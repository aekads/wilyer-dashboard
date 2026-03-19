// src/middlewares/errorHandler.js
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message, code } = err;

  // Postgres errors
  if (err.code === '23505') { statusCode = 409; message = 'Duplicate entry'; }
  if (err.code === '23503') { statusCode = 400; message = 'Referenced record not found'; }
  if (err.code === '22P02') { statusCode = 400; message = 'Invalid UUID format'; }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') { statusCode = 400; message = 'File too large (max 500MB)'; }

  if (process.env.NODE_ENV === 'development') {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    error: { message, code: code || err.code || 'ERROR', ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) }
  });
};

const notFound = (req, res) => {
  res.status(404).json({ success: false, error: { message: `Route ${req.originalUrl} not found` } });
};

module.exports = { AppError, errorHandler, notFound };
