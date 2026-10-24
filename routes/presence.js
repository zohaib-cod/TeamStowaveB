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
  let { userId, name, avatar, role, currentPage = '/', pageTitle } = req.body || {};
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
      lastSeen: now, // Always update to current time
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.addItem('active_presences', newEntry);
  }

  // Also update user's lastActive timestamp in users collection
  const allUsers = db.getCollection('users');
  const u = allUsers.find(x => x.id === userId);
  if (u) {
    db.updateItem('users', u.id, {
      status: 'online',
      lastActive: now,
      lastHeartbeat: now,
      lastSeen: now,
      updatedAt: new Date().toISOString()
    });
  }

  res.json({ success: true, timestamp: now });
});

/**
 * 2. User Leaves / Unloads page
 */
router.post('/leave', (req, res) => {
  let userId = null;
  if (req.body) {
    if (typeof req.body === 'object' && req.body.userId) {
      userId = req.body.userId;
    } else if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        userId = parsed.userId;
      } catch (e) {
        if (req.body.startsWith('usr_')) userId = req.body.trim();
      }
    }
  }
  if (!userId && req.query.userId) {
    userId = req.query.userId;
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
      lastHeartbeat: now - 45000 // force offline threshold
    });
  }

  const allUsers = db.getCollection('users');
  const u = allUsers.find(x => x.id === userId);
  if (u) {
    db.updateItem('users', u.id, {
      status: 'offline',
      lastActive: now,
      lastSeen: now,
      leftAt: now,
      updatedAt: new Date().toISOString()
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

  // Ensure all registered users have a presence record with realistic last seen
  allUsers.forEach(u => {
    if (!trackedMap.has(u.id)) {
      let userLastActive = u.lastActive || u.lastSeen;
      if (!userLastActive && u.lastLogin) {
        userLastActive = new Date(u.lastLogin).getTime();
      }
      if (!userLastActive && u.createdAt) {
        userLastActive = new Date(u.createdAt).getTime();
      }
      if (!userLastActive || isNaN(userLastActive)) {
        userLastActive = now - 3600000; // default 1 hour ago
      }

      trackedMap.set(u.id, {
        userId: u.id,
        name: u.name,
        avatar: u.avatar,
        role: u.role,
        currentPage: '/',
        status: 'offline',
        lastHeartbeat: 0,
        lastSeen: userLastActive
      });
    }
  });

  const onlineUsers = [];
  const offlineUsers = [];

  trackedMap.forEach(p => {
    const isOnline = p.status === 'online' && (now - (p.lastHeartbeat || 0)) <= ONLINE_THRESHOLD_MS;

    // Determine the most accurate last active timestamp
    const possibleTimestamps = [
      p.lastHeartbeat,
      p.lastSeen,
      p.leftAt,
      p.updatedAt ? new Date(p.updatedAt).getTime() : 0
    ].filter(t => typeof t === 'number' && !isNaN(t) && t > 0);

    const mostRecentActive = possibleTimestamps.length > 0 ? Math.max(...possibleTimestamps) : (now - 300000);
    const timeSinceActive = Math.max(0, now - mostRecentActive);
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
        lastActiveExact: new Date(p.lastHeartbeat || now).toISOString()
      });
    } else {
      offlineUsers.push({
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        status: 'offline',
        lastPage: p.currentPage || '/',
        leftAgo: formatTimeAgo(timeSinceActive),
        lastSeenExact: new Date(mostRecentActive).toISOString()
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
