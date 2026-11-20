'use strict';



function readString(env, name, fallback) {
  const raw = env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

function readInt(env, name, fallback, min = 0) {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`Invalid environment variable ${name}="${raw}": expected an integer >= ${min}`);
  }
  return value;
}

function readBool(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = raw.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(value)) return true;
  if (['false', '0', 'no'].includes(value)) return false;
  throw new Error(`Invalid environment variable ${name}="${raw}": expected true or false`);
}

function loadConfig(env = process.env) {
  const nodeEnv = readString(env, 'NODE_ENV', 'development');
  const port = readInt(env, 'PORT', 3000, 1);

  return Object.freeze({
    env: nodeEnv,
    serviceName: readString(env, 'SERVICE_NAME', 'hotel-api'),
    logLevel: readString(env, 'LOG_LEVEL', 'info'),
    port,

    redis: Object.freeze({
      url: readString(env, 'REDIS_URL', 'redis://localhost:6379'),
      cacheTtlSeconds: readInt(env, 'CACHE_TTL_SECONDS', 300, 1),
      degradedCacheTtlSeconds: readInt(env, 'CACHE_DEGRADED_TTL_SECONDS', 30, 1),
    }),

    temporal: Object.freeze({
      address: readString(env, 'TEMPORAL_ADDRESS', 'localhost:7233'),
      namespace: readString(env, 'TEMPORAL_NAMESPACE', 'default'),
      taskQueue: readString(env, 'TEMPORAL_TASK_QUEUE', 'hotel-offers'),
      workflowTimeoutMs: readInt(env, 'WORKFLOW_TIMEOUT_MS', 20000, 1000),
      connectMaxAttempts: readInt(env, 'TEMPORAL_CONNECT_MAX_ATTEMPTS', 30, 1),
      connectMinDelayMs: readInt(env, 'TEMPORAL_CONNECT_MIN_DELAY_MS', 500, 1),
      connectMaxDelayMs: readInt(env, 'TEMPORAL_CONNECT_MAX_DELAY_MS', 5000, 1),
      workerHealthPort: readInt(env, 'WORKER_HEALTH_PORT', 8081, 1),
    }),

    suppliers: Object.freeze({
      timeoutMs: readInt(env, 'SUPPLIER_TIMEOUT_MS', 1500, 100),
      endpoints: Object.freeze({
        supplierA: readString(env, 'SUPPLIER_A_URL', `http://localhost:${port}/supplierA`),
        supplierB: readString(env, 'SUPPLIER_B_URL', `http://localhost:${port}/supplierB`),
      }),
    }),

    simulation: Object.freeze({
      // Safe default: simulation is OFF in production unless explicitly enabled.
      enabled: readBool(env, 'ENABLE_FAILURE_SIMULATION', nodeEnv !== 'production'),
      hangMs: readInt(env, 'SIMULATION_HANG_MS', 10000, 1),
      slowMs: readInt(env, 'SIMULATION_SLOW_MS', 1500, 1),
    }),
  });
}

module.exports = { config: loadConfig(), loadConfig };
