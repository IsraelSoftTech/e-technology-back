const { Pool } = require('pg');

async function testDatabase() {
  const pool = new Pool({
    connectionString: 'postgres://postgres:Israel67564@localhost:5432/e_tech',
    ssl: false,
  });

  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0]);
    
    // Test course lookup
    const courseResult = await pool.query('SELECT id, title, price_amount, price_currency FROM courses WHERE id = $1', [5]);
    console.log('Course found:', courseResult.rows[0]);
    
    // Test user lookup
    const userResult = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [7]);
    console.log('User found:', userResult.rows[0]);
    
    // Test enrollment check
    const enrollmentResult = await pool.query('SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status = $3', [5, 7, 'active']);
    console.log('Active enrollments:', enrollmentResult.rows);
    
    // Test pending enrollment check
    const pendingResult = await pool.query('SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status = $3', [5, 7, 'pending']);
    console.log('Pending enrollments:', pendingResult.rows);
    
    console.log('All tests passed!');
    
  } catch (error) {
    console.error('Database test failed:', error);
  } finally {
    await pool.end();
  }
}

testDatabase();
