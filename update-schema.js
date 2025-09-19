const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function updateSchema() {
  try {
    console.log('Connecting to database...');
    
    // Check if username column exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'username'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Username column already exists!');
      return;
    }
    
    console.log('Adding username column...');
    
    // Add username column
    await pool.query('ALTER TABLE users ADD COLUMN username TEXT');
    console.log('✅ Added username column');
    
    // Update existing admin user
    await pool.query("UPDATE users SET username = 'admin' WHERE email = 'admin@etech.com'");
    console.log('✅ Updated admin user with username');
    
    // Make username not null and unique
    await pool.query('ALTER TABLE users ALTER COLUMN username SET NOT NULL');
    await pool.query('ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username)');
    console.log('✅ Made username unique and not null');
    
    // Create index
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    console.log('✅ Created username index');
    
    console.log('🎉 Database schema updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateSchema();
