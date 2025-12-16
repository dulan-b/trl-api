import type { FastifyInstance } from 'fastify';
import {
  getUserRole,
  createUserRole,
  updateUserRole,
  deleteUserRole,
} from '../controllers/userRoles.js';
import { optionalAuth } from '../middleware/auth.js';

export async function userRoleRoutes(fastify: FastifyInstance) {
  // Get user role by user ID
  fastify.get('/:userId', {
    onRequest: [optionalAuth],
    handler: getUserRole,
  });

  // Create user role
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createUserRole,
  });

  // Update user role
  fastify.put('/:userId', {
    onRequest: [optionalAuth],
    handler: updateUserRole,
  });

  // Delete user role
  fastify.delete('/:userId', {
    onRequest: [optionalAuth],
    handler: deleteUserRole,
  });
}
