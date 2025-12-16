import type { FastifyInstance } from 'fastify';
import {
  getUserInterests,
  addUserInterest,
  setUserInterests,
  removeUserInterest,
} from '../controllers/userInterests.js';
import { optionalAuth } from '../middleware/auth.js';

export async function userInterestRoutes(fastify: FastifyInstance) {
  // Get user's interests
  fastify.get('/:userId', {
    onRequest: [optionalAuth],
    handler: getUserInterests,
  });

  // Add single interest
  fastify.post('/:userId', {
    onRequest: [optionalAuth],
    handler: addUserInterest,
  });

  // Bulk set interests (replaces all)
  fastify.put('/:userId', {
    onRequest: [optionalAuth],
    handler: setUserInterests,
  });

  // Remove single interest
  fastify.delete('/:userId/:interestTag', {
    onRequest: [optionalAuth],
    handler: removeUserInterest,
  });
}
