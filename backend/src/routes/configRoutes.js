const express = require('express');
const config = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    data: {
      supabaseUrl: config.supabase.url,
      supabasePublishableKey: config.supabase.publishableKey,
    },
  });
});

module.exports = router;
