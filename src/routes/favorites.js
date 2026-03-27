const express = require('express');
const { User } = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Get favorites
router.get('/', auth, async (req, res) => {
  res.json({ favorites: req.user.favorites });
});

// Add favorite
router.post('/:pokemonId', auth, async (req, res) => {
  const pokemonId = parseInt(req.params.pokemonId);
  if (isNaN(pokemonId)) {
    return res.status(400).json({ error: 'Invalid Pokémon ID.' });
  }

  const user = await User.findById(req.user._id);
  if (user.favorites.includes(pokemonId)) {
    return res.status(409).json({ error: 'Pokémon already in favorites.' });
  }

  user.favorites.push(pokemonId);
  await user.save();
  res.json({ message: 'Added to favorites.', favorites: user.favorites });
});

// Remove favorite
router.delete('/:pokemonId', auth, async (req, res) => {
  const pokemonId = parseInt(req.params.pokemonId);
  const user = await User.findById(req.user._id);

  user.favorites = user.favorites.filter(id => id !== pokemonId);
  await user.save();
  res.json({ message: 'Removed from favorites.', favorites: user.favorites });
});

module.exports = router;
