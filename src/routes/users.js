const express = require('express');
const pool = require('../services/db');

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

// Delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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


