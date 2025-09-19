const { Pool } = require('pg');

// Connect as postgres superuser; adjust connection string if needed
const adminPool = new Pool({
  connectionString: 'postgres://postgres:Israel67564@localhost:5432/e_tech',
  ssl: false,
});

async function main() {
  try {
    console.log('🔧 Ensuring course_assignments table exists and granting privileges...');

    // Create table if missing (structure must match schema.sql)
    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS course_assignments (
        id BIGSERIAL PRIMARY KEY,
        course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (course_id, teacher_id)
      );
    `);

    // Index to help with joins (optional but harmless if exists)
    await adminPool.query('CREATE INDEX IF NOT EXISTS idx_course_assignments_teacher ON course_assignments(teacher_id)');

    // Grant privileges to application role
    await adminPool.query('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE course_assignments TO e_tech_user');
    await adminPool.query('GRANT USAGE, SELECT ON SEQUENCE course_assignments_id_seq TO e_tech_user');

    console.log('✅ Privileges granted on course_assignments.');
  } catch (err) {
    console.error('❌ Error granting privileges:', err.message);
    process.exit(1);
  } finally {
    await adminPool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = main;


