import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import socketService from '../socket/socket';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Add token to requests
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Load user from token
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await api.get('/api/users/me');
          setUser(response.data.user);
          socketService.connect(response.data.user.id);
        } catch (error) {
          console.error('Error loading user:', error);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setUser(user);
      socketService.connect(user.id);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await api.post('/api/auth/signup', { name, email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setUser(user);
      socketService.connect(user.id);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Signup failed' 
      };
    }
  };

  // UPDATED: Google Login function
  const googleLogin = async (userData) => {
    try {
      console.log('📤 Google login called with:', userData);
      
      // Validate userData
      if (!userData.googleId || !userData.email) {
        console.error('❌ Invalid user data:', userData);
        return { 
          success: false, 
          error: 'Invalid user data from Google' 
        };
      }
      
      // Send to backend
      const response = await api.post('/api/auth/google', {
        googleId: userData.googleId,
        email: userData.email,
        name: userData.name || userData.email.split('@')[0]
      });
      
      console.log('✅ Google login response:', response.data);
      
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      setUser(user);
      socketService.connect(user.id);
      return { success: true };
    } catch (error) {
      console.error('❌ Google login error:', error);
      console.error('❌ Error response:', error.response?.data);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Google login failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    socketService.disconnect();
  };

  const value = {
    user,
    loading,
    login,
    signup,
    googleLogin,
    logout,
    api
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};