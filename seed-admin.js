const bcrypt = require('bcryptjs');
const pool = require('./src/services/db');

async function seedAdmin() {
  try {
    // Check if admin already exists (by username or email)
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      ['admin_account', 'admin@etech.com']
    );
    
    if (existingAdmin.rows.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash('admin_password', 10);

    // Insert admin user
    const result = await pool.query(
      'INSERT INTO users (name, username, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, username, email, role',
      ['Admin Account', 'admin_account', 'admin@etech.com', passwordHash, 'admin', 'active']
    );

    console.log('Admin user created:', result.rows[0]);
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
}

// Run if called directly
if (require.main === module) {
  seedAdmin().then(() => {
    console.log('Admin seeding completed');
    process.exit(0);
  });
}

module.exports = seedAdmin;
