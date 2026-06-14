const db = require('../config/dbService');
const bcrypt = require('bcryptjs');

async function seedSampleData() {
  try {
    // Only seed the user login accounts if they do not exist
    const usersCount = (await db.find('users')).length;
    if (usersCount === 0) {
      console.log('Seeding default user accounts on Atlas...');
      
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      const partner1PasswordHash = await bcrypt.hash('partner123', 10);
      const partner2PasswordHash = await bcrypt.hash('partner223', 10);

      await db.insertOne('users', {
        username: 'admin',
        password: adminPasswordHash,
        name: 'Main Admin',
        role: 'admin'
      });

      await db.insertOne('users', {
        username: 'partner1',
        password: partner1PasswordHash,
        name: 'Partner 1 (Raman)',
        role: 'partner'
      });

      await db.insertOne('users', {
        username: 'partner2',
        password: partner2PasswordHash,
        name: 'Partner 2 (Suresh)',
        role: 'partner'
      });

      console.log('- Seeded user login profiles: admin, partner1, partner2');
    }
  } catch (err) {
    console.error('Error seeding default users:', err);
  }
}

module.exports = {
  seedSampleData
};
