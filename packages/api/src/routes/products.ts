import type { FastifyInstance } from 'fastify';
import {
  getDigitalProducts,
  getProductById,
  createProduct,
} from '../controllers/products.js';
import { optionalAuth } from '../middleware/auth.js';

export async function productRoutes(fastify: FastifyInstance) {
  // Get all products
  fastify.get('/', {
    onRequest: [optionalAuth],
    handler: getDigitalProducts,
  });

  // Get product by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getProductById,
  });

  // Create product
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createProduct,
  });
}
