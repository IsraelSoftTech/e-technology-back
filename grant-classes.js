const { Pool } = require('pg');

// Adjust superuser connection string as needed for your local Postgres
const adminPool = new Pool({
  connectionString: 'postgres://postgres:Israel67564@localhost:5432/e_tech',
  ssl: false,
});

async function main() {
  try {
    console.log('🔧 Ensuring classes table exists and granting privileges...');

    await adminPool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_status') THEN
          CREATE TYPE class_status AS ENUM ('scheduled','cancelled','completed');
        END IF;
      END $$;
    `);

    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id BIGSERIAL PRIMARY KEY,
        course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        teacher_id BIGINT NOT NULL REFERENCES users(id),
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        meet_link TEXT NOT NULL UNIQUE,
        status class_status NOT NULL DEFAULT 'scheduled',
        objective TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await adminPool.query('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE classes TO e_tech_user');
    await adminPool.query('GRANT USAGE, SELECT ON SEQUENCE classes_id_seq TO e_tech_user');

    // Ensure class_materials exists and grant privileges
    console.log('🔧 Ensuring class_materials table exists and granting privileges...');
    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS class_materials (
        id BIGSERIAL PRIMARY KEY,
        class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        uploader_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        title TEXT,
        file_url TEXT NOT NULL,
        file_type TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await adminPool.query('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE class_materials TO e_tech_user');
    await adminPool.query('GRANT USAGE, SELECT ON SEQUENCE class_materials_id_seq TO e_tech_user');

    console.log('✅ Privileges granted on classes and class_materials.');
  } catch (err) {
    console.error('❌ Error ensuring classes grants:', err.message);
    process.exit(1);
  } finally {
    await adminPool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = main;


