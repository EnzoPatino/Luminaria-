const express = require('express');
const config = require('../config');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json({
    status: 'ok',
    data: {
      supabaseUrl: config.supabase.url,
      supabasePublishableKey: config.supabase.publishableKey,
    },
  });
});

module.exports = router;
