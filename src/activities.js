'use strict';



const { ApplicationFailure, Context } = require('@temporalio/activity');
const { config: defaultConfig } = require('./config');
const { logger: defaultLogger } = require('./logger');
const { SupplierError } = require('./errors');
const { SUPPLIERS } = require('./constants');
const { getRedis } = require('./redis');
const { createSupplierClient } = require('./suppliers/supplier.client');
const cache = require('./hotel.cache');

// Extra context for logs (which attempt is this?). Safe to call outside Temporal.
function currentActivityInfo() {
  try {
    const { info } = Context.current();
    return { attempt: info.attempt, workflowId: info.workflowExecution.workflowId };
  } catch {
    return {};
  }
}

/**
 * Build the activity functions. Dependencies are parameters so tests can pass
 * fakes; the worker calls `createActivities()` with the real ones.
 */
function createActivities({
  supplierClient = createSupplierClient(),
  getRedisClient = getRedis,
  config = defaultConfig,
  logger = defaultLogger,
} = {}) {
  /** Ask ONE supplier for its offers in a city. */
  async function fetchSupplierOffers({ supplier, city }) {
    if (!SUPPLIERS.includes(supplier)) {
      throw ApplicationFailure.nonRetryable(`Unknown supplier "${supplier}"`, 'UNKNOWN_SUPPLIER');
    }

    const startedAt = Date.now();
    const context = { supplier, city, ...currentActivityInfo() };
    try {
      const offers = await supplierClient.fetchOffers(supplier, city);
      logger.info('activity.fetchSupplierOffers.ok', { ...context, offers: offers.length, durationMs: Date.now() - startedAt });
      return offers;
    } catch (err) {
      logger.warn('activity.fetchSupplierOffers.failed', { ...context, durationMs: Date.now() - startedAt, err });
      if (err instanceof SupplierError) {
        // Tell Temporal whether a retry makes sense.
        throw err.retryable
          ? ApplicationFailure.retryable(err.message, err.code)
          : ApplicationFailure.nonRetryable(err.message, err.code);
      }
      throw err;
    }
  }

  /** Is there a fresh cached snapshot for this city? Returns its metadata or null. */
  async function getCacheMeta({ city }) {
    return cache.getCityMeta(getRedisClient(), city);
  }

  /** Atomically replace the city's cached offers (Redis MULTI/EXEC). */
  async function refreshCache({ city, hotels, suppliers }) {
    const degraded = Object.values(suppliers).some((s) => s.status !== 'ok');
    const meta = { refreshedAt: new Date().toISOString(), count: hotels.length, suppliers, degraded };
    const ttlSeconds = config.redis.cacheTtlSeconds;

    await cache.replaceCityOffers(getRedisClient(), { city, hotels, meta, ttlSeconds });
    logger.info('activity.refreshCache.ok', { city, count: hotels.length, degraded, ttlSeconds, ...currentActivityInfo() });
    return meta;
  }

  /** Price-filtered read, performed by Redis (ZRANGEBYSCORE). */
  async function queryHotelsByPrice({ city, minPrice, maxPrice }) {
    return cache.queryOffersByPrice(getRedisClient(), { city, minPrice, maxPrice });
  }

  return { fetchSupplierOffers, getCacheMeta, refreshCache, queryHotelsByPrice };
}

module.exports = { createActivities };
