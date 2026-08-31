const express = require('express');
const { createEvent } = require('../controllers/eventController');

const router = express.Router();

// Entrada mínima para persistir el mismo contrato JSON que usa MQTT.
// No pretende ser la API REST completa del producto final.
router.post('/', createEvent);

module.exports = router;
