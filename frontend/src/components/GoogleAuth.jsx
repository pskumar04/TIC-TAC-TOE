import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './GoogleAuth.css';

const GoogleAuth = ({ type = 'login' }) => {
  const [loading, setLoading] = useState(false);
  const { googleLogin } = useAuth();
  const navigate = useNavigate();

  // Function to decode JWT token from Google
  const decodeJWT = (token) => {
    try {
      // Split the token and get the payload part
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    
    try {
      console.log('🔑 Credential Response received');
      
      // Get the credential token
      const credential = credentialResponse.credential;
      
      if (!credential) {
        console.error('❌ No credential received');
        toast.error('No credential received from Google');
        setLoading(false);
        return;
      }

      // Decode the JWT token
      const decodedData = decodeJWT(credential);
      
      if (!decodedData) {
        console.error('❌ Failed to decode credential');
        toast.error('Failed to decode Google credentials');
        setLoading(false);
        return;
      }

      console.log('✅ Decoded Google user:', {
        sub: decodedData.sub,
        email: decodedData.email,
        name: decodedData.name
      });

      // Prepare user data for backend
      const userData = {
        googleId: decodedData.sub,
        email: decodedData.email,
        name: decodedData.name || decodedData.email?.split('@')[0] || 'User'
      };

      console.log('📤 Sending to backend:', userData);

      // Send to backend
      const result = await googleLogin(userData);
      
      if (result.success) {
        toast.success(`Welcome ${decodedData.name || 'User'}!`);
        navigate('/');
      } else {
        toast.error(result.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('❌ Google auth error:', error);
      toast.error('Authentication failed. Please try again.');
    }
    
    setLoading(false);
  };

  const handleGoogleError = (error) => {
    console.error('❌ Google login error:', error);
    toast.error('Google authentication failed. Please try again.');
  };

  return (
    <div className="google-auth-container">
      <div className="google-auth-wrapper">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap={false}
          theme="outline"
          size="large"
          text={type === 'login' ? 'signin_with' : 'signup_with'}
          shape="rectangular"
          logo_alignment="center"
          locale="en"
          width="100%"
        />
        {loading && (
          <div className="google-loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}
      </div>
      
      <div className="google-auth-divider">
        <span>or</span>
      </div>

      <div className="google-auth-info">
        <p className="google-info-text">
          {type === 'login' 
            ? 'Sign in with your Google account to continue' 
            : 'Create an account using your Google account'}
        </p>
      </div>
    </div>
  );
};

export default GoogleAuth;