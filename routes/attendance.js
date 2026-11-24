const express = require('express');
const db = require('../db');
const { logOperationsHistory } = require('../services/historyService');

const router = express.Router();

/**
 * Helper to get today's calendar date formatted as YYYY-MM-DD in local time
 * (Ensures 12:00 AM midnight strictly rolls over to the next day).
 */
function getLocalDateString(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Helper to compute 12:00 AM Midnight cutoff details
 */
function getMidnightCutoffInfo(d = new Date()) {
  const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  const msUntilMidnight = Math.max(0, nextMidnight.getTime() - d.getTime());
  return {
    cutoffIso: nextMidnight.toISOString(),
    cutoffLabel: '12:00 AM Midnight',
    secondsUntilMidnight: Math.floor(msUntilMidnight / 1000)
  };
}

/**
 * Automatically expire any in-progress attendance sessions from previous days
 * that passed the 12:00 AM midnight cutoff without completing 5 continuous minutes.
 */
async function expirePastMidnightSessions() {
  try {
    const today = getLocalDateString();
    const attendances = db.getCollection('attendance') || [];
    const expiredSessions = attendances.filter(
      a => a.status === 'in_progress' && a.date < today
    );

    for (const session of expiredSessions) {
      await db.updateItem('attendance', session.id, {
        status: 'incomplete',
        verified: false,
        notes: `Session automatically expired at 12:00 AM midnight cutoff for ${session.date}. Continuous 5-minute portal engagement was not completed before midnight.`,
        completedTime: null,
        updatedAt: new Date().toISOString()
      });

      logOperationsHistory({
        category: 'system',
        action: 'ATTENDANCE_EXPIRED_MIDNIGHT',
        title: `Daily Attendance Cutoff (12:00 AM): ${session.userName}`,
        description: `Incomplete attendance session for ${session.date} expired automatically at 12:00 AM midnight cutoff.`,
        actor: { id: session.userId, name: session.userName, avatar: session.userAvatar || '' },
        metadata: { sessionDate: session.date, expiredAt: new Date().toISOString() }
      });
    }
  } catch (err) {
    console.error('Error auto-expiring past midnight sessions:', err);
  }
}

/**
 * 1. GET /api/attendance/today?userId=...
 * Retrieve today's attendance status and active session for the user
 * (Strictly aligned to local calendar day with 12:00 AM cutoff).
 */
router.get('/today', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Auto-expire any dangling sessions from yesterday before loading
    await expirePastMidnightSessions();

    const today = getLocalDateString();
    const cutoff = getMidnightCutoffInfo();
    const attendances = db.getCollection('attendance') || [];
    const userTodayAttendance = attendances.find(
      a => a.userId === userId && a.date === today
    );

    res.json({
      success: true,
      today,
      cutoff,
      attendance: userTodayAttendance || null
    });
  } catch (err) {
    console.error('Error fetching today attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance status' });
  }
});

/**
 * 2. POST /api/attendance/start
 * User ticks "Start Attendance" checkbox to begin tracking.
 * After 12:00 AM midnight, it immediately records for the new calendar day.
 */
