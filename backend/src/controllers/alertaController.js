const { pool, withTransaction } = require('../config/database');
const alertasModel = require('../models/alertasModel');
const tablerosModel = require('../models/tablerosModel');

const SEVERIDADES = new Set(['CRITICA', 'ADVERTENCIA', 'INFO']);
const ESTADOS = new Set(['activa', 'resuelta']);

function parsePagination(query) {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 100, 1), 200);
  const offset = Math.max(Number.parseInt(query.offset, 10) || 0, 0);
  return { limit, offset };
}

async function getAlertas(req, res, next) {
  try {
    const severidad = req.query.severidad || req.query.prioridad;
    const estado_alerta = req.query.estado || req.query.estado_alerta;
    if (severidad && !SEVERIDADES.has(severidad)) {
      return res.status(400).json({ status: 'error', message: 'severidad inválida.' });
    }
    if (estado_alerta && !ESTADOS.has(estado_alerta)) {
      return res.status(400).json({ status: 'error', message: 'estado inválido.' });
    }

    const pagination = parsePagination(req.query);
    const result = await alertasModel.getAll(pool, { severidad, estado_alerta, ...pagination });
    return res.json({
      status: 'ok',
      data: result.rows,
      pagination: { ...pagination, total: result.total },
    });
  } catch (error) {
    next(error);
  }
}

async function resolveAlerta(req, res, next) {
  const idAlerta = Number.parseInt(req.params.id, 10);
  if (!Number.isSafeInteger(idAlerta) || idAlerta < 1) {
    return res.status(400).json({ status: 'error', message: 'ID de alerta inválido.' });
  }

  try {
    const alerta = await withTransaction(async (client) => {
      const resolved = await alertasModel.resolve(client, idAlerta);
      if (!resolved) return null;
      await tablerosModel.updateDerivedState(client, resolved.id_tablero);
      return resolved;
    });
    if (!alerta) {
      return res.status(404).json({ status: 'error', message: 'Alerta no encontrada.' });
    }
    return res.json({ status: 'ok', data: alerta });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAlertas, resolveAlerta };
