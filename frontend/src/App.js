import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import socketService from './socket/socket';
import Home from './components/Home';
import Modes from './components/Modes';
import Login from './components/Login';
import Signup from './components/Signup';
import ComputerGame from './components/ComputerGame';
import OnlineGame from './components/OnlineGame';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <ToastContainer 
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
          />
          <AppContent />
        </div>
      </Router>
    </AuthProvider>
  );
}

// Create a separate component to use hooks
function AppContent() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Handle socket connection on user change
  useEffect(() => {
    if (user) {
      socketService.connect(user.id);
    } else {
      socketService.disconnect();
    }
  }, [user]);

  // Override logout function to handle navigation
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/modes" element={<Modes />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/computer-game" element={<ComputerGame />} />
      <Route path="/online-game/:gameId?" element={<OnlineGame />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;