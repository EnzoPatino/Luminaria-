const express = require('express');
const telemetriaController = require('../controllers/telemetriaController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// GET /api/telemetria/historico — Obtener historial de lecturas de sensores
router.get('/historico', requireAuth, telemetriaController.getHistorico);

module.exports = router;
