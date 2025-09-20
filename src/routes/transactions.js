const express = require('express');
const pool = require('../services/db');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Submit transaction ID for verification
router.post('/submit-transaction', async (req, res) => {
  try {
    const { courseId, userId, transactionId, amount, currency } = req.body;
    
    if (!courseId || !userId || !transactionId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify user authentication
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (parseInt(decoded.userId) !== parseInt(userId)) {
      return res.status(403).json({ error: 'Unauthorized - user ID mismatch' });
    }

    // Check if course exists
    const courseResult = await pool.query('SELECT id, title, price_amount FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];

    // Check if user already enrolled (check both user_id and student_id for compatibility)
    const enrollmentResult = await pool.query(
      'SELECT id FROM enrollments WHERE (user_id = $1 OR student_id = $1) AND course_id = $2',
      [userId, courseId]
    );

    if (enrollmentResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Create pending enrollment with transaction ID
    const enrollment = await pool.query(
      `INSERT INTO enrollments (user_id, student_id, course_id, status, payment_reference, amount, currency, created_at)
       VALUES ($1, $1, $2, 'pending', $3, $4, $5, NOW())
       RETURNING id, user_id, student_id, course_id, status, payment_reference, amount, currency, created_at`,
      [userId, courseId, transactionId, amount, currency || 'XAF']
    );

    res.status(201).json({
      success: true,
      message: 'Transaction ID submitted successfully. Please wait for admin approval.',
      enrollment: enrollment.rows[0]
    });

  } catch (error) {
    console.error('Submit transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending transactions for admin
router.get('/pending-transactions', async (req, res) => {
  try {
    // Verify admin authentication
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get pending enrollments with user and course details
    const result = await pool.query(`
      SELECT 
        e.id as enrollment_id,
        e.user_id,
        e.student_id,
        e.course_id,
        e.status,
        e.payment_reference,
        e.amount,
        e.currency,
        e.created_at,
        u.name as student_name,
        u.email as student_email,
        COALESCE(u.phone, 'N/A') as student_phone,
        c.title as course_title,
        c.price_amount as course_cost
      FROM enrollments e
      JOIN users u ON u.id = COALESCE(e.user_id, e.student_id)
      JOIN courses c ON c.id = e.course_id
      WHERE e.status = 'pending'
      ORDER BY e.created_at DESC
    `);

    res.json({
      success: true,
      transactions: result.rows
    });

  } catch (error) {
    console.error('Get pending transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve or reject transaction
router.post('/approve-transaction/:enrollmentId', async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be approve or reject' });
    }

    // Verify admin authentication
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const newStatus = action === 'approve' ? 'active' : 'rejected';

    // Update enrollment status
    const result = await pool.query(
      `UPDATE enrollments 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING id, user_id, course_id, status, payment_reference, amount, currency`,
      [newStatus, enrollmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending enrollment not found' });
    }

    const enrollment = result.rows[0];

    res.json({
      success: true,
      message: `Transaction ${action}d successfully`,
      enrollment: enrollment
    });

  } catch (error) {
    console.error('Approve transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
