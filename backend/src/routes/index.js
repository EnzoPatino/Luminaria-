const express = require('express');
const healthRoutes = require('./healthRoutes');

const router = express.Router();

// Route group: Health
router.use('/health', healthRoutes);

module.exports = router;
