const db = require('../config/dbService');

async function logActivity(user, action, details) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: user ? user.id : 'system',
      username: user ? user.username : 'System',
      role: user ? user.role : 'System',
      action,
      details
    };
    await db.insertOne('activityLogs', logEntry);
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

module.exports = {
  logActivity
};
