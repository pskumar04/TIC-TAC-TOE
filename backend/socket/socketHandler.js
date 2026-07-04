const Game = require('../models/Game');
const User = require('../models/User');

module.exports = (io) => {
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    console.log('✅ New client connected:', socket.id);

    socket.on('user-online', async (userId) => {
      try {
        console.log(`👤 User ${userId} is now online on socket ${socket.id}`);
        
        // Update user status in database
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          socketId: socket.id
        });

        // Store in memory
        onlineUsers.set(userId, socket.id);
        
        // Get ALL online users (including current)
        const allUsers = await User.find({ 
          isOnline: true
        }).select('name email isOnline');

        // Format users
        const formattedUsers = allUsers.map(user => ({
          id: user._id.toString(),
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          isOnline: user.isOnline
        }));

        console.log(`📡 Broadcasting ${formattedUsers.length} online users to ALL clients`);
        
        // IMPORTANT: Broadcast to ALL connected clients (including the sender)
        io.emit('online-users', formattedUsers);
        
      } catch (error) {
        console.error('Error updating user status:', error);
      }
    });

    // Send game request
    socket.on('send-game-request', async ({ fromUserId, toUserId }) => {
      try {
        console.log(`📤 Game request from ${fromUserId} to ${toUserId}`);
        
        if (!fromUserId || !toUserId) {
          console.error('❌ Missing fromUserId or toUserId');
          return;
        }

        const fromUser = await User.findById(fromUserId);
        const toUser = await User.findById(toUserId);
        
        if (!fromUser || !toUser) {
          console.error('❌ User not found');
          return;
        }

        console.log(`📤 From: ${fromUser.name}, To: ${toUser.name}`);

        if (toUser && toUser.isOnline) {
          const toSocketId = onlineUsers.get(toUserId);
          if (toSocketId) {
            console.log(`📤 Sending game request to ${toUser.name}`);
            
            io.to(toSocketId).emit('game-request', {
              from: {
                id: fromUserId,
                name: fromUser.name
              },
              message: `${fromUser.name} wants to play with you!`
            });
            
            socket.emit('game-request-sent', {
              to: toUser.name,
              message: `Game request sent to ${toUser.name}`
            });
            
            console.log(`✅ Game request sent successfully`);
          } else {
            console.error('❌ Target user socket not found');
            socket.emit('game-request-failed', {
              message: `${toUser.name} is not connected`
            });
          }
        } else {
          console.error('❌ Target user is not online');
          socket.emit('game-request-failed', {
            message: `${toUser.name} is not online`
          });
        }
      } catch (error) {
        console.error('❌ Error sending game request:', error);
      }
    });

    // Reject game request
    socket.on('reject-game-request', async ({ fromUserId, toUserId }) => {
      try {
        console.log(`❌ Game request rejected from ${toUserId} to ${fromUserId}`);
        
        const fromUser = await User.findById(fromUserId);
        const toUser = await User.findById(toUserId);
        
        if (!fromUser || !toUser) {
          console.error('User not found');
          return;
        }

        const fromSocketId = onlineUsers.get(fromUserId);
        if (fromSocketId) {
          io.to(fromSocketId).emit('game-request-rejected', {
            by: toUser.name,
            message: `${toUser.name} is not able to play game with you.`
          });
        }
      } catch (error) {
        console.error('Error rejecting game request:', error);
      }
    });

    // Accept game
    socket.on('accept-game', async ({ fromUserId, toUserId }) => {
      try {
        console.log(`✅ Game accepted from ${fromUserId} to ${toUserId}`);
        
        const fromSocketId = onlineUsers.get(fromUserId);
        const toSocketId = onlineUsers.get(toUserId);
        
        const fromUser = await User.findById(fromUserId);
        const toUser = await User.findById(toUserId);
        
        if (!fromUser || !toUser) {
          console.error('❌ User not found');
          return;
        }
        
        const game = new Game({
          players: [
            {
              userId: fromUserId,
              symbol: 'X',
              name: fromUser.name
            },
            {
              userId: toUserId,
              symbol: 'O',
              name: toUser.name
            }
          ],
          currentTurn: 'X',
          status: 'playing'
        });
        
        await game.save();
        console.log(`🎮 Game created with ID: ${game._id}`);

        if (fromSocketId) {
          io.to(fromSocketId).emit('game-start', {
            gameId: game._id,
            player: 'X',
            opponent: toUser.name,
            board: game.board,
            currentTurn: game.currentTurn
          });
        }

        if (toSocketId) {
          io.to(toSocketId).emit('game-start', {
            gameId: game._id,
            player: 'O',
            opponent: fromUser.name,
            board: game.board,
            currentTurn: game.currentTurn
          });
        }
      } catch (error) {
        console.error('❌ Error accepting game:', error);
      }
    });

    // Make move
    socket.on('make-move', async ({ gameId, userId, position }) => {
      try {
        const game = await Game.findById(gameId);
        if (!game) return;

        const player = game.players.find(p => p.userId.toString() === userId);
        if (!player || player.symbol !== game.currentTurn) return;

        if (game.board[position] !== null) return;

        game.board[position] = player.symbol;
        game.moveHistory.push({
          player: player.symbol,
          position,
          timestamp: new Date()
        });

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

        const gameData = game.toObject();
        const playerIds = game.players.map(p => p.userId.toString());
        for (const playerId of playerIds) {
          const socketId = onlineUsers.get(playerId);
          if (socketId) {
            io.to(socketId).emit('game-update', gameData);
          }
        }

        if (game.status === 'finished') {
          const winnerPlayer = game.players.find(p => p.symbol === game.winner);
          for (const playerId of playerIds) {
            const socketId = onlineUsers.get(playerId);
            if (socketId) {
              io.to(socketId).emit('game-finished', {
                winner: game.winner,
                winnerName: winnerPlayer ? winnerPlayer.name : null,
                draw: game.winner === 'draw'
              });
            }
          }
        }

      } catch (error) {
        console.error('Error making move:', error);
      }
    });

    // Rematch request
    socket.on('request-rematch', async ({ gameId, fromUserId }) => {
      try {
        const game = await Game.findById(gameId);
        if (!game) return;

        const otherPlayer = game.players.find(p => p.userId.toString() !== fromUserId);
        if (otherPlayer) {
          const otherSocketId = onlineUsers.get(otherPlayer.userId.toString());
          if (otherSocketId) {
            const fromUser = await User.findById(fromUserId);
            io.to(otherSocketId).emit('rematch-request', {
              fromUserId,
              fromName: fromUser ? fromUser.name : 'Player',
              gameId: gameId
            });
          }
        }
      } catch (error) {
        console.error('Error requesting rematch:', error);
      }
    });

    // Accept rematch
    socket.on('accept-rematch', async ({ gameId, userId }) => {
      try {
        const oldGame = await Game.findById(gameId);
        if (!oldGame) return;

        const newGame = new Game({
          players: oldGame.players,
          currentTurn: 'X',
          status: 'playing'
        });

        await newGame.save();

        const gameData = newGame.toObject();
        const playerIds = newGame.players.map(p => p.userId.toString());
        for (const playerId of playerIds) {
          const socketId = onlineUsers.get(playerId);
          if (socketId) {
            io.to(socketId).emit('rematch-started', gameData);
          }
        }
      } catch (error) {
        console.error('Error accepting rematch:', error);
      }
    });

    // Decline rematch
    socket.on('decline-rematch', async ({ fromUserId, toUserId, gameId }) => {
      try {
        const fromUser = await User.findById(fromUserId);
        const fromSocketId = onlineUsers.get(fromUserId);
        if (fromSocketId) {
          io.to(fromSocketId).emit('rematch-declined', {
            by: fromUser ? fromUser.name : 'Player',
            gameId: gameId
          });
        }
      } catch (error) {
        console.error('Error declining rematch:', error);
      }
    });

    // Leave game
    socket.on('leave-game', async ({ gameId }) => {
      try {
        const game = await Game.findById(gameId);
        if (game) {
          const playerIds = game.players.map(p => p.userId.toString());
          for (const playerId of playerIds) {
            const socketId = onlineUsers.get(playerId);
            if (socketId) {
              io.to(socketId).emit('player-left');
            }
          }
          game.status = 'finished';
          await game.save();
        }
      } catch (error) {
        console.error('Error leaving game:', error);
      }
    });

    // User offline
    socket.on('user-offline', async (userId) => {
      try {
        console.log(`👤 User ${userId} is going offline`);
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          socketId: null
        });
        onlineUsers.delete(userId);
        
        const users = await User.find({ isOnline: true }).select('name email isOnline');
        const formattedUsers = users.map(user => ({
          id: user._id.toString(),
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          isOnline: user.isOnline
        }));
        io.emit('online-users', formattedUsers);
      } catch (error) {
        console.error('Error handling user offline:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log('❌ Client disconnected:', socket.id);
      
      try {
        // Find user by socket ID
        let disconnectedUserId = null;
        for (const [userId, socketId] of onlineUsers.entries()) {
          if (socketId === socket.id) {
            disconnectedUserId = userId;
            break;
          }
        }
        
        if (disconnectedUserId) {
          await User.findByIdAndUpdate(disconnectedUserId, {
            isOnline: false,
            socketId: null
          });
          onlineUsers.delete(disconnectedUserId);
          console.log(`👤 User ${disconnectedUserId} marked offline`);

          const users = await User.find({ isOnline: true }).select('name email isOnline');
          const formattedUsers = users.map(u => ({
            id: u._id.toString(),
            _id: u._id.toString(),
            name: u.name,
            email: u.email,
            isOnline: u.isOnline
          }));
          io.emit('online-users', formattedUsers);
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });

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
  });
};