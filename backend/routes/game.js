const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Game = require('../models/Game');

// Create game
router.post('/create', auth, async (req, res) => {
  try {
    const { opponentId } = req.body;

    const game = new Game({
      players: [
        {
          userId: req.user._id,
          symbol: 'X',
          name: req.user.name
        }
      ],
      currentTurn: 'X',
      status: 'waiting'
    });

    if (opponentId) {
      // Find opponent
      const opponent = await User.findById(opponentId);
      if (opponent) {
        game.players.push({
          userId: opponent._id,
          symbol: 'O',
          name: opponent.name
        });
        game.status = 'playing';
      }
    }

    await game.save();
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get game
router.get('/:gameId', auth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Make move
router.post('/:gameId/move', auth, async (req, res) => {
  try {
    const { position } = req.body;
    const game = await Game.findById(req.params.gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status === 'finished') {
      return res.status(400).json({ error: 'Game already finished' });
    }

    // Check if it's player's turn
    const player = game.players.find(p => p.userId.toString() === req.user._id.toString());
    if (!player || player.symbol !== game.currentTurn) {
      return res.status(400).json({ error: 'Not your turn' });
    }

    if (game.board[position] !== null) {
      return res.status(400).json({ error: 'Position already taken' });
    }

    // Make move
    game.board[position] = player.symbol;
    game.moveHistory.push({
      player: player.symbol,
      position,
      timestamp: new Date()
    });

    // Check winner
    const winner = checkWinner(game.board);
    if (winner) {
      game.winner = winner;
      game.status = 'finished';
    } else if (game.board.every(cell => cell !== null)) {
      game.winner = 'draw';
      game.status = 'finished';
    } else {
      game.currentTurn = game.currentTurn === 'X' ? 'O' : 'X';
    }

    await game.save();
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check winner function
function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

module.exports = router;