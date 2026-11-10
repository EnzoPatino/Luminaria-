const { ingestValidatedEvent } = require('../services/ingestaService');

async function persistEvent(req, res, next, options = {}) {
  try {
    // Seccion: HTTP usa la misma capa de integridad que el worker MQTT.
    const result = await ingestValidatedEvent(req.validatedEvent, {
      source: options.source || 'http',
      ip: req.ip,
      allowDemo: options.allowDemo === true,
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

function createEvent(req, res, next) {
  return persistEvent(req, res, next);
}

function createSimulationEvent(req, res, next) {
  return persistEvent(req, res, next, { source: 'simulator', allowDemo: true });
}

module.exports = { createEvent, createSimulationEvent };
