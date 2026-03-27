const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const auth = require('../middleware/auth');
const { User } = require('../models/User');

// Configure web-push (Safe check for production/Railway)
if (process.env.PUSH_VAPID_PUBLIC_KEY && process.env.PUSH_VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.PUSH_CONTACT_EMAIL || 'mailto:admin@serviciomaestro.com',
    process.env.PUSH_VAPID_PUBLIC_KEY,
    process.env.PUSH_VAPID_PRIVATE_KEY
  );
  console.log('✅ Web-Push configured successfully.');
} else {
  console.warn('⚠️ PUSH_VAPID_PUBLIC_KEY or PUSH_VAPID_PRIVATE_KEY missing. Push notifications disabled.');
}

// Subscribe route
router.post('/subscribe', auth, async (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription object must contain an endpoint.' });
  }

  try {
    await User.findByIdAndUpdate(req.user._id, { pushSubscription: subscription });
    res.status(201).json({ message: 'Push subscription saved successfully.' });
  } catch (err) {
    console.error('Error saving push subscription:', err);
    res.status(500).json({ error: 'Failed to save push subscription.' });
  }
});

// Helper function to send notification (to be used by other routes)
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.pushSubscription) return;

    const payload = JSON.stringify({
      notification: {
        title,
        body,
        icon: '/pwa-192x192.svg',
        badge: '/pwa-192x192.svg',
        vibrate: [100, 50, 100],
        data,
        actions: [
          { action: 'open', title: 'Ver ahora' }
        ]
      }
    });

    await webpush.sendNotification(user.pushSubscription, payload);
    console.log(`Push notification sent to user ${userId}`);
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log('Subscription expired or no longer valid, removing from user.');
      await User.findByIdAndUpdate(userId, { pushSubscription: null });
    } else {
      console.error('Error sending push notification:', err);
    }
  }
};

module.exports = { router, sendPushNotification };
