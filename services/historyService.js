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
 * Helper to build a normalized history entry from any portal collection item
 */
function buildSyntheticEntry({ id, category, action, title, description, actor, target, metadata, isoDate }) {
  const d = isoDate ? new Date(isoDate) : new Date();
  const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
  return {
    id,
    category,
    action,
    title,
    urduTitle: title,
    description,
    actor: {
      id: actor?.id || 'usr_system',
      name: actor?.name || 'System',
      role: actor?.role || 'member',
      avatar: actor?.avatar || '/icon.png'
    },
    target: {
      id: target?.id || null,
      name: target?.name || null,
      title: target?.title || null
    },
    metadata: metadata || {},
    timestamp: safeDate.toISOString(),
    formattedTime: safeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    formattedDate: safeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    epoch: safeDate.getTime()
  };
}

/**
 * Returns complete portal history records sorted newest first,
 * aggregating operations_history + live Tasks, Reviews, Late Works, Leaves, Attendance, Kudos, Standups, Surveys, and Announcements.
 */
function getOperationsHistory({ category, search, limit = 250 } = {}) {
  try {
    const rawHistory = db.getCollection('operations_history') || [];
    const users = db.getCollection('users') || [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const combined = [...rawHistory];
    const seenKeys = new Set(rawHistory.map(h => h.id));

    const addUnique = (entry) => {
      if (!seenKeys.has(entry.id)) {
        seenKeys.add(entry.id);
        combined.push(entry);
      }
    };

    // 1. Tasks, Submissions, Approvals & Late Works
    const tasks = db.getCollection('tasks') || [];
    const nowMs = Date.now();
    for (const t of tasks) {
      const assigner = userMap.get(t.assignedBy) || { id: t.assignedBy, name: t.assignedByName || 'Administrator', role: 'admin', avatar: '/icon.png' };
      const assignee = userMap.get(t.assignedTo) || { id: t.assignedTo, name: t.assignedToName || 'Team Member', role: 'member', avatar: '/icon.png' };

      addUnique(buildSyntheticEntry({
        id: `syn_task_create_${t.id}`,
        category: 'task',
        action: 'TASK_ASSIGNED',
        title: `Task Assigned: "${t.title}"`,
        description: `${assigner.name} assigned "${t.title}" to ${assignee.name} (Priority: ${(t.priority || 'medium').toUpperCase()}${t.dueDate ? `, Due: ${t.dueDate}` : ''}).`,
        actor: assigner,
        target: { id: t.id, name: assignee.name, title: t.title },
        metadata: { taskId: t.id, status: t.status },
        isoDate: t.createdAt
      }));

      if (t.submittedAt) {
        addUnique(buildSyntheticEntry({
          id: `syn_task_submit_${t.id}`,
          category: 'task',
          action: 'TASK_SUBMITTED',
          title: `Work Submitted: "${t.title}"`,
          description: `${assignee.name} submitted deliverables for "${t.title}" for review.`,
          actor: assignee,
          target: { id: t.id, name: t.title, title: t.title },
          metadata: { taskId: t.id },
          isoDate: t.submittedAt
        }));
      }

      if (t.adminReviewedAt) {
        const s1Reviewer = userMap.get(t.adminReviewerId) || { id: t.adminReviewerId, name: t.adminReviewerName || 'Admin', role: 'admin', avatar: '/icon.png' };
        addUnique(buildSyntheticEntry({
          id: `syn_task_s1_${t.id}`,
          category: 'review',
          action: 'TASK_STAGE1_APPROVED',
          title: `Stage 1 Approved: "${t.title}"`,
          description: `${s1Reviewer.name} approved Stage 1 for ${assignee.name}'s task "${t.title}" and forwarded to Master Admin.`,
          actor: s1Reviewer,
          target: { id: t.id, name: assignee.name, title: t.title },
          isoDate: t.adminReviewedAt
        }));
      }

      if (t.status === 'completed' && t.reviewedAt) {
        const mReviewer = userMap.get(t.masterReviewerId || t.reviewedBy) || { id: t.reviewedBy, name: t.masterReviewerName || t.reviewedByName || 'Master Admin', role: 'master_admin', avatar: '/icon.png' };
        addUnique(buildSyntheticEntry({
          id: `syn_task_master_${t.id}`,
          category: 'review',
          action: 'TASK_MASTER_APPROVED',
          title: `Final Approved: "${t.title}"`,
          description: `${mReviewer.name} gave final approval to ${assignee.name} on "${t.title}"${t.rating ? ` (${t.rating}/5 Stars)` : ''}.`,
          actor: mReviewer,
          target: { id: t.id, name: assignee.name, title: t.title },
          isoDate: t.reviewedAt
        }));
      }

      // Late work check (overdue or submitted after dueDate)
      if (t.dueDate) {
        const dueMs = new Date(`${t.dueDate}T23:59:59`).getTime();
        const submittedMs = t.submittedAt ? new Date(t.submittedAt).getTime() : null;
        if (submittedMs && submittedMs > dueMs) {
          addUnique(buildSyntheticEntry({
            id: `syn_late_sub_${t.id}`,
            category: 'late',
            action: 'TASK_LATE_SUBMISSION',
            title: `Late Submission: "${t.title}"`,
            description: `${assignee.name} submitted "${t.title}" after the deadline (${t.dueDate}).`,
            actor: assignee,
            target: { id: t.id, name: t.title, title: t.title },
            isoDate: t.submittedAt
          }));
        } else if (!submittedMs && t.status !== 'completed' && nowMs > dueMs) {
          addUnique(buildSyntheticEntry({
            id: `syn_late_overdue_${t.id}`,
            category: 'late',
            action: 'TASK_OVERDUE',
            title: `Overdue Task: "${t.title}"`,
            description: `${assignee.name} has not completed "${t.title}" (Deadline was ${t.dueDate}).`,
            actor: assignee,
            target: { id: t.id, name: t.title, title: t.title },
            isoDate: `${t.dueDate}T23:59:59.000Z`
          }));
        }
      }
    }

    // 2. Leaves
    const leaves = db.getCollection('leaves') || [];
    for (const l of leaves) {
      const applicant = userMap.get(l.userId) || { id: l.userId, name: l.userName || 'Team Member', role: 'member', avatar: '/icon.png' };
      addUnique(buildSyntheticEntry({
        id: `syn_leave_apply_${l.id}`,
        category: 'leave',
        action: 'LEAVE_APPLIED',
        title: `Leave Applied: ${applicant.name}`,
        description: `${applicant.name} requested ${(l.type || 'casual').toUpperCase()} leave from ${l.startDate} to ${l.endDate}${l.reason ? ` — "${l.reason}"` : ''}.`,
        actor: applicant,
        target: { id: l.id, name: `${l.startDate} to ${l.endDate}`, title: l.type },
        isoDate: l.submittedAt || l.createdAt
      }));

      if (l.status && l.status !== 'pending' && l.reviewedAt) {
        const rev = userMap.get(l.reviewedBy) || { id: l.reviewedBy, name: 'Administrator', role: 'admin', avatar: '/icon.png' };
        addUnique(buildSyntheticEntry({
          id: `syn_leave_rev_${l.id}`,
          category: 'leave',
          action: l.status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
          title: `Leave ${l.status === 'approved' ? 'Approved' : 'Rejected'}: ${applicant.name}`,
          description: `${rev.name} ${l.status} ${applicant.name}'s leave request (${l.startDate} to ${l.endDate}).`,
          actor: rev,
          target: { id: l.id, name: applicant.name, title: l.status },
          isoDate: l.reviewedAt
        }));
      }
    }

    // 3. Attendance & Missed Attendance
    const attendances = db.getCollection('attendance') || [];
    const todayLocal = new Date().toISOString().slice(0, 10);
    const presentTodayIds = new Set();
    for (const a of attendances) {
      const attUser = userMap.get(a.userId) || { id: a.userId, name: a.userName || 'Team Member', role: 'member', avatar: a.userAvatar || '/icon.png' };
      if (a.date === todayLocal && (a.status === 'present' || a.status === 'in_progress')) {
        presentTodayIds.add(a.userId);
      }
      const isPresent = a.status === 'present';
      addUnique(buildSyntheticEntry({
        id: `syn_att_${a.id}`,
        category: 'attendance',
        action: isPresent ? 'ATTENDANCE_VERIFIED' : 'ATTENDANCE_INCOMPLETE',
        title: isPresent ? `Attendance Marked: ${attUser.name}` : `Attendance Incomplete / Missed: ${attUser.name}`,
        description: isPresent
          ? `${attUser.name} verified attendance for ${a.date} (${Math.floor((a.durationSeconds || a.activeSeconds || 300) / 60)}m active).`
          : `${attUser.name} did not complete the 5-minute attendance requirement on ${a.date} (Status: ${a.status}).`,
        actor: attUser,
        target: { id: a.id, name: a.date, title: a.status },
        isoDate: a.completedTime || a.startTime || a.createdAt
      }));
    }

    // Highlight members who haven't marked attendance today
    for (const u of users) {
      if (!presentTodayIds.has(u.id)) {
        addUnique(buildSyntheticEntry({
          id: `syn_att_absent_${u.id}_${todayLocal}`,
          category: 'attendance',
          action: 'ATTENDANCE_NOT_MARKED',
          title: `Attendance Not Marked Today: ${u.name}`,
          description: `${u.name} has not marked attendance for today (${todayLocal}) yet.`,
          actor: u,
          target: { id: u.id, name: todayLocal, title: 'Not Marked' },
          isoDate: new Date().toISOString()
        }));
      }
    }

    // 4. Kudos & Gifts
    const gifts = db.getCollection('gifts') || [];
    for (const g of gifts) {
      const fromU = userMap.get(g.fromUserId) || { id: g.fromUserId, name: 'Team Member', role: 'admin', avatar: '/icon.png' };
      const toU = userMap.get(g.toUserId) || { id: g.toUserId, name: 'Team Member', role: 'member', avatar: '/icon.png' };
      addUnique(buildSyntheticEntry({
        id: `syn_gift_${g.id}`,
        category: 'kudos',
        action: 'KUDOS_AWARDED',
        title: `Recognition & Kudos: "${g.title || 'Appreciation'}"`,
        description: `${fromU.name} awarded "${g.title || 'Recognition'}" (+${g.points || 0} pts) to ${toU.name}${g.personalNote ? `: "${g.personalNote}"` : ''}.`,
        actor: fromU,
        target: { id: g.id, name: toU.name, title: g.title },
        isoDate: g.createdAt
      }));
    }

    // 5. Announcements (any not already in operations_history)
    const announcements = db.getCollection('announcements') || [];
    for (const ann of announcements) {
      const author = userMap.get(ann.authorId) || { id: ann.authorId, name: 'Leadership', role: 'admin', avatar: '/icon.png' };
      const alreadyLogged = rawHistory.some(h => h.target?.id === ann.id || h.id === `syn_ann_${ann.id}`);
      if (!alreadyLogged) {
        addUnique(buildSyntheticEntry({
          id: `syn_ann_${ann.id}`,
          category: 'announcement',
          action: 'ANNOUNCEMENT_POSTED',
          title: `Directive: "${ann.title}"`,
          description: `${author.name} posted in Directives: "${(ann.content || '').slice(0, 120)}".`,
          actor: author,
          target: { id: ann.id, name: ann.title, title: ann.title },
          isoDate: ann.createdAt
        }));
      }
    }

    // Sort newest first
    let history = combined.sort((a, b) => (b.epoch || new Date(b.timestamp).getTime()) - (a.epoch || new Date(a.timestamp).getTime()));

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
