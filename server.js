require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const { notifyTaskAssigned, notifyWorkApproved, notifyTaskRejected } = require('./services/emailService');
const { 
  alertAdmins,
  notifyWhatsAppTaskAssigned,
  notifyWhatsAppTaskSubmitted,
  notifyWhatsAppTaskApproved,
  notifyWhatsAppTaskRejected,
  notifyWhatsAppExtensionRequested,
  notifyWhatsAppExtensionReviewed,
  notifyWhatsAppInPortalAlert
} = require('./services/whatsappService');

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure MongoDB connection & sync on cold start
app.use(async (req, res, next) => {
  if (db.initPromise) {
    try {
      await db.initPromise;
    } catch (e) {
      // Graceful fallback to memory/file
    }
  }
  next();
});

// Mount Routers
const notificationsRouter = require('./routes/notifications');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const presenceRouter = require('./routes/presence');
const departmentsRouter = require('./routes/departments');

app.use('/api/notifications', notificationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/presence', presenceRouter);
app.use('/api/departments', departmentsRouter);

app.use('/api/upload', (req, res, next) => {
  req.url = '/upload';
  notificationsRouter(req, res, next);
});

// Helper: build live context for AI
function buildLiveCompanyContext(userContext = null) {
  const users = db.getCollection('users') || [];
  const tasks = db.getCollection('tasks') || [];
  const reports = db.getCollection('reports') || [];
  const surveys = db.getCollection('surveys') || [];
  const shoutouts = db.getCollection('shoutouts') || [];
  const gifts = db.getCollection('gifts') || [];
  const departments = db.getCollection('departments') || [];
  const presence = db.getCollection('presence') || [];
  const auditLogs = db.getCollection('audit_logs') || [];
  const leaves = db.getCollection('leaves') || [];
  const socialAccounts = db.getCollection('social_accounts') || [];
  const socialPosts = db.getCollection('social_posts') || [];
  const socialInbox = db.getCollection('social_inbox') || [];

  const pendingTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress');
  const reviewTasks = tasks.filter(t => t.status === 'review');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const activeSurveys = surveys.filter(s => s.status === 'active' && new Date(s.expiresAt) > new Date());
  const unreadDms = socialInbox.filter(i => i.status === 'unread');

  let currentUserSection = '';
  if (userContext && (userContext.name || userContext.id)) {
    const matchedUser = users.find(u => (userContext.id && u.id === userContext.id) || (userContext.email && u.email && u.email.toLowerCase() === userContext.email.toLowerCase())) || userContext;
    const userTasks = tasks.filter(t => t.assignedTo === matchedUser.id);
    const createdTasks = tasks.filter(t => t.assignedBy === matchedUser.id);

    currentUserSection = `
=== CURRENT AUTHENTICATED USER (WHO IS TALKING TO YOU) ===
- Name: ${matchedUser.name}
- Email: ${matchedUser.email}
- System Role: ${matchedUser.role === 'admin' ? 'Primary Director & Administrator (Full Authority & Leadership)' : 'Team Member / Specialist'}
- Department: ${matchedUser.department || 'General'}
- Designation / Title: ${matchedUser.title || 'Team Member'}
- Points / Reputation: ${matchedUser.points || 0} pts
- Profile Bio: ${matchedUser.bio || 'N/A'}
- Skills: ${(matchedUser.skills || []).join(', ') || 'N/A'}
- Tasks Directly Assigned to ${matchedUser.name} (${userTasks.length}):
${userTasks.length > 0 ? userTasks.map(t => `  • [${t.priority?.toUpperCase() || 'NORMAL'}] "${t.title}" | Status: ${t.status} | Due: ${t.dueDate || 'N/A'} | ID: ${t.id}`).join('\n') : '  • No direct tasks assigned.'}
- Tasks Created / Delegated by ${matchedUser.name} (${createdTasks.length}):
${createdTasks.length > 0 ? createdTasks.map(t => `  • "${t.title}" (Assigned to: ${users.find(u => u.id === t.assignedTo)?.name || t.assignedTo}, Status: ${t.status})`).join('\n') : '  • None.'}
=============================================================`;
  }

  return `
--- LIVE STOWAVE WORKSPACE & PORTAL DATA ---
Company Name: ${db.getSettings().companyName || 'Stowave Global'}
Portal Domain: https://team.stowave.com
${currentUserSection}

=== FULL TEAM DIRECTORY (${users.length} Members) ===
${users.map(u => `• ${u.name} | ${u.title} (${u.department}) | Role: ${u.role} | Status: ${u.status} | Points: ${u.points || 0} | Email: ${u.email}`).join('\n')}

=== COMPREHENSIVE TASKS OVERVIEW (${tasks.length} Total) ===
- In-Progress/To-Do: ${pendingTasks.length}
- Submitted / Awaiting Review: ${reviewTasks.length}
- Completed: ${completedTasks.length}
All Current Tasks:
${tasks.map(t => `• [${t.id}] "${t.title}" | Priority: ${t.priority} | Status: ${t.status} | Assigned: ${users.find(u => u.id === t.assignedTo)?.name || t.assignedTo} | Due: ${t.dueDate || 'N/A'}${t.submissionNotes ? ` | Note: ${t.submissionNotes}` : ''}${t.reviewFeedback ? ` | Feedback: ${t.reviewFeedback}` : ''}`).join('\n')}

=== DEPARTMENTS ===
${departments.map(d => `• ${d.name} (${d.membersCount || 0} members)`).join('\n') || '• Executive Leadership\n• Operations\n• Social Media Command'}

=== LIVE PRESENCE & ACTIVITY ===
${presence.map(p => `• ${p.userName || p.name}: ${p.status} (Active page: ${p.currentPage || '/'}, Heartbeat: ${new Date(p.lastHeartbeat || Date.now()).toLocaleTimeString()})`).join('\n') || '• Real-time presence tracking active.'}

=== RECENT AUDIT LOGS (Last Actions) ===
${auditLogs.slice(0, 8).map(l => `• [${l.timestamp || l.createdAt}] ${l.action}: ${l.details || ''}`).join('\n') || '• No recent audit events.'}

=== OMNICHANNEL SOCIAL COMMAND ===
- Channels: ${socialAccounts.map(a => `${a.name} (${a.handle}, ${a.followers} followers)`).join(', ') || 'Instagram, TikTok, LinkedIn, Facebook, Twitter, YouTube'}
- Published Broadcasts: ${socialPosts.length}
- Unread Social Inquiries / DMs: ${unreadDms.length}
- Strategy Health Score: 88/100 (Surging Velocity)

=== STANDUPS, FEEDBACK & LEAVES ===
- Active Surveys: ${activeSurveys.length}
- Pending Leaves: ${leaves.filter(l => l.status === 'pending').length}
- Kudos / Shoutouts: ${shoutouts.length}
- Gifts / Recognition: ${gifts.length}
--------------------------------------------`;
}

// ==========================================
// 1. HEALTH & METRICS / DASHBOARD STATS
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  const users = db.getCollection('users');
  const tasks = db.getCollection('tasks');
  const reports = db.getCollection('reports');
  const surveys = db.getCollection('surveys');
  const shoutouts = db.getCollection('shoutouts');
  const gifts = db.getCollection('gifts');
  const leaves = db.getCollection('leaves');

  const now = new Date();
  const activeSurveys = surveys.filter(s => s.status === 'active' && new Date(s.expiresAt) > now);

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const pendingReviews = tasks.filter(t => t.status === 'review').length;

  res.json({
    totalMembers: users.length,
    activeTasks: tasks.filter(t => t.status !== 'completed').length,
    completedTasks,
    completionRate,
    pendingReviews,
    pendingReports: reports.filter(r => r.status === 'pending').length,
    activeSurveysCount: activeSurveys.length,
    totalShoutouts: shoutouts.length,
    totalGifts: gifts.length,
    pendingLeaves: leaves.filter(l => l.status === 'pending').length
  });
});

