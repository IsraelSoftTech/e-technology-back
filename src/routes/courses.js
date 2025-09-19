const express = require('express');
const pool = require('../services/db');
const jwt = require('jsonwebtoken');

const router = express.Router();

// List courses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, price_amount, price_currency, capacity, created_at, created_by FROM courses ORDER BY created_at DESC'
    );
    res.json({ courses: result.rows });
  } catch (error) {
    console.error('List courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List courses assigned to a teacher
router.get('/assigned/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.price_amount, c.price_currency, c.capacity, c.created_at
         FROM course_assignments ca
         JOIN courses c ON c.id = ca.course_id
        WHERE ca.teacher_id = $1
        ORDER BY c.created_at DESC`,
      [teacherId]
    );
    res.json({ courses: result.rows });
  } catch (error) {
    console.error('List assigned courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List classes for a course
router.get('/:id/classes', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, course_id, teacher_id, start_time, end_time, meet_link, status, objective, created_at
         FROM classes WHERE course_id = $1
         ORDER BY start_time DESC NULLS LAST, created_at DESC`,
      [id]
    );
    res.json({ classes: result.rows });
  } catch (error) {
    console.error('List course classes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create class for a course
router.post('/:id/classes', async (req, res) => {
  try {
    const { id } = req.params; // course id
    const { teacherId, start_time, end_time, objective, meet_link, room_type } = req.body || {};
    if (!teacherId || !start_time || !objective) return res.status(400).json({ error: 'teacherId, start_time, objective required' });
    try {
      // For custom rooms, avoid inserting a duplicate placeholder meet_link; start with NULL
      const tempSuffix = Math.random().toString(36).slice(2, 10);
      const initialMeetLink = (room_type === 'custom')
        ? `custom:tmp-${Date.now()}-${tempSuffix}`
        : (meet_link || null);
      // First insert with provided/derived meet_link
      const inserted = await pool.query(
        `INSERT INTO classes (course_id, teacher_id, start_time, end_time, meet_link, status, objective)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)
         RETURNING id, course_id, teacher_id, start_time, end_time, meet_link, status, objective, created_at`,
        [id, teacherId, start_time, end_time || null, initialMeetLink, objective || null]
      );
      let created = inserted.rows[0];
      // If this is a custom room, assign a unique meet_link based on class id
      if ((room_type === 'custom') && (!created.meet_link || String(created.meet_link).startsWith('custom:'))) {
        const customLink = `custom:class-${created.id}`;
        const upd = await pool.query(
          `UPDATE classes SET meet_link = $1 WHERE id = $2
           RETURNING id, course_id, teacher_id, start_time, end_time, meet_link, status, objective, created_at`,
          [customLink, created.id]
        );
        created = upd.rows[0];
      }
      return res.status(201).json({ message: 'Class scheduled', class: created });
    } catch (e) {
      // Fallback if objective column is missing in DB
      if ((e.message||'').includes('column') && (e.message||'').includes('objective')) {
        const tempSuffix = Math.random().toString(36).slice(2, 10);
        const initialMeetLink = (room_type === 'custom')
          ? `custom:tmp-${Date.now()}-${tempSuffix}`
          : (meet_link || null);
        const result2 = await pool.query(
          `INSERT INTO classes (course_id, teacher_id, start_time, end_time, meet_link, status)
           VALUES ($1, $2, $3, $4, $5, 'scheduled')
           RETURNING id, course_id, teacher_id, start_time, end_time, meet_link, status, created_at`,
          [id, teacherId, start_time, end_time || null, initialMeetLink]
        );
        let created = result2.rows[0];
        if ((room_type === 'custom') && (!created.meet_link || String(created.meet_link).startsWith('custom:'))) {
          const customLink = `custom:class-${created.id}`;
          const upd = await pool.query(
            `UPDATE classes SET meet_link = $1 WHERE id = $2
             RETURNING id, course_id, teacher_id, start_time, end_time, meet_link, status, created_at`,
            [customLink, created.id]
          );
          created = upd.rows[0];
        }
        return res.status(201).json({ message: 'Class scheduled', class: created });
      }
      throw e;
    }
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Cancel a class (teacher)
router.post('/:courseId/classes/:classId/cancel', async (req, res) => {
  try {
    const { classId } = req.params;
    const result = await pool.query(
      `UPDATE classes SET status = 'cancelled', end_time = COALESCE(end_time, NOW()) WHERE id = $1 RETURNING id, status, end_time`,
      [classId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Class not found' });
    res.json({ message: 'Class cancelled', class: result.rows[0] });
  } catch (error) {
    console.error('Cancel class error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create course
router.post('/', async (req, res) => {
  try {
    const { title, code, duration, tutors, cost, levels, imageUrl } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const priceAmount = cost && parseFloat(String(cost).replace(/[^0-9.]/g, '')) || 0;

    const meta = `Code: ${code || ''}; Duration: ${duration || ''}; Tutors: ${tutors || ''}; Levels: ${(levels||[]).join(', ')}; Image: ${imageUrl || ''}`;

    let createdBy = null;
    try {
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        if (decoded && decoded.userId && decoded.role === 'admin') {
          createdBy = decoded.userId;
        }
      }
    } catch (e) { /* ignore token errors; createdBy stays null */ }
    const insert = await pool.query(
      'INSERT INTO courses (title, description, price_amount, price_currency, capacity, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, description, price_amount, price_currency, capacity, created_at, created_by',
      [title, meta, priceAmount, 'XAF', null, createdBy]
    );

    res.status(201).json({ message: 'Course created successfully', course: insert.rows[0] });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update course (partial)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price_amount, price_currency } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (price_amount !== undefined) { fields.push(`price_amount = $${idx++}`); values.push(price_amount); }
    if (price_currency !== undefined) { fields.push(`price_currency = $${idx++}`); values.push(price_currency); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const sql = `UPDATE courses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, title, description, price_amount, price_currency, capacity, created_at`;
    const result = await pool.query(sql, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Course updated', course: result.rows[0] });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete course
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM courses WHERE id = $1', [id]);
    res.json({ message: 'Course deleted' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


// List teachers assigned to a course
router.get('/:id/teachers', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT u.id, u.name, u.email
         FROM course_assignments ca
         JOIN users u ON u.id = ca.teacher_id
        WHERE ca.course_id = $1
        ORDER BY u.name`,
      [id]
    );
    res.json({ teachers: result.rows });
  } catch (error) {
    console.error('List course teachers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign multiple teachers to a course
router.post('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params; // course id
    const { teacherIds } = req.body; // array of user ids
    if (!Array.isArray(teacherIds)) return res.status(400).json({ error: 'teacherIds must be an array' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const teacherId of teacherIds) {
        await client.query(
          `INSERT INTO course_assignments (course_id, teacher_id)
             VALUES ($1, $2)
             ON CONFLICT (course_id, teacher_id) DO NOTHING`,
          [id, teacherId]
        );
      }
      await client.query('COMMIT');
      res.json({ message: 'Teachers assigned' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Assign teachers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

