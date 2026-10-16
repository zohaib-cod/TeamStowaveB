require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const { notifyTaskAssigned, notifyWorkApproved } = require('./services/emailService');
const { alertAdmins } = require('./services/whatsappService');

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

// Mount Notifications & Media Upload Router (Cloudinary, Gmail, WhatsApp)
const notificationsRouter = require('./routes/notifications');
app.use('/api/notifications', notificationsRouter);
app.use('/api/upload', (req, res, next) => {
  req.url = '/upload';
  notificationsRouter(req, res, next);
});

// Helper: build live context for AI
function buildLiveCompanyContext() {
  const users = db.getCollection('users');
  const tasks = db.getCollection('tasks');
  const reports = db.getCollection('reports');
  const surveys = db.getCollection('surveys');
  const shoutouts = db.getCollection('shoutouts');
  const gifts = db.getCollection('gifts');
  const socialAccounts = db.getCollection('social_accounts') || [];
  const socialPosts = db.getCollection('social_posts') || [];
  const socialInbox = db.getCollection('social_inbox') || [];

  const pendingTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length;
  const reviewTasks = tasks.filter(t => t.status === 'review').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const activeSurveys = surveys.filter(s => s.status === 'active' && new Date(s.expiresAt) > new Date()).length;
  const unreadDms = socialInbox.filter(i => i.status === 'unread').length;

  return `
--- LIVE COMPANY CONTEXT & STATE (OCTOBER 2026) ---
Company Name: ${db.getSettings().companyName || 'Stowave Global'}
Active Team Members (${users.length}):
${users.map(u => `• ${u.name} (${u.title}, ${u.department}) - Status: ${u.status}, Role: ${u.role}, Points: ${u.points}`).join('\n')}

Task Statistics:
- Total Tasks: ${tasks.length}
- In Progress / To-Do: ${pendingTasks}
- Awaiting Admin Review: ${reviewTasks}
- Completed: ${completedTasks}

Social Media & Omnichannel Command:
- Connected Channels: ${socialAccounts.map(a => `${a.name} (${a.handle}, ${a.followers} followers)`).join(', ') || 'Instagram, TikTok, LinkedIn, Facebook, Twitter, YouTube'}
- Published Broadcasts: ${socialPosts.length} posts
- Unread Social Inquiries / DMs: ${unreadDms}
- Strategy Health Score: 88/100 (Surging Velocity)

Recent Key Tasks:
${tasks.slice(0, 5).map(t => `• [${t.priority.toUpperCase()}] "${t.title}" (Status: ${t.status}, Assigned to: ${users.find(u => u.id === t.assignedTo)?.name || t.assignedTo})`).join('\n')}

Active Feedback Surveys: ${activeSurveys} active.
Total Kudos / Shoutouts Given: ${shoutouts.length}
Total Gifts Exchanged: ${gifts.length}
--------------------------------------------------`;
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

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const users = db.getCollection('users');
  const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials. Use password123 or select a profile.' });
  }
  res.json({ user, token: `jwt_${user.id}_${Date.now()}` });
});

// ==========================================
// 3. TASKS MANAGEMENT (FULL CRUD & WORKFLOW)
// ==========================================
app.get('/api/tasks', (req, res) => {
  const { assignedTo, status, priority } = req.query;
  let tasks = db.getCollection('tasks');
  if (assignedTo) tasks = tasks.filter(t => t.assignedTo === assignedTo);
  if (status) tasks = tasks.filter(t => t.status === status);
  if (priority) tasks = tasks.filter(t => t.priority === priority);
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { title, description, assignedTo, assignedBy, priority, dueDate, estimatedHours, tags } = req.body;
  if (!title || !assignedTo) {
    return res.status(400).json({ error: 'Title and assigned team member are required.' });
  }
  const newTask = {
    id: `tsk_${Date.now()}`,
    title,
    description: description || '',
    assignedTo,
    assignedBy: assignedBy || 'usr_admin_1',
    priority: priority || 'medium',
    status: 'todo',
    dueDate: dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    estimatedHours: Number(estimatedHours) || 8,
    actualHours: 0,
    tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(s => s.trim()) : ['General']),
    submissionNotes: '',
    submissionLink: '',
    reviewedBy: null,
    reviewFeedback: null,
    rating: null
  };
  const saved = db.addItem('tasks', newTask);

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
  if (newTask.priority === 'urgent' || newTask.priority === 'high') {
    alertAdmins(`🚨 Urgent Task Created: "${title}" assigned to ${assignee?.name || 'team'}. Due: ${newTask.dueDate}`).catch(e => console.warn('WhatsApp alert error:', e.message));
  }

  res.status(201).json(saved);
});

