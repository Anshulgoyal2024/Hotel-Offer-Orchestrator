'use strict';

const { config } = require('./config');
const { logger } = require('./logger');
const { createApp } = require('./app');
const { getRedis, closeRedis } = require('./redis');
const {
  connectTemporal,
  closeTemporalClient,
  runHotelSearch
} = require('./temporal-client');
const { createHealthChecker } = require('./health.service');

function main() {
  const app = createApp({
    hotelSearch: runHotelSearch,
    checkHealth: createHealthChecker()
  });

  // Listen immediately so mock suppliers are reachable
  // while Temporal is initializing.
  const server = app.listen(config.port, () => {
    logger.info('server.listening', {
      port: config.port,
      env: config.env,
      simulation: config.simulation.enabled
    });
  });

  // Connect to dependencies in the background.
  getRedis();
  connectTemporal().catch(() => {});

  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;

    shuttingDown = true;

    logger.info('server.shutdown', { signal });

    setTimeout(() => process.exit(1), 10000).unref();

    server.close();
    server.closeIdleConnections();

    await Promise.allSettled([
      closeTemporalClient(),
      closeRedis()
    ]);

    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();