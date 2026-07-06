const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sgMail = require('@sendgrid/mail');

// ========== SENDGRID CONFIGURATION ==========
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured for auth routes');
}

// ========== FORGOT PASSWORD - SEND OTP ==========
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, captcha, userCaptcha } = req.body;

    console.log('📧 Forgot password request received:', { email, captcha, userCaptcha });

    // Validate captcha
    if (!captcha || !userCaptcha || captcha.toLowerCase() !== userCaptcha.toLowerCase()) {
      return res.status(400).json({ error: 'Invalid captcha' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`📧 Generated OTP for ${email}: ${otp}`);
    
    // Save OTP to user with expiry (10 minutes)
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send OTP via SendGrid
    if (process.env.SENDGRID_API_KEY) {
      const fromEmail = process.env.EMAIL_FROM || 'satishpanduru9492@gmail.com';
      
      const msg = {
        to: user.email,
        from: fromEmail,
        subject: 'TIC-TAC-TOE - Password Reset OTP 🔐',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; border-radius: 10px;">
            <h1 style="color: #667eea; text-align: center;">🎮 TIC-TAC-TOE</h1>
            <div style="background-color: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333;">Password Reset Request</h2>
              <p style="color: #555; font-size: 16px;">Hello ${user.name},</p>
              <p style="color: #555; font-size: 16px;">You requested to reset your password. Use the OTP below to proceed:</p>
              <div style="text-align: center; margin: 30px 0; padding: 15px; background: #f0f0f0; border-radius: 8px;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #333;">
                  ${otp}
                </span>
              </div>
              <p style="color: #888; font-size: 14px;">This OTP is valid for 10 minutes. If you didn't request this, please ignore this email.</p>
              <p style="color: #aaa; font-size: 12px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
                TIC-TAC-TOE by Satish Kumar | ${new Date().getFullYear()}
              </p>
            </div>
          </div>
        `
      };

      await sgMail.send(msg);
      console.log(`✅ OTP email sent to ${user.email} via SendGrid`);
    } else {
      console.log('⚠️ SendGrid not configured. OTP saved but email not sent.');
    }

    res.json({ 
      success: true, 
      message: 'OTP sent to your email',
      email: user.email 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// ========== VERIFY OTP ==========
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log('🔐 Verify OTP request:', { email, otp });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if OTP exists and is valid
    if (!user.resetPasswordOTP || user.resetPasswordOTP !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Check if OTP expired
    if (Date.now() > user.resetPasswordOTPExpiry) {
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    res.json({ 
      success: true, 
      message: 'OTP verified successfully' 
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// ========== RESET PASSWORD ==========
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    console.log('🔑 Reset password request:', { email });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordOTP = null;
    user.resetPasswordOTPExpiry = null;
    await user.save();

    console.log('✅ Password reset successfully for:', email);

    res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ========== GENERATE CAPTCHA ==========
router.get('/captcha', (req, res) => {
  try {
    // Generate 8-character captcha with letters and numbers
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let captcha = '';
    for (let i = 0; i < 8; i++) {
      captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    console.log('🔄 Captcha generated:', captcha);
    res.json({ captcha });
  } catch (error) {
    console.error('Captcha generation error:', error);
    res.status(500).json({ error: 'Failed to generate captcha' });
  }
});

// ========== SIGNUP ==========
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== LOGIN ==========
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GOOGLE AUTH ==========
router.post('/google', async (req, res) => {
  try {
    console.log('📥 Google auth request received');
    console.log('📦 Request body:', req.body);
    
    const { googleId, email, name } = req.body;

    if (!googleId) {
      console.error('❌ Missing googleId');
      return res.status(400).json({ 
        error: 'Missing googleId',
        received: req.body 
      });
    }

    if (!email) {
      console.error('❌ Missing email');
      return res.status(400).json({ 
        error: 'Missing email',
        received: req.body 
      });
    }

    console.log('✅ All fields present:', { googleId, email, name });

    let user = await User.findOne({ 
      $or: [{ googleId }, { email }] 
    });

    if (!user) {
      console.log('👤 Creating new user...');
      user = new User({
        googleId,
        email,
        name: name || email.split('@')[0]
      });
      await user.save();
      console.log('✅ New user created:', user._id);
    } else {
      console.log('📝 Existing user found:', user._id);
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
        console.log('✅ User updated with googleId');
      }
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Token generated for user:', user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('❌ Google auth error:', error);
    res.status(500).json({ 
      error: error.message || 'Google authentication failed'
    });
  }
});

module.exports = router;