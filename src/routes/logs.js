const express = require('express');
const pool = require('../services/db');

const router = express.Router();

// List activity logs with basic filters
router.get('/', async (req, res) => {
  try {
    const { actorId, action, entityType, limit = 100 } = req.query;
    const values = [];
    const where = [];
    if (actorId) { values.push(actorId); where.push(`actor_id = $${values.length}`); }
    if (action) { values.push(action); where.push(`action = $${values.length}`); }
    if (entityType) { values.push(entityType); where.push(`entity_type = $${values.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const lim = Math.max(1, Math.min(parseInt(limit) || 100, 500));
    const result = await pool.query(
      `SELECT id, ts, actor_id, actor_role, action, entity_type, entity_id, details
         FROM activity_logs
         ${whereSql}
         ORDER BY ts DESC
         LIMIT ${lim}`,
      values
    );
    res.json({ logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Danger: delete all logs
router.delete('/', async (_req, res) => {
  try {
    await pool.query('DELETE FROM activity_logs');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


