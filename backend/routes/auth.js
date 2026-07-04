const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Signup
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

// Login
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

// Google Auth - UPDATED with better error handling
router.post('/google', async (req, res) => {
  try {
    console.log('📥 Google auth request received');
    console.log('📦 Request body:', req.body);
    
    // Extract data from request body
    const { googleId, email, name } = req.body;

    // Validate required fields with detailed errors
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

    // Check if user exists with googleId or email
    let user = await User.findOne({ 
      $or: [{ googleId }, { email }] 
    });

    if (!user) {
      console.log('👤 Creating new user...');
      // Create new user
      user = new User({
        googleId,
        email,
        name: name || email.split('@')[0]
      });
      await user.save();
      console.log('✅ New user created:', user._id);
    } else {
      console.log('📝 Existing user found:', user._id);
      // Update existing user's googleId if they signed up with email before
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
        console.log('✅ User updated with googleId');
      }
    }

    // Generate token
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