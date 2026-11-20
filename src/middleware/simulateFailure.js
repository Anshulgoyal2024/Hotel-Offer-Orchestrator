'use strict';

const { AppError } = require('../errors');
const { ERROR_CODES } = require('../constants');
const { sleep } = require('../utils/async');


function simulateFailure(simulation, supplier) {
  return async (req, res, next) => {
    const mode = simulation.modeFor(supplier, req.validated?.simulate);

    switch (mode) {
      case 'error':
        return next(new AppError(500, ERROR_CODES.SIMULATED_SUPPLIER_FAILURE, `${supplier} is simulating an outage`));
      case 'timeout':
        await sleep(simulation.hangMs); // outlasts the client's timeout
        return next(new AppError(504, ERROR_CODES.SIMULATED_SUPPLIER_FAILURE, `${supplier} is simulating a timeout`));
      case 'slow':
        await sleep(simulation.slowMs);
        return next();
      case 'malformed':
        return res.status(200).json({ unexpected: 'this is not a hotel list' });
      default:
        return next();
    }
  };
}

module.exports = { simulateFailure };
