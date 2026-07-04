const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
  players: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    symbol: {
      type: String,
      enum: ['X', 'O']
    },
    name: String
  }],
  currentTurn: {
    type: String,
    enum: ['X', 'O']
  },
  board: {
    type: [String],
    default: Array(9).fill(null)
  },
  winner: {
    type: String,
    enum: ['X', 'O', 'draw', null],
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'playing', 'finished'],
    default: 'waiting'
  },
  timer: {
    type: Number,
    default: 20
  },
  moveHistory: [{
    player: String,
    position: Number,
    timestamp: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Game', GameSchema);