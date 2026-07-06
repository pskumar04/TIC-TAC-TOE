import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import socketService from './socket/socket';
import Home from './components/Home';
import Modes from './components/Modes';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import ComputerGame from './components/ComputerGame';
import OnlineGame from './components/OnlineGame';
import './App.css';

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

function AppContent() {
  const { user } = useAuth();
  
  useEffect(() => {
    if (user) {
      socketService.connect(user.id);
    } else {
      socketService.disconnect();
    }
  }, [user]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/modes" element={<Modes />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/computer-game" element={<ComputerGame />} />
      <Route path="/online-game/:gameId?" element={<OnlineGame />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;// Force redeploy
