const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/dbService');
const { authenticateToken, requireAdmin, JWT_SECRET } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  try {
    const user = await db.findOne('users', { username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logActivity(
      { id: user._id, username: user.username, role: user.role },
      'USER_LOGIN',
      `User ${user.name} logged in successfully.`
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Get Current User Profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.findOne('users', { _id: req.user.id });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get All Users (Admin Only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.find('users');
    const safeUsers = users.map(u => ({
      id: u._id,
      username: u.username,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt
    }));
    res.json({ success: true, users: safeUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create User (Admin Only)
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name || !role) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const existing = await db.findOne('users', { username: username.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await db.insertOne('users', {
      username: username.toLowerCase().trim(),
      password: passwordHash,
      name,
      role
    });

    await logActivity(req.user, 'USER_CREATE', `Created user account ${name} (${username}) with role ${role}.`);

    res.status(201).json({
      success: true,
      user: {
        id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update User (Admin Only)
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, role, password } = req.body;
  const { id } = req.params;

  try {
    const user = await db.findOne('users', { _id: id });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }

    await db.updateOne('users', { _id: id }, updates);
    await logActivity(req.user, 'USER_UPDATE', `Updated user account details for ${user.username}.`);

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete User (Admin Only)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own admin account.' });
  }

  try {
    const user = await db.findOne('users', { _id: id });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await db.deleteOne('users', { _id: id });
    await logActivity(req.user, 'USER_DELETE', `Deleted user account ${user.name} (${user.username}).`);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
