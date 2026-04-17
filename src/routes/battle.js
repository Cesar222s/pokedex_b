const express = require('express');
const Battle = require('../models/Battle');
const Team = require('../models/Team');
const { User } = require('../models/User');
const auth = require('../middleware/auth');
const { resolveSingleAttack, hasAlivePokemon, getNextAlive } = require('../services/battleEngine');
const { sendPushNotification } = require('./notifications');
const socketService = require('../services/socket');
const router = express.Router();

// Challenge a friend
router.post('/challenge', auth, async (req, res) => {
  const { opponentId, teamId } = req.body;
  if (!opponentId || !teamId) {
    return res.status(400).json({ error: 'opponentId and teamId are required.' });
  }

  // Verify friendship
  const user = await User.findById(req.user._id);
  if (!user.friends.map(f => f.toString()).includes(opponentId)) {
    return res.status(403).json({ error: 'You can only challenge friends.' });
  }

  // Verify team exists and has Pokémon
  const team = await Team.findOne({ _id: teamId, user: req.user._id });
  if (!team || team.pokemon.length === 0) {
    return res.status(400).json({ error: 'Invalid team or team has no Pokémon.' });
  }

  // Check all Pokémon have selected moves
  const invalidPoke = team.pokemon.find(p => !p.selectedMoves || p.selectedMoves.length === 0);
  if (invalidPoke) {
    return res.status(400).json({ error: `${invalidPoke.name} has no moves selected. Configure moves before battling.` });
  }

  const battle = new Battle({
    challenger: req.user._id,
    opponent: opponentId,
    challengerTeam: teamId
  });
  await battle.save();

  // Notify opponent via Socket (real-time)
  socketService.emitToUser(opponentId, 'battle-challenge-received', {
    battle: {
      _id: battle._id,
      challenger: { _id: req.user._id, username: user.username, email: user.email },
      challengerTeam: team
    }
  });

  // Notify opponent via push (fallback for offline)
  await sendPushNotification(
    opponentId,
    '¡Nuevo reto de batalla!',
    `${user.username} te ha desafiado a un combate Pokémon.`,
    { url: `/battles?accept=${battle._id}` }
  );

  res.status(201).json({ message: 'Battle challenge sent!', battle });
});

// Get pending challenges
router.get('/pending', auth, async (req, res) => {
  const incoming = await Battle.find({ opponent: req.user._id, status: 'pending' })
    .populate('challenger', 'username email')
    .populate('challengerTeam', 'name pokemon');
  const outgoing = await Battle.find({ challenger: req.user._id, status: 'pending' })
    .populate('opponent', 'username email');

  res.json({ incoming, outgoing });
});

// Accept challenge
router.post('/:id/accept', auth, async (req, res) => {
  const { teamId } = req.body;
  if (!teamId) return res.status(400).json({ error: 'teamId is required.' });

  const battle = await Battle.findOne({ _id: req.params.id, opponent: req.user._id, status: 'pending' });
  if (!battle) return res.status(404).json({ error: 'Battle not found.' });

  const team = await Team.findOne({ _id: teamId, user: req.user._id });
  if (!team || team.pokemon.length === 0) {
    return res.status(400).json({ error: 'Invalid team or team has no Pokémon.' });
  }

  const invalidPoke = team.pokemon.find(p => !p.selectedMoves || p.selectedMoves.length === 0);
  if (invalidPoke) {
    return res.status(400).json({ error: `${invalidPoke.name} has no moves selected.` });
  }

  // Get challenger team for HP initialization
  const challengerTeam = await Team.findById(battle.challengerTeam);

  // Randomly assign first attacker
  const firstAttacker = Math.random() < 0.5 ? 'challenger' : 'opponent';

  battle.opponentTeam = teamId;
  battle.status = 'active';
  battle.state = {
    challengerActive: 0,
    opponentActive: 0,
    challengerHP: challengerTeam.pokemon.map(p => p.stats?.hp || 100),
    opponentHP: team.pokemon.map(p => p.stats?.hp || 100),
    challengerMove: null,
    opponentMove: null,
    currentTurn: 1,
    currentAttacker: firstAttacker
  };

  await battle.save();

  // Get full battle state for emission
  const fullBattle = await getBattleState(battle._id);

  // Emit battle-accepted to BOTH players via their personal rooms
  // Both will auto-navigate to the arena
  socketService.emitToUser(battle.challenger, 'battle-accepted', {
    battleId: battle._id.toString(),
    battle: fullBattle
  });
  socketService.emitToUser(battle.opponent, 'battle-accepted', {
    battleId: battle._id.toString(),
    battle: fullBattle
  });

  // Push notification fallback for challenger
  await sendPushNotification(
    battle.challenger,
    '¡Reto aceptado!',
    `${req.user.username} ha aceptado tu reto. ¡Que comience el combate!`,
    { url: `/battles/${battle._id}` }
  );

  res.json({ message: 'Battle started!', battle: fullBattle });
});

// Reject challenge
router.post('/:id/reject', auth, async (req, res) => {
  const battle = await Battle.findOne({ _id: req.params.id, opponent: req.user._id, status: 'pending' });
  if (!battle) return res.status(404).json({ error: 'Battle not found.' });

  await Battle.findByIdAndDelete(battle._id);
  res.json({ message: 'Battle rejected.' });
});

