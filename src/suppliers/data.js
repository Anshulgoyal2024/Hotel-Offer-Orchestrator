'use strict';

// Mock catalogues for the two suppliers.
//
// The data is deliberately designed to exercise every rule of the aggregator:
//   * overlapping hotels (the same hotel sold by both suppliers)
//   * names that differ only by case / spacing ("Holtin" vs "HOLTIN")
//   * hotels that exist at only ONE supplier
//   * a price TIE with different commissions (Lemon Tree Premier, Delhi)
//   * a full tie, same price AND commission (Hotel Marine Plaza, Mumbai)
//   * two cities, so cache keys per city can be tested

const SUPPLIER_DATA = Object.freeze({
  supplierA: Object.freeze([
    // ---- Delhi
    { hotelId: 'A-DEL-001', name: 'Holtin', city: 'delhi', price: 6000, commissionPct: 10 },
    { hotelId: 'A-DEL-002', name: 'Radisson Blu', city: 'delhi', price: 5900, commissionPct: 12 },
    { hotelId: 'A-DEL-003', name: 'Taj Palace', city: 'delhi', price: 12000, commissionPct: 8 },
    { hotelId: 'A-DEL-004', name: 'The Imperial', city: 'delhi', price: 15500, commissionPct: 10 }, // A only
    { hotelId: 'A-DEL-005', name: 'Hotel Aman', city: 'delhi', price: 6800, commissionPct: 14 }, // A only
    { hotelId: 'A-DEL-006', name: 'Lemon Tree Premier', city: 'delhi', price: 5200, commissionPct: 11 },
    // ---- Mumbai
    { hotelId: 'A-MUM-001', name: 'Taj Mahal Palace', city: 'mumbai', price: 18000, commissionPct: 8 },
    { hotelId: 'A-MUM-002', name: 'Trident Nariman Point', city: 'mumbai', price: 13500, commissionPct: 10 },
    { hotelId: 'A-MUM-003', name: 'Hotel Marine Plaza', city: 'mumbai', price: 8200, commissionPct: 12 },
    { hotelId: 'A-MUM-004', name: 'Sea Princess Juhu', city: 'mumbai', price: 9400, commissionPct: 11 }, // A only
  ]),
  supplierB: Object.freeze([
    // ---- Delhi
    { hotelId: 'B-DEL-001', name: 'HOLTIN', city: 'delhi', price: 5340, commissionPct: 20 }, // cheaper than A
    { hotelId: 'B-DEL-002', name: 'RADISSON BLU', city: 'delhi', price: 6100, commissionPct: 15 }, // A is cheaper
    { hotelId: 'B-DEL-003', name: '  Taj  Palace ', city: 'delhi', price: 11500, commissionPct: 9 }, // messy spacing
    { hotelId: 'B-DEL-004', name: 'Hyatt Regency', city: 'delhi', price: 8200, commissionPct: 13 }, // B only
    { hotelId: 'B-DEL-005', name: 'Lemon Tree Premier', city: 'delhi', price: 5200, commissionPct: 15 }, // price tie
    { hotelId: 'B-DEL-006', name: 'Ibis Aerocity', city: 'delhi', price: 4100, commissionPct: 18 }, // B only
    // ---- Mumbai
    { hotelId: 'B-MUM-001', name: 'Taj Mahal Palace', city: 'mumbai', price: 17250, commissionPct: 11 },
    { hotelId: 'B-MUM-002', name: 'TRIDENT NARIMAN POINT', city: 'mumbai', price: 14000, commissionPct: 14 },
    { hotelId: 'B-MUM-003', name: 'Hotel Marine Plaza', city: 'mumbai', price: 8200, commissionPct: 12 }, // full tie
    { hotelId: 'B-MUM-004', name: 'JW Marriott Juhu', city: 'mumbai', price: 16000, commissionPct: 12 }, // B only
    { hotelId: 'B-MUM-005', name: 'ITC Maratha', city: 'mumbai', price: 12500, commissionPct: 9 }, // B only
  ]),
});

// `city` is already normalised (lower case) by the validation middleware.
function getSupplierHotels(supplier, city) {
  const catalogue = SUPPLIER_DATA[supplier] ?? [];
  return catalogue.filter((hotel) => hotel.city === city).map((hotel) => ({ ...hotel }));
}

module.exports = { SUPPLIER_DATA, getSupplierHotels };