// ==========================================
// 2. USERS & AUTHENTICATION
// ==========================================
app.get('/api/users', (req, res) => {
  const users = db.getCollection('users');
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { name, email, role, department, title, phone, bio, skills, avatar } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }
  const newUser = {
    id: `usr_${Date.now()}`,
    name,
    email,
    password: req.body.password || 'password123',
    role: role || 'member',
    department: department || 'Engineering',
    title: title || 'Team Associate',
    avatar: avatar || `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 9000000)}?auto=format&fit=crop&w=200&q=80`,
    phone: phone || '+1 (555) 000-0000',
    joinDate: new Date().toISOString().split('T')[0],
    status: 'online',
    points: 500,
    bio: bio || 'Dedicated team contributor.',
    skills: skills || ['Collaboration', 'Problem Solving']
  };
  const saved = db.addItem('users', newUser);
  res.status(201).json(saved);
});

app.put('/api/users/:id', (req, res) => {
  const updated = db.updateItem('users', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json(updated);
});

app.delete('/api/users/:id', (req, res) => {
  const success = db.deleteItem('users', req.params.id);
  if (!success) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User deleted successfully' });
});



// ==========================================
// 3. TASKS MANAGEMENT (FULL CRUD & WORKFLOW)
// ==========================================
// Helper: Dispatch in-portal notifications (like LinkedIn / WhatsApp / FB)
function createInPortalNotification({ userId, title, message, type = 'info', link = '/tasks', relatedId = '' }) {
  try {
    const newNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId, // Target user ID or 'admins' or 'all'
      title,
      message,
      type, // 'task_assigned', 'extension_requested', 'extension_approved', 'extension_declined', 'task_submitted', 'task_approved', 'task_rejected', 'general'
      link,
      relatedId,
      read: false,
      createdAt: new Date().toISOString()
    };
    db.addItem('notifications', newNotification);

    // Auto-dispatch WhatsApp notification to configured admin numbers (923290010909, 923184360458)
    notifyWhatsAppInPortalAlert({ title, message, type, link }).catch(err => {
      console.warn('Auto WhatsApp notification broadcast failed:', err.message);
    });

    return newNotification;
  } catch (err) {
    console.warn('Error creating in-portal notification:', err);
    return null;
  }
}

app.get('/api/tasks', (req, res) => {
  const { assignedTo, status, priority } = req.query;
  let tasks = db.getCollection('tasks');
  if (assignedTo) tasks = tasks.filter(t => t.assignedTo === assignedTo);
  if (status) tasks = tasks.filter(t => t.status === status);
  if (priority) tasks = tasks.filter(t => t.priority === priority);
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { 
    title, 
    description, 
    assignedTo, 
    assignedBy, 
    assignedByName,
    priority, 
    dueDate, 
    estimatedHours, 
    tags,
    images = [],
    pdfs = [],
    voiceUrl = '',
    attachments = []
  } = req.body;
  if (!title || !assignedTo) {
    return res.status(400).json({ error: 'Title and assigned team member are required.' });
  }
  const newTask = {
    id: `tsk_${Date.now()}`,
    title,
    description: description || '',
    assignedTo,
    assignedBy: assignedBy || 'usr_admin_1',
    assignedByName: assignedByName || '',
    priority: priority || 'medium',
    status: 'todo',
    dueDate: dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    estimatedHours: Number(estimatedHours) || 8,
    actualHours: 0,
    tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(s => s.trim()) : ['General']),
    images: Array.isArray(images) ? images : [],
    pdfs: Array.isArray(pdfs) ? pdfs : [],
    voiceUrl: voiceUrl || '',
    attachments: Array.isArray(attachments) ? attachments : [],
    submissionNotes: '',
    submissionLink: '',
    submissionImages: [],
    submissionPdfs: [],
    submissionVoice: '',
    submissionAttachments: [],
    reviewedBy: null,
    reviewFeedback: null,
    rating: null
  };
  const saved = db.addItem('tasks', newTask);

  // In-portal notification for Assignee
  createInPortalNotification({
    userId: newTask.assignedTo,
    title: '🚨 New Task Assigned',
    message: `You have been assigned: "${newTask.title}". Due date: ${newTask.dueDate}.`,
    type: 'task_assigned',
    link: '/tasks',
    relatedId: newTask.id
  });

  // Background notifications (Email + WhatsApp)
  const assignee = db.getCollection('users').find(u => u.id === assignedTo);
  if (assignee && assignee.email) {
    notifyTaskAssigned({
      to: assignee.email,
      taskTitle: title,
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      assigneeName: assignee.name
    }).catch(e => console.warn('Email notify error:', e.message));
  }

  // Rich WhatsApp dispatch to configured admin numbers (923290010909, 923184360458)
  notifyWhatsAppTaskAssigned({
    taskTitle: title,
    priority: newTask.priority,
    dueDate: newTask.dueDate,
    assigneeName: assignee?.name || 'Team Contributor',
    assignedByName: newTask.assignedByName || 'Leadership'
  }).catch(e => console.warn('WhatsApp task assigned alert error:', e.message));

  res.status(201).json(saved);
});

app.put('/api/tasks/:id', (req, res) => {
  const updated = db.updateItem('tasks', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  res.json(updated);
});

// Member submits work with image, pdf, voice note, and notes
app.post('/api/tasks/:id/submit', (req, res) => {
  const { 
    submissionNotes, 
    submissionLink, 
    actualHours,
    images = [],
    pdfs = [],
    voiceUrl = '',
    attachments = [],
    submittedBy = '',
    submittedByName = ''
  } = req.body;

  const task = db.getCollection('tasks').find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const updates = {
    status: 'review',
    submissionNotes: submissionNotes || 'Work completed and submitted for review.',
    submissionLink: submissionLink || '',
    actualHours: Number(actualHours) || 0,
    submissionImages: images,
    submissionPdfs: pdfs,
    submissionVoice: voiceUrl,
    submissionAttachments: attachments,
    submittedBy: submittedBy || task.assignedTo,
    submittedByName: submittedByName || '',
    submittedAt: new Date().toISOString()
  };
  const updated = db.updateItem('tasks', req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'Task not found' });

  // In-portal notification for Admins
  createInPortalNotification({
    userId: 'admins',
    title: '📤 Task Deliverables Submitted',
    message: `${updates.submittedByName || 'Team Member'} has submitted deliverables for "${task.title}". Click to review.`,
    type: 'task_submitted',
    link: '/tasks',
    relatedId: task.id
  });

  // Rich WhatsApp dispatch
  notifyWhatsAppTaskSubmitted({
    taskTitle: task.title,
    submittedByName: updates.submittedByName || 'Team Member',
    notes: updates.submissionNotes,
    actualHours: updates.actualHours
  }).catch(e => console.warn('WhatsApp task submitted alert error:', e.message));

  res.json(updated);
});

