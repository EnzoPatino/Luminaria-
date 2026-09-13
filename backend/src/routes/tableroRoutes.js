const express = require('express');
const { getTableros } = require('../controllers/tableroController');

const router = express.Router();
router.get('/', getTableros);

module.exports = router;
