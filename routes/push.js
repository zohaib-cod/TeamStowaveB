const express = require('express');
const { VAPID_PUBLIC_KEY, saveSubscription, sendPushToActiveUsers } = require('../services/pushNotificationService');

const router = express.Router();

/**
 * 1. Get VAPID Public Key for Browser PushManager
 */
router.get('/public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

/**
 * 2. Register / Update Browser Push Subscription
 */
router.post('/subscribe', (req, res) => {
  const { userId, userEmail, subscription, userAgent } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Valid PushSubscription object is required' });
  }

  const result = saveSubscription({ userId, userEmail, subscription, userAgent });
  if (!result) {
    return res.status(500).json({ error: 'Failed to record push subscription' });
  }

  res.json({ success: true, message: 'Device subscribed to background web push notifications' });
});

/**
 * 3. Send Test Push Notification
 */
router.post('/test', async (req, res) => {
  const { title = 'Stowave Test Notification', body = 'Background Web Push is active on your device!' } = req.body || {};
  const result = await sendPushToActiveUsers({
    title,
    body,
    url: '/',
    tag: 'stowave-test'
  });
  res.json(result);
});

module.exports = router;
