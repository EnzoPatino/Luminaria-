class IngestionError extends Error {
  constructor(message, options = {}) {
    super(message);

    // Seccion: metadatos HTTP y operativos para respuestas y logs consistentes.
    this.name = 'IngestionError';
    this.statusCode = options.statusCode || 400;
    this.code = options.code || 'INGESTION_ERROR';
    this.details = options.details || [];

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IngestionError);
    }
  }
}

module.exports = { IngestionError };
