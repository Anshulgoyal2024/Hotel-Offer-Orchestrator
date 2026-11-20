'use strict';



const { proxyActivities, ApplicationFailure, log } = require('@temporalio/workflow');
const { SUPPLIERS, ERROR_CODES } = require('./constants');
const { selectCheapestOffers } = require('./hotel.service');

// `proxyActivities` gives us functions that look local but actually schedule an
// activity on the worker. Timeouts and retry rules are configured right here.
const supplierActivities = proxyActivities({
  startToCloseTimeout: '5s', // one attempt may take at most 5 seconds
  scheduleToCloseTimeout: '20s', // all attempts together, at most 20 seconds
  retry: {
    initialInterval: '300ms',
    backoffCoefficient: 2, // wait 300ms, then 600ms, ...
    maximumInterval: '2s',
    maximumAttempts: 3,
  },
});

const cacheActivities = proxyActivities({
  startToCloseTimeout: '5s',
  retry: {
    initialInterval: '500ms',
    backoffCoefficient: 2,
    maximumInterval: '5s',
    maximumAttempts: 5, // Redis hiccups are usually brief; be more patient
  },
});

function describeFailure(reason) {
  // A failed activity surfaces as ActivityFailure whose `cause` holds the real message.
  return reason?.cause?.message ?? reason?.message ?? 'unknown error';
}

/** Call both suppliers IN PARALLEL; one failing must not hide the other. */
async function fetchFromAllSuppliers(city) {
  const outcomes = await Promise.allSettled(
    SUPPLIERS.map((supplier) => supplierActivities.fetchSupplierOffers({ supplier, city })),
  );

  const offers = [];
  const suppliers = {};
  outcomes.forEach((outcome, index) => {
    const supplier = SUPPLIERS[index];
    if (outcome.status === 'fulfilled') {
      suppliers[supplier] = { status: 'ok', offers: outcome.value.length };
      offers.push(...outcome.value);
    } else {
      suppliers[supplier] = { status: 'failed', error: describeFailure(outcome.reason) };
      log.warn('Supplier failed', { supplier, city, error: suppliers[supplier].error });
    }
  });

  return { offers, suppliers };
}

/**
 * @param {{ city: string, minPrice?: number, maxPrice?: number, forceRefresh?: boolean }} input
 */
async function hotelSearchWorkflow({ city, minPrice, maxPrice, forceRefresh = false }) {
  // 1. Reuse the cache when it is still fresh (unless the caller forced a refresh).
  let snapshot = forceRefresh ? null : await cacheActivities.getCacheMeta({ city });
  let cache = forceRefresh ? 'refresh' : 'hit';

  // 2. Otherwise rebuild it from the suppliers.
  if (snapshot === null) {
    if (!forceRefresh) cache = 'miss';

    const { offers, suppliers } = await fetchFromAllSuppliers(city);

    if (Object.values(suppliers).every((s) => s.status === 'failed')) {
      // ApplicationFailure (non-retryable) FAILS the workflow cleanly. Any other
      // thrown error would only fail the "workflow task" and be retried forever.
      throw ApplicationFailure.nonRetryable(
        'All hotel suppliers failed',
        ERROR_CODES.ALL_SUPPLIERS_FAILED,
        suppliers,
      );
    }

    const hotels = selectCheapestOffers(offers); // dedupe + cheapest (pure function)
    snapshot = await cacheActivities.refreshCache({ city, hotels, suppliers });
  }

  // 3. Redis does the price filtering (ZRANGEBYSCORE) inside an activity.
  const hotels = await cacheActivities.queryHotelsByPrice({ city, minPrice, maxPrice });

  return {
    city,
    hotels,
    cache,
    suppliers: snapshot.suppliers,
    degraded: snapshot.degraded,
    refreshedAt: snapshot.refreshedAt,
  };
}

module.exports = { hotelSearchWorkflow };
