'use strict';

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../logger');
const { SupplierError } = require('../errors');
const { parseSupplierResponse } = require('./supplier.parser');

function toSupplierError(supplier, err) {
  if (err.response) {
    const status = err.response.status;
    return new SupplierError(supplier, 'SUPPLIER_HTTP_ERROR', `${supplier} responded with HTTP ${status}`, {
      retryable: status >= 500 || status === 429 || status === 408, status, cause: err,
    });
  }
  const timeout = ['ECONNABORTED', 'ETIMEDOUT'].includes(err.code);
  return new SupplierError(supplier, timeout ? 'SUPPLIER_TIMEOUT' : 'SUPPLIER_NETWORK_ERROR',
    timeout ? `${supplier} did not respond in time` : `${supplier} is unreachable (${err.code ?? err.message})`,
    { retryable: true, cause: err });
}

function createSupplierClient({
  http = axios.create({ timeout: config.suppliers.timeoutMs, headers: { Accept: 'application/json' } }),
  endpoints = config.suppliers.endpoints,
  log = logger,
} = {}) {
  async function fetchOffers(supplier, city) {
    const baseUrl = endpoints[supplier];
    if (!baseUrl) throw new SupplierError(supplier, 'SUPPLIER_UNKNOWN', `No endpoint configured for ${supplier}`, { retryable: false });
    let response;
    try { response = await http.get(`${baseUrl}/hotels`, { params: { city } }); }
    catch (err) { throw toSupplierError(supplier, err); }
    const { offers, skipped } = parseSupplierResponse(supplier, response.data);
    if (skipped) log.warn('supplier.rows.skipped', { supplier, city, skipped });
    return offers;
  }
  return { fetchOffers };
}

module.exports = { createSupplierClient };
