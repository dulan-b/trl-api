import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Get notifications for a user
 */
export async function getNotificationsByUserId(
  request: FastifyRequest<{
    Params: { userId: string };
  }>,
  reply: FastifyReply
) {
  const { userId } = request.params;

  try {
    const notifications = await sql`
      SELECT * FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return reply.send({
      notifications: notifications.map((n) => ({
        id: n.id,
        userId: n.user_id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
        metadata: n.metadata,
        createdAt: n.created_at,
      })),
    });
  } catch (error) {
    request.log.error(error, 'Failed to get notifications');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve notifications',
    });
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const [notification] = await sql`
      UPDATE notifications
      SET is_read = true
      WHERE id = ${id}
      RETURNING *
    `;

    if (!notification) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Notification not found',
      });
    }

    return reply.send({
      id: notification.id,
      isRead: notification.is_read,
    });
  } catch (error) {
    request.log.error(error, 'Failed to mark notification as read');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to update notification',
    });
  }
}

/**
 * Create notification
 */
export async function createNotification(
  request: FastifyRequest<{
    Body: {
      userId: string;
      type: string;
      title: string;
      message: string;
      metadata?: any;
    };
  }>,
  reply: FastifyReply
) {
  const { userId, type, title, message, metadata } = request.body;

  try {
    const [notification] = await sql`
      INSERT INTO notifications (user_id, type, title, message, metadata, is_read)
      VALUES (${userId}, ${type}, ${title}, ${message}, ${metadata ? sql.json(metadata) : null}, false)
      RETURNING *
    `;

    return reply.code(201).send({
      id: notification.id,
      userId: notification.user_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      isRead: notification.is_read,
      createdAt: notification.created_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to create notification');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create notification',
    });
  }
}
