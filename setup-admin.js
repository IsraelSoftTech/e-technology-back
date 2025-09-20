const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

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
  ssl: { rejectUnauthorized: false }, // SSL required for hosted databases
};

const pool = new Pool(config);

async function createAdminUser() {
  try {
    console.log('🔧 Creating admin user with credentials admin123/password123...');
    
    // Use a pre-hashed password for 'password123'
    // This is the bcrypt hash for 'password123' with salt rounds 10
    const passwordHash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
    
    // Check if admin123 user already exists
    const existingUser = await pool.query("SELECT id FROM users WHERE username = 'admin123'");
    
    if (existingUser.rows.length > 0) {
      console.log('✅ User admin123 already exists, updating password...');
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE username = $2',
        [passwordHash, 'admin123']
      );
      console.log('✅ Updated password for admin123');
    } else {
      // Insert new admin user
      await pool.query(`
        INSERT INTO users (name, username, email, password_hash, role, status) 
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'Admin Account',
        'admin123',
        'admin123@etech.com',
        passwordHash,
        'admin',
        'active'
      ]);
      console.log('✅ Created admin user with username: admin123');
    }
    
    // Verify the user was created/updated
    const user = await pool.query("SELECT username, email, role FROM users WHERE username = 'admin123'");
    if (user.rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log(`   Username: ${user.rows[0].username}`);
      console.log(`   Email: ${user.rows[0].email}`);
      console.log(`   Role: ${user.rows[0].role}`);
    }
    
    console.log('🎉 Admin user setup complete!');
    console.log('📝 Login credentials:');
    console.log('   Username: admin123');
    console.log('   Password: password123');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await pool.end();
  }
}

createAdminUser();
