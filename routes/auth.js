const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { sendInviteEmail } = require('../services/emailService');

const router = express.Router();

// Helper to generate a strong random password
function generateStrongPassword(length = 16) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = upper + lower + numbers + symbols;

  let pwd = '';
  // Ensure at least one of each
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

/**
 * 1. Generate Strong Password Helper API
 */
router.get('/generate-password', (req, res) => {
  const password = generateStrongPassword(16);
  res.json({ password });
});

/**
 * 2. Get Workspace Auth Status (Has Admin / Requires First Admin Setup)
 */
router.get('/status', (req, res) => {
  const users = db.getCollection('users');
  // Check if any real admin exists (excluding dummy/seed usr_admin_1)
  const realAdmins = users.filter(u => u.role === 'admin' && !u.isDummy && u.id !== 'usr_admin_1');
  const hasAdmin = realAdmins.length > 0;
  const requiresFirstAdminSetup = users.length === 0 || !hasAdmin;

  res.json({
    hasAdmin,
    totalUsers: users.length,
    realAdminsCount: realAdmins.length,
    requiresFirstAdminSetup
  });
});

/**
 * Reset Workspace Users for First Admin Setup Testing
 */
router.post('/reset-for-first-admin', (req, res) => {
  db.clearCollection('users');
  db.clearCollection('invitations');
  db.clearCollection('active_presences');
  db.clearCollection('pending_profile_updates');
  res.json({
    success: true,
    message: 'All user accounts reset. The first person to create an account now will become the Primary Admin!'
  });
});

/**
 * 3. User Login with Email & Password
 * Strict Guard: Nobody can log in without creating an account first!
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const users = db.getCollection('users');
  const realAdmins = users.filter(u => u.role === 'admin' && !u.isDummy && u.id !== 'usr_admin_1');
  const requiresFirstAdminSetup = users.length === 0 || realAdmins.length === 0;

  // If no admin exists yet, automatically initialize the first person who logs in as the Primary Admin!
  if (requiresFirstAdminSetup) {
    const defaultName = req.body.name || email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const newAdmin = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: defaultName,
      email: email.toLowerCase().trim(),
      password,
      role: 'admin',
      isFirstAdmin: true,
      department: 'Executive Leadership',
      title: 'Primary Administrator & Director',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      phone: '+92 329 0010909',
      joinDate: new Date().toISOString().split('T')[0],
      status: 'online',
      points: 2500,
      bio: 'Primary Administrator & Director at Stowave.',
      skills: ['Strategy', 'Leadership', 'Operations', 'E-Commerce']
    };

    db.addItem('users', newAdmin);
    // Clean up any old dummy usr_admin_1
    if (users.some(u => u.id === 'usr_admin_1')) {
      db.deleteItem('users', 'usr_admin_1');
    }

    const token = `jwt_${newAdmin.id}_${Date.now()}`;
    return res.status(201).json({
      message: `👑 Mubarak ho! Aap sb sy pehly login huye hain, is liye aap is workspace k Primary Admin ban gaye hain! Welcome, ${newAdmin.name}!`,
      user: newAdmin,
      token,
      becameAdmin: true
    });
  }

  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

  if (!user) {
    return res.status(401).json({ 
      error: 'Koi bhi bnda is may account bnaye baghair login nahi kar sakta. (No account found with this email. Please ask your administrator to send you an invitation link.)' 
    });
  }

  if (user.password !== password) {
    return res.status(401).json({ error: 'Ghalat password (Incorrect password). Barah-e-karam apna durust password darj karein.' });
  }

  // Update status to online
  db.updateItem('users', user.id, { status: 'online' });

  const token = `jwt_${user.id}_${Date.now()}`;
  res.json({
    message: `Welcome back to Stowave, ${user.name}! Login successful.`,
    user,
    token
  });
});

/**
 * 2. Register / Initialize Primary Admin Account
 * If user creates account and no real admin exists (or user specifies initialize),
 * they become the first primary live ADMIN!
 */
router.post('/register', (req, res) => {
  const { name, email, password, department, title, phone, bio } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const users = db.getCollection('users');
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  // Check if this is the first real admin setup
  const realAdmins = users.filter(u => u.role === 'admin' && !u.isDummy && u.id !== 'usr_admin_1');
  const isFirstAdminSetup = users.length === 0 || realAdmins.length === 0 || users.every(u => u.id === 'usr_admin_1');

  if (!isFirstAdminSetup && !req.body.inviteToken) {
    return res.status(403).json({ 
      error: 'Direct registration is disabled. You must be invited by an Administrator to create an account.' 
    });
  }

  const role = isFirstAdminSetup ? 'admin' : (req.body.role || 'member');

  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role,
    isFirstAdmin: role === 'admin',
    department: department || (role === 'admin' ? 'Executive Leadership' : 'General'),
    title: title || (role === 'admin' ? 'Primary Administrator & Director' : 'Team Associate'),
    avatar: req.body.avatar || `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 50000)}?auto=format&fit=crop&w=200&q=80`,
    phone: phone || '+92 300 0000000',
    joinDate: new Date().toISOString().split('T')[0],
    status: 'online',
    points: role === 'admin' ? 2500 : 500,
    bio: bio || `${role === 'admin' ? 'Primary Administrator' : 'Dedicated team member'} at Stowave Global.`,
    skills: ['Operations', 'Collaboration']
  };

  db.addItem('users', newUser);

  // If this was the first real admin, clean up the dummy seed user
  if (isFirstAdminSetup && users.some(u => u.id === 'usr_admin_1')) {
    db.deleteItem('users', 'usr_admin_1');
  }

  res.status(201).json({
    message: role === 'admin' ? '👑 Primary Admin account initialized successfully!' : 'Account registered successfully!',
    user: newUser,
    token: `jwt_${newUser.id}_${Date.now()}`
  });
});

/**
 * 3. Admin Invites a User (Link expires in 30 minutes)
 */
router.post('/invite', async (req, res) => {
  const { email, role = 'member', department = 'Operations', adminId, adminName } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required for invitation.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const users = db.getCollection('users');
  if (users.some(u => u.email.toLowerCase() === normalizedEmail)) {
    return res.status(400).json({ error: 'A team member with this email already has an active account.' });
  }

  // Generate 30-minute token
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

  const newInvite = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    email: normalizedEmail,
    role: role === 'admin' ? 'admin' : 'member',
    department,
    token,
    status: 'pending', // 'pending' | 'accepted' | 'expired'
    expiresAt,
    invitedBy: adminId || 'usr_admin',
    invitedByName: adminName || 'Stowave Admin',
    createdAt: new Date().toISOString()
  };

  db.addItem('invitations', newInvite);

  // Construct invite link based on host / origin
  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost:3000';
  const inviteLink = `${origin}/invite?token=${token}`;

  // Send real email via nodemailer
  let emailDispatched = false;
  try {
    const emailResult = await sendInviteEmail({
      to: normalizedEmail,
      inviteLink,
      role: newInvite.role,
      department: newInvite.department,
      invitedByName: newInvite.invitedByName
    });
    emailDispatched = emailResult.success;
  } catch (err) {
    console.error('Invite email error:', err.message);
  }

  res.status(201).json({
    message: `Invitation successfully created for ${normalizedEmail}. Link is valid for 30 minutes.`,
    invitation: newInvite,
    inviteLink,
    emailDispatched
  });
});

/**
 * 4. Verify Invitation Token
 */
