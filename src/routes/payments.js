const express = require('express');
const router = express.Router();
const fapshiService = require('../services/fapshi');
const pool = require('../services/db');
const { authenticateToken } = require('./middleware');

/**
 * Create a payment request
 * POST /api/payments/create
 */
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { courseId, amount, currency, phone, paymentMethod } = req.body;
    const userId = req.user.userId;

    console.log('Payment request:', { courseId, amount, currency, phone, paymentMethod, userId });

    // Validate required fields
    if (!courseId || !amount || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: courseId, amount, phone' 
      });
    }

    // Validate payment method
    console.log('Payment method received:', paymentMethod);
    if (paymentMethod !== 'fapshi') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only Fapshi payment method is supported' 
      });
    }

    // Check if user is already enrolled (only active enrollments)
    let enrollmentCheck;
    try {
      enrollmentCheck = await pool.query(
        'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status = $3',
        [courseId, userId, 'active']
      );
    } catch (dbError) {
      console.error('Database error during enrollment check:', dbError);
      if (dbError.code === 'ECONNRESET' || dbError.code === 'ECONNREFUSED') {
        // Retry once
        try {
          enrollmentCheck = await pool.query(
            'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status = $3',
            [courseId, userId, 'active']
          );
        } catch (retryError) {
          console.error('Database retry failed:', retryError);
          throw retryError;
        }
      } else {
        throw dbError;
      }
    }

    console.log('Enrollment check result:', enrollmentCheck.rows);

    if (enrollmentCheck.rows.length > 0) {
      // Idempotent behavior: treat as success if already enrolled
      return res.json({
        success: true,
        status: 'already_enrolled',
        message: 'User already enrolled in this course'
      });
    }

    // Check if there's a pending enrollment and delete it
    const pendingEnrollmentCheck = await pool.query(
      'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status = $3',
      [courseId, userId, 'pending']
    );

    if (pendingEnrollmentCheck.rows.length > 0) {
      console.log('Deleting pending enrollment:', pendingEnrollmentCheck.rows[0].id);
      await pool.query(
        'DELETE FROM enrollments WHERE id = $1',
        [pendingEnrollmentCheck.rows[0].id]
      );
    }

    // Create enrollment record first
    const enrollmentResult = await pool.query(
      'INSERT INTO enrollments (course_id, student_id, status) VALUES ($1, $2, $3) RETURNING id',
      [courseId, userId, 'pending']
    );

    const enrollmentId = enrollmentResult.rows[0].id;

    // Create payment record
    const paymentResult = await pool.query(
      'INSERT INTO payments (enrollment_id, user_id, amount, currency, provider, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [enrollmentId, userId, amount, currency, 'fapshi', 'pending']
    );

    const paymentId = paymentResult.rows[0].id;
    const reference = `ENROLL_${enrollmentId}_${paymentId}`;

    // Create Fapshi payment request (triggers MoMo prompt on phone)
    const fapshiResponse = await fapshiService.createPayment({
      amount: parseFloat(amount),
      phone: phone,
      customerName: req.user.name || 'Student',
      email: req.user.email || 'student@example.com',
      userId: userId.toString(),
      description: `Course enrollment payment - ${reference}`,
      reference: reference
    });

    if (!fapshiResponse.success) {
      // Update payment status to failed
      await pool.query(
        'UPDATE payments SET status = $1 WHERE id = $2',
        ['failed', paymentId]
      );

      return res.status(400).json({
        success: false,
        error: fapshiResponse.error || 'Payment creation failed'
      });
    }

    // Save provider transaction/payment id
    await pool.query(
      'UPDATE payments SET provider_txn_id = $1 WHERE id = $2',
      [fapshiResponse.paymentId, paymentId]
    );

    // Respond pending; client will poll or await webhook to activate enrollment
    res.json({
      success: true,
      status: 'pending',
      reference: reference,
      paymentId: fapshiResponse.paymentId,
      paymentUrl: fapshiResponse.data?.paymentUrl || fapshiResponse.data?.url || null,
      message: 'Approval prompt sent. Please confirm on your phone.'
    });

  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

