'use strict';

const { randomUUID } = require('node:crypto');
const { logger } = require('../logger');

const SAFE_REQUEST_ID = /^[\w.-]{1,64}$/;


function requestContext(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader('x-request-id', req.id);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
    const level = req.originalUrl.startsWith('/health') ? 'debug' : 'info'; // keep probes quiet
    req.log[level]('http.request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
    });
  });

  next();
}

module.exports = { requestContext };
