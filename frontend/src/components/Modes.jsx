import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import socketService from '../socket/socket';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './Modes.css';

const Modes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleComputerGame = () => {
    navigate('/computer-game');
  };

  const handleOnlineGame = () => {
    if (!user) {
      toast.warning('Please login to play online!');
      navigate('/login');
      return;
    }
    // ========== CONNECT TO SOCKET BEFORE NAVIGATING ==========
    socketService.connect(user.id);
    navigate('/online-game');
  };

  return (
    <div className="modes-container">
      <Header currentPage="modes" />
      
      <div className="modes-content">
        <h2 className="modes-title">Choose Your Mode</h2>
        <p className="modes-subtitle">Select how you want to play</p>

        <div className="modes-grid">
          <div className="mode-card" onClick={handleComputerGame}>
            <div className="mode-icon">🤖</div>
            <h3 className="mode-name">Play with Computer</h3>
            <p className="mode-description">
              Challenge our AI opponent. Can you beat the machine?
            </p>
            <div className="mode-features">
              <span>⚡ Smart AI</span>
              <span>🎯 Different difficulty levels</span>
              <span>🔄 Play anytime</span>
            </div>
            <button className="mode-btn">Start Game</button>
          </div>

          <div className="mode-card" onClick={handleOnlineGame}>
            <div className="mode-icon">🌐</div>
            <h3 className="mode-name">Play with Online Players</h3>
            <p className="mode-description">
              Compete with players from around the world in real-time!
            </p>
            <div className="mode-features">
              <span>👥 Real-time multiplayer</span>
              <span>🏆 Global competition</span>
              <span>💬 Game requests</span>
            </div>
            <button className="mode-btn">
              {user ? 'Find Players' : 'Login to Play'}
            </button>
          </div>
        </div>

        {!user && (
          <div className="modes-login-prompt">
            <p>👋 Want to play online? <span onClick={() => navigate('/login')}>Login here</span></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modes;