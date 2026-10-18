const express = require('express');
const db = require('../db');
const { sendOtpEmail } = require('../services/emailService');

const router = express.Router();

/**
 * 1. Request Profile Update (Generates & Emails 6-Digit OTP)
 * Required before any changes (image, name, email, bio) can be saved!
 */
router.post('/request-update', async (req, res) => {
  const { userId, name, email, avatar, title, phone, bio } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const users = db.getCollection('users');
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Check if requested email is already used by another user
  if (email && email.toLowerCase() !== user.email.toLowerCase()) {
    const emailConflict = users.find(u => u.id !== userId && u.email.toLowerCase() === email.toLowerCase().trim());
    if (emailConflict) {
      return res.status(400).json({ error: 'This email is already in use by another team member.' });
    }
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  const pendingUpdate = {
    id: `pup_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    userId,
    otp,
    expiresAt,
    changes: {
      name: name !== undefined ? name.trim() : user.name,
      email: email !== undefined ? email.toLowerCase().trim() : user.email,
      avatar: avatar !== undefined ? avatar : user.avatar,
      title: title !== undefined ? title.trim() : user.title,
      phone: phone !== undefined ? phone.trim() : user.phone,
      bio: bio !== undefined ? bio.trim() : user.bio
    },
    createdAt: new Date().toISOString()
  };

  db.addItem('pending_profile_updates', pendingUpdate);

  // Send OTP to user's existing email
  let emailDispatched = false;
  try {
    const sendRes = await sendOtpEmail({
      to: user.email,
      otp,
      userName: user.name,
      action: 'Profile & Security Changes'
    });
    emailDispatched = sendRes.success;

    // If email is changing, also dispatch a copy to the new email
    if (email && email.toLowerCase().trim() !== user.email.toLowerCase()) {
      await sendOtpEmail({
        to: email.toLowerCase().trim(),
        otp,
        userName: name || user.name,
        action: 'Email Verification'
      }).catch(e => console.warn('New email OTP send warning:', e.message));
    }
  } catch (err) {
    console.error('OTP email dispatch error:', err.message);
  }

  res.json({
    success: true,
    updateId: pendingUpdate.id,
    targetEmail: user.email,
    newEmail: email && email.toLowerCase() !== user.email.toLowerCase() ? email.toLowerCase() : null,
    message: `Security OTP sent to ${user.email}. Enter the 6-digit code to apply changes.`,
    emailDispatched
  });
});

/**
 * 2. Verify OTP & Apply Profile Update
 */
router.post('/verify-update', (req, res) => {
  const { updateId, otp, userId } = req.body;
  if (!updateId || !otp) {
    return res.status(400).json({ error: 'Update ID and 6-digit OTP are required.' });
  }

  const updates = db.getCollection('pending_profile_updates');
  const pending = updates.find(p => p.id === updateId);

  if (!pending) {
    return res.status(404).json({ error: 'Update request not found or expired. Please submit your profile update again.' });
  }

  if (userId && pending.userId !== userId) {
    return res.status(403).json({ error: 'Unauthorized update request.' });
  }

  if (new Date(pending.expiresAt) < new Date()) {
    db.deleteItem('pending_profile_updates', pending.id);
    return res.status(410).json({ error: 'This OTP has expired (valid for 10 minutes). Please request a new code.' });
  }

  if (pending.otp.trim() !== otp.toString().trim()) {
    return res.status(400).json({ error: 'Invalid OTP code. Please check your email and try again.' });
  }

  // OTP is valid! Apply changes to user
  const updatedUser = db.updateItem('users', pending.userId, pending.changes);
  if (!updatedUser) {
    return res.status(404).json({ error: 'User could not be found to update.' });
  }

  // Clean up pending update
  db.deleteItem('pending_profile_updates', pending.id);

  res.json({
    success: true,
    message: 'Profile updated successfully!',
    user: updatedUser
  });
});

/**
 * 3. Resend OTP
 */
router.post('/resend-otp', async (req, res) => {
  const { updateId } = req.body;
  const updates = db.getCollection('pending_profile_updates');
  const pending = updates.find(p => p.id === updateId);

  if (!pending) {
    return res.status(404).json({ error: 'Pending update request not found.' });
  }

  const users = db.getCollection('users');
  const user = users.find(u => u.id === pending.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Generate fresh OTP and extend time
  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.updateItem('pending_profile_updates', pending.id, {
    otp: newOtp,
    expiresAt
  });

  await sendOtpEmail({
    to: user.email,
    otp: newOtp,
    userName: user.name,
    action: 'Resent OTP for Profile Update'
  });

  res.json({
    success: true,
    message: `A fresh 6-digit OTP has been sent to ${user.email}.`
  });
});

module.exports = router;