// Submit a turn (move selection) — TURN-BY-TURN system
router.post('/:id/turn', auth, async (req, res) => {
  const { moveName, switchTo } = req.body;
  const battle = await Battle.findById(req.params.id)
    .populate('challengerTeam')
    .populate('opponentTeam');

  if (!battle || battle.status !== 'active') {
    return res.status(404).json({ error: 'Active battle not found.' });
  }

  const isChallenger = battle.challenger.toString() === req.user._id.toString();
  const isOpponent = battle.opponent.toString() === req.user._id.toString();
  if (!isChallenger && !isOpponent) {
    return res.status(403).json({ error: 'You are not part of this battle.' });
  }

  const myRole = isChallenger ? 'challenger' : 'opponent';

  // Handle switch (allowed anytime on your turn, or when your pokemon fainted)
  if (switchTo !== undefined && switchTo !== null) {
    const hpArr = isChallenger ? battle.state.challengerHP : battle.state.opponentHP;
    const team = isChallenger ? battle.challengerTeam : battle.opponentTeam;
    if (switchTo < 0 || switchTo >= team.pokemon.length || hpArr[switchTo] <= 0) {
      return res.status(400).json({ error: 'Invalid switch target.' });
    }
    if (isChallenger) battle.state.challengerActive = switchTo;
    else battle.state.opponentActive = switchTo;

    battle.markModified('state');
    await battle.save();

    const battleState = await getBattleState(battle._id);
    socketService.emitToBattle(battle._id, 'battle-updated', { battle: battleState });
    return res.json({ message: 'Pokémon switched.', battle: battleState });
  }

  // Verify it's this player's turn
  if (battle.state.currentAttacker !== myRole) {
    return res.status(400).json({ error: 'No es tu turno.' });
  }

  if (!moveName) {
    return res.status(400).json({ error: 'moveName or switchTo is required.' });
  }

  // Resolve the attack immediately (turn-by-turn)
  const attackerTeam = isChallenger ? battle.challengerTeam : battle.opponentTeam;
  const defenderTeam = isChallenger ? battle.opponentTeam : battle.challengerTeam;

  const result = resolveSingleAttack(
    attackerTeam,
    defenderTeam,
    battle.state,
    moveName,
    isChallenger
  );

  // Update HP
  battle.state.challengerHP = result.challengerHP;
  battle.state.opponentHP = result.opponentHP;

  // Log the turn
  battle.log.push({
    turn: battle.state.currentTurn,
    events: result.events
  });

  // Handle fainting — auto-switch to next alive
  if (result.defenderFainted) {
    const defenderIsChallenger = !isChallenger;
    const defenderHP = defenderIsChallenger ? result.challengerHP : result.opponentHP;
    const defenderActiveIdx = defenderIsChallenger ? battle.state.challengerActive : battle.state.opponentActive;
    const defenderTeamData = defenderIsChallenger ? battle.challengerTeam : battle.opponentTeam;

    if (hasAlivePokemon(defenderHP)) {
      // Auto-switch to next alive Pokémon
      const next = getNextAlive(defenderHP, defenderActiveIdx);
      if (next >= 0) {
        if (defenderIsChallenger) battle.state.challengerActive = next;
        else battle.state.opponentActive = next;
        battle.log[battle.log.length - 1].events.push(
          `¡${defenderTeamData.pokemon[next].name} entra al combate!`
        );
      }
    }
  }

  // Check for winner
  if (!hasAlivePokemon(result.challengerHP)) {
    battle.status = 'completed';
    battle.winner = battle.opponent;
    battle.log[battle.log.length - 1].events.push('¡El combate ha terminado!');
  } else if (!hasAlivePokemon(result.opponentHP)) {
    battle.status = 'completed';
    battle.winner = battle.challenger;
    battle.log[battle.log.length - 1].events.push('¡El combate ha terminado!');
  } else {
    // Switch turn to the other player
    battle.state.currentAttacker = battle.state.currentAttacker === 'challenger' ? 'opponent' : 'challenger';
    battle.state.currentTurn += 1;
  }

  // Notify winner/loser via push if battle is completed
  if (battle.status === 'completed' && battle.winner) {
    const winnerId = battle.winner;
    const loserId = winnerId.toString() === battle.challenger.toString() ? battle.opponent : battle.challenger;
    await sendPushNotification(winnerId, '¡Victoria!', '¡Has ganado la batalla Pokémon!', { url: `/battles/${battle._id}` });
    await sendPushNotification(loserId, 'Derrota', 'Tu equipo ha caído en combate.', { url: `/battles/${battle._id}` });
  }

  battle.markModified('state');
  battle.markModified('log');
  await battle.save();

  // Emit to both players immediately
  const battleState = await getBattleState(battle._id);
  socketService.emitToBattle(battle._id, 'battle-updated', { battle: battleState });

  res.json({ message: 'Move resolved.', battle: battleState });
});

// Get battle state
router.get('/:id', auth, async (req, res) => {
  const battle = await getBattleState(req.params.id);
  if (!battle) return res.status(404).json({ error: 'Battle not found.' });

  const isChallenger = battle.challenger._id?.toString() === req.user._id.toString();
  const isOpponent = battle.opponent._id?.toString() === req.user._id.toString();
  if (!isChallenger && !isOpponent) {
    return res.status(403).json({ error: 'You are not part of this battle.' });
  }

  res.json({ battle, perspective: isChallenger ? 'challenger' : 'opponent' });
});

// Battle history
router.get('/', auth, async (req, res) => {
  const battles = await Battle.find({
    $or: [{ challenger: req.user._id }, { opponent: req.user._id }],
    status: 'completed'
  })
    .populate('challenger', 'username')
    .populate('opponent', 'username')
    .populate('winner', 'username')
    .sort({ createdAt: -1 })
    .limit(20);

  res.json({ battles });
});

async function getBattleState(id) {
  return Battle.findById(id)
    .populate('challenger', 'username email')
    .populate('opponent', 'username email')
    .populate('challengerTeam')
    .populate('opponentTeam')
    .populate('winner', 'username');
}

module.exports = router;
