'use strict';

const Redis = require('ioredis');
const { config } = require('./config');
const { logger } = require('./logger');

let client = null;

/**
 * One shared Redis connection per process (created on first use).
 * ioredis reconnects automatically; `maxRetriesPerRequest` makes a command
 * fail after a couple of attempts instead of hanging forever while Redis is down.
 */
function getRedis() {
  if (!client) {
    client = new Redis(config.redis.url, {
      connectionName: config.serviceName,
      maxRetriesPerRequest: 2,
      retryStrategy: (attempt) => Math.min(attempt * 200, 3000),
    });
    client.on('ready', () => logger.info('redis.ready'));
    client.on('close', () => logger.warn('redis.connection.closed'));
    client.on('error', (err) => logger.warn('redis.error', { err }));
  }
  return client;
}

async function closeRedis() {
  if (!client) return;
  const current = client;
  client = null;
  try {
    await current.quit();
  } catch {
    current.disconnect();
  }
}

module.exports = { getRedis, closeRedis };
