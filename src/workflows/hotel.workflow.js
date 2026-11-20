'use strict';

const { proxyActivities } = require('@temporalio/workflow');

const { getCacheMeta, refreshCache, queryHotelsByPrice } = proxyActivities({
  startToCloseTimeout: '15 seconds',
  retry: { maximumAttempts: 2 },
});

async function hotelSearchWorkflow({ city, minPrice, maxPrice, forceRefresh = false }) {
  const meta = forceRefresh ? { exists: false } : await getCacheMeta(city);
  let cache = forceRefresh ? 'refresh' : meta.exists ? 'hit' : 'miss';
  if (!meta.exists || forceRefresh) await refreshCache(city);
  const result = await queryHotelsByPrice({ city, minPrice, maxPrice });
  return { city, ...result, cache };
}

module.exports = { hotelSearchWorkflow };
