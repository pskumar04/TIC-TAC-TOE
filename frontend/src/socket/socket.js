import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnected = false;
  }

  // Initialize socket connection
  connect(userId = null) {
    if (this.socket && this.isConnected) {
      console.log('Socket already connected');
      return this.socket;
    }

    const options = {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    };

    this.socket = io(SOCKET_URL, options);

    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
      this.isConnected = true;
      
      if (userId) {
        this.socket.emit('user-online', userId);
      }
      
      // Trigger connect event for listeners
      this.emitEvent('connect', null);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.isConnected = false;
      this.emitEvent('disconnect', null);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.isConnected = false;
      this.emitEvent('connect_error', error);
    });

    this.socket.on('reconnect', () => {
      console.log('Socket reconnected');
      this.isConnected = true;
      if (userId) {
        this.socket.emit('user-online', userId);
      }
    });

    // Setup default event listeners
    this.setupDefaultListeners();

    return this.socket;
  }

  // Setup default event listeners
  setupDefaultListeners() {
    if (!this.socket) return;

    // Listen for server events
    this.socket.on('online-users', (users) => {
      this.emitEvent('online-users', users);
    });

    this.socket.on('game-request', (data) => {
      this.emitEvent('game-request', data);
    });

    this.socket.on('game-start', (data) => {
      this.emitEvent('game-start', data);
    });

    this.socket.on('game-update', (data) => {
      this.emitEvent('game-update', data);
    });

    this.socket.on('game-finished', (data) => {
      this.emitEvent('game-finished', data);
    });

    this.socket.on('rematch-request', (data) => {
      this.emitEvent('rematch-request', data);
    });

    this.socket.on('rematch-accepted', (data) => {
      this.emitEvent('rematch-accepted', data);
    });

    this.socket.on('rematch-declined', (data) => {
      this.emitEvent('rematch-declined', data);
    });

    this.socket.on('rematch-started', (data) => {
      this.emitEvent('rematch-started', data);
    });

    this.socket.on('player-left', (data) => {
      this.emitEvent('player-left', data);
    });

    this.socket.on('game-cancelled', (data) => {
      this.emitEvent('game-cancelled', data);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.emitEvent('error', error);
    });

    this.socket.on('online-status-confirmed', (data) => {
      this.emitEvent('online-status-confirmed', data);
    });

    // Add this to the setupDefaultListeners method in socket.js
    this.socket.on('game-request-sent', (data) => {
      this.emitEvent('game-request-sent', data);
    });

    // Add these to the setupDefaultListeners method
    this.socket.on('game-request-rejected', (data) => {
      this.emitEvent('game-request-rejected', data);
    });

    this.socket.on('game-request-failed', (data) => {
      this.emitEvent('game-request-failed', data);
    });

    // Add this to setupDefaultListeners method
    this.socket.on('all-users-list', (users) => {
      this.emitEvent('all-users-list', users);
    });

    this.socket.on('email-invitation-sent', (data) => {
      console.log('📧 Email invitation sent event received:', data);
      this.emitEvent('email-invitation-sent', data);
    });

    this.socket.on('email-invitation-failed', (data) => {
      console.log('❌ Email invitation failed event received:', data);
      this.emitEvent('email-invitation-failed', data);
    });

  }

  // Emit event to server
  emit(eventName, data) {
    if (!this.socket || !this.isConnected) {
      console.warn(`Socket not connected. Cannot emit ${eventName}`);
      return false;
    }
    this.socket.emit(eventName, data);
    return true;
  }

  // Add event listener
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
    
    // Return function to remove listener
    return () => this.off(eventName, callback);
  }

  // Remove event listener
  off(eventName, callback) {
    if (!this.listeners.has(eventName)) return;
    
    const callbacks = this.listeners.get(eventName);
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
    
    if (callbacks.length === 0) {
      this.listeners.delete(eventName);
    }
  }

  // Emit event to all listeners
  emitEvent(eventName, data) {
    if (!this.listeners.has(eventName)) return;
    
    const callbacks = this.listeners.get(eventName);
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventName}:`, error);
      }
    });
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
    this.listeners.clear();
  }

  // Check if socket is connected
  isSocketConnected() {
    return this.isConnected;
  }

  // Get socket instance
  getSocket() {
    return this.socket;
  }

  // Reconnect socket
  reconnect(userId = null) {
    if (this.socket) {
      this.disconnect();
    }
    return this.connect(userId);
  }

  // Send game request
  sendGameRequest(fromUserId, toUserId) {
    return this.emit('send-game-request', { fromUserId, toUserId });
  }

  // Accept game
  acceptGame(fromUserId, toUserId) {
    return this.emit('accept-game', { fromUserId, toUserId });
  }

  // Make a move
  makeMove(gameId, userId, position) {
    return this.emit('make-move', { gameId, userId, position });
  }

  // Request rematch
  requestRematch(gameId, fromUserId) {
    return this.emit('rematch-request', { gameId, fromUserId });
  }

  // Accept rematch
  acceptRematch(gameId, userId) {
    return this.emit('rematch-accept', { gameId, userId });
  }

  declineRematch(fromUserId, toUserId, gameId) {
    return this.emit('decline-rematch', { fromUserId, toUserId, gameId });
 }

  // Leave game
  leaveGame(gameId) {
    return this.emit('leave-game', { gameId });
  }

  // Update user status
  updateUserStatus(userId, isOnline, socketId = null) {
    return this.emit('user-status', { userId, isOnline, socketId });
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService;