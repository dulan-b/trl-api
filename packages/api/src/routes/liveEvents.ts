import type { FastifyInstance } from 'fastify';
import {
  listLiveEvents,
  getLiveEventById,
  createLiveEvent,
  updateLiveEvent,
  deleteLiveEvent,
  getLiveEventCredentials,
  getLiveEventChat,
  deleteChatMessage,
} from '../controllers/liveEvents.js';
import { optionalAuth } from '../middleware/auth.js';

export async function liveEventRoutes(fastify: FastifyInstance) {
  // List live events
  fastify.get('/', { onRequest: [optionalAuth], handler: listLiveEvents });

  // Get live event by ID
  fastify.get('/:id', { onRequest: [optionalAuth], handler: getLiveEventById });

  // Create live event
  fastify.post('/', { onRequest: [optionalAuth], handler: createLiveEvent });

  // Update live event
  fastify.put('/:id', { onRequest: [optionalAuth], handler: updateLiveEvent });

  // Delete live event
  fastify.delete('/:id', { onRequest: [optionalAuth], handler: deleteLiveEvent });

  // Get credentials (stream key) - requires auth
  fastify.get('/:id/credentials', { onRequest: [optionalAuth], handler: getLiveEventCredentials });

  // Get chat history
  fastify.get('/:id/chat', { onRequest: [optionalAuth], handler: getLiveEventChat });

  // Delete chat message (moderation)
  fastify.delete('/:id/chat/:messageId', { onRequest: [optionalAuth], handler: deleteChatMessage });
}
