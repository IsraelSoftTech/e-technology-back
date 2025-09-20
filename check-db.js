const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Default database URL if not set in environment
const defaultDatabaseUrl = 'postgres://postgres:Israel67564@localhost:5432/e_tech';
const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;

// Parse the connection string to ensure password is a string
const url = new URL(databaseUrl);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 5432,
  database: url.pathname.slice(1), // Remove leading slash
  user: url.username,
  password: String(url.password || ''), // Ensure password is a string
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(config);

async function checkDatabase() {
  try {
    console.log('Checking database structure...');
    
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'users'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ Users table does not exist!');
      return;
    }
    
    console.log('✅ Users table exists');
    
    // Check table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Table structure:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check if username column exists
    const usernameExists = columns.rows.some(col => col.column_name === 'username');
    console.log(`\n🔍 Username column exists: ${usernameExists ? '✅ Yes' : '❌ No'}`);
    
    // Check existing users
    const users = await pool.query('SELECT * FROM users LIMIT 5');
    console.log(`\n👥 Found ${users.rows.length} users:`);
    users.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Username: ${user.username || 'NULL'}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();
