import pino from 'pino';
import { captionWorker } from './workers/caption-worker.js';
import { getEnvConfig } from '@trl/shared';

const config = getEnvConfig();

const logger = pino({
  level: 'info',
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

logger.info('Starting TRL Worker...');
logger.info({ env: config.NODE_ENV }, 'Environment');

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down workers...');

  await captionWorker.close();

  logger.info('Workers shut down');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info('Worker ready - listening for jobs');
