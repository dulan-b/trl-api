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
 * Get user's bookmarks with optional item details
 *
 * TRANSITIONAL IMPLEMENTATION: This uses an `include` query parameter to optionally
 * join related tables based on bookmarkable_type. While functional and secure
 * (whitelisted includes only), this exposes internal table structure to the client.
 *
 * TODO: Replace with purpose-built endpoints or a GraphQL-style approach
 * that abstracts internal schema details from the API contract.
 *
 * Allowed includes: details (fetches the bookmarked item's data)
 */
const BOOKMARK_ALLOWED_INCLUDES = ['details'] as const;
type BookmarkInclude = typeof BOOKMARK_ALLOWED_INCLUDES[number];

export async function getUserBookmarks(
  request: FastifyRequest<{
    Params: { userId: string };
    Querystring: { type?: string; include?: string; limit?: string; offset?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const { type, include, limit = '50', offset = '0' } = request.query;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    // Parse and whitelist includes - SECURITY: only allow predefined values
    const requestedIncludes = (include?.split(',') || [])
      .filter((i): i is BookmarkInclude => BOOKMARK_ALLOWED_INCLUDES.includes(i as BookmarkInclude));

    const includeDetails = requestedIncludes.includes('details');

    // If not including details, use the simple query
    if (!includeDetails) {
      let query;
      if (type) {
        query = sql`
          SELECT * FROM bookmarks
          WHERE user_id = ${userId} AND bookmarkable_type = ${type}
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
      } else {
        query = sql`
          SELECT * FROM bookmarks
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${limitNum} OFFSET ${offsetNum}
        `;
      }

      const bookmarks = await query;
      return reply.send({ data: bookmarks, pagination: { limit: limitNum, offset: offsetNum } });
    }

    // With details: fetch bookmarks then hydrate with item data
    // Using separate queries per type to avoid complex polymorphic joins
    let bookmarks;
    if (type) {
      bookmarks = await sql`
        SELECT * FROM bookmarks
        WHERE user_id = ${userId} AND bookmarkable_type = ${type}
        ORDER BY created_at DESC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
    } else {
      bookmarks = await sql`
        SELECT * FROM bookmarks
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
    }

    // Group bookmark IDs by type
    const lessonIds = bookmarks.filter(b => b.bookmarkable_type === 'lesson').map(b => b.bookmarkable_id);
    const trackIds = bookmarks.filter(b => b.bookmarkable_type === 'track').map(b => b.bookmarkable_id);
    const postIds = bookmarks.filter(b => b.bookmarkable_type === 'post').map(b => b.bookmarkable_id);
    const productIds = bookmarks.filter(b => b.bookmarkable_type === 'product').map(b => b.bookmarkable_id);

    // Fetch details for each type (only if there are IDs)
    const [lessons, tracks, posts, products] = await Promise.all([
      lessonIds.length > 0
        ? sql`SELECT id, title, description, thumbnail_url, lesson_type, duration, is_standalone FROM lessons WHERE id = ANY(${lessonIds})`
        : [],
      trackIds.length > 0
        ? sql`SELECT id, title, description, thumbnail_url, category, level FROM tracks WHERE id = ANY(${trackIds})`
        : [],
      postIds.length > 0
        ? sql`SELECT id, title, content, author_id, created_at FROM posts WHERE id = ANY(${postIds}) AND deleted_at IS NULL`
        : [],
      productIds.length > 0
        ? sql`SELECT id, title, description, thumbnail_url, price FROM digital_products WHERE id = ANY(${productIds})`
        : [],
    ]);

    // Create lookup maps
    const lessonMap = new Map(lessons.map(l => [l.id, l]));
    const trackMap = new Map(tracks.map(t => [t.id, t]));
    const postMap = new Map(posts.map(p => [p.id, p]));
    const productMap = new Map(products.map(p => [p.id, p]));

    // Hydrate bookmarks with item details
    const hydratedBookmarks = bookmarks.map(bookmark => {
      let item = null;
      switch (bookmark.bookmarkable_type) {
        case 'lesson':
          item = lessonMap.get(bookmark.bookmarkable_id) || null;
          break;
        case 'track':
          item = trackMap.get(bookmark.bookmarkable_id) || null;
          break;
        case 'post':
          item = postMap.get(bookmark.bookmarkable_id) || null;
          break;
        case 'product':
          item = productMap.get(bookmark.bookmarkable_id) || null;
          break;
      }
      return {
        ...bookmark,
        item,
      };
    });

    return reply.send({ data: hydratedBookmarks, pagination: { limit: limitNum, offset: offsetNum } });
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
