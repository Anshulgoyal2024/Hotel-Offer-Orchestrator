'use strict';

const { SUPPLIERS } = require('../constants');

// Ways a supplier can misbehave, for testing our resilience:
//   error     -> HTTP 500 immediately
//   timeout   -> hangs longer than our client timeout
//   slow      -> answers correctly, but late
//   malformed -> HTTP 200 with a body that is not a hotel list
const SIMULATION_MODES = Object.freeze(['none', 'error', 'timeout', 'slow', 'malformed']);

function createSimulation({ enabled = false, hangMs = 10000, slowMs = 1500 } = {}) {
  const modes = Object.fromEntries(SUPPLIERS.map((supplier) => [supplier, 'none']));

  return {
    enabled,
    hangMs,
    slowMs,
    snapshot: () => ({ ...modes }),
    set(supplier, mode) {
      if (!SUPPLIERS.includes(supplier)) throw new Error(`Unknown supplier: ${supplier}`);
      if (!SIMULATION_MODES.includes(mode)) throw new Error(`Unknown simulation mode: ${mode}`);
      modes[supplier] = mode;
    },
    reset() {
      for (const supplier of SUPPLIERS) modes[supplier] = 'none';
    },
    // A per-request override (?simulate=error) wins over the stored mode.
    modeFor(supplier, override) {
      if (!enabled) return 'none';
      return override ?? modes[supplier] ?? 'none';
    },
  };
}

module.exports = { createSimulation, SIMULATION_MODES };
