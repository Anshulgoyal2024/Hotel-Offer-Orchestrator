'use strict';

const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../logger');
const { SupplierError } = require('../errors');
const { parseSupplierResponse } = require('./supplier.parser');

function toSupplierError(supplier, err) {
  if (err.response) {
    const { status } = err.response;
    // 5xx / 429 / 408 are usually temporary -> worth retrying. Other 4xx are our bug.
    const retryable = status >= 500 || status === 429 || status === 408;
    return new SupplierError(supplier, 'SUPPLIER_HTTP_ERROR', `${supplier} responded with HTTP ${status}`, {
      retryable,
      status,
      cause: err,
    });
  }
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return new SupplierError(supplier, 'SUPPLIER_TIMEOUT', `${supplier} did not respond in time`, {
      retryable: true,
      cause: err,
    });
  }
  return new SupplierError(supplier, 'SUPPLIER_NETWORK_ERROR', `${supplier} is unreachable (${err.code ?? err.message})`, {
    retryable: true,
    cause: err,
  });
}

function createSupplierClient({
  http = axios.create({ timeout: config.suppliers.timeoutMs, headers: { Accept: 'application/json' } }),
  endpoints = config.suppliers.endpoints,
  log = logger,
} = {}) {
  /** Fetch and validate the offers one supplier has for a city. */
  async function fetchOffers(supplier, city) {
    const baseUrl = endpoints[supplier];
    if (!baseUrl) {
      throw new SupplierError(supplier, 'SUPPLIER_UNKNOWN', `No endpoint configured for ${supplier}`, { retryable: false });
    }

    let response;
    try {
      response = await http.get(`${baseUrl}/hotels`, { params: { city } });
    } catch (err) {
      throw toSupplierError(supplier, err);
    }

    const { offers, skipped } = parseSupplierResponse(supplier, response.data);
    if (skipped > 0) log.warn('supplier.rows.skipped', { supplier, city, skipped });
    return offers;
  }

  return { fetchOffers };
}

module.exports = { createSupplierClient };
