const { z } = require('zod');
const telemetriaModel = require('../models/telemetriaModel');

/**
 * Controlador para la API de telemetría histórica (BE-05).
 */

const historicoSchema = z.object({
  id_sensor: z.string().regex(/^\d+$/).transform(Number).optional(),
  inicio: z.string().datetime().optional(),
  fin: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).default('100').pipe(z.number().max(1000)),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0'),
});

async function getHistorico(req, res, next) {
  try {
    const parsed = historicoSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Parámetros de consulta inválidos.',
        details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const { data, total } = await telemetriaModel.getHistorico(parsed.data);

    return res.json({
      status: 'ok',
      data,
      pagination: {
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getHistorico };
