import React, { useState, useEffect } from 'react';
import socketService from '../socket/socket';
import { ThreeDots } from 'react-loader-spinner';
import './OnlinePlayers.css';

import React, { useState, useEffect } from 'react';
import { ThreeDots } from 'react-loader-spinner';
import socketService from '../socket/socket'; // ADD THIS LINE
import './OnlinePlayers.css';

const OnlinePlayers = ({ 
  players, 
  onSelectPlayer, 
  currentUser,
  loading: propsLoading 
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [localPlayers, setLocalPlayers] = useState(players || []);
  const [loading, setLoading] = useState(propsLoading || false);

  // ========== SOCKET CONNECTION CODE - PUT THIS useEffect HERE ==========
  useEffect(() => {
    // Connect to socket if user is provided
    if (currentUser) {
      socketService.connect(currentUser.id);
    }

    // Listen for online users updates
    const unsubscribeOnline = socketService.on('online-users', (users) => {
      setLocalPlayers(users);
      setLoading(false);
    });

    // Listen for user status changes
    const unsubscribeStatus = socketService.on('user-status', (data) => {
      // Update local players list when someone comes online/offline
      setLocalPlayers(prev => {
        const index = prev.findIndex(p => p.id === data.userId);
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], isOnline: data.isOnline };
          return updated;
        }
        return prev;
      });
    });

    // Cleanup on unmount
    return () => {
      unsubscribeOnline();
      unsubscribeStatus();
    };
  }, [currentUser]);

  // Update localPlayers when props change
  useEffect(() => {
    if (players) {
      setLocalPlayers(players);
    }
  }, [players]);

  const filteredPlayers = localPlayers.filter(player => 
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectPlayer = (player) => {
    setSelectedPlayerId(player.id);
    onSelectPlayer(player);
    // Reset selection after a moment
    setTimeout(() => setSelectedPlayerId(null), 2000);
  };

  return (
    <div className="online-players-container">
      <div className="players-header">
        <h3 className="players-title">
          🌐 Online Players
          <span className="player-count">{players.length}</span>
        </h3>
        <div className="players-search">
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="players-list">
        {loading ? (
          <div className="players-loading">
            <ThreeDots 
              height="40" 
              width="80" 
              color="#667eea" 
              visible={true}
            />
            <p>Loading players...</p>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="no-players">
            <span className="no-players-icon">👤</span>
            <p>
              {players.length === 0 
                ? 'No other players online right now' 
                : 'No players match your search'}
            </p>
            {players.length === 0 && (
              <span className="no-players-sub">
                Be the first to invite someone!
              </span>
            )}
          </div>
        ) : (
          filteredPlayers.map(player => (
            <div 
              key={player.id} 
              className={`player-item ${selectedPlayerId === player.id ? 'selected' : ''}`}
            >
              <div className="player-avatar">
                <span className="avatar-initial">
                  {player.name.charAt(0).toUpperCase()}
                </span>
                <span className="online-status-dot"></span>
              </div>
              
              <div className="player-details">
                <span className="player-name">{player.name}</span>
                <span className="player-status">Online</span>
              </div>

              <button 
                className="invite-btn"
                onClick={() => handleSelectPlayer(player)}
                disabled={selectedPlayerId === player.id}
              >
                {selectedPlayerId === player.id ? (
                  <ThreeDots height="20" width="40" color="#fff" />
                ) : (
                  'Play with me'
                )}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="players-footer">
        <p className="footer-info">
          {players.length > 0 
            ? `Click "Play with me" to send a game request` 
            : 'Invite friends to play online!'}
        </p>
      </div>
    </div>
  );
};

export default OnlinePlayers;