const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

// Default database URL if not set in environment
const defaultDatabaseUrl = 'postgresql://e_technology_user:0HOeUm1DfwdAYMyZHkbGugsVEoZHivnn@dpg-d36hd3vfte5s73bfnsrg-a.oregon-postgres.render.com/e_technology';
const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;

// Parse the connection string to ensure password is a string
const url = new URL(databaseUrl);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 5432,
  database: url.pathname.slice(1), // Remove leading slash
  user: url.username,
  password: String(url.password || ''), // Ensure password is a string
  ssl: { rejectUnauthorized: false }, // SSL required for hosted databases
};

const pool = new Pool(config);

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
