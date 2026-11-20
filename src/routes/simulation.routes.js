'use strict';

const express = require('express');
const { validateSimulationUpdate } = require('../middleware/validate');


function createSimulationRouter({ simulation }) {
  const router = express.Router();

  router.get('/', (_req, res) => {
    res.json({ enabled: simulation.enabled, modes: simulation.snapshot() });
  });

  router.put('/:supplier', express.json({ limit: '1kb' }), validateSimulationUpdate, (req, res) => {
    const { supplier, mode } = req.validated;
    simulation.set(supplier, mode);
    req.log.info('simulation.updated', { supplier, mode });
    res.json({ enabled: simulation.enabled, modes: simulation.snapshot() });
  });

  router.delete('/', (req, res) => {
    simulation.reset();
    req.log.info('simulation.reset');
    res.json({ enabled: simulation.enabled, modes: simulation.snapshot() });
  });

  return router;
}

module.exports = { createSimulationRouter };
