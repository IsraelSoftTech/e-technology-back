const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

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


