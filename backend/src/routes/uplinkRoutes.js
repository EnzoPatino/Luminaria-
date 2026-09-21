const express = require('express');
const { handleChirpstackUplink, getLastUplink } = require('../controllers/chirpstackController');

const router = express.Router();

// Endpoint de verificación / liveness
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'chirpstack-uplink-receiver',
    message: 'Endpoint listo para recibir webhooks de ChirpStack vía POST',
  });
});

// Endpoint para consultar el último payload recibido para depuración
router.get('/last', getLastUplink);

// Endpoint principal para recibir webhooks de ChirpStack
router.post('/', handleChirpstackUplink);

module.exports = router;
