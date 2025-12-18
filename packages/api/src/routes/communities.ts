import type { FastifyInstance } from 'fastify';
import {
  getCommunities,
  getCommunityById,
  createCommunity,
  getPostsByCommunityId,
  createPost,
} from '../controllers/communities.js';
import { optionalAuth } from '../middleware/auth.js';

export async function communityRoutes(fastify: FastifyInstance) {
  // Get all communities
  fastify.get('/', {
    onRequest: [optionalAuth],
    handler: getCommunities,
  });

  // Get community by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getCommunityById,
  });

  // Create community
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createCommunity,
  });

  // Get posts by community ID
  fastify.get('/:id/posts', {
    onRequest: [optionalAuth],
    handler: getPostsByCommunityId,
  });

  // Create post
  fastify.post('/posts', {
    onRequest: [optionalAuth],
    handler: createPost,
  });
}
