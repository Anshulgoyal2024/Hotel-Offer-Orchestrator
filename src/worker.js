'use strict';

const { Worker, NativeConnection } = require('@temporalio/worker');
const { config } = require('./config');
const { logger } = require('./logger');
const { createActivities } = require('./activities');
const activities = createActivities();

async function run() {
  const connection = await NativeConnection.connect({ address: config.temporal.address });
  const worker = await Worker.create({
    connection,
    namespace: config.temporal.namespace,
    taskQueue: config.temporal.taskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });
  logger.info('worker.started', { taskQueue: config.temporal.taskQueue, address: config.temporal.address });
  await worker.run();
  await connection.close();
}

run().catch((err) => {
  logger.error('worker.failed', { err });
  process.exitCode = 1;
});
