const express = require('express');
const db = require('../db');

const router = express.Router();

function formatTimeAgo(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 10) return 'Just now (a few seconds ago)';
  if (seconds < 60) return `Left ${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return 'Left 1 minute ago';
  if (minutes < 60) return `Left ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'Left 1 hour ago';
  if (hours < 24) return `Left ${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `Left ${days} day${days > 1 ? 's' : ''} ago`;
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * 1. Heartbeat from active browser tab
 * Called periodically (every 12-18s) and on page navigation
 */
router.post('/heartbeat', (req, res) => {
  const { userId, name, avatar, role, currentPage = '/', pageTitle } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const presences = db.getCollection('active_presences');
  const now = Date.now();
  let existing = presences.find(p => p.userId === userId);

  if (existing) {
    const isNewSession = (now - (existing.lastHeartbeat || 0)) > 60000;
    const updates = {
      name: name || existing.name,
      avatar: avatar || existing.avatar,
      role: role || existing.role,
      currentPage: currentPage || existing.currentPage,
      pageTitle: pageTitle || existing.pageTitle || currentPage,
      status: 'online',
      lastHeartbeat: now,
      sessionStartedAt: isNewSession ? now : (existing.sessionStartedAt || now),
      updatedAt: new Date().toISOString()
    };
    db.updateItem('active_presences', existing.id, updates);
  } else {
    const newEntry = {
      id: `prs_${userId}`,
      userId,
      name: name || 'Team Member',
      avatar: avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80`,
      role: role || 'member',
      currentPage: currentPage || '/',
      pageTitle: pageTitle || currentPage,
      status: 'online',
      sessionStartedAt: now,
      lastHeartbeat: now,
      lastSeen: now,
      createdAt: new Date().toISOString()
    };
    db.addItem('active_presences', newEntry);
  }

  res.json({ success: true, timestamp: now });
});

/**
 * 2. User Leaves / Unloads page
 */
router.post('/leave', (req, res) => {
  let { userId } = req.body;
  // Fallback if sent as text/beacon
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      userId = parsed.userId;
    } catch (e) {}
  }

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const presences = db.getCollection('active_presences');
  const existing = presences.find(p => p.userId === userId);
  const now = Date.now();

  if (existing) {
    db.updateItem('active_presences', existing.id, {
      status: 'offline',
      lastSeen: now,
      leftAt: now,
      lastHeartbeat: now - 45000 // force offline timestamp
    });
  }

  res.json({ success: true });
});

/**
 * 3. Get Active Real-Time Presences & Crawlers
 * Returns who is online right now, which page they are browsing,
 * and for offline users, exact time elapsed since they left!
 */
router.get('/active', (req, res) => {
  const presences = db.getCollection('active_presences');
  const allUsers = db.getCollection('users');
  const now = Date.now();
  const ONLINE_THRESHOLD_MS = 35000; // 35 seconds

  // Merge users with presences
  const trackedMap = new Map();

  presences.forEach(p => {
    trackedMap.set(p.userId, p);
  });

  // Ensure all registered users have a presence record
  allUsers.forEach(u => {
    if (!trackedMap.has(u.id)) {
      trackedMap.set(u.id, {
        userId: u.id,
        name: u.name,
        avatar: u.avatar,
        role: u.role,
        currentPage: '/',
        status: 'offline',
        lastHeartbeat: 0,
        lastSeen: now - 86400000 * 2 // 2 days ago
      });
    }
  });

  const onlineUsers = [];
  const offlineUsers = [];

  trackedMap.forEach(p => {
    const isOnline = p.status === 'online' && (now - (p.lastHeartbeat || 0)) <= ONLINE_THRESHOLD_MS;
    const timeSinceHeartbeat = now - (p.lastHeartbeat || p.lastSeen || now);
    const sessionDuration = p.sessionStartedAt ? formatDuration(now - p.sessionStartedAt) : '1m';

    if (isOnline) {
      onlineUsers.push({
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        status: 'online',
        currentPage: p.currentPage || '/',
        pageTitle: p.pageTitle || p.currentPage || 'Dashboard',
        crawlingDescription: `Currently crawling ${p.currentPage || '/'}`,
        activeFor: sessionDuration,
        lastActiveExact: new Date(p.lastHeartbeat).toISOString()
      });
    } else {
      offlineUsers.push({
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        status: 'offline',
        lastPage: p.currentPage || '/',
        leftAgo: formatTimeAgo(timeSinceHeartbeat),
        lastSeenExact: p.lastSeen ? new Date(p.lastSeen).toISOString() : new Date(p.lastHeartbeat || now).toISOString()
      });
    }
  });

  res.json({
    onlineCount: onlineUsers.length,
    offlineCount: offlineUsers.length,
    totalTracked: trackedMap.size,
    onlineUsers,
    offlineUsers
  });
});

module.exports = router;
