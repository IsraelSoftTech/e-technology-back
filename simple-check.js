const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function simpleCheck() {
  try {
    console.log('Connecting to database...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log('Current time:', result.rows[0].now);
    
    // Try to check users table
    const users = await pool.query('SELECT * FROM users LIMIT 1');
    console.log('✅ Users table accessible');
    console.log('Sample user:', users.rows[0]);
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

simpleCheck();
