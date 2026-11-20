'use strict';

const express = require('express');
const { validateSupplierQuery } = require('../middleware/validate');
const { simulateFailure } = require('../middleware/simulateFailure');
const { getSupplierHotels } = require('../suppliers/data');

// GET /supplierA/hotels?city=delhi   and   GET /supplierB/hotels?city=delhi
function createSupplierRouter(supplier, { simulation }) {
  const router = express.Router();

  router.get('/hotels', validateSupplierQuery, simulateFailure(simulation, supplier), (req, res) => {
    res.json(getSupplierHotels(supplier, req.validated.city));
  });

  return router;
}

module.exports = { createSupplierRouter };
