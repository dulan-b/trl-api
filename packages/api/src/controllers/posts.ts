import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Posts Controller - Aligned with Supabase schema
 */

interface PostParams {
  id: string;
}

interface CreatePostBody {
  community_id: string;
  author_id: string;
  content: string;
  post_type?: 'text' | 'media' | 'link';
  media_url?: string;
  media_duration_seconds?: number;
  link_url?: string;
  link_title?: string;
  link_description?: string;
  link_image?: string;
}

interface UpdatePostBody {
  content?: string;
  is_pinned?: boolean;
}

/**
 * Get post by ID
 */
export async function getPostById(
  request: FastifyRequest<{ Params: PostParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const result = await sql`
      SELECT p.*, pr.full_name as author_name, pr.avatar_url as author_avatar
      FROM posts p
      LEFT JOIN profiles pr ON p.author_id = pr.id
      WHERE p.id = ${id} AND p.deleted_at IS NULL
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Post not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Create post
 */
export async function createPost(
  request: FastifyRequest<{ Body: CreatePostBody }>,
  reply: FastifyReply
) {
  try {
    const {
      community_id,
      author_id,
      content,
      post_type = 'text',
      media_url,
      media_duration_seconds,
      link_url,
      link_title,
      link_description,
      link_image,
    } = request.body;

    const result = await sql`
      INSERT INTO posts (
        community_id, author_id, content, post_type,
        media_url, media_duration_seconds,
        link_url, link_title, link_description, link_image
      )
      VALUES (
        ${community_id}, ${author_id}, ${content}, ${post_type},
        ${media_url || null}, ${media_duration_seconds || null},
        ${link_url || null}, ${link_title || null},
        ${link_description || null}, ${link_image || null}
      )
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Update post
 */
export async function updatePost(
  request: FastifyRequest<{ Params: PostParams; Body: UpdatePostBody }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const updates = request.body;

    const updateData: Record<string, any> = {};
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.is_pinned !== undefined) updateData.is_pinned = updates.is_pinned;

    if (Object.keys(updateData).length === 0) {
      return reply.code(400).send({ error: 'Bad Request', message: 'No fields to update' });
    }

    const result = await sql`
      UPDATE posts
      SET ${sql(updateData)}, updated_at = NOW()
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Post not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Delete post (soft delete)
 */
export async function deletePost(
  request: FastifyRequest<{ Params: PostParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const result = await sql`
      UPDATE posts
      SET deleted_at = NOW()
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Post not found' });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get post comments
 */
export async function getPostComments(
  request: FastifyRequest<{
    Params: PostParams;
    Querystring: { limit?: number; offset?: number };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { limit = 50, offset = 0 } = request.query;

    const comments = await sql`
      SELECT c.*, p.full_name as author_name, p.avatar_url as author_avatar
      FROM post_comments c
      LEFT JOIN profiles p ON c.user_id = p.id
      WHERE c.post_id = ${id}
      ORDER BY c.created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return reply.send({ data: comments, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Create comment on post
 */
export async function createPostComment(
  request: FastifyRequest<{
    Params: PostParams;
    Body: { user_id: string; content: string; parent_comment_id?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { user_id, content, parent_comment_id } = request.body;

    const result = await sql`
      INSERT INTO post_comments (post_id, user_id, content, parent_comment_id)
      VALUES (${id}, ${user_id}, ${content}, ${parent_comment_id || null})
      RETURNING *
    `;

    // Increment comment count
    await sql`UPDATE posts SET comments_count = comments_count + 1 WHERE id = ${id}`;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Delete comment
 */
export async function deletePostComment(
  request: FastifyRequest<{ Params: { id: string; commentId: string } }>,
  reply: FastifyReply
) {
  try {
    const { id, commentId } = request.params;

    const result = await sql`
      DELETE FROM post_comments WHERE id = ${commentId} AND post_id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Comment not found' });
    }

    // Decrement comment count
    await sql`UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = ${id}`;

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get post reactions
 */
export async function getPostReactions(
  request: FastifyRequest<{ Params: PostParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const reactions = await sql`
      SELECT reaction_type, COUNT(*) as count
      FROM post_reactions
      WHERE post_id = ${id}
      GROUP BY reaction_type
    `;

    return reply.send({ data: reactions });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Add reaction to post
 */
export async function addPostReaction(
  request: FastifyRequest<{
    Params: PostParams;
    Body: { user_id: string; reaction_type: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { user_id, reaction_type } = request.body;

    // Upsert reaction
    const result = await sql`
      INSERT INTO post_reactions (post_id, user_id, reaction_type)
      VALUES (${id}, ${user_id}, ${reaction_type})
      ON CONFLICT (post_id, user_id) DO UPDATE SET reaction_type = ${reaction_type}
      RETURNING *
    `;

    // Update likes count if it's a like
    if (reaction_type === 'like') {
      await sql`UPDATE posts SET likes_count = likes_count + 1 WHERE id = ${id}`;
    }

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Remove reaction from post
 */
export async function removePostReaction(
  request: FastifyRequest<{ Params: { id: string; userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { id, userId } = request.params;

    const result = await sql`
      DELETE FROM post_reactions
      WHERE post_id = ${id} AND user_id = ${userId}
      RETURNING reaction_type
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Reaction not found' });
    }

    // Update likes count if it was a like
    if (result[0].reaction_type === 'like') {
      await sql`UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ${id}`;
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Bookmark post
 */
export async function bookmarkPost(
  request: FastifyRequest<{
    Params: PostParams;
    Body: { user_id: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { user_id } = request.body;

    const result = await sql`
      INSERT INTO post_bookmarks (post_id, user_id)
      VALUES (${id}, ${user_id})
      ON CONFLICT (post_id, user_id) DO NOTHING
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(409).send({ error: 'Conflict', message: 'Already bookmarked' });
    }

    // Update saves count
    await sql`UPDATE posts SET saves_count = saves_count + 1 WHERE id = ${id}`;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Remove bookmark from post
 */
export async function unbookmarkPost(
  request: FastifyRequest<{ Params: { id: string; userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { id, userId } = request.params;

    const result = await sql`
      DELETE FROM post_bookmarks
      WHERE post_id = ${id} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Bookmark not found' });
    }

    // Update saves count
    await sql`UPDATE posts SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = ${id}`;

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Report post
 */
export async function reportPost(
  request: FastifyRequest<{
    Params: PostParams;
    Body: { reporter_id: string; reason: string; description?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { reporter_id, reason, description } = request.body;

    const result = await sql`
      INSERT INTO post_reports (post_id, reporter_id, reason, description)
      VALUES (${id}, ${reporter_id}, ${reason}, ${description || null})
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get post reports (admin)
 */
export async function getPostReports(
  request: FastifyRequest<{
    Querystring: { status?: string; limit?: number; offset?: number };
  }>,
  reply: FastifyReply
) {
  try {
    const { status, limit = 50, offset = 0 } = request.query;

    let query;
    if (status) {
      query = sql`
        SELECT r.*, p.content as post_content, p.author_id
        FROM post_reports r
        LEFT JOIN posts p ON r.post_id = p.id
        WHERE r.status = ${status}
        ORDER BY r.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT r.*, p.content as post_content, p.author_id
        FROM post_reports r
        LEFT JOIN posts p ON r.post_id = p.id
        ORDER BY r.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const reports = await query;
    return reply.send({ data: reports, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Update report status (admin)
 */
export async function updateReportStatus(
  request: FastifyRequest<{
    Params: { reportId: string };
    Body: { status: string; resolution_notes?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { reportId } = request.params;
    const { status, resolution_notes } = request.body;

    const result = await sql`
      UPDATE post_reports
      SET status = ${status}, resolution_notes = ${resolution_notes || null}, resolved_at = NOW()
      WHERE id = ${reportId}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Report not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
