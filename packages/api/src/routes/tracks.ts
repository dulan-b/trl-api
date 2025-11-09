import type { FastifyInstance } from 'fastify';
import {
  listTracks,
  getTrackById,
  createTrack,
  updateTrack,
  getTrackModules,
} from '../controllers/tracks.js';
import { optionalAuth } from '../middleware/auth.js';

export async function trackRoutes(fastify: FastifyInstance) {
  // List all tracks
  fastify.get('/', {
    onRequest: [optionalAuth],
    handler: listTracks,
  });

  // Get track by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getTrackById,
  });

  // Create track
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createTrack,
  });

  // Update track
  fastify.put('/:id', {
    onRequest: [optionalAuth],
    handler: updateTrack,
  });

  // Get modules for a track
  fastify.get('/:id/modules', {
    onRequest: [optionalAuth],
    handler: getTrackModules,
  });
}
