'use strict';

const express = require('express');

// GET /health  -> 200 when ok/degraded, 503 when we cannot serve requests.
function createHealthRouter({ checkHealth }) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    const report = await checkHealth();
    res.status(report.status === 'down' ? 503 : 200).json(report);
  });

  return router;
}

module.exports = { createHealthRouter };
