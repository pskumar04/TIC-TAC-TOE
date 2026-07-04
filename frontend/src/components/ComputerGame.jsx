import React, { useState, useEffect } from 'react';
import socketService from '../socket/socket';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Header from './Header';
import { useAuth } from '../context/AuthContext';
import './Game.css';

const ComputerGame = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [computerScore, setComputerScore] = useState(0);
  const [drawCount, setDrawCount] = useState(0);

  const checkWinner = (board) => {
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
    return board.every(cell => cell !== null) ? 'draw' : null;
  };

  const makeComputerMove = () => {
    // Smart AI with different difficulty levels
    const availableMoves = board
      .map((cell, index) => cell === null ? index : null)
      .filter(index => index !== null);

    if (availableMoves.length === 0) return;

    // Check if computer can win
    for (const move of availableMoves) {
      const testBoard = [...board];
      testBoard[move] = 'O';
      if (checkWinner(testBoard) === 'O') {
        makeMove(move, 'O');
        return;
      }
    }

    // Block player from winning
    for (const move of availableMoves) {
      const testBoard = [...board];
      testBoard[move] = 'X';
      if (checkWinner(testBoard) === 'X') {
        makeMove(move, 'O');
        return;
      }
    }

    // Try to take center
    if (availableMoves.includes(4)) {
      makeMove(4, 'O');
      return;
    }

    // Try to take corners
    const corners = [0, 2, 6, 8];
    const availableCorners = corners.filter(corner => availableMoves.includes(corner));
    if (availableCorners.length > 0) {
      const randomCorner = availableCorners[Math.floor(Math.random() * availableCorners.length)];
      makeMove(randomCorner, 'O');
      return;
    }

    // Random move (with some chance of making a mistake)
    const randomIndex = Math.floor(Math.random() * availableMoves.length);
    const move = availableMoves[randomIndex];
    
    // 20% chance of making a suboptimal move (for difficulty)
    if (Math.random() < 0.2) {
      const otherMoves = availableMoves.filter(m => m !== move);
      if (otherMoves.length > 0) {
        const randomOther = otherMoves[Math.floor(Math.random() * otherMoves.length)];
        makeMove(randomOther, 'O');
        return;
      }
    }
    
    makeMove(move, 'O');
  };

  const makeMove = (index, player) => {
    const newBoard = [...board];
    newBoard[index] = player;
    setBoard(newBoard);

    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setGameOver(true);
      setWinner(gameWinner);
      
      if (gameWinner === 'X') {
        setPlayerScore(prev => prev + 1);
        toast.success('🎉 You won the match!');
      } else if (gameWinner === 'O') {
        setComputerScore(prev => prev + 1);
        toast.error('🤖 Computer won!');
      } else {
        setDrawCount(prev => prev + 1);
        toast.info('🤝 It\'s a draw!');
      }
      return;
    }

    setIsPlayerTurn(player === 'O');
  };

  const handleCellClick = (index) => {
    if (board[index] || !isPlayerTurn || gameOver) return;

    makeMove(index, 'X');
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setGameOver(false);
    setWinner(null);
  };

  const resetScores = () => {
    setPlayerScore(0);
    setComputerScore(0);
    setDrawCount(0);
    resetGame();
  };

  // Computer's turn
  useEffect(() => {
    if (!isPlayerTurn && !gameOver) {
      const timer = setTimeout(() => {
        makeComputerMove();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPlayerTurn, gameOver]);

  const renderCell = (index) => {
    const value = board[index];
    return (
      <div 
        key={index}
        className={`game-cell ${value ? 'filled' : ''}`}
        onClick={() => handleCellClick(index)}
      >
        {value}
      </div>
    );
  };

  return (
    <div className="game-container">
      <Header currentPage="modes" />
      
      <div className="game-content">
        <div className="game-card">
          <div className="game-header">
            <h2 className="game-title">🤖 VS Computer</h2>
            <div className="game-players">
              <div className="player-info">
                <span className="player-name">{user ? user.name : 'Player 1'}</span>
                <span className="player-score">{playerScore}</span>
              </div>
              <span className="vs-text">VS</span>
              <div className="player-info">
                <span className="player-name">Computer</span>
                <span className="player-score">{computerScore}</span>
              </div>
            </div>
          </div>

          <div className="game-status">
            {gameOver ? (
              <div className="status-message">
                {winner === 'X' && '🎉 You Won!'}
                {winner === 'O' && '😞 Computer Won!'}
                {winner === 'draw' && '🤝 Draw!'}
              </div>
            ) : (
              <div className="status-message">
                {isPlayerTurn ? 'Your turn (X)' : 'Computer thinking... (O)'}
              </div>
            )}
          </div>

          <div className="game-board">
            <div className="board-grid">
              {board.map((_, index) => renderCell(index))}
            </div>
          </div>

          <div className="game-actions">
            <button className="game-btn primary" onClick={resetGame}>
              New Game
            </button>
            <button className="game-btn secondary" onClick={resetScores}>
              Reset Scores
            </button>
            <button className="game-btn danger" onClick={() => navigate('/modes')}>
              Back to Modes
            </button>
          </div>

          <div className="game-stats">
            <div className="stat-item">
              <span>Wins</span>
              <span className="stat-value">{playerScore}</span>
            </div>
            <div className="stat-item">
              <span>Draws</span>
              <span className="stat-value">{drawCount}</span>
            </div>
            <div className="stat-item">
              <span>Losses</span>
              <span className="stat-value">{computerScore}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComputerGame;