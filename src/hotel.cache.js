'use strict';

// Everything Redis-related for hotel offers lives here.
//
// Data model (one pair of keys per city):
//
//   hotels:<city>        SORTED SET   score = price, member = JSON offer
//   hotels:<city>:meta   STRING(JSON) { refreshedAt, count, suppliers, degraded }
//
// Why a separate meta key? An EMPTY sorted set does not exist in Redis, so
// "we checked and there are no hotels" would look the same as "never checked".
// The meta key records that we checked, and also expires together with the data.

const keys = Object.freeze({
  hotels: (city) => `hotels:${city}`,
  meta: (city) => `hotels:${city}:meta`,
});

// Fixed key order => identical offers always serialise to identical members.
function serializeOffer({ name, price, supplier, commissionPct }) {
  return JSON.stringify({ name, price, supplier, commissionPct });
}

function assertTransactionSucceeded(results) {
  if (!results) throw new Error('Redis transaction was aborted');
  for (const [err] of results) {
    if (err) throw err;
  }
}

/**
 * Replace a city's cached offers ATOMICALLY.
 *
 * MULTI/EXEC makes Redis run all queued commands together, with no other
 * client's command interleaved. A reader therefore sees either the complete
 * old data or the complete new data, never "half deleted". Deleting first
 * is also how stale hotels (no longer offered by anyone) disappear.
 */
async function replaceCityOffers(redis, { city, hotels, meta, ttlSeconds }) {
  const tx = redis.multi().del(keys.hotels(city));

  if (hotels.length > 0) {
    const scoreMemberPairs = hotels.flatMap((hotel) => [hotel.price, serializeOffer(hotel)]);
    tx.zadd(keys.hotels(city), ...scoreMemberPairs);
    tx.expire(keys.hotels(city), ttlSeconds);
  }
  tx.set(keys.meta(city), JSON.stringify(meta), 'EX', ttlSeconds);

  assertTransactionSucceeded(await tx.exec());
}

/** Metadata of the cached city snapshot, or null when there is no fresh cache. */
async function getCityMeta(redis, city) {
  const raw = await redis.get(keys.meta(city));
  return raw === null ? null : JSON.parse(raw);
}

/**
 * Offers priced between min and max (both inclusive), cheapest first.
 *
 * The price filter is performed BY REDIS with ZRANGEBYSCORE. This function
 * deliberately contains no JavaScript filtering of prices.
 */
async function queryOffersByPrice(redis, { city, minPrice, maxPrice }) {
  const members = await redis.zrangebyscore(keys.hotels(city), minPrice ?? '-inf', maxPrice ?? '+inf');
  return members.map((member) => JSON.parse(member));
}

module.exports = { keys, serializeOffer, replaceCityOffers, getCityMeta, queryOffersByPrice };
