const express = require('express');
const healthRoutes = require('./healthRoutes');
const eventRoutes = require('./eventRoutes');
const tableroRoutes = require('./tableroRoutes');
const alertaRoutes = require('./alertaRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/eventos', eventRoutes);
router.use('/tableros', tableroRoutes);
router.use('/alertas', alertaRoutes);

module.exports = router;
