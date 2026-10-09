const express = require('express');
const { getTableros } = require('../controllers/tableroController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();
router.get('/', requireAuth, getTableros);

module.exports = router;
