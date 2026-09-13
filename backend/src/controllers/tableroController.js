const { pool } = require('../config/database');
const tablerosModel = require('../models/tablerosModel');

async function getTableros(req, res, next) {
  try {
    const tableros = await tablerosModel.findAll(pool);
    res.json({ status: 'ok', data: tableros });
  } catch (error) {
    next(error);
  }
}

module.exports = { getTableros };
