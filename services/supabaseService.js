const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.waokbbftfhjrhvgpigzm:rtKvtuK.%23c%2BTWx7@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    return res;
  } catch (err) {
    console.error('Supabase PostgreSQL Query Error:', err.message);
    throw err;
  }
}

/**
 * Log an automated Apify tracking run to Supabase
 */
async function logTrackingRun({ actorName, target, status = 'completed', itemsFound = 0, summary = '' }) {
  try {
    const sql = `
      INSERT INTO public.apify_tracking_runs (actor_name, target, status, items_found, summary)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const res = await query(sql, [actorName, target, status, itemsFound, summary]);
    return res.rows[0];
  } catch (err) {
    console.error('Failed to log tracking run to Supabase:', err.message);
    return null;
  }
}

/**
 * Fetch all tracking runs from Supabase
 */
async function getTrackingHistory() {
  try {
    const sql = `
      SELECT * FROM public.apify_tracking_runs
      ORDER BY id DESC
      LIMIT 50;
    `;
    const res = await query(sql);
    return res.rows;
  } catch (err) {
    console.error('Failed to get tracking history from Supabase:', err.message);
    return [];
  }
}

/**
 * Delete a tracking run from Supabase
 */
async function deleteTrackingRun(id) {
  try {
    const sql = `DELETE FROM public.apify_tracking_runs WHERE id = $1;`;
    await query(sql, [id]);
    return true;
  } catch (err) {
    console.error('Failed to delete tracking run:', err.message);
    return false;
  }
}

module.exports = {
  query,
  logTrackingRun,
  getTrackingHistory,
  deleteTrackingRun
};
