const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
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

  try {
    const sqlPath = path.join(__dirname, 'src', 'services', 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Applying schema from', sqlPath);
    await pool.query(sql);
    console.log('✅ Schema applied successfully');
  } catch (err) {
    console.error('❌ Failed to apply schema:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = main;


