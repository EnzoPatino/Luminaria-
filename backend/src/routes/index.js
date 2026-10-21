const express = require('express');
const healthRoutes = require('./healthRoutes');
const eventRoutes = require('./eventRoutes');
const tableroRoutes = require('./tableroRoutes');
const alertaRoutes = require('./alertaRoutes');
const uplinkRoutes = require('./uplinkRoutes');
const authRoutes = require('./authRoutes');
const telemetriaRoutes = require('./telemetriaRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/eventos', eventRoutes);
router.use('/uplink', uplinkRoutes);
router.use('/tableros', tableroRoutes);
router.use('/alertas', alertaRoutes);
router.use('/telemetria', telemetriaRoutes);

module.exports = router;
