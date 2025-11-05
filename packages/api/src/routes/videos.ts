import type { FastifyInstance } from 'fastify';
import {
  createVideoUpload,
  createVideoFromUrl,
  getVideoById,
  listVideos,
} from '../controllers/videos.js';
import { optionalAuth } from '../middleware/auth.js';

export async function videoRoutes(fastify: FastifyInstance) {
  // Get video by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getVideoById,
  });

  // List videos (with optional filtering)
  fastify.get('/', {
    onRequest: [optionalAuth],
    handler: listVideos,
  });

  // Create direct upload URL
  fastify.post('/uploads', {
    onRequest: [optionalAuth],
    handler: createVideoUpload,
  });

  // Create video from URL
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createVideoFromUrl,
  });
}
