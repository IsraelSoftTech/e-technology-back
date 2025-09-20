const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const useSsl = process.env.DATABASE_SSL === 'true' || true; // Default to SSL for hosted databases

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
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  keepAlive: true,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 60000,
  max: 5,
  min: 1,
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,
};

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;