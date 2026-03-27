const express = require('express');
const { User } = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Get favorites
router.get('/', auth, async (req, res) => {
  res.json({ favorites: req.user.favorites });
});

// Add favorite
router.post('/', auth, async (req, res) => {
  const { pokemonId, name, sprite } = req.body;
  
  if (!pokemonId || !name || !sprite) {
    return res.status(400).json({ error: 'Missing Pokémon data (id, name, sprite).' });
  }

  const user = await User.findById(req.user._id);
  const exists = user.favorites.some(f => f.pokemonId === pokemonId);
  
  if (exists) {
    return res.status(409).json({ error: 'Pokémon already in favorites.' });
  }

  user.favorites.push({ pokemonId, name, sprite });
  await user.save();
  res.json({ message: 'Added to favorites.', favorites: user.favorites });
});

// Remove favorite
router.delete('/:pokemonId', auth, async (req, res) => {
  const pokemonId = parseInt(req.params.pokemonId);
  const user = await User.findById(req.user._id);

  user.favorites = user.favorites.filter(f => f.pokemonId !== pokemonId);
  await user.save();
  res.json({ message: 'Removed from favorites.', favorites: user.favorites });
});

module.exports = router;
