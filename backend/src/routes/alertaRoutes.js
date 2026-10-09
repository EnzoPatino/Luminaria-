const express = require('express');
const { getAlertas, resolveAlerta } = require('../controllers/alertaController');
const { requireAuth, requireRole, optionalAuth } = require('../middlewares/authMiddleware');
const { audit } = require('../middlewares/auditMiddleware');

const router = express.Router();

// GET /api/alertas — Público (lectura abierta para el dashboard)
router.get('/', requireAuth, getAlertas);

// PATCH /api/alertas/:id/resolver — Resuelve alertas desde dashboard o técnicos autorizados
router.patch(
  '/:id/resolver',
  requireAuth,
  audit('RESOLVER_ALERTA', 'alertas', (req) => req.params.id),
  resolveAlerta
);

module.exports = router;
