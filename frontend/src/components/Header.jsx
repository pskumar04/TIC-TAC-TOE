import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socketService from '../socket/socket';
import './Header.css';

const Header = ({ currentPage }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (user) {
      setIsOnline(socketService.isSocketConnected());
      
      const unsubscribeConnect = socketService.on('connect', () => {
        setIsOnline(true);
      });
      
      const unsubscribeDisconnect = socketService.on('disconnect', () => {
        setIsOnline(false);
      });
      
      return () => {
        unsubscribeConnect();
        unsubscribeDisconnect();
      };
    }
  }, [user]);

  const handleLogout = () => {
    logout(); // This removes token and clears user state
    navigate('/'); // Navigate to home after logout
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="brand">
          <h1 className="brand-title">TIC-TAC-TOE</h1>
          <p className="brand-subtitle">by Satish</p>
        </div>
      </div>
      
      <nav className="header-nav">
        <Link to="/" className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}>
          HOME
        </Link>
        <Link to="/modes" className={`nav-link ${currentPage === 'modes' ? 'active' : ''}`}>
          MODES
        </Link>
        {user ? (
          <div className="user-section">
            <span className="user-name">
              {user.name}
              <span className={`online-status ${isOnline ? 'online' : 'offline'}`}>
                {isOnline ? '●' : '○'}
              </span>
            </span>
            <button onClick={handleLogout} className="logout-btn">
              LOGOUT
            </button>
          </div>
        ) : (
          <Link to="/login" className={`nav-link ${currentPage === 'login' ? 'active' : ''}`}>
            LOGIN
          </Link>
        )}
      </nav>
    </header>
  );
};

export default Header;