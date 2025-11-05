import type { FastifyInstance } from 'fastify';
import {
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  listUsers,
} from '../controllers/users.js';
import { optionalAuth } from '../middleware/auth.js';

export async function userRoutes(fastify: FastifyInstance) {
  // Create user
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createUser,
  });

  // Get user by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getUserById,
  });

  // Update user
  fastify.put('/:id', {
    onRequest: [optionalAuth],
    handler: updateUser,
  });

  // Delete user
  fastify.delete('/:id', {
    onRequest: [optionalAuth],
    handler: deleteUser,
  });

  // List users
  fastify.get('/', {
    onRequest: [optionalAuth],
    handler: listUsers,
  });
}
