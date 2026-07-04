import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import socketService from '../socket/socket';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [board, setBoard] = useState(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [blinkIndex, setBlinkIndex] = useState(null);

  useEffect(() => {
    if (user) {
      // Connect socket when on home page
      socketService.connect(user.id);
    }
  }, [user]);

  // Auto-play animation for home page
  useEffect(() => {
    let interval;
    let moveInterval;

    const makeRandomMove = () => {
      const emptyIndices = board
        .map((cell, index) => cell === null ? index : null)
        .filter(index => index !== null);

      if (emptyIndices.length === 0) {
        // Reset board
        setBoard(Array(9).fill(null));
        setCurrentPlayer('X');
        return;
      }

      const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      const newBoard = [...board];
      newBoard[randomIndex] = currentPlayer;
      setBoard(newBoard);
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
      setBlinkIndex(randomIndex);

      // Clear blink after 1.5s
      setTimeout(() => setBlinkIndex(null), 1500);
    };

    // Make a move every 2 seconds
    moveInterval = setInterval(makeRandomMove, 2000);

    return () => {
      clearInterval(moveInterval);
    };
  }, [board, currentPlayer]);

  const renderCell = (index) => {
    const value = board[index];
    const isBlinking = index === blinkIndex;
    
    return (
      <div 
        key={index} 
        className={`home-cell ${value ? 'filled' : ''} ${isBlinking ? 'blink' : ''}`}
      >
        {value}
      </div>
    );
  };

  const handleGetStarted = () => {
    if (user) {
      navigate('/modes');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="home-container">
      <Header currentPage="home" />
      
      <div className="home-content">
        <div className="home-hero">
          <div className="home-left">
            <h2 className="home-title">Welcome to TIC-TAC-TOE</h2>
            <p className="home-description">
              The classic game of X's and O's. Play with friends, challenge the computer,
              or compete online with players from around the world!
            </p>
            <div className="home-features">
              <div className="feature-item">
                <span className="feature-icon">🤖</span>
                <span>Play vs Computer</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🌐</span>
                <span>Online Multiplayer</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🎯</span>
                <span>Smart AI</span>
              </div>
            </div>
            <button className="home-cta" onClick={handleGetStarted}>
              {user ? 'START PLAYING' : 'GET STARTED'}
            </button>
          </div>

          <div className="home-right">
            <div className="home-board-wrapper">
              <div className="home-board">
                <div className="board-grid">
                  {board.map((_, index) => renderCell(index))}
                </div>
              </div>
              <div className="board-status">
                <span className="status-indicator">
                  {currentPlayer === 'X' ? '❌' : '⭕'} Next move...
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;