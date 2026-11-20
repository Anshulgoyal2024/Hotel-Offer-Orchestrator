'use strict';

// This file is imported by the Temporal workflow, so it must stay pure:
// no I/O, no Node-only modules, no randomness.

const SUPPLIERS = Object.freeze(['supplierA', 'supplierB']);

const WORKFLOW_NAMES = Object.freeze({
  HOTEL_SEARCH: 'hotelSearchWorkflow',
});

const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  ALL_SUPPLIERS_FAILED: 'ALL_SUPPLIERS_FAILED',
  CACHE_UNAVAILABLE: 'CACHE_UNAVAILABLE',
  TEMPORAL_UNAVAILABLE: 'TEMPORAL_UNAVAILABLE',
  WORKFLOW_TIMEOUT: 'WORKFLOW_TIMEOUT',
  WORKFLOW_FAILED: 'WORKFLOW_FAILED',
  SIMULATED_SUPPLIER_FAILURE: 'SIMULATED_SUPPLIER_FAILURE',
});

module.exports = { SUPPLIERS, WORKFLOW_NAMES, ERROR_CODES };
