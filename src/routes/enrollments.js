const express = require('express');
const pool = require('../services/db');

const router = express.Router();

// List my enrollments with course info
router.get('/my', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const result = await pool.query(
      `SELECT e.id as enrollment_id, e.status, e.enrolled_at,
              c.id as course_id, c.title, c.description, c.price_amount, c.price_currency
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
        WHERE e.student_id = $1
        ORDER BY e.enrolled_at DESC`,
      [userId]
    );
    res.json({ enrollments: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create an enrollment (pending)
router.post('/', async (req, res) => {
  try {
    const { courseId, studentId } = req.body || {};
    if (!courseId || !studentId) return res.status(400).json({ error: 'courseId and studentId are required' });
    const result = await pool.query(
      `INSERT INTO enrollments (course_id, student_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (course_id, student_id) DO UPDATE SET status = 'active'
       RETURNING id, course_id, student_id, status, enrolled_at`,
      [courseId, studentId]
    );
    res.status(201).json({ enrollment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


