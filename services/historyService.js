const db = require('../db');

/**
 * Enterprise Audit Trail & Operations History Logger
 * Records every step and operational change in clear English & Roman Urdu
 * so any user or the AI Assistant can review the full history of everything that happened.
 */
function logOperationsHistory({
  category = 'task', // 'task' | 'review' | 'kudos' | 'survey' | 'standup' | 'leave' | 'announcement' | 'team' | 'system'
  action,
  title,
  urduTitle,
  description,
  actor = {},
  target = {},
  metadata = {}
}) {
  try {
    const now = new Date();
    const entryId = `hist_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    const newEntry = {
      id: entryId,
      category,
      action: action || 'OPERATION_EVENT',
      title: title || 'Activity Recorded',
      urduTitle: urduTitle || title,
      description: description || 'Operational action completed.',
      actor: {
        id: actor.id || 'usr_system',
        name: actor.name || 'System / Admin',
        role: actor.role || 'admin',
        avatar: actor.avatar || '/icon.png'
      },
      target: {
        id: target.id || null,
        name: target.name || null,
        title: target.title || null
      },
      metadata: metadata || {},
      timestamp: now.toISOString(),
      formattedTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      formattedDate: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      epoch: now.getTime()
    };

    db.addItem('operations_history', newEntry);
    console.log(`📜 [HISTORY LOG] ${newEntry.urduTitle || newEntry.title}`);
    return newEntry;
  } catch (err) {
    console.warn('History logging error:', err.message);
  }
}

/**
 * Returns history records sorted newest first, with optional filters
 */
function getOperationsHistory({ category, search, limit = 150 } = {}) {
  try {
    let history = db.getCollection('operations_history') || [];

    // Sort newest first
    history = [...history].sort((a, b) => (b.epoch || new Date(b.timestamp).getTime()) - (a.epoch || new Date(a.timestamp).getTime()));

    if (category && category !== 'all') {
      history = history.filter(h => h.category === category);
    }

    if (search && search.trim()) {
      const q = search.toLowerCase();
      history = history.filter(h => 
        h.title?.toLowerCase().includes(q) ||
        h.urduTitle?.toLowerCase().includes(q) ||
        h.description?.toLowerCase().includes(q) ||
        h.actor?.name?.toLowerCase().includes(q) ||
        h.target?.name?.toLowerCase().includes(q)
      );
    }

    return history.slice(0, limit);
  } catch (err) {
    console.error('getOperationsHistory error:', err);
    return [];
  }
}

module.exports = {
  logOperationsHistory,
  getOperationsHistory
};
