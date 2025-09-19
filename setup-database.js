const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Connect as postgres superuser to create the table
const adminPool = new Pool({
  connectionString: 'postgres://postgres:Israel67564@localhost:5432/e_tech',
  ssl: false,
});

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database...');
    
    // Create users table
    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected', 'disabled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Created users table');
    
    // Grant permissions to e_tech_user
    await adminPool.query('GRANT ALL PRIVILEGES ON TABLE users TO e_tech_user');
    await adminPool.query('GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO e_tech_user');
    console.log('✅ Granted permissions to e_tech_user');
    
    // Check if admin user exists
    const existingAdmin = await adminPool.query("SELECT id FROM users WHERE username = 'admin'");
    
    if (existingAdmin.rows.length === 0) {
      // Insert admin user
      await adminPool.query(`
        INSERT INTO users (name, username, email, password_hash, role, status) 
        VALUES ('Admin Account', 'admin', 'admin@etech.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active')
      `);
      console.log('✅ Created admin user');
    } else {
      console.log('✅ Admin user already exists');
    }
    
    // Create indexes
    await adminPool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await adminPool.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    console.log('✅ Created indexes');
    
    console.log('🎉 Database setup complete!');
    
  } catch (error) {
    console.error('❌ Setup error:', error.message);
  } finally {
    await adminPool.end();
  }
}

setupDatabase();
