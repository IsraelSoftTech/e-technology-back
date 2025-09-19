const { Pool } = require('pg');

const adminPool = new Pool({
  connectionString: 'postgres://postgres:Israel67564@localhost:5432/e_tech',
  ssl: false,
});

async function main() {
  try {
    console.log('🔧 Ensuring enrollments/payments grants...');
    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id BIGSERIAL PRIMARY KEY,
        course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active',
        payment_id BIGINT,
        enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (course_id, student_id)
      );
    `);
    await adminPool.query('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE enrollments TO e_tech_user');
    await adminPool.query('GRANT USAGE, SELECT ON SEQUENCE enrollments_id_seq TO e_tech_user');

    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id BIGSERIAL PRIMARY KEY,
        enrollment_id BIGINT NOT NULL UNIQUE REFERENCES enrollments(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        provider TEXT NOT NULL CHECK (provider IN ('mtn','orange','fapshi')),
        provider_txn_id TEXT,
        status TEXT NOT NULL DEFAULT 'success',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await adminPool.query('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payments TO e_tech_user');
    await adminPool.query('GRANT USAGE, SELECT ON SEQUENCE payments_id_seq TO e_tech_user');

    console.log('✅ Grants ensured for enrollments and payments');
  } catch (err) {
    console.error('❌ Error ensuring grants:', err.message);
    process.exit(1);
  } finally {
    await adminPool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = main;


