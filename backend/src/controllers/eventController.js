const { persistEvent } = require('../services/persistenciaService');

async function createEvent(req, res, next) {
  try {
    const result = await persistEvent(req.body);
    res.status(201).json({
      status: 'ok',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createEvent };
