const { Pool } = require('pg');

const adminPool = new Pool({
  connectionString: 'postgres://postgres:Israel67564@localhost:5432/e_tech',
  ssl: false,
});

async function main() {
  try {
    console.log('🔧 Ensuring teacher_docs table and grants...');
    await adminPool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
          CREATE TYPE review_status AS ENUM ('pending','approved','rejected');
        END IF;
      END $$;
    `);

    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS teacher_docs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        filename TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        admin_comment TEXT,
        review_status review_status NOT NULL DEFAULT 'pending'
      );
    `);

    await adminPool.query('GRANT ALL PRIVILEGES ON TABLE teacher_docs TO e_tech_user');
    await adminPool.query('GRANT USAGE, SELECT ON SEQUENCE teacher_docs_id_seq TO e_tech_user');

    console.log('✅ teacher_docs ready and privileges granted.');
  } catch (err) {
    console.error('❌ Error ensuring teacher_docs:', err.message);
    process.exit(1);
  } finally {
    await adminPool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = main;