// Member / Admin deletes submission for everyone within 30 minutes
app.post('/api/tasks/:id/unsubmit', (req, res) => {
  const task = db.getCollection('tasks').find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (!task.submittedAt) {
    return res.status(400).json({ error: 'Task is not currently submitted.' });
  }

  if (task.status === 'completed') {
    return res.status(400).json({ error: 'Admin pehlay hi deliverable approve kar chukay hain. Ab delete nahi kiya ja sakta.' });
  }

  // Enforce 30-minute window
  const submittedTime = new Date(task.submittedAt).getTime();
  const elapsedMs = Date.now() - submittedTime;
  const THIRTY_MINUTES_MS = 30 * 60 * 1000;

  if (elapsedMs > THIRTY_MINUTES_MS) {
    return res.status(400).json({ 
      error: '30 minute ka time guzar chuka hai. Ab submission delete nahi ho sakti.',
      elapsedMinutes: Math.floor(elapsedMs / 60000)
    });
  }

  const updates = {
    status: 'in_progress',
    submissionNotes: '',
    submissionLink: '',
    submissionImages: [],
    submissionPdfs: [],
    submissionVoice: '',
    submissionAttachments: [],
    submittedAt: null,
    deletedSubmissionLog: {
      deletedAt: new Date().toISOString(),
      deletedBy: req.body.userId || 'Member',
      message: 'Submission deleted for everyone within 30-minute grace window.'
    }
  };

  const updated = db.updateItem('tasks', req.params.id, updates);
  res.json({
    message: 'Submission successfully deleted for everyone. Task reverted to In Progress.',
    task: updated
  });
});

// Admin reviews work (Approve / Reject / Rate)
app.post('/api/tasks/:id/review', async (req, res) => {
  const { status, reviewFeedback, rating, reviewerId } = req.body; // status: 'completed' or 'in_progress' / 'rejected'
  const task = db.getCollection('tasks').find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Enforce Admin Verification
  const users = db.getCollection('users');
  const reviewer = users.find(u => u.id === reviewerId);
  if (reviewer && reviewer.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Only an Administrator can approve or reject submitted deliverables.' });
  }

  const isApproved = status === 'completed';
  const numericRating = rating !== undefined && rating !== null && rating !== '' ? Number(rating) : null;
  const awardPoints = isApproved ? (numericRating ? numericRating * 20 : 100) : 0;

  const updates = {
    status: isApproved ? 'completed' : 'rejected',
    reviewedBy: reviewerId || 'usr_admin_1',
    reviewedByName: reviewer?.name || 'Administrator',
    reviewFeedback: reviewFeedback || (isApproved ? 'Deliverable approved with excellence!' : 'Deliverable requires revision. Please update and re-submit.'),
    rating: numericRating,
    reviewedAt: new Date().toISOString()
  };
  const updated = db.updateItem('tasks', req.params.id, updates);

  // If approved, reward points to user
  const assignee = users.find(u => u.id === task.assignedTo);
  if (isApproved && assignee) {
    db.updateItem('users', assignee.id, { points: (assignee.points || 0) + awardPoints });
  }

  // Dispatch Email Notification to Assignee
  if (assignee && assignee.email) {
    if (isApproved) {
      notifyWorkApproved({
        to: assignee.email,
        taskTitle: task.title,
        rating: numericRating,
        feedback: updates.reviewFeedback,
        pointsAwarded: awardPoints,
        memberName: assignee.name
      }).catch(err => console.warn('Approval email dispatch failed:', err.message));
    } else {
      notifyTaskRejected({
        to: assignee.email,
        taskTitle: task.title,
        reason: updates.reviewFeedback,
        memberName: assignee.name
      }).catch(err => console.warn('Rejection email dispatch failed:', err.message));
    }
  }

  // Rich WhatsApp dispatch to configured numbers
  if (isApproved) {
    notifyWhatsAppTaskApproved({
      taskTitle: task.title,
      memberName: assignee?.name || 'Team Member',
      rating: numericRating || 5,
      pointsAwarded: awardPoints,
      feedback: updates.reviewFeedback
    }).catch(err => console.warn('Approval WhatsApp dispatch failed:', err.message));
  } else {
    notifyWhatsAppTaskRejected({
      taskTitle: task.title,
      memberName: assignee?.name || 'Team Member',
      reason: updates.reviewFeedback
    }).catch(err => console.warn('Rejection WhatsApp dispatch failed:', err.message));
  }

  // In-portal notification for Assignee
  createInPortalNotification({
    userId: task.assignedTo,
    title: isApproved ? '🎉 Task Deliverable Approved!' : '⚠️ Task Revision Requested',
    message: isApproved 
      ? `Admin approved "${task.title}"! Rating: ${numericRating ? `${numericRating}/5 Stars ⭐` : 'Approved'}. +${awardPoints} points awarded.`
      : `Admin requested revisions on "${task.title}": "${updates.reviewFeedback}"`,
    type: isApproved ? 'task_approved' : 'task_rejected',
    link: '/tasks',
    relatedId: task.id
  });

  res.json({
    message: isApproved ? 'Task deliverable approved and email dispatched!' : 'Task rejected / revisions requested and email dispatched!',
    task: updated
  });
});

app.delete('/api/tasks/:id', (req, res) => {
  const success = db.deleteItem('tasks', req.params.id);
  if (!success) return res.status(404).json({ error: 'Task not found' });
  res.json({ message: 'Task deleted successfully' });
});

// Member requests extra time / deadline extension
app.post('/api/tasks/:id/request-extension', (req, res) => {
  const { requestedDueDate, requestedHours, reason, userId } = req.body;
  const task = db.getCollection('tasks').find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!requestedDueDate) return res.status(400).json({ error: 'New requested deadline is required.' });

  const users = db.getCollection('users') || [];
  const member = users.find(u => u.id === userId) || users.find(u => u.id === task.assignedTo);

  const updates = {
    extensionRequested: true,
    extensionStatus: 'pending', // 'pending' | 'approved' | 'declined'
    requestedDueDate,
    requestedHours: Number(requestedHours) || 0,
    extensionReason: reason || 'More time requested to complete deliverables.',
    extensionRequestedAt: new Date().toISOString(),
    extensionRequestedBy: member?.id || userId,
    extensionRequestedByName: member?.name || 'Team Member'
  };

  const updated = db.updateItem('tasks', req.params.id, updates);

  // In-portal notification for Admins
  createInPortalNotification({
    userId: 'admins',
    title: '⏳ Deadline Extension Requested',
    message: `${member?.name || 'Team Member'} has requested extra time for "${task.title}" until ${requestedDueDate}. Reason: "${updates.extensionReason}"`,
    type: 'extension_requested',
    link: '/tasks',
    relatedId: task.id
  });

  // Rich WhatsApp dispatch
  notifyWhatsAppExtensionRequested({
    taskTitle: task.title,
    memberName: member?.name || 'Team Member',
    requestedDueDate,
    reason: updates.extensionReason
  }).catch(err => console.warn('Extension request WhatsApp error:', err.message));

  res.json(updated);
});