router.post('/start', async (req, res) => {
  try {
    const { userId, name, email, avatar, department } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Auto-expire past sessions
    await expirePastMidnightSessions();

    const today = getLocalDateString();
    const cutoff = getMidnightCutoffInfo();
    const attendances = db.getCollection('attendance') || [];
    let existing = attendances.find(a => a.userId === userId && a.date === today);

    // If already marked present for today (the current local calendar day)
    if (existing && existing.status === 'present') {
      return res.json({
        success: true,
        alreadyMarked: true,
        today,
        cutoff,
        message: 'Attendance already marked for today!',
        attendance: existing
      });
    }

    // If an in_progress session exists for today, return it
    if (existing && existing.status === 'in_progress') {
      return res.json({
        success: true,
        alreadyMarked: false,
        today,
        cutoff,
        message: 'Attendance tracking in progress for today',
        attendance: existing
      });
    }

    const newRecord = {
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId,
      userName: name || 'Team Member',
      userEmail: email || '',
      userAvatar: avatar || '',
      userDepartment: department || 'General',
      date: today,
      status: 'in_progress', // 'in_progress' | 'present' | 'incomplete'
      startTime: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      activeSeconds: 0,
      targetSeconds: 300, // 5 minutes required continuous active portal usage
      verified: false,
      ruleMet: null,
      completedTime: null,
      durationSeconds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.addItem('attendance', newRecord);

    logOperationsHistory({
      category: 'system',
      action: 'ATTENDANCE_STARTED',
      title: `${name || 'User'} started attendance tracking session`,
      description: `Active portal monitoring started for ${today}. Attendance will be recorded only after 5 minutes of continuous portal usage before 12:00 AM midnight.`,
      actor: { id: userId, name: name || 'Team Member', avatar: avatar || '' },
      metadata: { targetSeconds: 300, date: today, cutoff: cutoff.cutoffLabel }
    });

    res.json({
      success: true,
      today,
      cutoff,
      message: 'Attendance tracking started! Keep portal active for 5 minutes continuously before 12:00 AM midnight.',
      attendance: newRecord
    });
  } catch (err) {
    console.error('Error starting attendance:', err);
    res.status(500).json({ error: 'Failed to start attendance session' });
  }
});

/**
 * 3. POST /api/attendance/heartbeat
 * Periodic heartbeat sent while user actively uses the portal
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { attendanceId, userId, elapsedSeconds, isActive } = req.body || {};
    if (!attendanceId && !userId) {
      return res.status(400).json({ error: 'attendanceId or userId is required' });
    }

    await expirePastMidnightSessions();

    const today = getLocalDateString();
    const cutoff = getMidnightCutoffInfo();
    const attendances = db.getCollection('attendance') || [];
    const record = attendances.find(
      a => (attendanceId && a.id === attendanceId) || (userId && a.userId === userId && a.date === today)
    );

    if (!record) {
      return res.status(404).json({ error: 'Attendance session not found for today' });
    }

    // If the record's date is before today, it expired at 12:00 AM midnight!
    if (record.date < today) {
      await db.updateItem('attendance', record.id, {
        status: 'incomplete',
        verified: false,
        notes: `Attendance window for ${record.date} closed at 12:00 AM midnight cutoff.`,
        updatedAt: new Date().toISOString()
      });
      return res.json({
        success: false,
        expired: true,
        message: `Attendance window for ${record.date} closed at 12:00 AM midnight. Please start new attendance for ${today}.`,
        today,
        cutoff
      });
    }

    // If already marked present, return status
    if (record.status === 'present') {
      return res.json({
        success: true,
        verified: true,
        today,
        cutoff,
        attendance: record
      });
    }

    const currentSeconds = Math.max(record.activeSeconds || 0, Number(elapsedSeconds) || 0);
    const now = new Date().toISOString();

    const updates = {
      activeSeconds: currentSeconds,
      lastHeartbeat: now,
      updatedAt: now
    };

    // If threshold reached (>= 300 seconds continuous active usage)
    if (currentSeconds >= 300) {
      updates.status = 'present';
      updates.verified = true;
      updates.ruleMet = '5_minutes_continuous_active_usage';
      updates.completedTime = now;
      updates.durationSeconds = currentSeconds;

      const updated = await db.updateItem('attendance', record.id, updates);

      logOperationsHistory({
        category: 'system',
        action: 'ATTENDANCE_VERIFIED',
        title: `Attendance Verified: ${record.userName}`,
        description: `User successfully completed 5 minutes (300 seconds) of continuous active portal usage for ${today}.`,
        actor: { id: record.userId, name: record.userName, avatar: record.userAvatar },
        metadata: { durationSeconds: currentSeconds, date: today }
      });

      return res.json({
        success: true,
        verified: true,
        today,
        cutoff,
        message: 'Attendance verified & marked successfully! 5 minutes continuous usage completed before 12:00 AM midnight.',
        attendance: updated
      });
    }

    const updated = await db.updateItem('attendance', record.id, updates);

    res.json({
      success: true,
      verified: false,
      today,
      cutoff,
      attendance: updated
    });
  } catch (err) {
    console.error('Error recording attendance heartbeat:', err);
    res.status(500).json({ error: 'Failed to record heartbeat' });
  }
});

/**
 * 4. POST /api/attendance/complete
 * Officially completes and locks in the attendance once 5 minutes requirement is achieved
 */
router.post('/complete', async (req, res) => {
  try {
    const { attendanceId, userId, activeSeconds } = req.body || {};
    await expirePastMidnightSessions();

    const today = getLocalDateString();
    const cutoff = getMidnightCutoffInfo();
    const attendances = db.getCollection('attendance') || [];
    const record = attendances.find(
      a => (attendanceId && a.id === attendanceId) || (userId && a.userId === userId && a.date === today)
    );

    if (!record) {
      return res.status(404).json({ error: 'Attendance session not found for today' });
    }

    // If record date is before today, cannot complete after 12:00 AM midnight
    if (record.date < today) {
      return res.status(400).json({
        error: `Daily attendance for ${record.date} closed at 12:00 AM midnight. You can now start attendance for ${today}.`,
        expired: true,
        today
      });
    }

    if (record.status === 'present') {
      return res.json({
        success: true,
        message: 'Attendance already marked present!',
        attendance: record
      });
    }

    const duration = Math.max(record.activeSeconds || 0, Number(activeSeconds) || 0);

    // Strict rule check: user MUST have completed at least 300 seconds (5 minutes)
    if (duration < 300) {
      return res.status(400).json({
        error: `Attendance cannot be marked! Continuous 5 minutes (300 seconds) portal usage required. Current active time: ${Math.floor(duration / 60)}m ${duration % 60}s.`,
        currentActiveSeconds: duration,
        requiredSeconds: 300
      });
    }

    const now = new Date().toISOString();
    const updates = {
      status: 'present',
      verified: true,
      ruleMet: '5_minutes_continuous_active_usage',
      completedTime: now,
      durationSeconds: duration,
      activeSeconds: duration,
      updatedAt: now
    };

    const updated = await db.updateItem('attendance', record.id, updates);

    logOperationsHistory({
      category: 'system',
      action: 'ATTENDANCE_COMPLETED',
      title: `Attendance Logged: ${record.userName} (Present)`,
      description: `Official attendance stamped after 5 minutes continuous active engagement for ${today}.`,
      actor: { id: record.userId, name: record.userName, avatar: record.userAvatar },
      metadata: { durationSeconds: duration, date: today }
    });

    res.json({
      success: true,
      today,
      cutoff,
      message: 'Attendance successfully verified and marked Present!',
      attendance: updated
    });
  } catch (err) {
    console.error('Error completing attendance:', err);
    res.status(500).json({ error: 'Failed to complete attendance' });
  }
});

/**
 * 5. POST /api/attendance/cancel
 * If user unchecks the box or stops before 5 minutes are completed
 */
router.post('/cancel', async (req, res) => {
  try {
    const { attendanceId, userId, activeSeconds } = req.body || {};
    const today = getLocalDateString();
    const attendances = db.getCollection('attendance') || [];
    const record = attendances.find(
      a => (attendanceId && a.id === attendanceId) || (userId && a.userId === userId && a.date === today)
    );

    if (!record) {
      return res.status(404).json({ error: 'Attendance session not found' });
    }

    // If already marked present, don't cancel completed attendance
    if (record.status === 'present') {
      return res.json({
        success: true,
        message: 'Attendance has already been verified and marked for today.',
        attendance: record
      });
    }

    const duration = Math.max(record.activeSeconds || 0, Number(activeSeconds) || 0);
    const updates = {
      status: 'incomplete',
      verified: false,
      notes: `Session stopped before completing 5 continuous minutes (Active: ${Math.floor(duration / 60)}m ${duration % 60}s). Attendance not marked.`,
      durationSeconds: duration,
      updatedAt: new Date().toISOString()
    };

    const updated = await db.updateItem('attendance', record.id, updates);

    logOperationsHistory({
      category: 'system',
      action: 'ATTENDANCE_ABANDONED',
      title: `Attendance session cancelled: ${record.userName}`,
      description: `User stopped after ${Math.floor(duration / 60)}m ${duration % 60}s. 5-minute requirement was not met.`,
      actor: { id: record.userId, name: record.userName, avatar: record.userAvatar }
    });

    res.json({
      success: true,
      message: 'Attendance session cancelled. Attendance was not marked because 5-minute continuous requirement was not completed.',
      attendance: updated
    });
  } catch (err) {
    console.error('Error cancelling attendance:', err);
    res.status(500).json({ error: 'Failed to cancel attendance' });
  }
});

/**
 * 6. GET /api/attendance/history
 * Returns attendance logs
 */
router.get('/history', (req, res) => {
  try {
    const { userId, date, limit = 100 } = req.query;
    const users = db.getCollection('users') || [];
    let attendances = db.getCollection('attendance') || [];

    if (userId) {
      attendances = attendances.filter(a => a.userId === userId);
    }
    if (date) {
      attendances = attendances.filter(a => a.date === date);
    }

    // Enrich missing userAvatar from users collection
    attendances = attendances.map(a => {
      if (a.userAvatar) return a;
      const u = users.find(usr => usr.id === a.userId || (usr.name && a.userName && usr.name.toLowerCase() === a.userName.toLowerCase()));
      return u?.avatar ? { ...a, userAvatar: u.avatar } : a;
    });

    // Sort newest first
    attendances.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({
      success: true,
      count: attendances.length,
      history: attendances.slice(0, Number(limit))
    });
  } catch (err) {
    console.error('Error fetching attendance history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * 7. GET /api/attendance/stats
 * Overview of today's attendance across the team
 */
router.get('/stats', async (req, res) => {
  try {
    await expirePastMidnightSessions();
    const today = getLocalDateString();
    const cutoff = getMidnightCutoffInfo();
    const users = db.getCollection('users') || [];
    const attendances = db.getCollection('attendance') || [];

    const todayRecords = attendances.filter(a => a.date === today);
    const presentUsers = todayRecords.filter(a => a.status === 'present');
    const inProgressUsers = todayRecords.filter(a => a.status === 'in_progress');
    const totalUsers = users.length || 1;

    const rate = Math.round((presentUsers.length / totalUsers) * 100);

    res.json({
      success: true,
      today,
      cutoff,
      totalUsers,
      presentCount: presentUsers.length,
      inProgressCount: inProgressUsers.length,
      absentCount: Math.max(0, totalUsers - presentUsers.length - inProgressUsers.length),
      attendanceRate: `${rate}%`
    });
  } catch (err) {
    console.error('Error fetching attendance stats:', err);
    res.status(500).json({ error: 'Failed to fetch attendance stats' });
  }
});

module.exports = router;
