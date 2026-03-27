const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const friendRequestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  friendCode: { type: String, unique: true, sparse: true },
  favorites: [{
    pokemonId: { type: Number, required: true },
    name: { type: String, required: true },
    sprite: { type: String, required: true },
    types: [{ type: String }]
  }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pushSubscription: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    username: this.username,
    email: this.email,
    friendCode: this.friendCode,
    favorites: this.favorites,
    friends: this.friends,
    createdAt: this.createdAt
  };
};

const User = mongoose.model('User', userSchema);
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

module.exports = { User, FriendRequest };
