const express = require('express');
const { getAlertas, resolveAlerta } = require('../controllers/alertaController');
const { requireAuth, requireRole, optionalAuth } = require('../middlewares/authMiddleware');
const { audit } = require('../middlewares/auditMiddleware');

const router = express.Router();

// GET /api/alertas — Público (lectura abierta para el dashboard)
router.get('/', getAlertas);

// PATCH /api/alertas/:id/resolver — Protegido: admin o tecnico pueden resolver alertas.
// BE-04: autenticación obligatoria + RBAC
// SEC-03: auditoría de la resolución
router.patch(
  '/:id/resolver',
  requireAuth,
  requireRole('admin', 'tecnico'),
  audit('RESOLVER_ALERTA', 'alertas', (req) => req.params.id),
  resolveAlerta
);

module.exports = router;
