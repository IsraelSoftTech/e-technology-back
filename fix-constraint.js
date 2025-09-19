const { Pool } = require('pg');

async function fixConstraint() {
  const pool = new Pool({
    connectionString: 'postgres://postgres:Israel67564@localhost:5432/e_tech',
    ssl: false,
  });

  try {
    console.log('Fixing payments provider constraint...');
    
    // Drop the existing constraint
    await pool.query('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check');
    console.log('Dropped existing constraint');
    
    // Add the new constraint with fapshi included
    await pool.query("ALTER TABLE payments ADD CONSTRAINT payments_provider_check CHECK (provider IN ('mtn', 'orange', 'fapshi'))");
    console.log('Added new constraint with fapshi support');
    
    console.log('Constraint updated successfully!');
    
  } catch (error) {
    console.error('Error updating constraint:', error);
  } finally {
    await pool.end();
  }
}

fixConstraint();
