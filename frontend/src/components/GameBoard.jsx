import React from 'react';
import socketService from '../socket/socket';
import './GameBoard.css';

const GameBoard = ({ 
  board, 
  onCellClick, 
  currentPlayer, 
  winner, 
  isGameOver,
  isMyTurn,
  timer,
  playerSymbol 
}) => {
  
  const renderCell = (index) => {
    const value = board[index];
    const isWinnerCell = winner && winner.winningCells && winner.winningCells.includes(index);
    
    return (
      <div 
        key={index}
        className={`game-cell ${value ? 'filled' : ''} ${isWinnerCell ? 'winner' : ''}`}
        onClick={() => onCellClick(index)}
        style={{
          cursor: value || isGameOver || !isMyTurn ? 'not-allowed' : 'pointer'
        }}
      >
        <span className={`cell-content ${value ? 'pop-in' : ''}`}>
          {value}
        </span>
        {!value && !isGameOver && isMyTurn && (
          <div className="cell-hover-effect"></div>
        )}
      </div>
    );
  };

  const getGameStatus = () => {
    if (isGameOver) {
      if (winner) {
        if (winner.symbol === 'draw') {
          return "🤝 It's a Draw!";
        }
        return winner.symbol === playerSymbol 
          ? "🎉 You Won!" 
          : "😢 You Lost!";
      }
    }
    return isMyTurn 
      ? `Your Turn (${playerSymbol}) ⏱️ ${timer}s` 
      : `Opponent's Turn... ⏱️ ${timer}s`;
  };

  const getStatusColor = () => {
    if (isGameOver) {
      if (winner) {
        if (winner.symbol === 'draw') return '#ff9800';
        return winner.symbol === playerSymbol ? '#4CAF50' : '#f44336';
      }
    }
    return isMyTurn ? '#667eea' : '#999';
  };

  return (
    <div className="game-board-container">
      <div className="game-status" style={{ color: getStatusColor() }}>
        <span className="status-text">{getGameStatus()}</span>
      </div>

      <div className="game-board">
        <div className="board-grid">
          {board.map((_, index) => renderCell(index))}
        </div>
      </div>

      {!isGameOver && (
        <div className="timer-bar">
          <div 
            className="timer-fill"
            style={{ 
              width: `${(timer / 20) * 100}%`,
              background: timer <= 5 ? '#f44336' : timer <= 10 ? '#ff9800' : 'linear-gradient(90deg, #667eea, #764ba2)'
            }}
          />
        </div>
      )}

      {isGameOver && winner && (
        <div className="game-result">
          <div className="result-icon">
            {winner.symbol === playerSymbol ? '🏆' : winner.symbol === 'draw' ? '🤝' : '💪'}
          </div>
          <div className="result-message">
            {winner.symbol === playerSymbol && 'You won the match... hurray!!!'}
            {winner.symbol !== playerSymbol && winner.symbol !== 'draw' && 'Oh no, you have lost the match'}
            {winner.symbol === 'draw' && "It's a draw! Well played!"}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;