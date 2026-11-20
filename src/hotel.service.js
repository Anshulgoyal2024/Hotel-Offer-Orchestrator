'use strict';

// Use one stable key for offers from different suppliers that refer to the
// same hotel, regardless of case or extra whitespace.
function cleanHotelName(name) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

function selectBestOffers(offers) {
  const best = new Map();
  for (const offer of offers) {
    const key = cleanHotelName(offer.name);
    const current = best.get(key);
    if (!current || offer.price < current.price ||
        (offer.price === current.price && (offer.commissionPct > current.commissionPct ||
          (offer.commissionPct === current.commissionPct && offer.supplier === 'supplierA' && current.supplier !== 'supplierA')))) {
      best.set(key, offer);
    }
  }
  return [...best.values()].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
}

module.exports = { cleanHotelName, selectBestOffers, selectCheapestOffers: selectBestOffers };
