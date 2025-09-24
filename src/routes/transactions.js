const express = require('express');
const pool = require('../services/db');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../services/activity');

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

    await logActivity({
      actorId: decoded.userId,
      actorRole: decoded.role,
      action: 'submit_transaction',
      entityType: 'course',
      entityId: String(courseId),
      details: { enrollment_id: enrollment.rows[0].id, amount, currency, payment_reference: transactionId }
    });

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

// Submit teacher application fee transaction ID
router.post('/teacher-fee/submit', async (req, res) => {
  try {
    const { userId, transactionId, amount, currency } = req.body || {};
    if (!userId || !transactionId || !amount) return res.status(400).json({ error: 'Missing required fields' });

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    let decoded; try { decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key'); } catch { return res.status(401).json({ error: 'Invalid token' }); }
    if (parseInt(decoded.userId) !== parseInt(userId)) return res.status(403).json({ error: 'Unauthorized - user ID mismatch' });

    const ins = await pool.query(
      `INSERT INTO teacher_fees (user_id, amount, currency, payment_reference, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, user_id, amount, currency, payment_reference, status, created_at`,
      [userId, amount, currency || 'XAF', transactionId]
    );

    await logActivity({ actorId: decoded.userId, actorRole: decoded.role, action: 'submit_teacher_fee', entityType: 'teacher_fee', entityId: String(ins.rows[0].id), details: { amount, currency, payment_reference: transactionId } });
    return res.status(201).json({ success: true, message: 'Teacher fee submitted. Awaiting admin approval.', fee: ins.rows[0] });
  } catch (error) {
    console.error('Submit teacher fee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get transactions for admin (all statuses)
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

    if (decoded.role !== 'admin' && decoded.role !== 'teacher') {
      return res.status(403).json({ error: 'Admin or teacher access required' });
    }

    // Enrollments
    const enrollments = await pool.query(`
      SELECT 
        'course' as type,
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
    `);

    // Teacher fees (keep DB enum values; map to UI values in JS)
    const teacherFeesRaw = await pool.query(`
      SELECT 
        'teacher_fee' as type,
        tf.id as fee_id,
        tf.user_id,
        NULL::bigint as student_id,
        NULL::bigint as course_id,
        tf.status,
        tf.payment_reference,
        tf.amount,
        tf.currency,
        tf.created_at,
        u.name as student_name,
        u.email as student_email,
        COALESCE(u.phone, 'N/A') as student_phone,
        NULL::text as course_title,
        NULL::numeric as course_cost
      FROM teacher_fees tf
      JOIN users u ON u.id = tf.user_id
    `);
    const teacherFees = {
      rows: teacherFeesRaw.rows.map(r => ({
        ...r,
        status: (r.status === 'success' ? 'active' : (r.status === 'failed' ? 'rejected' : r.status))
      }))
    };

    const rows = [...enrollments.rows, ...teacherFees.rows].sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
    res.json({
      success: true,
      transactions: rows
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

    // Update enrollment status (allow re-approve/reject anytime)
    const result = await pool.query(
      `UPDATE enrollments 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, user_id, course_id, status, payment_reference, amount, currency`,
      [newStatus, enrollmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const enrollment = result.rows[0];

    await logActivity({
      actorId: decoded.userId,
      actorRole: decoded.role,
      action: action === 'approve' ? 'approve_transaction' : 'reject_transaction',
      entityType: 'enrollment',
      entityId: String(enrollmentId),
      details: { course_id: enrollment.course_id, user_id: enrollment.user_id, status: enrollment.status }
    });

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

// Approve or reject teacher fee
router.post('/approve-teacher-fee/:feeId', async (req, res) => {
  try {
    const { feeId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'Invalid action. Must be approve or reject' });

    // Verify admin authentication
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    let decoded; try { decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key'); } catch { return res.status(401).json({ error: 'Invalid token' }); }
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const newStatus = action === 'approve' ? 'success' : 'failed';
    const upd = await pool.query(
      `UPDATE teacher_fees SET status = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, user_id, status`, [newStatus, feeId]
    );
    if (upd.rows.length === 0) return res.status(404).json({ error: 'Fee not found' });
    const fee = upd.rows[0];

    // If approved, and teacher verification is approved, then promote user to teacher
    if (newStatus === 'success') {
      const ver = await pool.query(
        `SELECT review_status FROM teacher_docs WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1`,
        [fee.user_id]
      );
      if (ver.rows.length > 0 && ver.rows[0].review_status === 'approved') {
        await pool.query("UPDATE users SET role = 'teacher', status = 'active' WHERE id = $1", [fee.user_id]);
      }
    }

    await logActivity({
      actorId: decoded.userId,
      actorRole: decoded.role,
      action: action === 'approve' ? 'approve_teacher_fee' : 'reject_teacher_fee',
      entityType: 'teacher_fee',
      entityId: String(feeId),
      details: { user_id: fee.user_id, status: fee.status }
    });

    // Present status as 'active'/'rejected' in response for UI consistency
    const presented = { ...fee, status: (fee.status === 'success' ? 'active' : (fee.status === 'failed' ? 'rejected' : fee.status)) }
    res.json({ success: true, message: `Teacher fee ${action}d successfully`, fee: presented });
  } catch (error) {
    console.error('Approve teacher fee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
