const { ingestValidatedEvent } = require('../services/ingestaService');

async function createEvent(req, res, next) {
  try {
    // Seccion: HTTP usa la misma capa de integridad que el worker MQTT.
    const result = await ingestValidatedEvent(req.validatedEvent, {
      source: 'http',
      ip: req.ip,
    });

    if (result.duplicate) {
      return res.status(202).json({
        status: 'ok',
        ingestionStatus: 'duplicate',
        message: 'Evento duplicado descartado por ventana de deduplicacion.',
      });
    }

    return res.status(201).json({
      status: 'ok',
      ingestionStatus: 'persisted',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createEvent };
