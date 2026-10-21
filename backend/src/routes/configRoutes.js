const express = require('express');
const config = require('../config');

const router = express.Router();

// La URL y la publishable key son datos públicos que necesita cargar el cliente
// antes de iniciar sesión. No incluir aquí secretos de Supabase.
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