// Admin approves or declines extension request
app.post('/api/tasks/:id/review-extension', (req, res) => {
  const { approved, adminNotes, reviewerId } = req.body;
  const task = db.getCollection('tasks').find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const users = db.getCollection('users') || [];
  const reviewer = users.find(u => u.id === reviewerId);
  if (reviewer && reviewer.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can approve or decline extension requests.' });
  }

  const isApproved = Boolean(approved);
  const updates = {
    extensionStatus: isApproved ? 'approved' : 'declined',
    extensionReviewedAt: new Date().toISOString(),
    extensionReviewedBy: reviewerId || 'usr_admin_1',
    extensionReviewedByName: reviewer?.name || 'Administrator',
    extensionReviewNotes: adminNotes || (isApproved ? 'Extension granted.' : 'Extension declined.')
  };

  if (isApproved && task.requestedDueDate) {
    updates.dueDate = task.requestedDueDate;
    if (task.requestedHours) {
      updates.estimatedHours = (task.estimatedHours || 0) + Number(task.requestedHours);
    }
  }

  const updated = db.updateItem('tasks', req.params.id, updates);

  // In-portal notification for Assignee
  createInPortalNotification({
    userId: task.assignedTo,
    title: isApproved ? '✅ Deadline Extension Approved!' : '❌ Extension Request Declined',
    message: isApproved 
      ? `Admin approved your extra time request for "${task.title}". New deadline: ${updates.dueDate || task.requestedDueDate}.`
      : `Your deadline extension request for "${task.title}" was declined: "${updates.extensionReviewNotes}"`,
    type: isApproved ? 'extension_approved' : 'extension_declined',
    link: '/tasks',
    relatedId: task.id
  });

  // Rich WhatsApp dispatch
  notifyWhatsAppExtensionReviewed({
    taskTitle: task.title,
    approved: isApproved,
    memberName: task.assignedByName || 'Team Member',
    notes: updates.extensionReviewNotes
  }).catch(e => console.warn('Extension review WhatsApp error:', e.message));

  res.json(updated);
});

// ==========================================
// 3B. IN-PORTAL NOTIFICATIONS (LINKEDIN / FB / WHATSAPP STYLE)
// ==========================================
app.get('/api/notifications', (req, res) => {
  const { userId } = req.query;
  const allNotifs = db.getCollection('notifications') || [];
  const users = db.getCollection('users') || [];
  const requestingUser = users.find(u => u.id === userId);
  const isAdmin = requestingUser?.role === 'admin';

  const userNotifs = allNotifs.filter(n => {
    if (n.userId === 'all') return true;
    if (isAdmin && n.userId === 'admins') return true;
    return n.userId === userId;
  });

  userNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(userNotifs);
});

app.put('/api/notifications/:id/read', (req, res) => {
  const updated = db.updateItem('notifications', req.params.id, { read: true });
  res.json(updated || { success: true });
});

app.post('/api/notifications/mark-all-read', (req, res) => {
  const { userId } = req.body;
  const users = db.getCollection('users') || [];
  const requestingUser = users.find(u => u.id === userId);
  const isAdmin = requestingUser?.role === 'admin';
  const allNotifs = db.getCollection('notifications') || [];

  allNotifs.forEach(n => {
    const isTarget = n.userId === userId || n.userId === 'all' || (isAdmin && n.userId === 'admins');
    if (isTarget && !n.read) {
      db.updateItem('notifications', n.id, { read: true });
    }
  });

  res.json({ success: true });
});

app.delete('/api/notifications/:id', (req, res) => {
  db.deleteItem('notifications', req.params.id);
  res.json({ success: true });
});

// ==========================================
// 4. WORK REPORTS & DAILY/WEEKLY STANDUPS
// ==========================================
app.get('/api/reports', (req, res) => {
  const { userId, type } = req.query;
  let reports = db.getCollection('reports');
  if (userId) reports = reports.filter(r => r.userId === userId);
  if (type) reports = reports.filter(r => r.type === type);
  res.json(reports);
});

app.post('/api/reports', (req, res) => {
  const { userId, type, achievements, plannedNext, blockers, hoursWorked } = req.body;
  if (!userId || !achievements) {
    return res.status(400).json({ error: 'User ID and Achievements are required.' });
  }
  const newReport = {
    id: `rep_${Date.now()}`,
    userId,
    type: type || 'daily',
    date: new Date().toISOString().split('T')[0],
    achievements,
    plannedNext: plannedNext || 'Continue project deliverables.',
    blockers: blockers || 'No major blockers.',
    hoursWorked: Number(hoursWorked) || 8,
    rating: null,
    adminFeedback: null,
    status: 'pending'
  };
  const saved = db.addItem('reports', newReport);
  res.status(201).json(saved);
});

app.put('/api/reports/:id/review', (req, res) => {
  const { rating, adminFeedback } = req.body;
  const updates = {
    rating: Number(rating) || 5,
    adminFeedback: adminFeedback || 'Acknowledged and reviewed.',
    status: 'reviewed',
    reviewedAt: new Date().toISOString()
  };
  const updated = db.updateItem('reports', req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'Report not found' });
  res.json(updated);
});

app.delete('/api/reports/:id', (req, res) => {
  const success = db.deleteItem('reports', req.params.id);
  if (!success) return res.status(404).json({ error: 'Report not found' });
  res.json({ message: 'Report deleted' });
});

// ==========================================
// 5. FEEDBACK PAGES & SURVEYS WITH DURATION
// ==========================================
app.get('/api/surveys', (req, res) => {
  const surveys = db.getCollection('surveys');
  const responses = db.getCollection('survey_responses');
  // Enrich surveys with response stats
  const enriched = surveys.map(s => {
    const sResponses = responses.filter(r => r.surveyId === s.id);
    const isExpired = new Date(s.expiresAt) < new Date();
    return {
      ...s,
      responseCount: sResponses.length,
      isExpired,
      effectiveStatus: isExpired ? 'closed' : s.status
    };
  });
  res.json(enriched);
});

app.post('/api/surveys', (req, res) => {
  const { title, description, targetType, durationHours, isAnonymous, questions, createdBy } = req.body;
  if (!title) return res.status(400).json({ error: 'Survey title is required.' });

  const hours = Number(durationHours) || 48;
  const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();

  const newSurvey = {
    id: `srv_${Date.now()}`,
    title,
    description: description || 'Please provide your honest feedback.',
    targetType: targetType || 'general',
    durationHours: hours,
    expiresAt,
    isAnonymous: Boolean(isAnonymous),
    questions: Array.isArray(questions) && questions.length > 0 ? questions : [
      { id: 'q1', text: 'How do you rate the clarity of strategic leadership?', type: 'rating' },
      { id: 'q2', text: 'What suggestions do you have to improve our workflow?', type: 'text' }
    ],
    createdBy: createdBy || 'usr_admin_1',
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  const saved = db.addItem('surveys', newSurvey);
  res.status(201).json(saved);
});

app.get('/api/surveys/:id', (req, res) => {
  const survey = db.getCollection('surveys').find(s => s.id === req.params.id);
  if (!survey) return res.status(404).json({ error: 'Survey not found' });
  const responses = db.getCollection('survey_responses').filter(r => r.surveyId === req.params.id);
  res.json({ survey, responses });
});

app.post('/api/surveys/:id/respond', (req, res) => {
  const { respondentId, answers } = req.body;
  const survey = db.getCollection('surveys').find(s => s.id === req.params.id);
  if (!survey) return res.status(404).json({ error: 'Survey not found' });

  if (new Date(survey.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'This feedback survey has expired and is no longer accepting responses.' });
  }

  const responseObj = {
    id: `srvr_${Date.now()}`,
    surveyId: req.params.id,
    respondentId: survey.isAnonymous ? 'anonymous' : (respondentId || 'usr_anonymous'),
    answers: answers || [],
    submittedAt: new Date().toISOString()
  };

  const saved = db.addItem('survey_responses', responseObj);

  // Reward points for feedback participation
  if (respondentId && respondentId !== 'anonymous') {
    const user = db.getCollection('users').find(u => u.id === respondentId);
    if (user) {
      db.updateItem('users', user.id, { points: (user.points || 0) + 50 });
    }
  }

  res.status(201).json(saved);
});

app.delete('/api/surveys/:id', (req, res) => {
  const success = db.deleteItem('surveys', req.params.id);
  if (!success) return res.status(404).json({ error: 'Survey not found' });
  res.json({ message: 'Survey deleted' });
});

// ==========================================
// 6. PEER RATINGS, SHOUT-OUTS & GIFTING
// ==========================================
app.get('/api/peer-ratings', (req, res) => {
  const ratings = db.getCollection('peer_ratings');
  res.json(ratings);
});

app.post('/api/peer-ratings', (req, res) => {
  const { fromUserId, toUserId, criteria, comment } = req.body;
  if (!fromUserId || !toUserId) {
    return res.status(400).json({ error: 'Both rater and recipient are required.' });
  }
  if (fromUserId === toUserId) {
    return res.status(400).json({ error: 'You cannot rate yourself.' });
  }

  const crit = criteria || { collaboration: 5, skill: 5, communication: 5, reliability: 5 };
  const vals = Object.values(crit);
  const overallScore = vals.length > 0 ? (vals.reduce((a, b) => a + Number(b), 0) / vals.length).toFixed(2) : 5.0;

  const newRating = {
    id: `pr_${Date.now()}`,
    fromUserId,
    toUserId,
    criteria: crit,
    overallScore: parseFloat(overallScore),
    comment: comment || 'Great peer contribution!',
    createdAt: new Date().toISOString()
  };

  const saved = db.addItem('peer_ratings', newRating);

  // Recipient earns points
  const recipient = db.getCollection('users').find(u => u.id === toUserId);
  if (recipient) {
    db.updateItem('users', toUserId, { points: (recipient.points || 0) + Math.round(overallScore * 10) });
  }

  res.status(201).json(saved);
});

app.delete('/api/peer-ratings/:id', (req, res) => {
  const deleted = db.deleteItem('peer_ratings', req.params.id);
  res.json({ success: deleted });
});

app.get('/api/shoutouts', (req, res) => {
  const shoutouts = db.getCollection('shoutouts');
  res.json(shoutouts);
});

app.delete('/api/shoutouts/:id', (req, res) => {
  const deleted = db.deleteItem('shoutouts', req.params.id);
  res.json({ success: deleted });
});

app.delete('/api/gifts/:id', (req, res) => {
  const deleted = db.deleteItem('gifts', req.params.id);
  res.json({ success: deleted });
});

app.post('/api/shoutouts', (req, res) => {
  const { fromUserId, toUserId, message, category } = req.body;
  if (!message || !toUserId) {
    return res.status(400).json({ error: 'Message and recipient are required.' });
  }
  const newShoutout = {
    id: `sho_${Date.now()}`,
    fromUserId: fromUserId || 'usr_admin_1',
    toUserId,
    message,
    category: category || 'teamwork',
    reactions: { claps: 1, hearts: 1, fire: 1 },
    createdAt: new Date().toISOString()
  };
  const saved = db.addItem('shoutouts', newShoutout);

  // Recipient earns points
  const recipient = db.getCollection('users').find(u => u.id === toUserId);
  if (recipient) {
    db.updateItem('users', toUserId, { points: (recipient.points || 0) + 30 });
  }

  res.status(201).json(saved);
});

app.post('/api/shoutouts/:id/react', (req, res) => {
  const { reaction } = req.body; // 'claps', 'hearts', 'fire'
  const shoutout = db.getCollection('shoutouts').find(s => s.id === req.params.id);
  if (!shoutout) return res.status(404).json({ error: 'Shoutout not found' });

  const reactions = { ...shoutout.reactions };
  reactions[reaction] = (reactions[reaction] || 0) + 1;

  const updated = db.updateItem('shoutouts', req.params.id, { reactions });
  res.json(updated);
});

app.get('/api/gifts', (req, res) => {
  const gifts = db.getCollection('gifts');
  res.json(gifts);
});

app.post('/api/gifts', (req, res) => {
  const { fromUserId, toUserId, giftType, title, points, personalNote } = req.body;
  if (!fromUserId || !toUserId) {
    return res.status(400).json({ error: 'Sender and recipient required.' });
  }

  const cost = Number(points) || 100;
  const sender = db.getCollection('users').find(u => u.id === fromUserId);
  const recipient = db.getCollection('users').find(u => u.id === toUserId);

  if (!sender || !recipient) {
    return res.status(404).json({ error: 'Sender or recipient not found.' });
  }

  // Deduct from sender if not admin, or grant points
  if (sender.role !== 'admin' && (sender.points || 0) < cost) {
    return res.status(400).json({ error: `Insufficient points. You have ${sender.points} points.` });
  }

  if (sender.role !== 'admin') {
    db.updateItem('users', sender.id, { points: sender.points - cost });
  }
  db.updateItem('users', recipient.id, { points: (recipient.points || 0) + cost });

  const newGift = {
    id: `gft_${Date.now()}`,
    fromUserId,
    toUserId,
    giftType: giftType || 'badge_mvp',
    title: title || 'Appreciation Gift',
    points: cost,
    personalNote: personalNote || 'Thank you for your incredible work!',
    createdAt: new Date().toISOString()
  };

  const saved = db.addItem('gifts', newGift);
  res.status(201).json(saved);
});

app.get('/api/leaderboard', (req, res) => {
  const users = db.getCollection('users');
  const tasks = db.getCollection('tasks');
  const peerRatings = db.getCollection('peer_ratings');
  const shoutouts = db.getCollection('shoutouts');

  const leaderboard = users.map(u => {
    const userTasks = tasks.filter(t => t.assignedTo === u.id && t.status === 'completed');
    const userRatings = peerRatings.filter(r => r.toUserId === u.id);
    const avgRating = userRatings.length > 0
      ? (userRatings.reduce((sum, r) => sum + r.overallScore, 0) / userRatings.length).toFixed(1)
      : '5.0';
    const userShoutouts = shoutouts.filter(s => s.toUserId === u.id).length;

    return {
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      title: u.title,
      department: u.department,
      role: u.role,
      points: u.points || 0,
      completedTasks: userTasks.length,
      averageRating: parseFloat(avgRating),
      shoutoutsReceived: userShoutouts
    };
  }).sort((a, b) => b.points - a.points);

  res.json(leaderboard);
});

// ==========================================
// 7. LEAVE MANAGEMENT & ANNOUNCEMENTS
// ==========================================
app.get('/api/leaves', (req, res) => {
  const leaves = db.getCollection('leaves');
  res.json(leaves);
});

app.post('/api/leaves', (req, res) => {
  const { userId, type, startDate, endDate, reason } = req.body;
  if (!userId || !startDate || !endDate) {
    return res.status(400).json({ error: 'User ID, start date, and end date required.' });
  }
  const newLeave = {
    id: `lev_${Date.now()}`,
    userId,
    type: type || 'casual',
    startDate,
    endDate,
    reason: reason || 'Personal leave request',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null
  };
  const saved = db.addItem('leaves', newLeave);
  res.status(201).json(saved);
});

app.put('/api/leaves/:id/status', (req, res) => {
  const { status, reviewerId } = req.body; // 'approved' or 'rejected'
  const updates = {
    status: status || 'approved',
    reviewedBy: reviewerId || 'usr_admin_1',
    reviewedAt: new Date().toISOString()
  };
  const updated = db.updateItem('leaves', req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'Leave not found' });
  res.json(updated);
});

app.get('/api/announcements', (req, res) => {
  const ann = db.getCollection('announcements');
  res.json(ann);
});

app.post('/api/announcements', (req, res) => {
  const { title, content, priority, pinned, authorId } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required.' });
  const newAnn = {
    id: `ann_${Date.now()}`,
    title,
    content,
    priority: priority || 'normal',
    pinned: Boolean(pinned),
    authorId: authorId || 'usr_admin_1',
    createdAt: new Date().toISOString()
  };
  const saved = db.addItem('announcements', newAnn);
  res.status(201).json(saved);
});

app.delete('/api/announcements/:id', (req, res) => {
  const success = db.deleteItem('announcements', req.params.id);
  if (!success) return res.status(404).json({ error: 'Announcement not found' });
  res.json({ message: 'Deleted' });
});

// ==========================================
// 8. SETTINGS & AUDIT LOGS
// ==========================================
app.get('/api/settings', (req, res) => {
  const data = db.read();
  res.json(data.settings || {});
});

app.put('/api/settings', (req, res) => {
  const data = db.read();
  data.settings = { ...data.settings, ...req.body };
  db.write(data);
  res.json(data.settings);
});

app.get('/api/audit-logs', (req, res) => {
  const logs = db.getCollection('audit_logs');
  res.json(logs.slice(0, 50));
});

