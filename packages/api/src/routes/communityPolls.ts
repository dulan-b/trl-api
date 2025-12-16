import type { FastifyInstance } from 'fastify';
import {
  listPolls,
  getPollById,
  createPoll,
  votePoll,
  deletePoll,
  closePoll,
} from '../controllers/communityPolls.js';
import { optionalAuth } from '../middleware/auth.js';

export async function communityPollRoutes(fastify: FastifyInstance) {
  // List active polls
  fastify.get('/', { onRequest: [optionalAuth], handler: listPolls });

  // Get poll by ID
  fastify.get('/:id', { onRequest: [optionalAuth], handler: getPollById });

  // Create poll
  fastify.post('/', { onRequest: [optionalAuth], handler: createPoll });

  // Vote on poll
  fastify.post('/:id/vote', { onRequest: [optionalAuth], handler: votePoll });

  // Close poll (admin/creator)
  fastify.post('/:id/close', { onRequest: [optionalAuth], handler: closePoll });

  // Delete poll (admin/creator)
  fastify.delete('/:id', { onRequest: [optionalAuth], handler: deletePoll });
}
