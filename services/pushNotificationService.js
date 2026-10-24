const webpush = require('web-push');
const db = require('../db');

// VAPID Credentials for Browser Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BCfYxwL3uLUkcwb2pnhYt57n4hj_VcvuD_4pszA2xnu8yiyhlc0FzWD1ypTODKhQcI7fDNOwbY7FPdyfbKRSEEo';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'Ia22e0LOjSD41zC-vziaNylybijiK4hXq9AzEhsxii8';
const VAPID_MAILTO = process.env.VAPID_MAILTO || 'mailto:alizohaib.web@gmail.com';

try {
  webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('🔔 Web Push VAPID initialized successfully');
} catch (err) {
  console.error('Failed to set VAPID details:', err.message);
}

/**
 * Saves or updates a browser push subscription for a user
 */
function saveSubscription({ userId, userEmail, subscription, userAgent }) {
  if (!subscription || !subscription.endpoint) return null;

  try {
    const subs = db.getCollection('push_subscriptions') || [];
    const now = Date.now();
    const existing = subs.find(s => s.subscription?.endpoint === subscription.endpoint);

    if (existing) {
      db.updateItem('push_subscriptions', existing.id, {
        userId: userId || existing.userId,
        userEmail: userEmail || existing.userEmail,
        subscription,
        userAgent: userAgent || existing.userAgent,
        lastActive: now,
        updatedAt: new Date().toISOString()
      });
      return existing;
    } else {
      const newSub = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        userId: userId || 'anonymous',
        userEmail: userEmail || '',
        subscription,
        userAgent: userAgent || 'Browser Device',
        lastActive: now,
        createdAt: new Date().toISOString()
      };
      db.addItem('push_subscriptions', newSub);
      console.log(`📱 Push subscription registered for ${userEmail || userId}`);
      return newSub;
    }
  } catch (err) {
    console.error('saveSubscription error:', err.message);
    return null;
  }
}

/**
 * Dispatches a native browser Push Notification to all users
 * who logged in or were active within the last 3 days — even if the portal is closed!
 */
async function sendPushToActiveUsers({
  title = 'Stowave Global Update',
  body = 'New company announcement or operational deliverable.',
  icon = '/icon.png',
  url = '/',
  tag = 'stowave-alert',
  excludeUserId = null
}) {
  try {
    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

    const allUsers = db.getCollection('users') || [];
    const subs = db.getCollection('push_subscriptions') || [];

    // Find users who have logged in or had presence activity within the last 3 days
    const activeUserIds = new Set();
    allUsers.forEach(u => {
      const last = u.lastActive || u.lastHeartbeat || u.lastSeen || (u.lastLogin ? new Date(u.lastLogin).getTime() : 0);
      if (last && (now - last) <= THREE_DAYS_MS) {
        activeUserIds.add(u.id);
      }
    });

    // Also include any subscription registered within the last 3 days
    const targetSubs = subs.filter(s => {
      if (excludeUserId && s.userId === excludeUserId) return false;
      const subRecent = s.lastActive && (now - s.lastActive) <= THREE_DAYS_MS;
      const userRecent = s.userId && activeUserIds.has(s.userId);
      return subRecent || userRecent || subs.length <= 5; // fallback to alert registered devices
    });

    console.log(`📡 Dispatching Web Push to ${targetSubs.length} device subscriptions (3-day active criterion)`);

    const payload = JSON.stringify({
      title,
      body,
      icon,
      badge: icon,
      url,
      tag,
      timestamp: now
    });

    const sendPromises = targetSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        return { success: true, id: sub.id };
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or user revoked browser permission
          console.log(`Removing expired subscription: ${sub.id}`);
          try { db.deleteItem('push_subscriptions', sub.id); } catch (e) {}
        } else {
          console.warn(`Push dispatch warning on ${sub.id}:`, err.message);
        }
        return { success: false, error: err.message };
      }
    });

    const results = await Promise.allSettled(sendPromises);
    const successfulCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;

    console.log(`✅ Push dispatch completed: ${successfulCount}/${targetSubs.length} devices reached`);
    return { success: true, sent: successfulCount, total: targetSubs.length };
  } catch (err) {
    console.error('sendPushToActiveUsers error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  VAPID_PUBLIC_KEY,
  saveSubscription,
  sendPushToActiveUsers
};
