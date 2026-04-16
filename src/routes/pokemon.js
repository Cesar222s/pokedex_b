const express = require('express');
const pokeapi = require('../services/pokeapi');
const router = express.Router();

// List Pokémon with pagination
router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  const list = await pokeapi.getPokemonList(limit, offset);
  const enriched = await Promise.all(
    list.results.map(async (item) => {
      try {
        const p = await pokeapi.getPokemon(item.name);
        return {
          id: p.id,
          name: p.name,
          sprite: p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default,
          types: p.types.map(t => t.type.name)
        };
      } catch {
        return null;
      }
    })
  );

  res.json({
    count: list.count,
    next: list.next,
    previous: list.previous,
    results: enriched.filter(Boolean)
  });
});

// Get detailed Pokémon data
router.get('/:idOrName', async (req, res) => {
  const p = await pokeapi.getPokemon(req.params.idOrName);
  res.json({
    id: p.id,
    name: p.name,
    height: p.height,
    weight: p.weight,
    sprites: {
      front_default: p.sprites?.front_default,
      official_artwork: p.sprites?.other?.['official-artwork']?.front_default,
      showdown: p.sprites?.other?.showdown?.front_default
    },
    types: p.types.map(t => ({ slot: t.slot, name: t.type.name })),
    stats: p.stats.map(s => ({ name: s.stat.name, value: s.base_stat })),
    abilities: p.abilities.map(a => ({ name: a.ability.name, hidden: a.is_hidden })),
    moves: p.moves.slice(0, 50).map(m => ({
      name: m.move.name,
      url: m.move.url
    }))
  });
});

// Get species data
router.get('/:id/species', async (req, res) => {
  const s = await pokeapi.getPokemonSpecies(req.params.id);
  const flavorEntry = s.flavor_text_entries?.find(f => f.language?.name === 'en');
  const genusEntry = s.genera?.find(g => g.language?.name === 'en');

  // Extract evolution chain ID from URL
  const evoChainId = s.evolution_chain?.url
    ? parseInt(s.evolution_chain.url.split('/').filter(Boolean).pop())
    : null;

  res.json({
    id: s.id,
    name: s.name,
    color: s.color?.name,
    habitat: s.habitat?.name,
    generation: s.generation?.name,
    flavorText: flavorEntry?.flavor_text?.replace(/\f|\n/g, ' ') || '',
    genus: genusEntry?.genus || '',
    evolutionChainId: evoChainId,
    isLegendary: s.is_legendary,
    isMythical: s.is_mythical
  });
});

// Get evolution chain
router.get('/:id/evolution', async (req, res) => {
  // First get species to find chain ID
  const species = await pokeapi.getPokemonSpecies(req.params.id);
  const chainUrl = species.evolution_chain?.url;
  if (!chainUrl) {
    return res.json({ chain: [] });
  }

  const chainId = parseInt(chainUrl.split('/').filter(Boolean).pop());
  const chainData = await pokeapi.getEvolutionChain(chainId);
  const chain = pokeapi.parseEvolutionChain(chainData.chain);

  // Enrich with sprites
  const enriched = await Promise.all(
    chain.map(async (evo) => {
      try {
        const p = await pokeapi.getPokemon(evo.name);
        return {
          ...evo,
          sprite: p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default,
          types: p.types.map(t => t.type.name)
        };
      } catch {
        return evo;
      }
    })
  );

  res.json({ chain: enriched });
});

// Get moves for a Pokémon (with details)
router.get('/:id/moves', async (req, res) => {
  try {
    const p = await pokeapi.getPokemon(req.params.id);
    
    // Sort moves to prioritize level-up and machine moves if possible,
    // but for now let's just take a larger slice (top 70) to ensure variety
    const movePromises = p.moves.slice(0, 70).map(async (m) => {
      try {
        const moveData = await pokeapi.getMove(m.move.name);
        return {
          name: moveData.name,
          power: moveData.power,
          accuracy: moveData.accuracy,
          pp: moveData.pp,
          type: moveData.type?.name,
          damageClass: moveData.damage_class?.name,
          priority: moveData.priority,
          effect: moveData.effect_entries?.find(e => e.language.name === 'en')?.short_effect
        };
      } catch {
        return null;
      }
    });

    const moves = (await Promise.all(movePromises)).filter(Boolean);
    res.json({ moves });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch moves' });
  }
});

module.exports = router;
