'use strict';

const express = require('express');
const { validateHotelQuery } = require('../middleware/validate');

// GET /api/hotels?city=delhi&minPrice=5000&maxPrice=7000
function createHotelsRouter({ hotelSearch }) {
  const router = express.Router();

  router.get('/', validateHotelQuery, async (req, res) => {
    const { city, minPrice, maxPrice, refresh } = req.validated;

    // Express 5 forwards a rejected promise to the error handler automatically.
    const result = await hotelSearch({ city, minPrice, maxPrice, forceRefresh: refresh, requestId: req.id });

    res.json({
      city,
      filters: { minPrice: minPrice ?? null, maxPrice: maxPrice ?? null },
      count: result.hotels.length,
      hotels: result.hotels.map(({ name, price, supplier, commissionPct }) => ({ name, price, supplier, commissionPct })),
      meta: {
        cache: result.cache, // hit | miss | refresh
        degraded: result.degraded, // true when one supplier failed
        suppliers: result.suppliers,
        refreshedAt: result.refreshedAt,
        workflowId: result.workflowId,
        requestId: req.id,
      },
    });
  });

  return router;
}

module.exports = { createHotelsRouter };