// Helper: execute real portal actions triggered by AI
function executeAiAction(actionObj, userContext) {
  if (!actionObj || !actionObj.type) return null;
  const users = db.getCollection('users') || [];
  const tasks = db.getCollection('tasks') || [];

  const type = String(actionObj.type).toUpperCase().trim();
  const params = actionObj.params || actionObj.data || {};

  try {
    if (type === 'CREATE_TASK' || type === 'ASSIGN_TASK') {
      const assignTarget = (params.assignedTo || params.assignee || params.member || params.user || '').toLowerCase().trim();
      let assignee = null;
      if (assignTarget) {
        assignee = users.find(u => 
          (u.id && u.id.toLowerCase() === assignTarget) || 
          (u.name && u.name.toLowerCase().includes(assignTarget)) ||
          (u.name && assignTarget.includes(u.name.toLowerCase())) ||
          (u.email && u.email.toLowerCase().includes(assignTarget))
        );
      }
      if (!assignee) {
        assignee = users.find(u => u.id !== userContext?.id) || users[0];
      }

      const newTask = {
        id: `tsk_${Date.now()}`,
        title: params.title || 'Assigned Workspace Task',
        description: params.description || `Task assigned via AI Assistant by ${userContext?.name || 'Administrator'}`,
        assignedTo: assignee ? assignee.id : (userContext?.id || 'usr_admin_1'),
        assignedBy: userContext?.id || 'usr_admin_1',
        assignedByName: userContext?.name || 'Administrator',
        priority: (params.priority || 'medium').toLowerCase(),
        status: 'todo',
        dueDate: params.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        estimatedHours: 8,
        actualHours: 0,
        tags: ['AI-Assigned', assignee?.department || 'General'],
        images: [],
        pdfs: [],
        voiceUrl: '',
        attachments: [],
        submissionNotes: '',
        submissionLink: '',
        submissionImages: [],
        submissionPdfs: [],
        submissionVoice: '',
        submissionAttachments: [],
        reviewedBy: null,
        reviewFeedback: null,
        rating: null
      };

      const saved = db.addItem('tasks', newTask);

      createInPortalNotification({
        userId: newTask.assignedTo,
        title: '🚨 New Task Assigned by AI',
        message: `You have been assigned: "${newTask.title}". Due date: ${newTask.dueDate}.`,
        type: 'task_assigned',
        link: '/tasks',
        relatedId: newTask.id
      });

      notifyWhatsAppTaskAssigned({
        taskTitle: newTask.title,
        priority: newTask.priority,
        dueDate: newTask.dueDate,
        assigneeName: assignee?.name || 'Team Contributor',
        assignedByName: 'Stowave AI Strategic Advisor'
      }).catch(e => console.warn('AI task assigned WhatsApp error:', e.message));

      db.addItem('audit_logs', {
        id: `log_${Date.now()}`,
        userId: userContext?.id || 'ai_copilot',
        action: 'AI_CREATE_TASK',
        details: `AI created and assigned task: "${newTask.title}" to ${assignee?.name || 'team member'}`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      return {
        success: true,
        type: 'CREATE_TASK',
        task: saved,
        message: `\n\n> ⚡ **Action Executed:** Task *"${newTask.title}"* has been created and assigned to **${assignee?.name || 'Team Member'}**! [View in Tasks](/tasks)`
      };
    }

    if (type === 'APPROVE_TASK') {
      const query = (params.taskTitleOrId || params.taskId || params.title || '').toLowerCase().trim();
      let task = null;
      if (query && query.length > 1) {
        task = tasks.find(t => 
          (t.id && t.id.toLowerCase() === query) || 
          (t.title && t.title.toLowerCase().includes(query)) ||
          (t.title && query.includes(t.title.toLowerCase()))
        );
      }
      if (!task) {
        task = tasks.find(t => t.status === 'review') || tasks.find(t => t.status !== 'completed') || tasks[tasks.length - 1];
      }

      if (!task) return { success: false, error: 'Task not found to approve.' };

      const rating = Number(params.rating) || 5;
      const awardPoints = rating * 20;
      const updates = {
        status: 'completed',
        reviewedBy: userContext?.id || 'usr_admin_1',
        reviewedByName: userContext?.name || 'Administrator',
        reviewFeedback: params.feedback || 'Deliverable approved with excellence by Admin via AI!',
        rating: rating,
        reviewedAt: new Date().toISOString()
      };

      const updated = db.updateItem('tasks', task.id, updates);
      const assignee = users.find(u => u.id === task.assignedTo);
      if (assignee) {
        db.updateItem('users', assignee.id, { points: (assignee.points || 0) + awardPoints });
      }

      createInPortalNotification({
        userId: task.assignedTo,
        title: '🎉 Task Deliverable Approved by Admin',
        message: `Admin approved "${task.title}"! Rating: ${rating}/5 ⭐. +${awardPoints} points awarded.`,
        type: 'task_approved',
        link: '/tasks',
        relatedId: task.id
      });

      notifyWhatsAppTaskApproved({
        taskTitle: task.title,
        memberName: assignee?.name || 'Team Member',
        rating: rating,
        pointsAwarded: awardPoints,
        feedback: updates.reviewFeedback
      }).catch(e => console.warn('AI approval WhatsApp error:', e.message));

      db.addItem('audit_logs', {
        id: `log_${Date.now()}`,
        userId: userContext?.id || 'admin',
        action: 'AI_APPROVE_TASK',
        details: `AI approved task: "${task.title}" with rating ${rating}/5`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      return {
        success: true,
        type: 'APPROVE_TASK',
        task: updated,
        message: `\n\n> ⚡ **Action Executed:** Task *"${task.title}"* has been approved and marked as completed! (+${awardPoints} points awarded to **${assignee?.name || 'assignee'}**) [View in Tasks](/tasks)`
      };
    }

    if (type === 'UPDATE_TASK') {
      const query = (params.taskTitleOrId || params.taskId || params.title || '').toLowerCase().trim();
      let task = null;
      if (query) {
        task = tasks.find(t => 
          (t.id && t.id.toLowerCase() === query) || 
          (t.title && t.title.toLowerCase().includes(query)) ||
          (t.title && query.includes(t.title.toLowerCase()))
        );
      }
      if (!task) task = tasks[0];
      if (!task) return { success: false, error: 'Task not found.' };

      const updates = {};
      if (params.status) updates.status = params.status;
      if (params.priority) updates.priority = params.priority;
      const updated = db.updateItem('tasks', task.id, updates);

      return {
        success: true,
        type: 'UPDATE_TASK',
        task: updated,
        message: `\n\n> ⚡ **Action Executed:** Task *"${task.title}"* updated to status **${params.status || task.status}**! [View in Tasks](/tasks)`
      };
    }

    if (type === 'DELETE_TASK') {
      const query = (params.taskTitleOrId || params.taskId || params.title || '').toLowerCase().trim();
      let task = null;
      if (query) {
        task = tasks.find(t => 
          (t.id && t.id.toLowerCase() === query) || 
          (t.title && t.title.toLowerCase().includes(query)) ||
          (t.title && query.includes(t.title.toLowerCase()))
        );
      }
      if (!task) return { success: false, error: 'Task not found.' };

      db.deleteItem('tasks', task.id);
      return {
        success: true,
        type: 'DELETE_TASK',
        message: `\n\n> ⚡ **Action Executed:** Task *"${task.title}"* has been deleted.`
      };
    }
  } catch (err) {
    console.error('Error executing AI action:', err);
  }
  return null;
}

// ==========================================
// 9. AI EXECUTIVE ASSISTANT (GROQ + HF + VISION + LIVE SEARCH)
// ==========================================
app.post('/api/ai/chat', async (req, res) => {
  const { message, history = [], searchTrends = false, userContext = null } = req.body;
  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    return res.status(500).json({ error: 'Groq API Key not configured.' });
  }

  try {
    const liveContext = buildLiveCompanyContext(userContext);

    // If web search is requested, fetch real-time trend info
    let webContext = '';
    if (searchTrends || message.toLowerCase().includes('trend') || message.toLowerCase().includes('market') || message.toLowerCase().includes('search')) {
      try {
        const queryTerm = encodeURIComponent(message.replace(/trend|trends|search|latest/gi, '').trim() || 'team productivity management trends 2026');
        const searchResp = await fetch(`https://api.duckduckgo.com/?q=${queryTerm}&format=json&no_html=1&skip_disambig=1`);
        const searchData = await searchResp.json();
        if (searchData.AbstractText) {
          webContext = `\n[LIVE INTERNET SEARCH VERIFICATION RESULT]:\n${searchData.AbstractText}\nSource: ${searchData.AbstractURL || 'Verified Web Intelligence'}\n`;
        }
      } catch (err) {
        console.warn('Web trend lookup fallback:', err.message);
      }
    }

    const systemPrompt = `You are Stowave AI, an elite enterprise executive advisor designed in the style and intelligence of Claude (Anthropic). You are remarkably thoughtful, structured, articulate, insightful, and proactive.

${liveContext}
${webContext ? webContext : ''}

CORE PRINCIPLES & CAPABILITIES:
1. USER PERSONALIZATION: You are directly conversing with ${userContext?.name || 'the user'}. Always recognize them personally, know their title (${userContext?.title || 'Team Member'}), department (${userContext?.department || 'General'}), and role (${userContext?.role === 'admin' ? 'Primary Administrator & Director (Full Authority)' : 'Team Member / Specialist'}). Never ask them who they are — you already know!
2. COMPLETE PORTAL OMNISCIENCE: You have full real-time access to the entire Stowave workspace (all tasks, members, reviews, attendance/presence, departments, social command, and audit logs). When asked about any task, person, or metric, quote exact facts and figures from the data above with zero fabrication.
3. EXECUTIVE AUDIT GENERATION:
   When the user asks for an "audit" (e.g. "audit kr k do", "team audit", "performance audit", "tasks audit", "workspace audit", "meri company ka audit karo"):
   - Provide an exhaustive, senior-management-grade audit report.
   - Use clean, professional headings:
     * ## Executive Summary & Workspace Health Index (e.g. 88/100)
     * ### 1. Workload & Task Execution Analysis (urgent vs overdue vs review)
     * ### 2. Departmental & Team Performance (individual velocity, points, status)
     * ### 3. Critical Bottlenecks & Operational Risks
     * ### 4. Strategic 48-Hour Action Directives
   - Use clean markdown tables to summarize key metrics so they can be exported to PDF.
4. AUTONOMOUS ACTIONS (CREATE / ASSIGN / APPROVE / UPDATE / DELETE TASKS):
   You have full authority to execute real workspace actions when requested by the user:
   - If asked to create or assign a task (e.g. "Ali Haider ko task assign karo...", "task bnao"):
     Append this exact block at the bottom of your reply:
     \`\`\`action
     {
       "type": "CREATE_TASK",
       "params": {
         "title": "Title of task",
         "assignedTo": "Ali Haider",
         "priority": "urgent" or "high" or "medium",
         "dueDate": "2026-10-22",
         "description": "Task description"
       }
     }
     \`\`\`
   - If asked to approve a task / deliverable (e.g. "task approve kr do", "is deliverable ko approve karo"):
     \`\`\`action
     {
       "type": "APPROVE_TASK",
       "params": {
         "taskTitleOrId": "task name or ID",
         "rating": 5,
         "feedback": "Approved with excellence!"
       }
     }
     \`\`\`
   - If asked to update status (e.g. "complete mark karo"):
     \`\`\`action
     {
       "type": "UPDATE_TASK",
       "params": {
         "taskTitleOrId": "task name or ID",
         "status": "completed"
       }
     }
     \`\`\`
   - If asked to delete a task:
     \`\`\`action
     {
       "type": "DELETE_TASK",
       "params": {
         "taskTitleOrId": "task name or ID"
       }
     }
     \`\`\`
5. RESPONSE TONE & FORMAT (CLAUDE-LIKE):
   - Never sound like a robotic script. Avoid repetitive canned greeting lists like "I have access to 1 active tasks...". Speak naturally, warmly, and with high intellectual clarity.
   - Match user language: If the user communicates in Roman Urdu / Urdu (e.g. "kia hal hai", "audit kr k do", "tasks check kro"), reply in fluent, polite, elegant Roman Urdu / Urdu with professional English terms. If in English, reply in crisp executive English.
   - Always structure complex information with markdown: bullet points, bold key terms, tables, and clickable links formatted as [Label](/route), such as [Task Board](/tasks), [Team Directory](/team), [Operations](/operations), [Settings](/settings).`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    let reply = '';
    let usedModel = 'openai/gpt-oss-120b';

    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: usedModel,
          messages,
          temperature: 0.6,
          max_tokens: 2500
        })
      });

      if (groqResponse.ok) {
        const data = await groqResponse.json();
        reply = data.choices[0]?.message?.content || '';
      } else {
        throw new Error(`Groq Primary Model Error: ${await groqResponse.text()}`);
      }
    } catch (primaryErr) {
      console.warn('Primary model failed, falling back to llama-3.3-70b-versatile:', primaryErr.message);
      usedModel = 'llama-3.3-70b-versatile';
      const fallbackResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: usedModel,
          messages,
          temperature: 0.6,
          max_tokens: 2500
        })
      });
      if (!fallbackResponse.ok) {
        const errText = await fallbackResponse.text();
        throw new Error(`Groq Fallback Model Error: ${errText}`);
      }
      const data = await fallbackResponse.json();
      reply = data.choices[0]?.message?.content || 'No response generated.';
    }

    // Check if reply contains an autonomous action block
    let actionExecuted = null;
    let actionRaw = null;
    const actionBlockMatch = reply.match(/```(?:action|json)?\s*([\s\S]*?\{[\s\S]*?"type"[\s\S]*?\})\s*```/);
    if (actionBlockMatch) {
      try {
        actionRaw = JSON.parse(actionBlockMatch[1]);
        reply = reply.replace(actionBlockMatch[0], '').trim();
      } catch (e) {}
    } else {
      const inlineMatch = reply.match(/(\{\s*"type"\s*:\s*"(?:CREATE_TASK|ASSIGN_TASK|APPROVE_TASK|UPDATE_TASK|DELETE_TASK)"[\s\S]*?\})/i);
      if (inlineMatch) {
        try {
          actionRaw = JSON.parse(inlineMatch[1]);
          reply = reply.replace(inlineMatch[0], '').trim();
        } catch (e) {}
      }
    }

    if (actionRaw && actionRaw.type) {
      const actionResult = executeAiAction(actionRaw, userContext);
      if (actionResult && actionResult.success) {
        actionExecuted = actionResult;
        reply = reply.trim() + actionResult.message;
      }
    }

    // Direct intent fallback if AI didn't emit code block but intent is obvious
    if (!actionExecuted) {
      const lowerMsg = message.toLowerCase();
      // 1. Approve task fallback
      if ((lowerMsg.includes('approve') || lowerMsg.includes('aprove') || lowerMsg.includes('manzoor')) && (lowerMsg.includes('task') || lowerMsg.includes('deliverable') || lowerMsg.includes('kam') || lowerMsg.includes('testing'))) {
        let cleanQuery = message
          .replace(/(approve|aprove|task|deliverable|kam|ko|kr do|kardo|kar do|please|plz|bhi|is|ye)/gi, '')
          .replace(/["'`]/g, '')
          .trim();
        const result = executeAiAction({ type: 'APPROVE_TASK', params: { taskTitleOrId: cleanQuery } }, userContext);
        if (result && result.success) {
          actionExecuted = result;
          reply += result.message;
        }
      }
      // 2. Assign / Create task fallback
      else if ((lowerMsg.includes('assign') || lowerMsg.includes('create') || lowerMsg.includes('banao') || lowerMsg.includes('de do')) && (lowerMsg.includes('task') || lowerMsg.includes('kam'))) {
        const allUsers = db.getCollection('users') || [];
        const foundUser = allUsers.find(u => lowerMsg.includes(u.name.toLowerCase()) || (u.name.split(' ')[0] && lowerMsg.includes(u.name.split(' ')[0].toLowerCase())));
        const cleanTitle = message
          .replace(/(assign|create|banao|task|kam|ko|karo|kr do|kardo|kar do|please|plz|aik|ek|new)/gi, '')
          .replace(foundUser ? new RegExp(foundUser.name, 'gi') : '', '')
          .replace(/["'`:]/g, '')
          .trim();

        const result = executeAiAction({
          type: 'CREATE_TASK',
          params: {
            title: cleanTitle.length > 3 ? cleanTitle : 'Assigned Workspace Task',
            assignedTo: foundUser ? foundUser.name : (allUsers[0]?.name || 'team member')
          }
        }, userContext);
        if (result && result.success) {
          actionExecuted = result;
          reply += result.message;
        }
      }
      // 3. Delete task fallback
      else if ((lowerMsg.includes('delete') || lowerMsg.includes('remove') || lowerMsg.includes('hatao') || lowerMsg.includes('khatam')) && lowerMsg.includes('task')) {
        let cleanQuery = message
          .replace(/(delete|remove|hatao|khatam|task|ko|kr do|kardo|kar do|please|plz|is|ye)/gi, '')
          .replace(/["'`]/g, '')
          .trim();
        const result = executeAiAction({ type: 'DELETE_TASK', params: { taskTitleOrId: cleanQuery } }, userContext);
        if (result && result.success) {
          actionExecuted = result;
          reply += result.message;
        }
      }
    }

    res.json({ reply, actionExecuted, model: usedModel });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process AI chat.' });
  }
});

// AI Vision Endpoint (Live Camera snapshot & Document analysis)
app.post('/api/ai/vision', async (req, res) => {
  const { imageBase64, prompt = 'Describe what you see in this live camera snapshot and provide strategic advice or feedback.' } = req.body;
  const groqKey = process.env.GROQ_API_KEY;
  const hfKey = process.env.HUGGINGFACE_API_KEY;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required.' });
  }

  // Ensure clean data URI and raw base64
  const formattedImage = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  // Try Groq Vision first with qwen/qwen3.8-27b
  if (groqKey) {
    try {
      const visionResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'qwen/qwen3.8-27b',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${prompt}\n(Provide clear, actionable feedback. If viewing a workspace, design, whiteboard, document or person, give constructive analysis).`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: formattedImage
                  }
                }
              ]
            }
          ],
          temperature: 0.3,
          max_tokens: 450
        })
      });

      if (visionResponse.ok) {
        const data = await visionResponse.json();
        const reply = data.choices[0]?.message?.content;
        if (reply) {
          return res.json({ reply, model: 'qwen/qwen3.8-27b' });
        }
      }
    } catch (gErr) {
      console.warn('Groq Vision attempt failed, falling back to Hugging Face:', gErr.message);
    }
  }

  // Fallback to Hugging Face Vision Inference API
  if (hfKey) {
    try {
      const base64Data = formattedImage.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      const hfResp = await fetch('https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfKey}`,
          'Content-Type': 'application/octet-stream'
        },
        body: imageBuffer
      });

      if (hfResp.ok) {
        const hfData = await hfResp.json();
        const caption = Array.isArray(hfData) && hfData[0]?.generated_text ? hfData[0].generated_text : JSON.stringify(hfData);
        return res.json({
          reply: `**Visual Analysis Result:**\nDetected: ${caption}\n\nStrategic Feedback: This visual artifact has been analyzed via Hugging Face Vision. Ensure optimal lighting and framing for real-time document and screen code inspection.`,
          model: 'Salesforce/blip-image-captioning (Hugging Face)'
        });
      }
    } catch (hfErr) {
      console.error('Hugging Face Vision error:', hfErr);
    }
  }

  res.status(500).json({ error: 'Vision processing failed on both Groq and Hugging Face.' });
});

// Mount Apify Router (Real-time Scraping, Actor runner & Trends)
const apifyRouter = require('./routes/apify');
app.use('/api/apify', apifyRouter);

// Mount Omnichannel Social Command Center Router (Publishing, Crawler, Inbox, Analytics)
const socialRouter = require('./routes/social');
app.use('/api/social', socialRouter);

// Reset Workspace to Clean Slate (User option to start completely fresh without sample items)
app.post('/api/settings/reset-workspace', (req, res) => {
  const currentAdmin = db.getCollection('users').find(u => u.role === 'admin');
  const freshData = db.resetToCleanSlate(currentAdmin);
  res.json({ message: 'Workspace reset to clean real-time slate successfully!', freshData });
});

// Start Express Server with Graceful Error Handling
const server = app.listen(PORT, () => {
  console.log(`🚀 Team Management API Server is running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`⚠️ Port ${PORT} is in use. Run 'kill -9 $(lsof -t -i:${PORT})' or set PORT=5002 in .env.`);
    process.exit(1);
  } else {
    throw err;
  }
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

module.exports = app;

