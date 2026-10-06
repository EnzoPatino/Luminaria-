const express = require('express');
const telemetriaController = require('../controllers/telemetriaController');

const router = express.Router();

// GET /api/telemetria/historico — Obtener historial de lecturas de sensores
router.get('/historico', telemetriaController.getHistorico);

module.exports = router;
