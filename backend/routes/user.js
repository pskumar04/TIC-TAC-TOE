const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        isOnline: req.user.isOnline
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all online users
router.get('/online', auth, async (req, res) => {
  try {
    const users = await User.find({ 
      isOnline: true,
      _id: { $ne: req.user._id }
    }).select('name email isOnline');
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user online status
router.post('/status', auth, async (req, res) => {
  try {
    const { isOnline, socketId } = req.body;
    
    await User.findByIdAndUpdate(req.user._id, {
      isOnline,
      socketId
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;