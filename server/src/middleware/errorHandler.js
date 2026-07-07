function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  // A streaming response (PDF download, SSE chat) may already have sent
  // headers before failing — writing a JSON error on top of that would throw
  // "Cannot set headers after they are sent." Delegate to Express's default
  // handler, which just closes the connection instead.
  if (res.headersSent) {
    return next(err);
  }

  const isMulterError = err.name === 'MulterError';
  const isCastError = err.name === 'CastError';
  const statusCode =
    err.statusCode || (isMulterError || isCastError ? 400 : res.statusCode >= 400 ? res.statusCode : 500);
  const message = isMulterError
    ? `Upload error: ${err.message}`
    : isCastError
      ? 'Invalid ID format'
      : err.message || 'Server error';

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
}

module.exports = { notFound, errorHandler };
