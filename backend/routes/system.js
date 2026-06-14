const express = require('express');
const router = express.Router();
const db = require('../config/dbService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

// Get Activity Logs (Admin Only)
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await db.find('activityLogs');
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Download/Export Data Backup (Admin Only)
router.get('/backup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const data = await db.backup();
    await logActivity(req.user, 'SYSTEM_BACKUP', 'Exported database backup.');
    res.json({ success: true, backup: data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Backup failed' });
  }
});

// Restore Data Backup (Admin Only)
router.post('/restore', authenticateToken, requireAdmin, async (req, res) => {
  const { backupData } = req.body;
  if (!backupData) {
    return res.status(400).json({ success: false, message: 'Backup data is required' });
  }

  try {
    await db.restore(backupData);
    await logActivity(req.user, 'SYSTEM_RESTORE', 'Restored database from file backup.');
    res.json({ success: true, message: 'Database restored successfully' });
  } catch (err) {
    console.error('Restore failed:', err);
    res.status(500).json({ success: false, message: 'Restore failed' });
  }
});

module.exports = router;
