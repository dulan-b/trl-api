import type { FastifyInstance } from 'fastify';
import {
  getCertificationsByUserId,
  getCertificationById,
  createCertification,
} from '../controllers/certifications.js';
import { optionalAuth } from '../middleware/auth.js';

export async function certificationRoutes(fastify: FastifyInstance) {
  // Get certifications for a user
  fastify.get('/user/:userId', {
    onRequest: [optionalAuth],
    handler: getCertificationsByUserId,
  });

  // Get certification by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getCertificationById,
  });

  // Create certification
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createCertification,
  });
}
