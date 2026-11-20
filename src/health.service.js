'use strict';

const axios = require('axios');
const { config } = require('./config');
const { getRedis } = require('./redis');
const { getTemporalClient } = require('./temporal-client');
const { withTimeout } = require('./utils/async');
const { SUPPLIERS } = require('./constants');

async function timedCheck(fn) {
  const startedAt = performance.now();
  try {
    const details = await fn();
    return { status: 'up', latencyMs: Math.round(performance.now() - startedAt), ...details };
  } catch (err) {
    return { status: 'down', latencyMs: Math.round(performance.now() - startedAt), error: err.message };
  }
}

/**
 *   down     -> we cannot serve requests (Redis or Temporal down, or BOTH suppliers down)
 *   degraded -> we can serve, but something is wrong (e.g. one supplier down)
 *   ok       -> everything works
 */
function summarizeHealth(checks) {
  const suppliersDown = SUPPLIERS.filter((name) => checks[name].status === 'down');
  if (checks.redis.status === 'down' || checks.temporal.status === 'down' || suppliersDown.length === SUPPLIERS.length) {
    return 'down';
  }
  const anythingDown = Object.values(checks).some((check) => check.status === 'down');
  return anythingDown ? 'degraded' : 'ok';
}

function createHealthChecker({
  getRedisClient = getRedis,
  getTemporal = getTemporalClient,
  http = axios,
  endpoints = config.suppliers.endpoints,
  timeoutMs = 2000,
} = {}) {
  const checkRedis = async () => {
    const reply = await withTimeout(getRedisClient().ping(), timeoutMs, 'redis ping');
    if (reply !== 'PONG') throw new Error(`unexpected PING reply: ${reply}`);
    return {};
  };

  const checkTemporal = async () => {
    const temporal = getTemporal();
    const info = await withTimeout(temporal.connection.workflowService.getSystemInfo({}), timeoutMs, 'temporal getSystemInfo');
    return { serverVersion: info?.serverVersion };
  };

  const checkSupplier = (supplier) => async () => {
    const response = await http.get(`${endpoints[supplier]}/hotels`, { params: { city: 'delhi' }, timeout: timeoutMs });
    if (!Array.isArray(response.data)) throw new Error('response is not a hotel list');
    return {};
  };

  return async function checkHealth() {
    const [redis, temporal, ...suppliers] = await Promise.all([
      timedCheck(checkRedis),
      timedCheck(checkTemporal),
      ...SUPPLIERS.map((supplier) => timedCheck(checkSupplier(supplier))),
    ]);

    const checks = { redis, temporal, ...Object.fromEntries(SUPPLIERS.map((name, i) => [name, suppliers[i]])) };
    return {
      status: summarizeHealth(checks),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks,
    };
  };
}

module.exports = { createHealthChecker, summarizeHealth };
