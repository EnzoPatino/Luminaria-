const express = require('express');
const { pool } = require('../config/database');

const { checkSupabaseHealth } = require('../services/supabaseService');

const router = express.Router();

router.get('/', async (req, res) => {
  let dbStatus = 'unavailable';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'unavailable';
  }

  const supabaseHealth = await checkSupabaseHealth();

  const isOk = dbStatus === 'connected' || supabaseHealth.status === 'connected';

  res.status(isOk ? 200 : 503).json({
    status: isOk ? 'ok' : 'degraded',
    database: dbStatus,
    supabase: supabaseHealth.status,
  });
});

module.exports = router;
