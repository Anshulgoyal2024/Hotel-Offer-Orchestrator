'use strict';

// The Temporal CLIENT is how the Express API *starts* a workflow and waits for
// its result. It does not execute workflow code; the worker does.

const { randomUUID } = require('node:crypto');
const { Client, Connection } = require('@temporalio/client');
const { config } = require('./config');
const { logger } = require('./logger');
const { AppError } = require('./errors');
const { retry } = require('./utils/async');
const { WORKFLOW_NAMES, ERROR_CODES } = require('./constants');

const CACHE_ACTIVITIES = new Set(['getCacheMeta', 'refreshCache', 'queryHotelsByPrice']);

let client = null;
let connecting = null;

/** Connect (with exponential-backoff retries) and remember the client. */
function connectTemporal() {
  if (client) return Promise.resolve(client);
  if (!connecting) {
    const { address, namespace, connectMaxAttempts, connectMinDelayMs, connectMaxDelayMs } = config.temporal;
    connecting = retry(
      async () => {
        const connection = await Connection.connect({ address, connectTimeout: '5s' });
        return new Client({ connection, namespace });
      },
      {
        maxAttempts: connectMaxAttempts,
        minDelayMs: connectMinDelayMs,
        maxDelayMs: connectMaxDelayMs,
        onRetry: (err, attempt, delayMs) => logger.warn('temporal.connect.retry', { attempt, delayMs, address, err }),
      },
    )
      .then((connected) => {
        client = connected;
        logger.info('temporal.connected', { address, namespace });
        return connected;
      })
      .catch((err) => {
        logger.error('temporal.connect.failed', { address, err });
        throw err;
      })
      .finally(() => {
        connecting = null;
      });
  }
  return connecting;
}

/** The ready client, or a clear 503 (and a background reconnect attempt). */
function getTemporalClient() {
  if (client) return client;
  connectTemporal().catch(() => {}); // already logged inside connectTemporal
  throw new AppError(503, ERROR_CODES.TEMPORAL_UNAVAILABLE, 'Temporal is not reachable yet, please retry shortly');
}

async function closeTemporalClient() {
  if (!client) return;
  const current = client;
  client = null;
  await current.connection.close();
}

const slugify = (text) => text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

/**
 * Temporal errors are class instances with a `name`. We compare names instead of
 * using instanceof so this works regardless of which package re-exports the class.
 */
function mapTemporalError(err, workflowId) {
  if (err instanceof AppError) return err;

  if (err?.name === 'WorkflowFailedError') {
    const cause = err.cause;

    if (cause?.name === 'ApplicationFailure' && cause.type === ERROR_CODES.ALL_SUPPLIERS_FAILED) {
      return new AppError(503, ERROR_CODES.ALL_SUPPLIERS_FAILED, 'All hotel suppliers failed; no data is available', {
        suppliers: cause.details?.[0],
        workflowId,
      });
    }
    if (cause?.name === 'TimeoutFailure') {
      return new AppError(504, ERROR_CODES.WORKFLOW_TIMEOUT, 'The hotel search timed out', { workflowId });
    }
    if (cause?.name === 'ActivityFailure' && CACHE_ACTIVITIES.has(cause.activityType)) {
      return new AppError(503, ERROR_CODES.CACHE_UNAVAILABLE, 'The Redis cache is unavailable', { workflowId });
    }
    return new AppError(502, ERROR_CODES.WORKFLOW_FAILED, 'The hotel search workflow failed', {
      workflowId,
      reason: cause?.message ?? err.message,
    });
  }

  logger.error('temporal.client.error', { workflowId, err });
  return new AppError(503, ERROR_CODES.TEMPORAL_UNAVAILABLE, 'Could not reach Temporal');
}

/**
 * Start `hotelSearchWorkflow` and wait for its result.
 * @returns {Promise<{city, hotels, cache, suppliers, degraded, refreshedAt, workflowId}>}
 */
async function runHotelSearch({ city, minPrice, maxPrice, forceRefresh = false, requestId }) {
  const temporal = getTemporalClient();
  const workflowId = `hotel-search-${slugify(city)}-${randomUUID()}`;

  let handle;
  try {
    handle = await temporal.workflow.start(WORKFLOW_NAMES.HOTEL_SEARCH, {
      taskQueue: config.temporal.taskQueue,
      workflowId,
      args: [{ city, minPrice, maxPrice, forceRefresh }],
      workflowExecutionTimeout: config.temporal.workflowTimeoutMs, // never hang forever
      memo: requestId ? { requestId } : undefined, // visible in the Temporal UI
    });
  } catch (err) {
    throw mapTemporalError(err, workflowId);
  }

  try {
    const result = await handle.result();
    return { ...result, workflowId };
  } catch (err) {
    throw mapTemporalError(err, workflowId);
  }
}

module.exports = { connectTemporal, getTemporalClient, closeTemporalClient, runHotelSearch, mapTemporalError };
