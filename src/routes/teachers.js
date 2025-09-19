const express = require('express');
const pool = require('../services/db');

const router = express.Router();

// Submit teacher application
router.post('/apply', async (req, res) => {
  try {
    const { fullName, courseIds = [], certificate } = req.body;
    const userId = req.body.userId; // In real app, derive from auth token

    if (!userId || !fullName || !certificate?.dataUrl || !certificate?.name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      'INSERT INTO teacher_docs (user_id, file_path, filename, admin_comment, review_status) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, filename, uploaded_at, review_status, admin_comment',
      [userId, certificate.dataUrl, certificate.name, `Courses: ${Array.isArray(courseIds)?courseIds.join(','):''}`, 'pending']
    );

    res.status(201).json({ message: 'Application submitted', application: result.rows[0] });
  } catch (error) {
    console.error('Teacher apply error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my application (latest)
router.get('/my', async (req, res) => {
  try {
    const userId = req.query.userId; // In real app, derive from token
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const result = await pool.query(
      'SELECT id, user_id, filename, uploaded_at, review_status, admin_comment, file_path FROM teacher_docs WHERE user_id = $1 ORDER BY uploaded_at DESC LIMIT 1',
      [userId]
    );
    res.json({ application: result.rows[0] || null });
  } catch (error) {
    console.error('Teacher my error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my applications list
router.get('/my/list', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const result = await pool.query(
      'SELECT id, user_id, filename, uploaded_at, review_status, admin_comment, file_path FROM teacher_docs WHERE user_id = $1 ORDER BY uploaded_at DESC',
      [userId]
    );
    res.json({ applications: result.rows });
  } catch (error) {
    console.error('Teacher my list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List applications (admin)
router.get('/applications', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT td.id, td.user_id, td.filename, td.uploaded_at, td.review_status, td.admin_comment, td.file_path,
              u.name as user_name, u.email as user_email
         FROM teacher_docs td
         JOIN users u ON u.id = td.user_id
        ORDER BY td.uploaded_at DESC`
    );
    res.json({ applications: result.rows });
  } catch (error) {
    console.error('Teacher list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve application
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const update = await client.query('UPDATE teacher_docs SET review_status = $1 WHERE id = $2 RETURNING user_id', ['approved', id]);
      if (update.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Not found' });
      }
      const userId = update.rows[0].user_id;
      await client.query("UPDATE users SET role = 'teacher', status = 'active' WHERE id = $1", [userId]);
      await client.query('COMMIT');
      res.json({ message: 'Application approved' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Teacher approve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject application
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    await pool.query('UPDATE teacher_docs SET review_status = $1, admin_comment = $2 WHERE id = $3', ['rejected', comment || null, id]);
    res.json({ message: 'Application rejected' });
  } catch (error) {
    console.error('Teacher reject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
// List approved teachers with assignment info
router.get('/approved', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id as user_id, u.name, u.email, td.id as application_id, td.admin_comment, td.uploaded_at,
             COALESCE(COUNT(ca.id),0)::int as assigned_count
        FROM teacher_docs td
        JOIN users u ON u.id = td.user_id
        LEFT JOIN course_assignments ca ON ca.teacher_id = u.id
       WHERE td.review_status = 'approved'
       GROUP BY u.id, u.name, u.email, td.id, td.admin_comment, td.uploaded_at
       ORDER BY td.uploaded_at DESC`);
    res.json({ teachers: result.rows });
  } catch (error) {
    console.error('Approved teachers list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


