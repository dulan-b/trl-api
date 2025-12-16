import type { FastifyInstance } from 'fastify';
import {
  listCommunityMembers,
  joinCommunity,
  leaveCommunity,
  updateMemberRole,
} from '../controllers/communityMembers.js';
import { optionalAuth } from '../middleware/auth.js';

export async function communityMemberRoutes(fastify: FastifyInstance) {
  fastify.get('/:communityId/members', { onRequest: [optionalAuth], handler: listCommunityMembers });
  fastify.post('/:communityId/members', { onRequest: [optionalAuth], handler: joinCommunity });
  fastify.delete('/:communityId/members/:userId', { onRequest: [optionalAuth], handler: leaveCommunity });
  fastify.put('/:communityId/members/:userId', { onRequest: [optionalAuth], handler: updateMemberRole });
}