router.get('/verify-invite', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token is required.' });
  }

  const invitations = db.getCollection('invitations');
  const invite = invitations.find(i => i.token === token);

  if (!invite) {
    return res.status(404).json({ valid: false, error: 'Invitation not found or link is invalid.' });
  }

  if (invite.status === 'accepted') {
    return res.status(400).json({ valid: false, error: 'This invitation has already been used and activated.' });
  }

  const isExpired = new Date(invite.expiresAt) < new Date();
  if (isExpired) {
    // Mark as expired in db
    db.updateItem('invitations', invite.id, { status: 'expired' });
    return res.status(410).json({
      valid: false,
      isExpired: true,
      error: 'This invitation link expired (links are valid for 30 minutes). Please contact your administrator.'
    });
  }

  // Calculate remaining seconds
  const remainingSeconds = Math.max(0, Math.floor((new Date(invite.expiresAt) - new Date()) / 1000));

  res.json({
    valid: true,
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      department: invite.department,
      expiresAt: invite.expiresAt,
      remainingSeconds,
      invitedByName: invite.invitedByName
    }
  });
});

/**
 * 5. Accept Invitation & Create Account
 */
router.post('/accept-invite', (req, res) => {
  const { token, name, password, avatar, phone, bio } = req.body;
  if (!token || !name || !password) {
    return res.status(400).json({ error: 'Token, name, and password are required.' });
  }

  const invitations = db.getCollection('invitations');
  const invite = invitations.find(i => i.token === token);

  if (!invite) {
    return res.status(404).json({ error: 'Invitation not found.' });
  }

  if (invite.status === 'accepted') {
    return res.status(400).json({ error: 'This invitation has already been accepted.' });
  }

  if (new Date(invite.expiresAt) < new Date()) {
    db.updateItem('invitations', invite.id, { status: 'expired' });
    return res.status(410).json({ error: 'This invitation expired after 30 minutes. Please request a new invite.' });
  }

  // Check if user already exists
  const users = db.getCollection('users');
  if (users.some(u => u.email.toLowerCase() === invite.email.toLowerCase())) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  // Create new active user
  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim(),
    email: invite.email,
    password,
    role: invite.role || 'member',
    department: invite.department || 'Operations',
    title: invite.role === 'admin' ? 'Stowave Operations Administrator' : 'Team Specialist',
    avatar: avatar || `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 50000)}?auto=format&fit=crop&w=200&q=80`,
    phone: phone || '+92 300 0000000',
    joinDate: new Date().toISOString().split('T')[0],
    status: 'online',
    points: 600,
    bio: bio || `Contributor in ${invite.department || 'Operations'}.`,
    skills: ['Operations', 'Collaboration', invite.department]
  };

  db.addItem('users', newUser);

  // Mark invite as accepted
  db.updateItem('invitations', invite.id, {
    status: 'accepted',
    acceptedAt: new Date().toISOString(),
    acceptedUserId: newUser.id
  });

  res.status(201).json({
    message: 'Welcome to Stowave! Account created and logged in successfully.',
    user: newUser,
    token: `jwt_${newUser.id}_${Date.now()}`
  });
});

/**
 * 6. Get All Invitations (Admin only)
 */
router.get('/invitations', (req, res) => {
  const invitations = db.getCollection('invitations');
  const now = new Date();

  // Annotate active/expired status dynamically
  const list = invitations.map(inv => {
    const isExpired = inv.status !== 'accepted' && new Date(inv.expiresAt) < now;
    return {
      ...inv,
      effectiveStatus: inv.status === 'accepted' ? 'accepted' : (isExpired ? 'expired' : 'pending'),
      remainingSeconds: Math.max(0, Math.floor((new Date(inv.expiresAt) - now) / 1000))
    };
  });

  res.json(list.reverse());
});

/**
 * 7. Delete / Revoke Invitation
 */
router.delete('/invitations/:id', (req, res) => {
  const success = db.deleteItem('invitations', req.params.id);
  if (!success) return res.status(404).json({ error: 'Invitation not found' });
  res.json({ message: 'Invitation revoked successfully' });
});

module.exports = router;
