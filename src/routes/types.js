const express = require('express');
const pokeapi = require('../services/pokeapi');
const router = express.Router();

// Get all types
router.get('/', async (req, res) => {
  const data = await pokeapi.getTypeList();
  const types = data.results
    .filter(t => t.name !== 'unknown' && t.name !== 'shadow')
    .map(t => t.name);
  res.json({ types });
});

// Get Pokémon by type
router.get('/:name', async (req, res) => {
  const data = await pokeapi.getType(req.params.name);
  const pokemon = data.pokemon.map(p => ({
    name: p.pokemon.name,
    url: p.pokemon.url,
    id: parseInt(p.pokemon.url.split('/').filter(Boolean).pop())
  }));
  res.json({ type: req.params.name, pokemon });
});

module.exports = router;
