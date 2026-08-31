const port = Number(process.env.PORT || 3000);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number.isFinite(port) && port > 0 ? port : 3000,
};
