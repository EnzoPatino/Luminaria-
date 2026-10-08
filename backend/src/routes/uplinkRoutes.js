const express = require('express');
const { handleChirpstackUplink, getLastUplink } = require('../controllers/chirpstackController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Endpoint de verificación / liveness
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'chirpstack-uplink-receiver',
    message: 'Endpoint listo para recibir webhooks de ChirpStack vía POST',
  });
});

// Endpoint para consultar el último payload recibido (protegido con autenticación)
router.get('/last', requireAuth, getLastUplink);

// Endpoint principal para recibir webhooks de ChirpStack
router.post('/', handleChirpstackUplink);

module.exports = router;
