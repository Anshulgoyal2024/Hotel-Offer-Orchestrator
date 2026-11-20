'use strict';

// A tiny structured logger: one JSON object per line on stdout.
// Docker, Kubernetes and log tools (Loki, Datadog, CloudWatch) all understand
// this format, and it needs zero dependencies.

const { config } = require('./config');

const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, silent: 100 });

function serializeError(err) {
  if (!(err instanceof Error)) return { message: String(err) };
  return { name: err.name, message: err.message, code: err.code, stack: err.stack };
}

function defaultWrite(line) {
  process.stdout.write(`${line}\n`);
}

function createLogger({ level = 'info', bindings = {}, write = defaultWrite } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function log(levelName, msg, fields) {
    if (LEVELS[levelName] < threshold) return;
    const { err, ...rest } = fields ?? {};
    const entry = { level: levelName, time: new Date().toISOString(), msg, ...bindings, ...rest };
    if (err !== undefined) entry.err = serializeError(err);
    try {
      write(JSON.stringify(entry));
    } catch {
      // A log call must never crash the app (e.g. circular object in fields).
      write(JSON.stringify({ level: levelName, time: entry.time, msg, logError: 'unserializable fields' }));
    }
  }

  return {
    debug: (msg, fields) => log('debug', msg, fields),
    info: (msg, fields) => log('info', msg, fields),
    warn: (msg, fields) => log('warn', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
    child: (extra) => createLogger({ level, bindings: { ...bindings, ...extra }, write }),
  };
}

const logger = createLogger({ level: config.logLevel, bindings: { service: config.serviceName } });

module.exports = { logger, createLogger, serializeError };
