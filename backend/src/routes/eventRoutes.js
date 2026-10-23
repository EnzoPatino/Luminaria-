const express = require('express');
const { createEvent } = require('../controllers/eventController');
const { validateEventPayload } = require('../middlewares/eventIngestionMiddleware');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Seccion: entrada HTTP protegida por contrato JSON antes de tocar servicios.
router.post('/', requireAuth, validateEventPayload, createEvent);

module.exports = router;
