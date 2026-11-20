'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn` until it succeeds, waiting longer between each failure
 * (exponential backoff with a little jitter).
 *
 * Used at STARTUP so that api/worker survive "Temporal or Redis is not ready yet".
 * (Retries of supplier calls are NOT done here - Temporal does those.)
 */
async function retry(fn, options = {}) {
  const {
    maxAttempts = 10,
    minDelayMs = 500,
    maxDelayMs = 5000,
    factor = 2,
    jitter = 0.2,
    onRetry = () => {},
    sleepFn = sleep,
  } = options;

  let delayMs = minDelayMs;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      const wait = Math.round(delayMs * (1 + Math.random() * jitter));
      onRetry(err, attempt, wait);
      await sleepFn(wait);
      delayMs = Math.min(delayMs * factor, maxDelayMs);
    }
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { sleep, retry, withTimeout };
