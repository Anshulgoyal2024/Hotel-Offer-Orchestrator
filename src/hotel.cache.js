'use strict';

const keys = Object.freeze({
  hotels: (city) => `hotels:${city}`,
  cached: (city) => `hotels:${city}:cached`,
});

function serializeOffer({ name, price, supplier, commissionPct }) {
  return JSON.stringify({ name, price, supplier, commissionPct });
}

function assertTransactionSucceeded(results) {
  if (!results) throw new Error('Redis transaction was aborted');
  for (const [err] of results) if (err) throw err;
}

async function replaceCityOffers(redis, { city, hotels, meta, ttlSeconds = 300 }) {
  const tx = redis.multi().del(keys.hotels(city));
  if (hotels.length) {
    tx.zadd(keys.hotels(city), ...hotels.flatMap((hotel) => [hotel.price, serializeOffer(hotel)]));
    tx.expire(keys.hotels(city), ttlSeconds);
  }
  tx.set(keys.cached(city), JSON.stringify(meta), 'EX', ttlSeconds);
  assertTransactionSucceeded(await tx.exec());
}

async function getCityMeta(redis, city) {
  const value = await redis.get(keys.cached(city));
  return value === null ? null : JSON.parse(value);
}

async function queryOffersByPrice(redis, { city, minPrice, maxPrice }) {
  const members = await redis.zrangebyscore(keys.hotels(city), minPrice ?? '-inf', maxPrice ?? '+inf');
  return members.map((member) => JSON.parse(member));
}

module.exports = { keys, serializeOffer, replaceCityOffers, getCityMeta, queryOffersByPrice };
