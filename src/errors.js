'use strict';

const { ERROR_CODES } = require('./constants');

// An error we *expect* and know how to describe to the client.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super(400, ERROR_CODES.VALIDATION_ERROR, 'Invalid request parameters', details);
    this.name = 'ValidationError';
  }
}

// Thrown by the supplier client. `retryable` tells the Temporal activity
// whether trying again could help (network blip, 503) or is pointless
// (HTTP 400, malformed response).
class SupplierError extends Error {
  constructor(supplier, code, message, { retryable, status, cause } = {}) {
    super(message, { cause });
    this.name = 'SupplierError';
    this.supplier = supplier;
    this.code = code;
    this.retryable = Boolean(retryable);
    this.status = status;
  }
}

module.exports = { AppError, ValidationError, SupplierError };
