'use strict';

const express = require('express');
const { config } = require('./config');
const { SUPPLIERS } = require('./constants');
const { requestContext } = require('./middleware/requestContext');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { createSimulation } = require('./suppliers/simulation');
const { createSupplierRouter } = require('./routes/supplier.routes');
const { createHotelsRouter } = require('./routes/hotels.routes');
const { createHealthRouter } = require('./routes/health.routes');
const { createSimulationRouter } = require('./routes/simulation.routes');

/**
 * Build the Express app. The two things that talk to the outside world
 * (hotelSearch -> Temporal, checkHealth -> Redis/Temporal/suppliers)
 * are parameters, so tests can pass fakes and need no infrastructure.
 */
function createApp({
  hotelSearch,
  checkHealth,
  simulation = createSimulation({ ...config.simulation })
} = {}) {
  if (typeof hotelSearch !== 'function') {
    throw new TypeError('createApp: hotelSearch is required');
  }

  if (typeof checkHealth !== 'function') {
    throw new TypeError('createApp: checkHealth is required');
  }

  const app = express();

  app.disable('x-powered-by');
  app.use(requestContext);

  // The two mock suppliers live in this same process.
  for (const supplier of SUPPLIERS) {
    app.use(
      `/${supplier}`,
      createSupplierRouter(supplier, { simulation })
    );
  }

  app.use('/api/hotels', createHotelsRouter({ hotelSearch }));
  app.use('/health', createHealthRouter({ checkHealth }));

  if (simulation.enabled) {
    app.use(
      '/admin/simulation',
      createSimulationRouter({ simulation })
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };