import type { FastifyInstance } from 'fastify';
import {
  getUserBookmarks,
  createBookmark,
  deleteBookmark,
  deleteBookmarkByItem,
} from '../controllers/bookmarks.js';
import { optionalAuth } from '../middleware/auth.js';

export async function bookmarkRoutes(fastify: FastifyInstance) {
  fastify.get('/user/:userId', { onRequest: [optionalAuth], handler: getUserBookmarks });
  fastify.post('/', { onRequest: [optionalAuth], handler: createBookmark });
  fastify.delete('/:id', { onRequest: [optionalAuth], handler: deleteBookmark });
  fastify.delete('/user/:userId/:type/:itemId', { onRequest: [optionalAuth], handler: deleteBookmarkByItem });
}
