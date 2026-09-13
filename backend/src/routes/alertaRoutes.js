const express = require('express');
const { getAlertas, resolveAlerta } = require('../controllers/alertaController');

const router = express.Router();
router.get('/', getAlertas);
router.patch('/:id/resolver', resolveAlerta);

module.exports = router;
