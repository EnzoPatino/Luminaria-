const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { closePool } = require('./config/database');

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({
    name: 'luminaria-backend',
    status: 'ok',
  });
});

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error('[API]', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Error interno del servidor.',
  });
});

process.once('SIGINT', async () => {
  await closePool();
});

process.once('SIGTERM', async () => {
  await closePool();
});

module.exports = app;
