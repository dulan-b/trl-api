import type { FastifyInstance } from 'fastify';
import {
  getModuleById,
  createModule,
  updateModule,
  getModuleLessons,
  deleteModule,
} from '../controllers/modules.js';
import { optionalAuth } from '../middleware/auth.js';

export async function moduleRoutes(fastify: FastifyInstance) {
  // Get module by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getModuleById,
  });

  // Create module
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createModule,
  });

  // Update module
  fastify.put('/:id', {
    onRequest: [optionalAuth],
    handler: updateModule,
  });

  // Delete module
  fastify.delete('/:id', {
    onRequest: [optionalAuth],
    handler: deleteModule,
  });

  // Get lessons for a module
  fastify.get('/:id/lessons', {
    onRequest: [optionalAuth],
    handler: getModuleLessons,
  });
}
