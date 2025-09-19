const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function ensureCourses() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('Ensuring courses table exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        price_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        price_currency VARCHAR(3) NOT NULL DEFAULT 'XAF',
        capacity INTEGER,
        created_by BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Optional UI-aligned columns (safe if already exist)
    await pool.query(`
      DO $$ BEGIN
        BEGIN
          ALTER TABLE courses ADD COLUMN code TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN
          ALTER TABLE courses ADD COLUMN duration TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN
          ALTER TABLE courses ADD COLUMN tutors TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN
          ALTER TABLE courses ADD COLUMN levels TEXT[];
        EXCEPTION WHEN duplicate_column THEN NULL; END;
      END $$;
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_courses_title ON courses(title);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);');

    console.log('✅ courses table is ready.');
  } catch (err) {
    console.error('❌ Failed ensuring courses table:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  ensureCourses();
}

module.exports = ensureCourses;


