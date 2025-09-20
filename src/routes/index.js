const express = require('express');
const router = express.Router();

const pool = require('../services/db');
const materialsRoutes = require('./materials');
const transactionsRoutes = require('./transactions');

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/db-check', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1 as ok');
    res.json({ db: 'connected', result: result.rows[0] });
  } catch (err) {
    res.status(500).json({ db: 'error', error: err.message });
  }
});

// Simple total users metric
router.get('/metrics/users/count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    res.json({ count: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Suspended users metric
router.get('/metrics/users/suspended', async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE status = 'disabled'");
    res.json({ count: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Total teachers metric
router.get('/metrics/teachers/count', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(DISTINCT user_id)::int AS count FROM teacher_docs WHERE review_status = 'approved'"
    );
    res.json({ count: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Students metric (users that are not teachers or admins)
router.get('/metrics/students/count', async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role <> 'teacher' AND role <> 'admin'");
    res.json({ count: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Courses count
router.get('/metrics/courses/count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM courses');
    res.json({ count: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Classes count
router.get('/metrics/classes/count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM classes');
    res.json({ count: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transactions count
router.get('/metrics/transactions/count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM payments WHERE status = "success"');
    res.json({ count: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Overview metrics (simple time-series for last 7 days)
router.get('/metrics/overview', async (req, res) => {
  try {
    const days = 7;
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const r = await pool.query(
        `SELECT 
           to_char((CURRENT_DATE - $1::int), 'YYYY-MM-DD') as day,
           (SELECT COUNT(*)::int FROM users WHERE created_at::date <= (CURRENT_DATE - $1::int)) as users,
           (SELECT COUNT(*)::int FROM courses WHERE created_at::date <= (CURRENT_DATE - $1::int)) as courses,
           (SELECT COUNT(*)::int FROM classes WHERE created_at::date <= (CURRENT_DATE - $1::int)) as classes,
           (SELECT COUNT(*)::int FROM payments WHERE created_at::date <= (CURRENT_DATE - $1::int) AND status = 'success') as transactions`,
        [i]
      );
      series.push(r.rows[0]);
    }
    res.json({ series });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use('/materials', materialsRoutes);
router.use('/transactions', transactionsRoutes);

module.exports = router;
