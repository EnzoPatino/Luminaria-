const { validateAndNormalizeEvent } = require('../validators/eventSchema');

function validateEventPayload(req, res, next) {
  try {
    // Seccion: validacion temprana para que ningun payload invalido toque servicios ni BD.
    req.validatedEvent = validateAndNormalizeEvent(req.body);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { validateEventPayload };
