import type { FastifyInstance } from 'fastify';
import {
  getProfileById,
  createProfile,
  updateProfile,
  listProfiles,
} from '../controllers/profiles.js';
import { optionalAuth } from '../middleware/auth.js';

export async function profileRoutes(fastify: FastifyInstance) {
  // List profiles
  fastify.get('/', {
    onRequest: [optionalAuth],
    handler: listProfiles,
  });

  // Get profile by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getProfileById,
  });

  // Create profile
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createProfile,
  });

  // Update profile
  fastify.put('/:id', {
    onRequest: [optionalAuth],
    handler: updateProfile,
  });
}
