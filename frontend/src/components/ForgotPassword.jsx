import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import Header from './Header';
import './Auth.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [userCaptcha, setUserCaptcha] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    generateCaptcha();
  }, []);

  const generateCaptcha = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/captcha`);
      setCaptcha(response.data.captcha);
    } catch (error) {
      console.error('Error generating captcha:', error);
      // Fallback captcha generation if API fails
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let fallbackCaptcha = '';
      for (let i = 0; i < 8; i++) {
        fallbackCaptcha += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setCaptcha(fallbackCaptcha);
    }
  };

  // Step 1: Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    if (!userCaptcha) {
      toast.error('Please enter the captcha');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/auth/forgot-password`, {
        email,
        captcha,
        userCaptcha
      });

      if (response.data.success) {
        toast.success('OTP sent to your email!');
        setUserEmail(email);
        setStep(2);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send OTP');
      generateCaptcha();
      setUserCaptcha('');
    }
    setLoading(false);
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/auth/verify-otp`, {
        email: userEmail,
        otp
      });

      if (response.data.success) {
        toast.success('OTP verified!');
        setStep(3);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid OTP');
    }
    setLoading(false);
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      setNewPassword('');
      setConfirmPassword('');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/auth/reset-password`, {
        email: userEmail,
        newPassword
      });

      if (response.data.success) {
        toast.success('Password reset successfully! Please login.');
        navigate('/login');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset password');
    }
    setLoading(false);
  };

  const renderEmailStep = () => (
    <form onSubmit={handleSendOTP} className="auth-form">
      <div className="form-group">
        <label>Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label>Enter Captcha</label>
        <div className="captcha-container">
          <div className="captcha-display">
            <span className="captcha-text">{captcha}</span>
            <button 
              type="button" 
              className="captcha-refresh"
              onClick={generateCaptcha}
            >
              🔄
            </button>
          </div>
          <input
            type="text"
            value={userCaptcha}
            onChange={(e) => setUserCaptcha(e.target.value)}
            placeholder="Enter the captcha above"
            required
            disabled={loading}
            className="captcha-input"
          />
        </div>
      </div>

      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? 'Sending...' : 'Send OTP'}
      </button>

      <div className="auth-footer">
        <Link to="/login">Back to Login</Link>
      </div>
    </form>
  );

  const renderOTPStep = () => (
    <form onSubmit={handleVerifyOTP} className="auth-form">
      <div className="form-group">
        <label>Enter OTP</label>
        <p className="otp-hint">A 6-digit OTP has been sent to your email</p>
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter 6-digit OTP"
          maxLength="6"
          required
          disabled={loading}
          className="otp-input"
        />
      </div>

      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? 'Verifying...' : 'Verify OTP'}
      </button>

      <div className="auth-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          type="button" 
          className="resend-btn"
          onClick={handleSendOTP}
          disabled={loading}
        >
          Resend OTP
        </button>
        <Link to="/login">Back to Login</Link>
      </div>
    </form>
  );

  const renderPasswordStep = () => (
    <form onSubmit={handleResetPassword} className="auth-form">
      <div className="form-group">
        <label>New Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password (min 6 characters)"
          required
          disabled={loading}
          minLength="6"
        />
      </div>

      <div className="form-group">
        <label>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter new password"
          required
          disabled={loading}
          minLength="6"
        />
      </div>

      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>

      <div className="auth-footer">
        <Link to="/login">Back to Login</Link>
      </div>
    </form>
  );

  return (
    <div className="auth-container">
      <Header currentPage="login" />
      
      <div className="auth-content">
        <div className="auth-card fade-in">
          <h2 className="auth-title">
            {step === 1 && 'Forgot Password'}
            {step === 2 && 'Verify OTP'}
            {step === 3 && 'Reset Password'}
          </h2>
          <p className="auth-subtitle">
            {step === 1 && 'Enter your email to receive an OTP'}
            {step === 2 && `Enter the OTP sent to ${userEmail}`}
            {step === 3 && 'Create a new password'}
          </p>

          {step === 1 && renderEmailStep()}
          {step === 2 && renderOTPStep()}
          {step === 3 && renderPasswordStep()}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;