const express = require('express');
const healthRoutes = require('./healthRoutes');
const eventRoutes = require('./eventRoutes');
const tableroRoutes = require('./tableroRoutes');
const alertaRoutes = require('./alertaRoutes');
const configRoutes = require('./configRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/config', configRoutes);
router.use('/eventos', eventRoutes);
router.use('/tableros', tableroRoutes);
router.use('/alertas', alertaRoutes);

module.exports = router;
