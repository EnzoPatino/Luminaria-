const express = require('express');
const healthRoutes = require('./healthRoutes');
const eventRoutes = require('./eventRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/eventos', eventRoutes);

module.exports = router;
