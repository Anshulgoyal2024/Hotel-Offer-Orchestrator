'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { selectBestOffers } = require('../src/hotel.service');
const { parseSupplierResponse } = require('../src/suppliers/supplier.parser');
const { getSupplierHotels } = require('../src/suppliers/data');
const cache = require('../src/hotel.cache');
const { createHealthChecker } = require('../src/health.service');

test('dedupes normalized names, preserves winning display name, and applies all tie breakers', () => {
  const offers = [
    { name: '  Taj  Palace ', price: 50, supplier: 'supplierB', commissionPct: 10 },
    { name: 'Taj Palace', price: 50, supplier: 'supplierA', commissionPct: 10 },
    { name: 'TAJ PALACE', price: 50, supplier: 'supplierB', commissionPct: 11 },
    { name: 'Other', price: 20, supplier: 'supplierB', commissionPct: 1 },
  ];
  assert.deepEqual(selectBestOffers(offers).find((offer) => offer.price === 50), offers[2]);
  assert.equal(selectBestOffers([
    { name: 'Tie', price: 10, supplier: 'supplierB', commissionPct: 5 },
    { name: 'Tie', price: 10, supplier: 'supplierA', commissionPct: 5 },
  ])[0].supplier, 'supplierA');
  assert.equal(selectBestOffers(offers).length, 2);
});

test('supplier parser retains original names and supplier endpoints expose the required city catalogues', () => {
  const parsed = parseSupplierResponse('supplierB', [{ name: '  Taj  Palace ', price: 2, commissionPct: 4 }]);
  assert.equal(parsed.offers[0].name, '  Taj  Palace ');
  assert.equal(getSupplierHotels('supplierA', 'delhi').length, 6);
  assert.equal(getSupplierHotels('supplierB', 'mumbai').length, 5);
});

test('cache refresh uses one MULTI/EXEC and cached marker with TTL; queries via score range', async () => {
  const calls = [];
  const tx = {
    del: (...args) => (calls.push(['del', ...args]), tx),
    zadd: (...args) => (calls.push(['zadd', ...args]), tx),
    expire: (...args) => (calls.push(['expire', ...args]), tx),
    set: (...args) => (calls.push(['set', ...args]), tx),
    exec: async () => [],
  };
  const redis = {
    multi: () => (calls.push(['multi']), tx),
    zrangebyscore: async (...args) => (calls.push(['zrangebyscore', ...args]), ['{"name":"One"}']),
  };
  await cache.replaceCityOffers(redis, {
    city: 'delhi', hotels: [{ name: 'One', price: 100, supplier: 'supplierA', commissionPct: 2 }], meta: {}, ttlSeconds: 300,
  });
  assert(calls.some((call) => call[0] === 'set' && call[1] === 'hotels:delhi:cached' && call.includes(300)));
  assert(calls.some((call) => call[0] === 'expire' && call[1] === 'hotels:delhi' && call[2] === 300));
  assert.deepEqual(await cache.queryOffersByPrice(redis, { city: 'delhi', minPrice: 50, maxPrice: 150 }), [{ name: 'One' }]);
  assert(calls.some((call) => call[0] === 'zrangebyscore' && call[2] === 50 && call[3] === 150));
});

test('health check distinguishes healthy, degraded and down dependency states', async () => {
  const create = ({ redisUp = true, temporalUp = true, supplierBUp = true } = {}) => createHealthChecker({
    getRedisClient: () => ({ ping: async () => { if (!redisUp) throw Error('redis down'); return 'PONG'; } }),
    getTemporal: () => ({ connection: { workflowService: { getSystemInfo: async () => {
      if (!temporalUp) throw Error('temporal down'); return { serverVersion: 'fake' };
    } } } }),
    http: { get: async (url) => {
      if (url.includes('supplierB') && !supplierBUp) throw Error('supplier down');
      return { data: [] };
    } },
    endpoints: { supplierA: 'http://supplierA', supplierB: 'http://supplierB' },
  });
  assert.equal((await create()()).status, 'ok');
  assert.equal((await create({ supplierBUp: false })()).status, 'degraded');
  assert.equal((await create({ redisUp: false })()).status, 'down');
});
