'use strict';

const express = require('express');

// GET /health -> 200 healthy, 207 degraded, 503 unavailable.
function createHealthRouter({ checkHealth }) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    const report = await checkHealth();
    res.status(report.status === 'down' ? 503 : report.status === 'degraded' ? 207 : 200).json(report);
  });

  return router;
}

module.exports = { createHealthRouter };
