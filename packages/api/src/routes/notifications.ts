import type { FastifyInstance } from 'fastify';
import {
  getNotificationsByUserId,
  markNotificationAsRead,
  createNotification,
} from '../controllers/notifications.js';
import { optionalAuth } from '../middleware/auth.js';

export async function notificationRoutes(fastify: FastifyInstance) {
  // Get notifications for a user
  fastify.get('/user/:userId', {
    onRequest: [optionalAuth],
    handler: getNotificationsByUserId,
  });

  // Mark notification as read
  fastify.put('/:id/read', {
    onRequest: [optionalAuth],
    handler: markNotificationAsRead,
  });

  // Create notification
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createNotification,
  });
}
