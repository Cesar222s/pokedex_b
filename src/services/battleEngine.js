// Full Pokémon type effectiveness chart
// Multipliers: 2 = super effective, 0.5 = not very effective, 0 = immune
const TYPE_CHART = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

/**
 * Get type effectiveness multiplier
 */
function getTypeEffectiveness(moveType, defenderTypes) {
  let multiplier = 1;
  for (const defType of defenderTypes) {
    const chart = TYPE_CHART[moveType];
    if (chart && chart[defType] !== undefined) {
      multiplier *= chart[defType];
    }
  }
  return multiplier;
}

/**
 * Calculate damage using the Pokémon damage formula
 * Level is assumed to be 50 for all battles
 */
function calculateDamage(attacker, defender, move, attackerTypes) {
  if (!move.power || move.power === 0) return 0;

  const level = 50;
  const isPhysical = move.damageClass === 'physical';
  const atk = isPhysical ? attacker.attack : attacker.specialAttack;
  const def = isPhysical ? defender.defense : defender.specialDefense;

  // Base damage
  let damage = ((2 * level / 5 + 2) * move.power * (atk / def)) / 50 + 2;

  // STAB (Same Type Attack Bonus)
  const stab = attackerTypes.includes(move.type) ? 1.5 : 1;

  // Type effectiveness
  const effectiveness = getTypeEffectiveness(move.type, defender.types || []);

  // Random factor (0.85 - 1.0)
  const random = 0.85 + Math.random() * 0.15;

  damage = Math.floor(damage * stab * effectiveness * random);
  return Math.max(1, damage); // minimum 1 damage unless immune
}

/**
 * Resolve a single turn of battle
 * Returns an object with events and updated HP
 */
function resolveTurn(challengerTeam, opponentTeam, state, challengerMoveName, opponentMoveName) {
  const events = [];
  const cActive = challengerTeam.pokemon[state.challengerActive];
  const oActive = opponentTeam.pokemon[state.opponentActive];
  const cHP = [...state.challengerHP];
  const oHP = [...state.opponentHP];

  if (!cActive || !oActive) {
    events.push('Error: Invalid active Pokémon index.');
    return { events, challengerHP: cHP, opponentHP: oHP, challengerFainted: false, opponentFainted: false };
  }

  // Find moves
  const cMove = cActive.selectedMoves.find(m => m.name === challengerMoveName);
  const oMove = oActive.selectedMoves.find(m => m.name === opponentMoveName);

  if (!cMove || !oMove) {
    events.push('Error: Invalid move selected.');
    return { events, challengerHP: cHP, opponentHP: oHP, challengerFainted: false, opponentFainted: false };
  }

  // Determine turn order by speed
  const cSpeed = cActive.stats.speed;
  const oSpeed = oActive.stats.speed;
  const challengerFirst = cSpeed >= oSpeed;

  const first = challengerFirst
    ? { poke: cActive, move: cMove, isChallenger: true }
    : { poke: oActive, move: oMove, isChallenger: false };
  const second = challengerFirst
    ? { poke: oActive, move: oMove, isChallenger: false }
    : { poke: cActive, move: cMove, isChallenger: true };

  let challengerFainted = false;
  let opponentFainted = false;

  // First attack
  const firstDefender = first.isChallenger ? oActive : cActive;
  const firstDmg = calculateDamage(first.poke.stats, firstDefender.stats, first.move, first.poke.types);
  const effectiveness1 = getTypeEffectiveness(first.move.type, firstDefender.types || []);

  events.push(`¡${first.poke.name} usó ${first.move.name}!`);
  if (effectiveness1 > 1) events.push("¡Es muy eficaz!");
  else if (effectiveness1 < 1 && effectiveness1 > 0) events.push("No es muy eficaz...");
  else if (effectiveness1 === 0) events.push("No afecta al oponente...");

  if (first.isChallenger) {
    oHP[state.opponentActive] = Math.max(0, oHP[state.opponentActive] - firstDmg);
    events.push(`¡${firstDefender.name} recibió ${firstDmg} de daño!`);
    if (oHP[state.opponentActive] <= 0) {
      events.push(`¡${firstDefender.name} se ha debilitado!`);
      opponentFainted = true;
    }
  } else {
    cHP[state.challengerActive] = Math.max(0, cHP[state.challengerActive] - firstDmg);
    events.push(`¡${firstDefender.name} recibió ${firstDmg} de daño!`);
    if (cHP[state.challengerActive] <= 0) {
      events.push(`¡${firstDefender.name} se ha debilitado!`);
      challengerFainted = true;
    }
  }

  // Second attack (only if second attacker is still alive)
  const secondStillAlive = second.isChallenger ? cHP[state.challengerActive] > 0 : oHP[state.opponentActive] > 0;
  if (secondStillAlive && !challengerFainted && !opponentFainted) {
    const secondDefender = second.isChallenger ? oActive : cActive;
    const secondDmg = calculateDamage(second.poke.stats, secondDefender.stats, second.move, second.poke.types);
    const effectiveness2 = getTypeEffectiveness(second.move.type, secondDefender.types || []);

    events.push(`¡${second.poke.name} usó ${second.move.name}!`);
    if (effectiveness2 > 1) events.push("¡Es muy eficaz!");
    else if (effectiveness2 < 1 && effectiveness2 > 0) events.push("No es muy eficaz...");
    else if (effectiveness2 === 0) events.push("No afecta al oponente...");

    if (second.isChallenger) {
      oHP[state.opponentActive] = Math.max(0, oHP[state.opponentActive] - secondDmg);
      events.push(`¡${secondDefender.name} recibió ${secondDmg} de daño!`);
      if (oHP[state.opponentActive] <= 0) {
        events.push(`¡${secondDefender.name} se ha debilitado!`);
        opponentFainted = true;
      }
    } else {
      cHP[state.challengerActive] = Math.max(0, cHP[state.challengerActive] - secondDmg);
      events.push(`¡${secondDefender.name} recibió ${secondDmg} de daño!`);
      if (cHP[state.challengerActive] <= 0) {
        events.push(`¡${secondDefender.name} se ha debilitado!`);
        challengerFainted = true;
      }
    }
  }

  return { events, challengerHP: cHP, opponentHP: oHP, challengerFainted, opponentFainted };
}

/**
 * Check if a player has any Pokémon left alive
 */
function hasAlivePokemon(hpArray) {
  return hpArray.some(hp => hp > 0);
}

/**
 * Get next alive Pokémon index, returns -1 if none
 */
function getNextAlive(hpArray, currentIndex) {
  for (let i = 0; i < hpArray.length; i++) {
    if (i !== currentIndex && hpArray[i] > 0) return i;
  }
  return -1;
}

module.exports = {
  calculateDamage,
  getTypeEffectiveness,
  resolveTurn,
  hasAlivePokemon,
  getNextAlive,
  TYPE_CHART
};
