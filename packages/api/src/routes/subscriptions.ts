import type { FastifyInstance } from 'fastify';
import {
  listSubscriptionPlans,
  getSubscriptionPlanById,
  getUserSubscription,
  createSubscription,
  cancelSubscription,
  getUserInvoices,
} from '../controllers/subscriptions.js';
import { optionalAuth } from '../middleware/auth.js';

export async function subscriptionRoutes(fastify: FastifyInstance) {
  // Plans
  fastify.get('/plans', { onRequest: [optionalAuth], handler: listSubscriptionPlans });
  fastify.get('/plans/:id', { onRequest: [optionalAuth], handler: getSubscriptionPlanById });

  // User subscriptions
  fastify.get('/user/:userId', { onRequest: [optionalAuth], handler: getUserSubscription });
  fastify.post('/', { onRequest: [optionalAuth], handler: createSubscription });
  fastify.post('/:id/cancel', { onRequest: [optionalAuth], handler: cancelSubscription });

  // Invoices
  fastify.get('/user/:userId/invoices', { onRequest: [optionalAuth], handler: getUserInvoices });
}
