const { Pool } = require('pg');

// NOTE: This uses the same approach as setup-database.js to connect as a superuser
// Adjust connection string if your postgres superuser/password differs
const adminPool = new Pool({
  connectionString: 'postgres://postgres:Israel67564@localhost:5432/e_tech',
  ssl: false,
});

async function main() {
  try {
    console.log('🔧 Ensuring courses table and grants...');

    await adminPool.query(`
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

    // Optional extra columns used by UI
    await adminPool.query(`
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

    await adminPool.query('CREATE INDEX IF NOT EXISTS idx_courses_title ON courses(title)');
    await adminPool.query('CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code)');

    // Grant to app role if it exists
    await adminPool.query('GRANT ALL PRIVILEGES ON TABLE courses TO e_tech_user');
    await adminPool.query('GRANT USAGE, SELECT ON SEQUENCE courses_id_seq TO e_tech_user');

    console.log('✅ Courses table ready and privileges granted.');
  } catch (err) {
    console.error('❌ Error ensuring courses:', err.message);
    process.exit(1);
  } finally {
    await adminPool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = main;


