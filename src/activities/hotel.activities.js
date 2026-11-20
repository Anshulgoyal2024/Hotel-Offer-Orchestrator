'use strict';

const { config } = require('../config');
const { getRedis } = require('../redis');
const { createSupplierClient } = require('../suppliers/supplier.client');
const { selectBestOffers } = require('../hotel.service');
const { SUPPLIERS, ERROR_CODES } = require('../constants');
const { ApplicationFailure } = require('@temporalio/activity');

const CACHE_PREFIX = 'hotel-offers:';
const supplierClient = createSupplierClient();

async function getCacheMeta(city) {
  const raw = await getRedis().get(`${CACHE_PREFIX}${city}`);
  if (!raw) return { exists: false };
  const cached = JSON.parse(raw);
  return { exists: true, refreshedAt: cached.refreshedAt };
}

async function refreshCache(city) {
  const settled = await Promise.allSettled(SUPPLIERS.map((supplier) => supplierClient.fetchOffers(supplier, city)));
  const offers = [];
  const failures = {};
  settled.forEach((result, i) => {
    const supplier = SUPPLIERS[i];
    if (result.status === 'fulfilled') offers.push(...result.value);
    else failures[supplier] = result.reason?.code ?? 'SUPPLIER_ERROR';
  });

  if (Object.keys(failures).length === SUPPLIERS.length) {
    throw ApplicationFailure.nonRetryable('All hotel suppliers failed', ERROR_CODES.ALL_SUPPLIERS_FAILED, failures);
  }

  const refreshedAt = new Date().toISOString();
  const hotels = selectBestOffers(offers);
  const ttl = Object.keys(failures).length > 0
    ? config.redis.degradedCacheTtlSeconds
    : config.redis.cacheTtlSeconds;
  await getRedis().set(`${CACHE_PREFIX}${city}`, JSON.stringify({ hotels, refreshedAt, failures }), 'EX', ttl);
  return { hotels, refreshedAt, failures };
}

async function queryHotelsByPrice({ city, minPrice, maxPrice }) {
  const raw = await getRedis().get(`${CACHE_PREFIX}${city}`);
  const cached = raw ? JSON.parse(raw) : { hotels: [], refreshedAt: null, failures: {} };
  const hotels = cached.hotels.filter((hotel) =>
    (minPrice === undefined || hotel.price >= minPrice) &&
    (maxPrice === undefined || hotel.price <= maxPrice));
  return { hotels, refreshedAt: cached.refreshedAt, suppliers: cached.failures, degraded: Object.keys(cached.failures).length > 0 };
}

module.exports = { getCacheMeta, refreshCache, queryHotelsByPrice };
