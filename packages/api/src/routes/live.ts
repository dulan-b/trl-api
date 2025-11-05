import type { FastifyInstance } from 'fastify';
import {
  createLiveStream,
  getLiveStreamById,
  listLiveStreams,
} from '../controllers/live.js';
import { optionalAuth } from '../middleware/auth.js';

/**
 * Live streaming routes - Phase 2
 * Currently stubbed for future implementation
 */
export async function liveRoutes(fastify: FastifyInstance) {
  // Create live stream
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createLiveStream,
  });

  // Get live stream by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getLiveStreamById,
  });

  // List live streams
  fastify.get('/', {
    onRequest: [optionalAuth],
    handler: listLiveStreams,
  });
}
