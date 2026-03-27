const express = require('express');
const { User, FriendRequest } = require('../models/User');
const auth = require('../middleware/auth');
const { sendPushNotification } = require('./notifications');
const router = express.Router();

// Search users
router.get('/search', auth, async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
  }

  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [
      { username: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } }
    ]
  }).select('username email').limit(20);

  res.json({ users });
});

// Get friends list
router.get('/friends', auth, async (req, res) => {
  const user = await User.findById(req.user._id).populate('friends', 'username email');
  res.json({ friends: user.friends });
});

// Send friend request
router.post('/friends/request', auth, async (req, res) => {
  const { email, username } = req.body;
  if (!email && !username) {
    return res.status(400).json({ error: 'Email or username is required.' });
  }

  const query = email ? { email: email.toLowerCase() } : { username };
  const targetUser = await User.findOne(query);
  if (!targetUser) return res.status(404).json({ error: 'User not found.' });
  if (targetUser._id.equals(req.user._id)) {
    return res.status(400).json({ error: 'Cannot add yourself as a friend.' });
  }

  // Check if already friends
  const currentUser = await User.findById(req.user._id);
  if (currentUser.friends.includes(targetUser._id)) {
    return res.status(409).json({ error: 'Already friends.' });
  }

  // Check existing pending request
  const existing = await FriendRequest.findOne({
    $or: [
      { from: req.user._id, to: targetUser._id, status: 'pending' },
      { from: targetUser._id, to: req.user._id, status: 'pending' }
    ]
  });
  if (existing) {
    return res.status(409).json({ error: 'Friend request already pending.' });
  }

  const request = new FriendRequest({ from: req.user._id, to: targetUser._id });
  await request.save();

  // Notify target user
  await sendPushNotification(
    targetUser._id,
    'Nueva solicitud de amistad',
    `${req.user.username} quiere ser tu amigo en PokéDex.`,
    { url: '/social' }
  );

  res.status(201).json({ message: 'Friend request sent.', request });
});

// Get pending friend requests
router.get('/friends/requests', auth, async (req, res) => {
  const incoming = await FriendRequest.find({ to: req.user._id, status: 'pending' })
    .populate('from', 'username email');
  const outgoing = await FriendRequest.find({ from: req.user._id, status: 'pending' })
    .populate('to', 'username email');

  res.json({ incoming, outgoing });
});

// Accept friend request
router.post('/friends/accept/:requestId', auth, async (req, res) => {
  const request = await FriendRequest.findOne({ _id: req.params.requestId, to: req.user._id, status: 'pending' });
  if (!request) return res.status(404).json({ error: 'Friend request not found.' });

  request.status = 'accepted';
  await request.save();

  // Add each other as friends
  await User.findByIdAndUpdate(req.user._id, { $addToSet: { friends: request.from } });
  await User.findByIdAndUpdate(request.from, { $addToSet: { friends: req.user._id } });

  // Notify original requester
  await sendPushNotification(
    request.from,
    'Solicitud de amistad aceptada',
    `${req.user.username} ha aceptado tu solicitud de amistad.`,
    { url: '/social' }
  );

  res.json({ message: 'Friend request accepted.' });
});

// Reject friend request
router.post('/friends/reject/:requestId', auth, async (req, res) => {
  const request = await FriendRequest.findOne({ _id: req.params.requestId, to: req.user._id, status: 'pending' });
  if (!request) return res.status(404).json({ error: 'Friend request not found.' });

  request.status = 'rejected';
  await request.save();
  res.json({ message: 'Friend request rejected.' });
});

// Remove friend
router.delete('/friends/:friendId', auth, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $pull: { friends: req.params.friendId } });
  await User.findByIdAndUpdate(req.params.friendId, { $pull: { friends: req.user._id } });
  res.json({ message: 'Friend removed.' });
});

module.exports = router;
