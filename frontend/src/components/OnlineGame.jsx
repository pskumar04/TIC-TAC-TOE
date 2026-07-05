import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Header from './Header';
import { useAuth } from '../context/AuthContext';
import { ThreeDots } from 'react-loader-spinner';
import socketService from '../socket/socket';
import './Game.css';

const OnlineGame = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [board, setBoard] = useState(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState('X');
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const [opponentName, setOpponentName] = useState('');
  const [gameStatus, setGameStatus] = useState('waiting');
  const [winner, setWinner] = useState(null);
  const [timer, setTimer] = useState(20);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [showPlayers, setShowPlayers] = useState(true);
  const [gameRequest, setGameRequest] = useState(null);
  const [rematchRequest, setRematchRequest] = useState(null);
  const [showRematch, setShowRematch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [currentGameId, setCurrentGameId] = useState(gameId || null);
  const [requestSent, setRequestSent] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [offlinePlayers, setOfflinePlayers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const timerRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  const getUserId = () => {
    return user?.id || user?._id;
  };

  // Check authentication
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
  }, [user, authLoading, navigate]);


  // Fetch all users when component mounts
  // Fetch all users when component mounts
  useEffect(() => {
    if (user) {
      console.log('📋 Fetching all users...');
      socketService.emit('get-all-users', user.id);
      
      const unsubscribeAllUsers = socketService.on('all-users-list', (users) => {
        console.log('📋 Received all users:', users);
        const currentUserId = user.id || user._id;
        
        // Separate online and offline users
        const online = users.filter(u => u.isOnline && u.id !== currentUserId);
        const offline = users.filter(u => !u.isOnline && u.id !== currentUserId);
        
        console.log(`📋 Online: ${online.length}, Offline: ${offline.length}`);
        
        setOnlinePlayers(online);
        setOfflinePlayers(offline);
        setAllUsers(users);
      });
      
      return () => {
        if (unsubscribeAllUsers) {
          unsubscribeAllUsers();
        }
      };
    }
  }, [user]);

  // ========== MAIN SOCKET CONNECTION ==========
  useEffect(() => {
    if (!user) return;

    const userId = getUserId();
    if (!userId) return;

    console.log(`🔌 Setting up socket connection for user: ${userId}`);

    // Connect to socket
    socketService.connect(userId);
    setIsSocketReady(true);

    // Function to emit user online status
    const emitUserOnline = () => {
      if (socketService.isSocketConnected()) {
        socketService.emit('user-online', userId);
        console.log(`👤 Emitted user-online for ${userId}`);
        reconnectAttemptsRef.current = 0;
      } else {
        console.log('⚠️ Socket not connected, attempting reconnect...');
        reconnectAttemptsRef.current += 1;
        if (reconnectAttemptsRef.current < 5) {
          setTimeout(() => {
            socketService.connect(userId);
            setTimeout(emitUserOnline, 500);
          }, 2000);
        }
      }
    };

    // Emit immediately and after delays
    emitUserOnline();
    setTimeout(emitUserOnline, 1000);
    setTimeout(emitUserOnline, 3000);

    // ========== SOCKET EVENT LISTENERS ==========
    
    // Listen for online users - THIS IS THE KEY
    const unsubscribeOnline = socketService.on('online-users', (users) => {
      console.log(`📡 Received ${users.length} online users:`, users);
      const currentUserId = getUserId();
      const filteredUsers = users.filter(u => {
        const uid = u.id || u._id;
        return uid !== currentUserId;
      });
      console.log(`📡 Setting ${filteredUsers.length} online players (excluding self)`);
      setOnlinePlayers(filteredUsers);
    });

    // Listen for game requests
    const unsubscribeRequest = socketService.on('game-request', (data) => {
      console.log('📩 Game request received:', data);
      setGameRequest(data);
      toast.info(`${data.from.name} wants to play with you!`);
    });

    // Listen for game request sent confirmation
    const unsubscribeRequestSent = socketService.on('game-request-sent', (data) => {
      console.log('✅ Game request sent successfully:', data);
      toast.success(data.message);
      setRequestSent(false);
      setRequestStatus('sent');
      setTimeout(() => setRequestStatus(null), 3000);
    });

    // Listen for game request rejected
    const unsubscribeRequestRejected = socketService.on('game-request-rejected', (data) => {
      console.log('❌ Game request rejected:', data);
      toast.error(data.message);
      setRequestSent(false);
      setRequestStatus('rejected');
      setTimeout(() => setRequestStatus(null), 3000);
    });

    // Listen for game request failed
    const unsubscribeRequestFailed = socketService.on('game-request-failed', (data) => {
      console.log('❌ Game request failed:', data);
      toast.error(data.message);
      setRequestSent(false);
    });

    // Listen for game start
    const unsubscribeStart = socketService.on('game-start', (data) => {
      console.log('🎮 Game starting:', data);
      setPlayerSymbol(data.player);
      setOpponentName(data.opponent);
      setBoard(data.board || Array(9).fill(null));
      setCurrentTurn(data.currentTurn || 'X');
      setGameStatus('playing');
      setShowPlayers(false);
      setIsMyTurn(data.player === 'X');
      setTimer(20);
      setCurrentGameId(data.gameId);
      toast.success(`Game started! You are ${data.player}`);
    });

    // Listen for game updates
    const unsubscribeUpdate = socketService.on('game-update', (data) => {
      setBoard(data.board);
      setCurrentTurn(data.currentTurn);
      setGameStatus(data.status);
      setTimer(20);
      
      if (data.status === 'playing') {
        setIsMyTurn(data.currentTurn === playerSymbol);
        if (data.currentTurn === playerSymbol) {
          toast.info('Your turn!');
        }
      }
    });

    // Listen for game finished
    const unsubscribeFinished = socketService.on('game-finished', (data) => {
      setGameStatus('finished');
      setWinner(data.winner);
      if (data.draw) {
        toast.info('🤝 Game is a draw!');
      } else if (data.winner === playerSymbol) {
        toast.success('🎉 You won the match! Hurray!!!');
      } else if (data.winner) {
        toast.error('😢 Oh no, you have lost the match');
      }
      setShowRematch(true);
    });

    // Listen for rematch requests
    const unsubscribeRematch = socketService.on('rematch-request', (data) => {
      setRematchRequest({
        fromUserId: data.fromUserId,
        fromName: data.fromName,
        gameId: data.gameId || currentGameId
      });
      toast.info(`${data.fromName} wants to play again!`);
    });

    // Listen for rematch accepted
    const unsubscribeRematchAccepted = socketService.on('rematch-accepted', (data) => {
      toast.success(`${data.by} accepted the rematch!`);
      setShowRematch(false);
      setRematchRequest(null);
    });

    // Listen for rematch declined
    const unsubscribeRematchDeclined = socketService.on('rematch-declined', (data) => {
      toast.info(`${data.by} declined the rematch`);
      setShowRematch(false);
      setRematchRequest(null);
    });

    // Listen for rematch started
    const unsubscribeRematchStart = socketService.on('rematch-started', (data) => {
      setBoard(Array(9).fill(null));
      setCurrentTurn('X');
      setGameStatus('playing');
      setWinner(null);
      setTimer(20);
      setIsMyTurn('X' === playerSymbol);
      toast.success('Rematch started!');
      setShowRematch(false);
      setRematchRequest(null);
      setCurrentGameId(data._id || data.gameId);
    });

    // Listen for player left
    const unsubscribePlayerLeft = socketService.on('player-left', () => {
      toast.warning('Opponent has left the game');
      setGameStatus('finished');
      setShowRematch(false);
      setTimeout(() => navigate('/modes'), 2000);
    });

    // Listen for socket connect
    const unsubscribeConnect = socketService.on('connect', () => {
      console.log('🔄 Socket reconnected');
      setIsSocketReady(true);
      reconnectAttemptsRef.current = 0;
      setTimeout(() => {
        socketService.emit('user-online', getUserId());
      }, 500);
      setTimeout(() => {
        socketService.emit('user-online', getUserId());
      }, 1500);
    });

    // Listen for socket disconnect
    const unsubscribeDisconnect = socketService.on('disconnect', () => {
      console.log('🔄 Socket disconnected');
      setIsSocketReady(false);
    });


    // Add these inside the socket event listeners section
    // Listen for email invitation sent
    const unsubscribeEmailSent = socketService.on('email-invitation-sent', (data) => {
      console.log('✅ Email invitation sent:', data);
      toast.success(data.message);
    });

    // Listen for email invitation failed
    const unsubscribeEmailFailed = socketService.on('email-invitation-failed', (data) => {
      console.log('❌ Email invitation failed:', data);
      toast.error(data.message);
    });

    // ========== HANDLE PAGE VISIBILITY CHANGE ==========
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 Page became visible, reconnecting...');
        const userId = getUserId();
        if (userId) {
          socketService.connect(userId);
          setTimeout(() => {
            socketService.emit('user-online', userId);
          }, 200);
          setTimeout(() => {
            socketService.emit('user-online', userId);
          }, 1000);
          setTimeout(() => {
            socketService.emit('user-online', userId);
          }, 2500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ========== HANDLE PAGE REFRESH ==========
    const handleBeforeUnload = () => {
      const userId = getUserId();
      if (userId) {
        socketService.emit('user-offline', userId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // ========== HEARTBEAT - Keep connection alive ==========
    heartbeatIntervalRef.current = setInterval(() => {
      const userId = getUserId();
      if (userId) {
        if (socketService.isSocketConnected()) {
          socketService.emit('user-online', userId);
          console.log('💓 Heartbeat: user-online emitted');
        } else {
          console.log('🔄 Heartbeat: Reconnecting...');
          socketService.connect(userId);
          setTimeout(() => {
            socketService.emit('user-online', userId);
          }, 500);
        }
      }
    }, 10000); // Every 10 seconds

    // ========== CLEANUP ==========
    return () => {
      unsubscribeOnline();
      unsubscribeRequest();
      unsubscribeRequestSent();
      unsubscribeRequestRejected();
      unsubscribeRequestFailed();
      unsubscribeStart();
      unsubscribeUpdate();
      unsubscribeFinished();
      unsubscribeRematch();
      unsubscribeRematchAccepted();
      unsubscribeRematchDeclined();
      unsubscribeRematchStart();
      unsubscribePlayerLeft();
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeEmailSent();
      unsubscribeEmailFailed();
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [user, playerSymbol, navigate]);

  // ========== TIMER LOGIC ==========
  useEffect(() => {
    if (gameStatus === 'playing' && isMyTurn) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimer(20);
      
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            makeRandomMove();
            return 20;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimer(20);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isMyTurn, gameStatus]);

  const makeRandomMove = () => {
    const availableMoves = board
      .map((cell, index) => cell === null ? index : null)
      .filter(index => index !== null);

    if (availableMoves.length > 0 && isMyTurn && gameStatus === 'playing') {
      const randomIndex = availableMoves[Math.floor(Math.random() * availableMoves.length)];
      handleCellClick(randomIndex);
    }
  };

  const handleCellClick = (index) => {
    if (!isMyTurn || gameStatus !== 'playing' || board[index]) return;
    if (!currentGameId) {
      toast.error('No active game');
      return;
    }
    const userId = getUserId();
    socketService.makeMove(currentGameId, userId, index);
  };

  const handleSendRequest = (player) => {
    if (!user) {
      toast.warning('Please login first');
      navigate('/login');
      return;
    }
    
    const playerId = player.id || player._id;
    const fromUserId = getUserId();
    
    console.log('📤 Sending game request');
    console.log('📤 From ID:', fromUserId);
    console.log('📤 To ID:', playerId);
    
    if (!fromUserId) {
      toast.error('Invalid user ID');
      return;
    }
    
    if (!playerId) {
      toast.error('Invalid player ID');
      return;
    }
    
    setLoading(true);
    setSelectedPlayer(player);
    setRequestSent(true);
    
    socketService.sendGameRequest(fromUserId, playerId);
  };

  const handleAcceptRequest = () => {
    if (!gameRequest) return;
    
    console.log('✅ Accepting game request from:', gameRequest.from);
    const fromUserId = gameRequest.from.id || gameRequest.from._id;
    const toUserId = getUserId();
    socketService.acceptGame(fromUserId, toUserId);
    setGameRequest(null);
  };

  const handleRejectRequest = () => {
    if (!gameRequest) return;
    
    console.log('❌ Rejecting game request from:', gameRequest.from);
    const fromUserId = gameRequest.from.id || gameRequest.from._id;
    const toUserId = getUserId();
    socketService.emit('reject-game-request', {
      fromUserId: fromUserId,
      toUserId: toUserId
    });
    setGameRequest(null);
    toast.info('Game request declined');
  };

  const handleRematch = (accept) => {
    if (!currentGameId) return;
    const userId = getUserId();
    
    if (accept) {
      socketService.acceptRematch(currentGameId, userId);
      setShowRematch(false);
    } else {
      socketService.leaveGame(currentGameId);
      setShowRematch(false);
      navigate('/modes');
    }
  };

  const handleLeave = () => {
    if (currentGameId) {
      socketService.leaveGame(currentGameId);
    }
    navigate('/modes');
  };


  // Send email invitation
  const handleEmailInvite = (player) => {
    const gameLink = 'https://tic-tac-toe-sooty-nu.vercel.app/';
    socketService.emit('send-email-invitation', {
      fromUserId: user.id || user._id,
      toUserId: player.id,
      gameLink: gameLink
    });
    
    socketService.on('email-invitation-sent', (data) => {
      toast.success(data.message);
    });
    
    socketService.on('email-invitation-failed', (data) => {
      toast.error(data.message);
    });
  };

  const renderCell = (index) => {
    const value = board[index];
    return (
      <div 
        key={index}
        className={`game-cell ${value ? 'filled' : ''}`}
        onClick={() => handleCellClick(index)}
        style={{
          cursor: value || gameStatus !== 'playing' || !isMyTurn ? 'not-allowed' : 'pointer'
        }}
      >
        {value}
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="game-container">
        <Header currentPage="modes" />
        <div className="game-content">
          <div className="game-card" style={{ textAlign: 'center', padding: '60px' }}>
            <ThreeDots height="80" width="80" color="#667eea" visible={true} />
            <p style={{ marginTop: '20px', color: '#666' }}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="game-container">
      <Header currentPage="modes" />
      
      <div className="game-content">
        <div className="game-card">
          <div className="game-header">
            <h2 className="game-title">🌐 Online Game</h2>
            {gameStatus === 'playing' && (
              <div className="game-players">
                <div className="player-info">
                  <span className="player-name">{user.name}</span>
                  <span className="player-symbol">({playerSymbol})</span>
                </div>
                <span className="vs-text">VS</span>
                <div className="player-info">
                  <span className="player-name">{opponentName}</span>
                </div>
              </div>
            )}
          </div>

          {showPlayers && (
            <div className="online-players">
              <h3>🟢 Online Players</h3>
              <div className="players-list">
                {onlinePlayers.length === 0 ? (
                  <p className="no-players">No other players online</p>
                ) : (
                  onlinePlayers.map((player, index) => {
                    const playerId = player.id || player._id;
                    return (
                      <div key={playerId || index} className="player-item">
                        <div className="player-details">
                          <span className="player-name">
                            {player.name}
                            <span className="online-dot"></span>
                          </span>
                        </div>
                        <button 
                          className="invite-btn"
                          onClick={() => handleSendRequest(player)}
                          disabled={loading || requestSent || !isSocketReady}
                        >
                          {loading && selectedPlayer && (selectedPlayer.id || selectedPlayer._id) === playerId ? (
                            <ThreeDots height="20" width="40" color="#fff" />
                          ) : requestStatus === 'sent' && selectedPlayer && (selectedPlayer.id || selectedPlayer._id) === playerId ? (
                            'Request Sent ✓'
                          ) : requestStatus === 'rejected' && selectedPlayer && (selectedPlayer.id || selectedPlayer._id) === playerId ? (
                            'Declined ✗'
                          ) : (
                            'Play'
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ========== OFFLINE PLAYERS SECTION - PASTE THIS HERE ========== */}
              {offlinePlayers.length > 0 && (
                <div className="offline-players">
                  <h3>📧 Offline Players</h3>
                  <div className="players-list">
                    {offlinePlayers.map((player, index) => {
                      const playerId = player.id || player._id;
                      return (
                        <div key={playerId || index} className="player-item offline">
                          <div className="player-details">
                            <span className="player-name">
                              {player.name}
                              <span className="offline-dot"></span>
                            </span>
                          </div>
                          <button 
                            className="invite-email-btn"
                            onClick={() => handleEmailInvite(player)}
                          >
                            ✉️ Invite
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* ========== END OFFLINE PLAYERS SECTION ========== */}

              <button className="game-btn danger" onClick={() => navigate('/modes')}>
                Back to Modes
              </button>
            </div>
          )}

          {gameRequest && (
            <div className="game-request-popup fade-in">
              <div className="popup-content">
                <h3>🎮 Game Request</h3>
                <p className="request-message">{gameRequest.message}</p>
                <p className="request-sub">Are you willing to play the match?</p>
                <div className="popup-actions">
                  <button className="popup-btn accept" onClick={handleAcceptRequest}>
                    YES
                  </button>
                  <button className="popup-btn reject" onClick={handleRejectRequest}>
                    NO
                  </button>
                </div>
              </div>
            </div>
          )}

          {rematchRequest && (
            <div className="game-request-popup fade-in">
              <div className="popup-content">
                <h3>🔄 Rematch Request</h3>
                <p className="request-message">{rematchRequest.fromName} wants to play again!</p>
                <p className="request-sub">Do you want to play another match?</p>
                <div className="popup-actions">
                  <button 
                    className="popup-btn accept" 
                    onClick={() => {
                      const userId = getUserId();
                      socketService.acceptRematch(currentGameId, userId);
                      setRematchRequest(null);
                    }}
                  >
                    YES
                  </button>
                  <button 
                    className="popup-btn reject" 
                    onClick={() => {
                      const fromUserId = rematchRequest.fromUserId;
                      const userId = getUserId();
                      socketService.declineRematch(fromUserId, userId, currentGameId);
                      setRematchRequest(null);
                      toast.info('Rematch declined');
                    }}
                  >
                    NO
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameStatus === 'playing' && (
            <>
              <div className="game-status">
                <div className="status-message">
                  {isMyTurn ? (
                    <span>Your Turn ({playerSymbol}) ⏱️ {timer}s</span>
                  ) : (
                    <span>{opponentName}'s Turn... ⏱️ {timer}s</span>
                  )}
                </div>
              </div>

              <div className="game-board">
                <div className="board-grid">
                  {board.map((_, index) => renderCell(index))}
                </div>
              </div>

              <div className="timer-bar">
                <div 
                  className="timer-fill"
                  style={{ 
                    width: `${(timer / 20) * 100}%`,
                    background: timer <= 5 ? '#f44336' : timer <= 10 ? '#ff9800' : 'linear-gradient(90deg, #667eea, #764ba2)'
                  }}
                />
              </div>
            </>
          )}

          {gameStatus === 'finished' && (
            <div className="game-finished">
              <div className="finish-message">
                {winner === playerSymbol && '🎉 You won the match! Hurray!!!'}
                {winner && winner !== playerSymbol && winner !== 'draw' && '😢 Oh no, you have lost the match'}
                {winner === 'draw' && '🤝 It\'s a draw!'}
              </div>
              
              <div className="rematch-actions">
                <button 
                  className="game-btn primary"
                  onClick={() => {
                    const userId = getUserId();
                    socketService.requestRematch(currentGameId, userId);
                    toast.info('Rematch request sent to opponent');
                    const btn = document.querySelector('.game-btn.primary');
                    if (btn) {
                      btn.disabled = true;
                      btn.textContent = 'Request Sent...';
                    }
                  }}
                >
                  Play Again
                </button>
                <button 
                  className="game-btn danger"
                  onClick={() => {
                    socketService.leaveGame(currentGameId);
                    navigate('/modes');
                  }}
                >
                  Leave
                </button>
              </div>
            </div>
          )}

          {gameStatus === 'waiting' && showPlayers && (
            <div className="waiting-message">
              <p>👋 Select an online player to start a game!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnlineGame;