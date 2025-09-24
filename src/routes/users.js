const express = require('express');
const pool = require('../services/db');
const { logActivity } = require('../services/activity');

const router = express.Router();

// List users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, username, email, role, status, created_at FROM users ORDER BY id ASC');
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user basic fields (name, email, role, status)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role, status } = req.body || {};
  try {
    const result = await pool.query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), status = COALESCE($4, status) WHERE id = $5 RETURNING id, name, username, email, role, status',
      [name ?? null, email ?? null, role ?? null, status ?? null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user with dependency cleanup
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove attendance by this user (as student)
    await client.query('DELETE FROM attendance WHERE student_id = $1', [id]);

    // Handle enrollments/payments for this user (as student)
    // payments has ON DELETE CASCADE to enrollments, and enrollments has FK to users(student_id) ON DELETE CASCADE
    // But in case older schema lacks cascade, explicitly delete
    await client.query('DELETE FROM payments WHERE user_id = $1', [id]);
    await client.query('DELETE FROM enrollments WHERE student_id = $1', [id]);

    // Notifications for this user
    await client.query('DELETE FROM notifications WHERE user_id = $1', [id]);

    // Teacher docs for this user (CASCADE exists, but ensure)
    await client.query('DELETE FROM teacher_docs WHERE user_id = $1', [id]);

    // If user is a teacher: delete classes where they are the teacher
    await client.query('DELETE FROM classes WHERE teacher_id = $1', [id]);

    // Remove course assignments where user is teacher
    await client.query('DELETE FROM course_assignments WHERE teacher_id = $1', [id]);

    // Materials uploaded by this user: set uploader to null to preserve class materials
    await client.query('UPDATE class_materials SET uploader_id = NULL WHERE uploader_id = $1', [id]);

    // Courses created by this user: null out created_by
    await client.query('UPDATE courses SET created_by = NULL WHERE created_by = $1', [id]);

    // Finally, delete the user
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');
    try { await logActivity({ actorId: null, actorRole: 'admin', action: 'delete_user', entityType: 'user', entityId: String(id) }); } catch {}
    res.json({ success: true });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Suspend (disable) a user
router.post('/:id/suspend', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("UPDATE users SET status = 'disabled' WHERE id = $1 RETURNING id, name, username, email, role, status", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activate a user
router.post('/:id/activate', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("UPDATE users SET status = 'active' WHERE id = $1 RETURNING id, name, username, email, role, status", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


