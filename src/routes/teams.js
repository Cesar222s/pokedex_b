const express = require('express');
const Team = require('../models/Team');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all teams for current user
router.get('/', auth, async (req, res) => {
  const teams = await Team.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ teams });
});

// Create a team
router.post('/', auth, async (req, res) => {
  const { name, pokemon } = req.body;
  if (!name) return res.status(400).json({ error: 'Team name is required.' });

  if (pokemon && pokemon.length > 6) {
    return res.status(400).json({ error: 'A team can have at most 6 Pokémon.' });
  }

  const team = new Team({
    user: req.user._id,
    name,
    pokemon: pokemon || []
  });
  await team.save();
  res.status(201).json({ message: 'Team created.', team });
});

// Update team
router.put('/:id', auth, async (req, res) => {
  const team = await Team.findOne({ _id: req.params.id, user: req.user._id });
  if (!team) return res.status(404).json({ error: 'Team not found.' });

  const { name, pokemon } = req.body;
  if (name) team.name = name;
  if (pokemon) {
    if (pokemon.length > 6) {
      return res.status(400).json({ error: 'A team can have at most 6 Pokémon.' });
    }
    team.pokemon = pokemon;
  }

  await team.save();
  res.json({ message: 'Team updated.', team });
});

// Delete team
router.delete('/:id', auth, async (req, res) => {
  const team = await Team.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!team) return res.status(404).json({ error: 'Team not found.' });
  res.json({ message: 'Team deleted.' });
});

// Add Pokémon to team
router.post('/:id/pokemon', auth, async (req, res) => {
  const team = await Team.findOne({ _id: req.params.id, user: req.user._id });
  if (!team) return res.status(404).json({ error: 'Team not found.' });

  if (team.pokemon.length >= 6) {
    return res.status(400).json({ error: 'Team already has 6 Pokémon.' });
  }

  const { pokemonId, name, sprite, types, stats, selectedMoves } = req.body;
  if (!pokemonId || !name) {
    return res.status(400).json({ error: 'pokemonId and name are required.' });
  }

  team.pokemon.push({ pokemonId, name, sprite, types, stats, selectedMoves: selectedMoves || [] });
  await team.save();
  res.json({ message: 'Pokémon added to team.', team });
});

// Remove Pokémon from team
router.delete('/:id/pokemon/:pokemonId', auth, async (req, res) => {
  const team = await Team.findOne({ _id: req.params.id, user: req.user._id });
  if (!team) return res.status(404).json({ error: 'Team not found.' });

  const pokemonId = parseInt(req.params.pokemonId);
  team.pokemon = team.pokemon.filter(p => p.pokemonId !== pokemonId);
  await team.save();
  res.json({ message: 'Pokémon removed from team.', team });
});

module.exports = router;