/**
 * Check payment status
 * GET /api/payments/status/:reference
 */
router.get('/status/:reference', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.userId;

    // Get payment from database
    const paymentResult = await pool.query(
      `SELECT p.*, e.course_id, c.title as course_title 
       FROM payments p 
       JOIN enrollments e ON p.enrollment_id = e.id 
       JOIN courses c ON e.course_id = c.id
       WHERE p.provider_txn_id = $1 AND p.user_id = $2`,
      [reference, userId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Payment not found' 
      });
    }

    const payment = paymentResult.rows[0];

    // If payment is already confirmed, return current status
    if (payment.status === 'success') {
      return res.json({
        success: true,
        status: 'success',
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          courseTitle: payment.course_title,
          createdAt: payment.created_at
        }
      });
    }

    // Check status with Fapshi
    const statusResponse = await fapshiService.checkPaymentStatus(reference);

    if (statusResponse.success) {
      const fapshiStatus = statusResponse.data.status;
      let newStatus = 'pending';

      if (fapshiStatus === 'completed' || fapshiStatus === 'success') {
        newStatus = 'success';
        // Update enrollment status
        await pool.query(
          'UPDATE enrollments SET status = $1 WHERE id = $2',
          ['active', payment.enrollment_id]
        );
      } else if (fapshiStatus === 'failed' || fapshiStatus === 'cancelled') {
        newStatus = 'failed';
      }

      // Update payment status
      await pool.query(
        'UPDATE payments SET status = $1 WHERE id = $2',
        [newStatus, payment.id]
      );

      res.json({
        success: true,
        status: newStatus,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: newStatus,
          courseTitle: payment.course_title,
          createdAt: payment.created_at
        }
      });
    } else {
      res.json({
        success: true,
        status: payment.status,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          courseTitle: payment.course_title,
          createdAt: payment.created_at
        }
      });
    }

  } catch (error) {
    console.error('Payment status check error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

/**
 * Fapshi webhook endpoint
 * POST /api/payments/fapshi/webhook
 */
router.post('/fapshi/webhook', async (req, res) => {
  try {
    console.log('Fapshi webhook received:', req.body);

    const webhookData = fapshiService.processWebhook(req.body);
    
    // Find payment by reference
    const paymentResult = await pool.query(
      'SELECT p.*, e.course_id FROM payments p JOIN enrollments e ON p.enrollment_id = e.id WHERE p.provider_txn_id = $1',
      [webhookData.paymentId]
    );

    if (paymentResult.rows.length === 0) {
      console.log('Payment not found for webhook:', webhookData.paymentId);
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];
    let newStatus = 'pending';

    // Map Fapshi status to our status
    if (webhookData.status === 'completed' || webhookData.status === 'success') {
      newStatus = 'success';
      // Update enrollment status
      await pool.query(
        'UPDATE enrollments SET status = $1 WHERE id = $2',
        ['active', payment.enrollment_id]
      );
    } else if (webhookData.status === 'failed' || webhookData.status === 'cancelled') {
      newStatus = 'failed';
    }

    // Update payment status
    await pool.query(
      'UPDATE payments SET status = $1 WHERE id = $2',
      [newStatus, payment.id]
    );

    console.log(`Payment ${payment.id} updated to status: ${newStatus}`);

    res.json({ success: true, message: 'Webhook processed successfully' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Webhook processing failed' 
    });
  }
});

/**
 * Get user's payment history
 * GET /api/payments/history
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT p.*, c.title as course_title, c.price_amount, c.price_currency
       FROM payments p 
       JOIN enrollments e ON p.enrollment_id = e.id 
       JOIN courses c ON e.course_id = c.id
       WHERE p.user_id = $1 
       ORDER BY p.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      payments: result.rows
    });

  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;
