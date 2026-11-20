'use strict';

const { AppError } = require('../errors');
const { ERROR_CODES } = require('../constants');
const { logger } = require('../logger');

function notFoundHandler(req, _res, next) {
  next(new AppError(404, ERROR_CODES.NOT_FOUND, `Route ${req.method} ${req.path} does not exist`));
}

function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err?.type === 'entity.parse.failed') return new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Request body is not valid JSON');
  if (err?.type === 'entity.too.large') return new AppError(413, ERROR_CODES.VALIDATION_ERROR, 'Request body is too large');
  return new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Unexpected server error');
}

// Express recognises an error handler by its 4 parameters - keep all four.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const appError = toAppError(err);
  const log = req.log ?? logger;

  if (appError.status >= 500) log.error('request.failed', { code: appError.code, err });
  else log.warn('request.rejected', { code: appError.code, message: appError.message });

  if (res.headersSent) return next(err);

  return res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      requestId: req.id,
    },
  });
}

module.exports = { notFoundHandler, errorHandler, toAppError };