app.put('/api/tasks/:id', (req, res) => {
  const updated = db.updateItem('tasks', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  res.json(updated);
});

// Member submits work
app.post('/api/tasks/:id/submit', (req, res) => {
  const { submissionNotes, submissionLink, actualHours } = req.body;
  const updates = {
    status: 'review',
    submissionNotes: submissionNotes || 'Work completed and submitted for review.',
    submissionLink: submissionLink || '',
    actualHours: Number(actualHours) || 0,
    submittedAt: new Date().toISOString()
  };
  const updated = db.updateItem('tasks', req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  res.json(updated);
});

// Admin reviews work (Approve / Reject / Rate)
app.post('/api/tasks/:id/review', (req, res) => {
  const { status, reviewFeedback, rating, reviewerId } = req.body; // status: 'completed' or 'in_progress' (needs revision)
  const task = db.getCollection('tasks').find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const updates = {
    status: status === 'completed' ? 'completed' : 'in_progress',
    reviewedBy: reviewerId || 'usr_admin_1',
    reviewFeedback: reviewFeedback || (status === 'completed' ? 'Great work!' : 'Please address the requested revisions.'),
    rating: Number(rating) || 5,
    reviewedAt: new Date().toISOString()
  };
  const updated = db.updateItem('tasks', req.params.id, updates);

  // If approved and rated, reward points to user
  if (status === 'completed' && task.assignedTo) {
    const user = db.getCollection('users').find(u => u.id === task.assignedTo);
    if (user) {
      const awardPoints = (Number(rating) || 5) * 20;
      db.updateItem('users', user.id, { points: (user.points || 0) + awardPoints });
    }
  }

  res.json(updated);
});

app.delete('/api/tasks/:id', (req, res) => {
  const success = db.deleteItem('tasks', req.params.id);
  if (!success) return res.status(404).json({ error: 'Task not found' });
  res.json({ message: 'Task deleted successfully' });
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

// ==========================================
// 9. AI EXECUTIVE ASSISTANT (GROQ + HF + VISION + LIVE SEARCH)
// ==========================================
app.post('/api/ai/chat', async (req, res) => {
  const { message, history = [], searchTrends = false } = req.body;
  const groqKey = process.env.GROQ_API_KEY;

  if (!groqKey) {
    return res.status(500).json({ error: 'Groq API Key not configured.' });
  }

  try {
    const liveContext = buildLiveCompanyContext();

    // If web search is requested, fetch real-time trend info
    let webContext = '';
    if (searchTrends || message.toLowerCase().includes('trend') || message.toLowerCase().includes('market') || message.toLowerCase().includes('search')) {
      try {
        // Query DuckDuckGo instant answer or Wikipedia summary for real-time verification
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

    const systemPrompt = `You are the Stowave AI Executive Strategic Advisor & Company Intelligence Engine for Stowave Global.
You possess complete, real-time access to Stowave's internal portal data: team members, tasks, reports, feedback, performance metrics, and the Omnichannel Social Command Center.

${liveContext}
${webContext ? webContext : ''}

Your Mission & Capabilities:
1. Provide accurate, insightful, and strategic guidance to the Admin and Team Members.
2. If asked about team status, tasks, deadlines, reports, or ratings, cite the exact real data above with zero fabrication.
3. Social Media & Content Command: You can draft multi-platform social media posts (Instagram, TikTok, LinkedIn, Twitter, Facebook), suggest viral video hooks, analyze competitor accounts, and suggest optimal posting times.
4. If asked to write or post an announcement or social post, write the exact tailored copies for the platforms requested with hashtags, hooks, and call-to-actions.
5. If the user talks in Urdu / Roman Urdu, respond warmly and clearly in Urdu / Roman Urdu or bilingual English/Urdu as natural.
6. Keep your answers well-formatted with markdown, bullet points, and high executive polish.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages,
        temperature: 0.6,
        max_tokens: 1200
      })
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      throw new Error(`Groq API Error: ${errText}`);
    }

    const data = await groqResponse.json();
    const reply = data.choices[0]?.message?.content || 'No response generated.';
    res.json({ reply, model: 'openai/gpt-oss-120b' });
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

