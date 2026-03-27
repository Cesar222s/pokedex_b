const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Generate unique short friend code (6 chars)
    let friendCode;
    let codeExists = true;
    while (codeExists) {
      friendCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const check = await User.findOne({ friendCode });
      if (!check) codeExists = false;
    }

    const user = new User({ username, email, password, friendCode });
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Registration successful.',
      token,
      user: user.toPublicJSON()
    });
  } catch (err) {
    console.error('Registration Error Details:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({ 
        error: field === 'email' ? 'Email already registered.' : 'Username already taken.' 
      });
    }
    throw err;
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.json({
    message: 'Login successful.',
    token,
    user: user.toPublicJSON()
  });
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
});

module.exports = router;
