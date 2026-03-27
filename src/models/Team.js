const mongoose = require('mongoose');

const teamPokemonSchema = new mongoose.Schema({
  pokemonId: { type: Number, required: true },
  name: { type: String, required: true },
  sprite: { type: String },
  types: [{ type: String }],
  stats: {
    hp: Number,
    attack: Number,
    defense: Number,
    specialAttack: Number,
    specialDefense: Number,
    speed: Number
  },
  selectedMoves: [{
    name: { type: String },
    power: { type: Number },
    accuracy: { type: Number },
    pp: { type: Number },
    type: { type: String },
    damageClass: { type: String }
  }]
}, { _id: false });

const teamSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 30 },
  pokemon: {
    type: [teamPokemonSchema],
    validate: [arr => arr.length <= 6, 'A team can have at most 6 Pokémon']
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', teamSchema);
