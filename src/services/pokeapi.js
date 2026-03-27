const POKEAPI_BASE = process.env.POKEAPI_BASE || 'https://pokeapi.co/api/v2';

// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

async function fetchFromPokeAPI(path) {
  const url = path.startsWith('http') ? path : `${POKEAPI_BASE}${path}`;
  const cached = getCached(url);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`PokeAPI error: ${res.status} for ${url}`);
  const data = await res.json();
  setCache(url, data);
  return data;
}

// ── Pokémon ──
async function getPokemonList(limit = 20, offset = 0) {
  return fetchFromPokeAPI(`/pokemon?limit=${limit}&offset=${offset}`);
}

async function getPokemon(idOrName) {
  return fetchFromPokeAPI(`/pokemon/${idOrName}`);
}

async function getPokemonSpecies(idOrName) {
  return fetchFromPokeAPI(`/pokemon-species/${idOrName}`);
}

async function getEvolutionChain(id) {
  return fetchFromPokeAPI(`/evolution-chain/${id}`);
}

async function getMove(idOrName) {
  return fetchFromPokeAPI(`/move/${idOrName}`);
}

// ── Types & Generations ──
async function getTypeList() {
  return fetchFromPokeAPI('/type');
}

async function getType(name) {
  return fetchFromPokeAPI(`/type/${name}`);
}

async function getGenerationList() {
  return fetchFromPokeAPI('/generation');
}

async function getGeneration(idOrName) {
  return fetchFromPokeAPI(`/generation/${idOrName}`);
}

// ── Helper: Enrich a list of pokemon names/urls with basic data ──
async function enrichPokemonList(pokemonItems, limit = 20, offset = 0) {
  const slice = pokemonItems.slice(offset, offset + limit);
  const enriched = await Promise.all(
    slice.map(async (item) => {
      try {
        const p = await getPokemon(item.name || item.pokemon_species?.name);
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
  return enriched.filter(Boolean);
}

// ── Helper: Parse evolution chain into flat array ──
function parseEvolutionChain(chain) {
  const evolutions = [];

  function walk(node) {
    if (!node) return;
    const speciesName = node.species?.name;
    const speciesId = node.species?.url ? parseInt(node.species.url.split('/').filter(Boolean).pop()) : null;
    const details = node.evolution_details?.[0] || {};

    evolutions.push({
      name: speciesName,
      id: speciesId,
      minLevel: details.min_level || null,
      trigger: details.trigger?.name || null,
      item: details.item?.name || null
    });

    if (node.evolves_to) {
      node.evolves_to.forEach(walk);
    }
  }

  walk(chain);
  return evolutions;
}

module.exports = {
  getPokemonList,
  getPokemon,
  getPokemonSpecies,
  getEvolutionChain,
  getMove,
  getTypeList,
  getType,
  getGenerationList,
  getGeneration,
  enrichPokemonList,
  parseEvolutionChain,
  fetchFromPokeAPI
};
