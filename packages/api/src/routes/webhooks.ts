import type { FastifyInstance } from 'fastify';
import { handleMuxWebhook } from '../controllers/webhooks.js';

export async function webhookRoutes(fastify: FastifyInstance) {
  // Mux webhook handler
  fastify.post('/mux', {
    // Don't parse body as JSON - we need raw body for signature verification
    config: {
      rawBody: true,
    },
    handler: handleMuxWebhook,
  });
}
