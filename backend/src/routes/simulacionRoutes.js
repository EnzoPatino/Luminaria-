const express = require('express');
const { createSimulationEvent } = require('../controllers/eventController');
const { validateEventPayload } = require('../middlewares/eventIngestionMiddleware');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');
const { audit } = require('../middlewares/auditMiddleware');

const router = express.Router();
const DEMO_BOARD_IDS = new Set([
  'DEMO_TABLERO_01',
  'DEMO_TABLERO_02',
  'DEMO_TABLERO_03',
  'DEMO_TABLERO_04',
]);

function requireDemoBoard(req, res, next) {
  if (!DEMO_BOARD_IDS.has(req.validatedEvent.id_tablero)) {
    return res.status(422).json({
      status: 'error',
      code: 'INVALID_DEMO_BOARD',
      message: 'El simulador solo puede escribir en DEMO_TABLERO_01 a DEMO_TABLERO_04.',
    });
  }
  return next();
}

router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validateEventPayload,
  requireDemoBoard,
  audit('SIMULACION_EVENTO', 'simulador'),
  createSimulationEvent,
);

module.exports = router;
