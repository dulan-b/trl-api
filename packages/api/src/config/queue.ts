import { Queue } from 'bullmq';
import { getEnvConfig } from '@trl/shared';
import type {
  GenerateCaptionsJobData,
  TranslateCaptionsJobData,
  AttachCaptionsJobData
} from '@trl/shared';

const config = getEnvConfig();

// Parse Redis URL
const redisConnection = {
  url: config.REDIS_URL,
};

// Create queues
export const captionQueue = new Queue<GenerateCaptionsJobData>('captions', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

export const translationQueue = new Queue<TranslateCaptionsJobData>('translations', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const muxQueue = new Queue<AttachCaptionsJobData>('mux-attachments', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});
