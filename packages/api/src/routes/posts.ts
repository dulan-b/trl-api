import type { FastifyInstance } from 'fastify';
import {
  listPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getPostComments,
  createPostComment,
  deletePostComment,
  getPostReactions,
  getUserReaction,
  addPostReaction,
  removePostReaction,
  bookmarkPost,
  unbookmarkPost,
  reportPost,
  getPostReports,
  updateReportStatus,
} from '../controllers/posts.js';
import { optionalAuth } from '../middleware/auth.js';

export async function postRoutes(fastify: FastifyInstance) {
  // List posts with optional includes (author, reactions_count)
  // TRANSITIONAL: Uses include param, see controller for TODO notes
  fastify.get('/', { onRequest: [optionalAuth], handler: listPosts });

  // Get post by ID
  fastify.get('/:id', { onRequest: [optionalAuth], handler: getPostById });

  // Create post
  fastify.post('/', { onRequest: [optionalAuth], handler: createPost });

  // Update post
  fastify.put('/:id', { onRequest: [optionalAuth], handler: updatePost });

  // Delete post
  fastify.delete('/:id', { onRequest: [optionalAuth], handler: deletePost });

  // Comments
  fastify.get('/:id/comments', { onRequest: [optionalAuth], handler: getPostComments });
  fastify.post('/:id/comments', { onRequest: [optionalAuth], handler: createPostComment });
  fastify.delete('/:id/comments/:commentId', { onRequest: [optionalAuth], handler: deletePostComment });

  // Reactions
  fastify.get('/:id/reactions', { onRequest: [optionalAuth], handler: getPostReactions });
  // Get current user's reaction on a post
  fastify.get('/:id/reactions/user/:userId', { onRequest: [optionalAuth], handler: getUserReaction });
  fastify.post('/:id/reactions', { onRequest: [optionalAuth], handler: addPostReaction });
  fastify.delete('/:id/reactions/:userId', { onRequest: [optionalAuth], handler: removePostReaction });

  // Bookmarks
  fastify.post('/:id/bookmark', { onRequest: [optionalAuth], handler: bookmarkPost });
  fastify.delete('/:id/bookmark/:userId', { onRequest: [optionalAuth], handler: unbookmarkPost });

  // Reports
  fastify.post('/:id/report', { onRequest: [optionalAuth], handler: reportPost });
  fastify.get('/reports', { onRequest: [optionalAuth], handler: getPostReports });
  fastify.put('/reports/:reportId', { onRequest: [optionalAuth], handler: updateReportStatus });
}
