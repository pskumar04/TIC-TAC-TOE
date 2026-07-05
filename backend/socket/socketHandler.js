const Game = require('../models/Game');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Email configuration (add your email credentials in .env)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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

    // SEND GAME REQUEST - FIXED
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
        console.log(`📤 To User Online: ${toUser.isOnline}`);

        if (toUser && toUser.isOnline) {
          const toSocketId = onlineUsers.get(toUserId);
          if (toSocketId) {
            console.log(`📤 Sending game request to ${toUser.name} (${toSocketId})`);
            
            // Send request to the target user
            io.to(toSocketId).emit('game-request', {
              from: {
                id: fromUserId,
                name: fromUser.name
              },
              message: `${fromUser.name} wants to play with you!`
            });
            
            // Send confirmation back to the sender
            io.to(socket.id).emit('game-request-sent', {
              to: toUser.name,
              message: `Game request sent to ${toUser.name}`
            });
            
            console.log(`✅ Game request sent successfully`);
          } else {
            console.error('❌ Target user socket not found');
            io.to(socket.id).emit('game-request-failed', {
              message: `${toUser.name} is not connected`
            });
          }
        } else {
          console.error('❌ Target user is not online');
          io.to(socket.id).emit('game-request-failed', {
            message: `${toUser.name} is not online`
          });
        }
      } catch (error) {
        console.error('❌ Error sending game request:', error);
      }
    });

    // REJECT GAME REQUEST
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
          console.log(`✅ Rejection sent to ${fromUser.name}`);
        }
      } catch (error) {
        console.error('Error rejecting game request:', error);
      }
    });

    // ACCEPT GAME
    socket.on('accept-game', async ({ fromUserId, toUserId }) => {
      try {
        console.log(`✅ Game accepted from ${fromUserId} to ${toUserId}`);
        
        const fromSocketId = onlineUsers.get(fromUserId);
        const toSocketId = onlineUsers.get(toUserId);
        
        // Create game in database
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

        // Send game data to both players
        if (fromSocketId) {
          io.to(fromSocketId).emit('game-start', {
            gameId: game._id,
            player: 'X',
            opponent: toUser.name,
            board: game.board,
            currentTurn: game.currentTurn
          });
          console.log(`📤 Game start sent to ${fromUser.name}`);
        }

        if (toSocketId) {
          io.to(toSocketId).emit('game-start', {
            gameId: game._id,
            player: 'O',
            opponent: fromUser.name,
            board: game.board,
            currentTurn: game.currentTurn
          });
          console.log(`📤 Game start sent to ${toUser.name}`);
        }
      } catch (error) {
        console.error('❌ Error accepting game:', error);
      }
    });

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

    socket.on('rematch-request', async ({ gameId, fromUserId }) => {
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
        console.error('Error sending rematch request:', error);
      }
    });

    socket.on('rematch-accept', async ({ gameId, userId }) => {
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
        console.error('Error starting rematch:', error);
      }
    });


    // REQUEST REMATCH
    socket.on('request-rematch', async ({ gameId, fromUserId }) => {
    try {
        console.log(`🔄 Rematch requested by ${fromUserId} for game ${gameId}`);
        
        const game = await Game.findById(gameId);
        if (!game) {
        console.error('❌ Game not found');
        return;
        }

        // Find the other player
        const otherPlayer = game.players.find(p => p.userId.toString() !== fromUserId);
        if (!otherPlayer) {
        console.error('❌ Other player not found');
        return;
        }

        const fromUser = await User.findById(fromUserId);
        const otherSocketId = onlineUsers.get(otherPlayer.userId.toString());
        
        if (otherSocketId) {
        io.to(otherSocketId).emit('rematch-request', {
            fromUserId: fromUserId,
            fromName: fromUser ? fromUser.name : 'Player',
            gameId: gameId
        });
        console.log(`✅ Rematch request sent to ${otherPlayer.name}`);
        } else {
        console.error('❌ Other player socket not found');
        }
    } catch (error) {
        console.error('Error requesting rematch:', error);
    }
    });

    // ACCEPT REMATCH
    socket.on('accept-rematch', async ({ gameId, userId }) => {
    try {
        console.log(`✅ Rematch accepted by ${userId} for game ${gameId}`);
        
        const game = await Game.findById(gameId);
        if (!game) {
        console.error('❌ Game not found');
        return;
        }

        // Find the other player
        const otherPlayer = game.players.find(p => p.userId.toString() !== userId);
        if (!otherPlayer) {
        console.error('❌ Other player not found');
        return;
        }

        const user = await User.findById(userId);
        const otherSocketId = onlineUsers.get(otherPlayer.userId.toString());
        
        if (otherSocketId) {
        io.to(otherSocketId).emit('rematch-accepted', {
            by: user ? user.name : 'Player',
            gameId: gameId
        });
        console.log(`✅ Rematch accepted notification sent to ${otherPlayer.name}`);
        }

        // Create new game with same players
        const newGame = new Game({
        players: game.players,
        currentTurn: 'X',
        status: 'playing'
        });

        await newGame.save();
        console.log(`🎮 New game created with ID: ${newGame._id}`);

        // Send new game to both players
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

    // DECLINE REMATCH
    socket.on('decline-rematch', async ({ fromUserId, toUserId, gameId }) => {
    try {
        console.log(`❌ Rematch declined by ${toUserId} for ${fromUserId}`);
        
        const fromUser = await User.findById(fromUserId);
        const toUser = await User.findById(toUserId);
        
        const fromSocketId = onlineUsers.get(fromUserId);
        if (fromSocketId) {
        io.to(fromSocketId).emit('rematch-declined', {
            by: toUser ? toUser.name : 'Player',
            gameId: gameId
        });
        console.log(`✅ Rematch declined notification sent to ${fromUser ? fromUser.name : 'Player'}`);
        }
    } catch (error) {
        console.error('Error declining rematch:', error);
    }
    });

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

    socket.on('disconnect', async () => {
      console.log('❌ Client disconnected:', socket.id);
      
      try {
        const user = await User.findOne({ socketId: socket.id });
        if (user) {
          await User.findByIdAndUpdate(user._id, {
            isOnline: false,
            socketId: null
          });
          onlineUsers.delete(user._id.toString());

          const users = await User.find({ 
            isOnline: true,
            _id: { $ne: user._id }
          }).select('name email isOnline');
          io.emit('online-users', users);
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });


    socket.on('user-offline', async (userId) => {
        try {
            console.log(`👤 User ${userId} is going offline`);
            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              socketId: null
            });
            onlineUsers.delete(userId);
            
            const users = await User.find({ 
              isOnline: true,
              _id: { $ne: userId }
            }).select('name email isOnline');
            io.emit('online-users', users);
        } catch (error) {
            console.error('Error handling user offline:', error);
        }
    });


    // In the user-online event, add better handling
    socket.on('user-online', async (userId) => {
    try {
        console.log(`👤 User ${userId} is now online`);
        
        // Clear any existing socket for this user
        if (onlineUsers.has(userId)) {
        const oldSocketId = onlineUsers.get(userId);
        if (oldSocketId !== socket.id) {
            console.log(`🔄 User ${userId} reconnected with new socket ${socket.id}`);
        }
        }
        
        // Update user status
        await User.findByIdAndUpdate(userId, {
        isOnline: true,
        socketId: socket.id
        });

        onlineUsers.set(userId, socket.id);
        
        // Get all online users EXCEPT the current user
        const users = await User.find({ 
        isOnline: true,
        _id: { $ne: userId }
        }).select('name email isOnline');

        const formattedUsers = users.map(user => ({
        id: user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        isOnline: user.isOnline
        }));

        console.log(`📡 Broadcasting ${formattedUsers.length} online users`);
        
        // Broadcast to ALL connected clients
        io.emit('online-users', formattedUsers);
    } catch (error) {
        console.error('Error updating user status:', error);
    }
    });

    // ========== NEW: GET ALL USERS (ONLINE + OFFLINE) ==========
    socket.on('get-all-users', async (userId) => {
      try {
        const allUsers = await User.find({})
          .select('name email isOnline _id');
        
        const formattedUsers = allUsers.map(user => ({
          id: user._id.toString(),
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          isOnline: user.isOnline || false
        }));

        socket.emit('all-users-list', formattedUsers);
      } catch (error) {
        console.error('Error getting all users:', error);
      }
    });

    // ========== NEW: SEND EMAIL INVITATION TO OFFLINE USER ==========
    socket.on('send-email-invitation', async ({ fromUserId, toUserId, gameLink }) => {
      try {
        console.log(`📧 Sending email invitation from ${fromUserId} to ${toUserId}`);
        
        const fromUser = await User.findById(fromUserId);
        const toUser = await User.findById(toUserId);
        
        if (!fromUser || !toUser) {
          console.error('❌ User not found');
          socket.emit('email-invitation-failed', {
            message: 'User not found'
          });
          return;
        }

        // Check if email is configured
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          console.error('❌ Email not configured. Add EMAIL_USER and EMAIL_PASS in .env');
          socket.emit('email-invitation-failed', {
            message: 'Email service not configured'
          });
          return;
        }

        // Send email
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: toUser.email,
          subject: `${fromUser.name} wants to play TIC-TAC-TOE with you!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; border-radius: 10px;">
              <h1 style="color: #667eea; text-align: center;">🎮 TIC-TAC-TOE</h1>
              <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333;">Hello ${toUser.name}! 👋</h2>
                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                  <strong style="color: #667eea;">${fromUser.name}</strong> wants to play a game of TIC-TAC-TOE with you!
                </p>
                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                  Click the button below to join the game and challenge your friend!
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${gameLink || 'https://tic-tac-toe-by-satish.vercel.app'}" 
                     style="background: linear-gradient(45deg, #667eea, #764ba2); 
                            color: white; 
                            padding: 14px 40px; 
                            text-decoration: none; 
                            border-radius: 30px; 
                            font-weight: 700; 
                            font-size: 18px;
                            display: inline-block;">
                    🎯 Play Now
                  </a>
                </div>
                <p style="color: #888; font-size: 14px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
                  You received this email because ${fromUser.name} invited you to play TIC-TAC-TOE.<br>
                  If you don't want to play, you can ignore this email.
                </p>
                <p style="color: #aaa; font-size: 12px; text-align: center;">
                  TIC-TAC-TOE by Satish Kumar | ${new Date().getFullYear()}
                </p>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email invitation sent to ${toUser.email}`);

        socket.emit('email-invitation-sent', {
          to: toUser.name,
          message: `Invitation sent to ${toUser.name} via email!`
        });

      } catch (error) {
        console.error('❌ Error sending email invitation:', error);
        socket.emit('email-invitation-failed', {
          message: 'Failed to send email invitation'
        });
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