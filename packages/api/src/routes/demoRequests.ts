import type { FastifyInstance } from 'fastify';
import {
  submitDemoRequest,
  listDemoRequests,
  updateDemoRequestStatus,
} from '../controllers/demoRequests.js';
import { optionalAuth } from '../middleware/auth.js';

export async function demoRequestRoutes(fastify: FastifyInstance) {
  // Public: Submit a demo request
  fastify.post('/', { handler: submitDemoRequest });

  // Admin: List demo requests
  fastify.get('/', { onRequest: [optionalAuth], handler: listDemoRequests });

  // Admin: Update demo request status
  fastify.put('/:id', { onRequest: [optionalAuth], handler: updateDemoRequestStatus });
}
