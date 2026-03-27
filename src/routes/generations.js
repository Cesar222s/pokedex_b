const express = require('express');
const pokeapi = require('../services/pokeapi');
const router = express.Router();

// Region-to-generation mapping
const REGIONS = {
  kanto: 1, johto: 2, hoenn: 3, sinnoh: 4,
  unova: 5, kalos: 6, alola: 7, galar: 8, paldea: 9
};

// Get all generations/regions
router.get('/', async (req, res) => {
  const regions = Object.entries(REGIONS).map(([name, id]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    id,
    generationName: `generation-${['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'][id]}`
  }));
  res.json({ regions });
});

// Get Pokémon by region/generation
router.get('/:idOrName', async (req, res) => {
  let genId = req.params.idOrName;
  // Check if it's a region name
  if (REGIONS[genId.toLowerCase()]) {
    genId = REGIONS[genId.toLowerCase()];
  }

  const gen = await pokeapi.getGeneration(genId);
  const pokemon = gen.pokemon_species.map(s => ({
    name: s.name,
    id: parseInt(s.url.split('/').filter(Boolean).pop())
  })).sort((a, b) => a.id - b.id);

  res.json({
    name: gen.name,
    region: gen.main_region?.name,
    pokemon
  });
});

module.exports = router;
