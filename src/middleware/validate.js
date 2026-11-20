'use strict';

const { ValidationError } = require('../errors');
const { SUPPLIERS } = require('../constants');
const { SIMULATION_MODES } = require('../suppliers/simulation');

// Letters (any language), spaces, dots, apostrophes and hyphens; 2-50 chars.
const CITY_PATTERN = /^\p{L}[\p{L} .'-]{0,48}\p{L}$/u;
// Plain decimal numbers only: rejects "1e3", "0x10", "-5", "NaN", "Infinity".
const PRICE_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;

const HOTEL_QUERY_PARAMS = ['city', 'minPrice', 'maxPrice', 'refresh'];
const SUPPLIER_QUERY_PARAMS = ['city', 'simulate'];

// Each parse* function pushes problems into `errors` and returns the clean value.

function readSingle(query, name, errors) {
  const raw = query[name];
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    errors.push({ field: name, message: `${name} must be given exactly once` });
    return undefined;
  }
  return raw.trim();
}

function rejectUnknownParams(query, allowed, errors) {
  for (const key of Object.keys(query)) {
    if (!allowed.includes(key)) {
      errors.push({ field: key, message: `unknown query parameter (allowed: ${allowed.join(', ')})` });
    }
  }
}

function parseCity(query, errors) {
  const raw = readSingle(query, 'city', errors);
  if (raw === undefined) {
    if (query.city === undefined) errors.push({ field: 'city', message: 'city is required' });
    return undefined;
  }
  const city = raw.replace(/\s+/g, ' ').toLowerCase();
  if (!CITY_PATTERN.test(city)) {
    errors.push({ field: 'city', message: 'city must be 2-50 letters (spaces, . \' - allowed)' });
    return undefined;
  }
  return city;
}

function parsePrice(query, name, errors) {
  const raw = readSingle(query, name, errors);
  if (raw === undefined) return undefined;
  if (!PRICE_PATTERN.test(raw)) {
    errors.push({ field: name, message: `${name} must be a non-negative number such as 5000 or 5000.50` });
    return undefined;
  }
  return Number(raw);
}

function parseBoolean(query, name, errors) {
  const raw = readSingle(query, name, errors);
  if (raw === undefined) return undefined;
  if (raw !== 'true' && raw !== 'false') {
    errors.push({ field: name, message: `${name} must be "true" or "false"` });
    return undefined;
  }
  return raw === 'true';
}

function parseHotelQuery(query) {
  const errors = [];
  rejectUnknownParams(query, HOTEL_QUERY_PARAMS, errors);

  const city = parseCity(query, errors);
  const minPrice = parsePrice(query, 'minPrice', errors);
  const maxPrice = parsePrice(query, 'maxPrice', errors);
  const refresh = parseBoolean(query, 'refresh', errors) ?? false;

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    errors.push({ field: 'minPrice', message: 'minPrice must be less than or equal to maxPrice' });
  }
  return { value: { city, minPrice, maxPrice, refresh }, errors };
}

function parseSupplierQuery(query) {
  const errors = [];
  rejectUnknownParams(query, SUPPLIER_QUERY_PARAMS, errors);

  const city = parseCity(query, errors);
  const simulate = readSingle(query, 'simulate', errors);
  if (simulate !== undefined && !SIMULATION_MODES.includes(simulate)) {
    errors.push({ field: 'simulate', message: `simulate must be one of: ${SIMULATION_MODES.join(', ')}` });
  }
  return { value: { city, simulate }, errors };
}

function parseSimulationUpdate(params, body) {
  const errors = [];
  const { supplier } = params;
  const mode = body?.mode;

  if (!SUPPLIERS.includes(supplier)) {
    errors.push({ field: 'supplier', message: `supplier must be one of: ${SUPPLIERS.join(', ')}` });
  }
  if (!SIMULATION_MODES.includes(mode)) {
    errors.push({ field: 'mode', message: `mode must be one of: ${SIMULATION_MODES.join(', ')}` });
  }
  return { value: { supplier, mode }, errors };
}

// Turns a parse function into Express middleware. The clean values are stored on
// `req.validated` (Express 5 makes `req.query` read-only, so we never mutate it).
function validator(parse, source = (req) => req.query) {
  return (req, _res, next) => {
    const { value, errors } = parse(source(req), req);
    if (errors.length > 0) return next(new ValidationError(errors));
    req.validated = value;
    return next();
  };
}

module.exports = {
  parseHotelQuery,
  parseSupplierQuery,
  parseSimulationUpdate,
  validateHotelQuery: validator(parseHotelQuery),
  validateSupplierQuery: validator(parseSupplierQuery),
  validateSimulationUpdate: validator((_unused, req) => parseSimulationUpdate(req.params, req.body)),
};
