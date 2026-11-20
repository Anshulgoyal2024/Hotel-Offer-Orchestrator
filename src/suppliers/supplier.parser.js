'use strict';

const { SupplierError } = require('../errors');
const { cleanHotelName } = require('../hotel.service');

function parseSupplierResponse(supplier, body) {
  if (!Array.isArray(body)) {
    throw new SupplierError(supplier, 'SUPPLIER_BAD_RESPONSE', `${supplier} returned a response that is not a hotel list`, {
      retryable: false,
    });
  }

  const offers = [];
  let skipped = 0;

  for (const row of body) {
    const name = typeof row?.name === 'string' ? cleanHotelName(row.name) : '';
    const price = row?.price;
    const commissionPct = row?.commissionPct;

    const valid =
      name !== '' &&
      Number.isFinite(price) && price >= 0 &&
      Number.isFinite(commissionPct) && commissionPct >= 0 && commissionPct <= 100;

    if (valid) offers.push({ name, price, supplier, commissionPct });
    else skipped += 1;
  }

  return { offers, skipped };
}

module.exports = { parseSupplierResponse };
