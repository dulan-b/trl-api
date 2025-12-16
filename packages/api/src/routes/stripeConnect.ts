import type { FastifyInstance } from 'fastify';
import {
  getConnectAccountStatus,
  createConnectAccount,
  updateConnectAccountStatus,
  getEducatorPayouts,
} from '../controllers/stripeConnect.js';
import { optionalAuth } from '../middleware/auth.js';

export async function stripeConnectRoutes(fastify: FastifyInstance) {
  fastify.get('/:userId', { onRequest: [optionalAuth], handler: getConnectAccountStatus });
  fastify.post('/', { onRequest: [optionalAuth], handler: createConnectAccount });
  fastify.put('/:userId', { onRequest: [optionalAuth], handler: updateConnectAccountStatus });
  fastify.get('/:userId/payouts', { onRequest: [optionalAuth], handler: getEducatorPayouts });
}
