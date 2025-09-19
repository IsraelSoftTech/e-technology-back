const { Pool } = require('pg');

async function debugPayment() {
  const pool = new Pool({
    connectionString: 'postgres://postgres:Israel67564@localhost:5432/e_tech',
    ssl: false,
  });

  try {
    console.log('=== DEBUGGING PAYMENT CREATION ===');
    
    const courseId = 5;
    const userId = 7;
    const amount = 5000;
    const currency = 'XAF';
    const phone = '670000000';
    const paymentMethod = 'fapshi';

    console.log('Input parameters:', { courseId, userId, amount, currency, phone, paymentMethod });

    // Step 1: Check if user is already enrolled (only active enrollments)
    console.log('\n1. Checking active enrollments...');
    const enrollmentCheck = await pool.query(
      'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status = $3',
      [courseId, userId, 'active']
    );
    console.log('Active enrollments:', enrollmentCheck.rows);

    // Step 2: Check if there's a pending enrollment and delete it
    console.log('\n2. Checking pending enrollments...');
    const pendingEnrollmentCheck = await pool.query(
      'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status = $3',
      [courseId, userId, 'pending']
    );
    console.log('Pending enrollments:', pendingEnrollmentCheck.rows);

    if (pendingEnrollmentCheck.rows.length > 0) {
      console.log('Deleting pending enrollment:', pendingEnrollmentCheck.rows[0].id);
      await pool.query(
        'DELETE FROM enrollments WHERE id = $1',
        [pendingEnrollmentCheck.rows[0].id]
      );
    }

    // Step 3: Create enrollment record
    console.log('\n3. Creating enrollment record...');
    const enrollmentResult = await pool.query(
      'INSERT INTO enrollments (course_id, student_id, status) VALUES ($1, $2, $3) RETURNING id',
      [courseId, userId, 'pending']
    );
    const enrollmentId = enrollmentResult.rows[0].id;
    console.log('Enrollment created with ID:', enrollmentId);

    // Step 4: Create payment record
    console.log('\n4. Creating payment record...');
    const paymentResult = await pool.query(
      'INSERT INTO payments (enrollment_id, user_id, amount, currency, provider, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [enrollmentId, userId, amount, currency, 'fapshi', 'pending']
    );
    const paymentId = paymentResult.rows[0].id;
    console.log('Payment created with ID:', paymentId);

    const reference = `ENROLL_${enrollmentId}_${paymentId}`;
    console.log('Reference:', reference);

    // Step 5: Update payment status to success for testing
    console.log('\n5. Updating payment status...');
    await pool.query(
      'UPDATE payments SET status = $1, provider_txn_id = $2 WHERE id = $3',
      ['success', `test_${paymentId}`, paymentId]
    );

    // Step 6: Update enrollment status to active
    console.log('\n6. Updating enrollment status...');
    await pool.query(
      'UPDATE enrollments SET status = $1 WHERE id = $2',
      ['active', enrollmentId]
    );

    console.log('\n=== PAYMENT CREATION SUCCESSFUL ===');
    console.log('Payment ID:', `test_${paymentId}`);
    console.log('Reference:', reference);
    console.log('Status: success');

  } catch (error) {
    console.error('Payment creation failed:', error);
  } finally {
    await pool.end();
  }
}

debugPayment();
