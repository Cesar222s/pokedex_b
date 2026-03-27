const mongoose = require('mongoose');

const battleSchema = new mongoose.Schema({
  challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  opponent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  challengerTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  opponentTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed'],
    default: 'pending'
  },
  // Battle state
  state: {
    challengerActive: { type: Number, default: 0 }, // index in team
    opponentActive: { type: Number, default: 0 },
    challengerHP: [Number],
    opponentHP: [Number],
    challengerMove: { type: String, default: null },
    opponentMove: { type: String, default: null },
    currentTurn: { type: Number, default: 1 }
  },
  log: [{
    turn: Number,
    events: [String],
    timestamp: { type: Date, default: Date.now }
  }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Battle', battleSchema);
