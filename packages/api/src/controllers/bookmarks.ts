import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Bookmarks Controller
 * Polymorphic bookmarks for lessons, tracks, etc.
 */

interface BookmarkParams {
  id: string;
}

interface CreateBookmarkBody {
  user_id: string;
  bookmarkable_type: 'lesson' | 'track';
  bookmarkable_id: string;
}

/**
 * Get user's bookmarks
 */
export async function getUserBookmarks(
  request: FastifyRequest<{
    Params: { userId: string };
    Querystring: { type?: string; limit?: number; offset?: number };
  }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const { type, limit = 50, offset = 0 } = request.query;

    let query;
    if (type) {
      query = sql`
        SELECT * FROM bookmarks
        WHERE user_id = ${userId} AND bookmarkable_type = ${type}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT * FROM bookmarks
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const bookmarks = await query;
    return reply.send({ data: bookmarks, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Create bookmark
 */
export async function createBookmark(
  request: FastifyRequest<{ Body: CreateBookmarkBody }>,
  reply: FastifyReply
) {
  try {
    const { user_id, bookmarkable_type, bookmarkable_id } = request.body;

    const result = await sql`
      INSERT INTO bookmarks (user_id, bookmarkable_type, bookmarkable_id)
      VALUES (${user_id}, ${bookmarkable_type}, ${bookmarkable_id})
      ON CONFLICT (user_id, bookmarkable_type, bookmarkable_id) DO NOTHING
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(409).send({ error: 'Conflict', message: 'Already bookmarked' });
    }

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Delete bookmark
 */
export async function deleteBookmark(
  request: FastifyRequest<{ Params: BookmarkParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const result = await sql`
      DELETE FROM bookmarks WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Bookmark not found' });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Delete bookmark by user and item
 */
export async function deleteBookmarkByItem(
  request: FastifyRequest<{
    Params: { userId: string; type: string; itemId: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { userId, type, itemId } = request.params;

    const result = await sql`
      DELETE FROM bookmarks
      WHERE user_id = ${userId}
        AND bookmarkable_type = ${type}
        AND bookmarkable_id = ${itemId}
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Bookmark not found' });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
