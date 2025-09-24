const pool = require('./db');

async function ensureActivityTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actor_id BIGINT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_logs(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_logs(actor_id);
  `);
}

async function logActivity({ actorId, actorRole, action, entityType, entityId, details }) {
  try {
    await ensureActivityTable();
    await pool.query(
      `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId || null, actorRole || null, action, entityType || null, entityId != null ? String(entityId) : null, details || null]
    );
  } catch (e) {
    // do not block primary flow on logging failure
  }
}

module.exports = { logActivity };


