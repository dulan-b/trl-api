import type { FastifyInstance } from 'fastify';
import { getPurchaseById, getUserPurchases, createPurchase } from '../controllers/purchases.js';
import { optionalAuth } from '../middleware/auth.js';

export async function purchaseRoutes(fastify: FastifyInstance) {
  fastify.get('/:id', { onRequest: [optionalAuth], handler: getPurchaseById });
  fastify.get('/user/:userId', { onRequest: [optionalAuth], handler: getUserPurchases });
  fastify.post('/', { onRequest: [optionalAuth], handler: createPurchase });
}
