const crypto = require('crypto');
const config = require('../config');

function requireChirpstackToken(req, res, next) {
  const expected = config.chirpstackWebhookToken;
  const provided = req.get('x-chirpstack-token') || '';
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (!expected || expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      message: 'Webhook no autorizado.',
    });
  }

  return next();
}

module.exports = { requireChirpstackToken };
