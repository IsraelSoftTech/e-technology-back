const express = require('express');
const pool = require('../services/db');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Get settings
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM app_settings');
    const map = {};
    for (const row of result.rows) {
      map[row.key] = row.value;
    }
    res.json({ settings: map });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upsert specific settings (admin only)
router.put('/', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    let decoded; try { decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key'); } catch { return res.status(401).json({ error: 'Invalid token' }); }
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { teacher_application_fee_amount, fapshi_payment_link } = req.body || {};
    const entries = Object.entries({ teacher_application_fee_amount, fapshi_payment_link }).filter(([,v])=> typeof v !== 'undefined');
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(value)]
      );
    }
    res.json({ message: 'Settings saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


