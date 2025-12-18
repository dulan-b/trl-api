import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Get all communities with optional filtering
 */
export async function getCommunities(
  request: FastifyRequest<{
    Querystring: {
      type?: string;
      category?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
) {
  const {
    type,
    category,
    search,
    limit = '20',
    offset = '0',
  } = request.query;

  try {
    let query = `
      SELECT
        c.*,
        p.full_name as creator_name,
        p.avatar_url as creator_avatar
      FROM communities c
      LEFT JOIN profiles p ON c.created_by = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND c.type = $${paramIndex++}`;
      params.push(type);
    }
    if (category) {
      query += ` AND c.category = $${paramIndex++}`;
      params.push(category);
    }
    if (search) {
      query += ` AND (c.name ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.member_count DESC, c.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const communities = await sql.unsafe(query, params);

    return reply.send({
      communities: communities.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type,
        category: c.category,
        trackId: c.track_id,
        createdBy: c.created_by,
        creatorName: c.creator_name,
        creatorAvatar: c.creator_avatar,
        thumbnailUrl: c.thumbnail_url,
        coverPhoto: c.cover_photo,
        memberCount: c.member_count,
        postsToday: c.posts_today || 0,
        isPrivate: c.type === 'private',
        rules: c.rules,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: communities.length,
      },
    });
  } catch (error) {
    request.log.error(error, 'Failed to get communities');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve communities',
    });
  }
}

/**
 * Get community by ID with full details
 */
export async function getCommunityById(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const [community] = await sql`
      SELECT
        c.*,
        p.full_name as creator_name,
        p.avatar_url as creator_avatar
      FROM communities c
      LEFT JOIN profiles p ON c.created_by = p.id
      WHERE c.id = ${id}
    `;

    if (!community) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Community not found',
      });
    }

    return reply.send({
      id: community.id,
      name: community.name,
      description: community.description,
      type: community.type,
      category: community.category,
      trackId: community.track_id,
      createdBy: community.created_by,
      creatorName: community.creator_name,
      creatorAvatar: community.creator_avatar,
      thumbnailUrl: community.thumbnail_url,
      coverPhoto: community.cover_photo,
      memberCount: community.member_count,
      postsToday: community.posts_today || 0,
      isPrivate: community.type === 'private',
      rules: community.rules,
      visibility: community.type === 'private' ? 'Private' : 'Public',
      createdAt: community.created_at,
      updatedAt: community.updated_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to get community');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve community',
    });
  }
}

/**
 * Create community
 */
export async function createCommunity(
  request: FastifyRequest<{
    Body: {
      name: string;
      description?: string;
      type?: string;
      trackId?: string;
      createdBy: string;
      thumbnailUrl?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { name, description, type, trackId, createdBy, thumbnailUrl } = request.body;

  try {
    const [community] = await sql`
      INSERT INTO communities (
        name,
        description,
        type,
        track_id,
        created_by,
        thumbnail_url,
        member_count
      )
      VALUES (
        ${name},
        ${description || null},
        ${type || 'public'},
        ${trackId || null},
        ${createdBy},
        ${thumbnailUrl || null},
        0
      )
      RETURNING *
    `;

    return reply.code(201).send({
      id: community.id,
      name: community.name,
      description: community.description,
      type: community.type,
      trackId: community.track_id,
      createdBy: community.created_by,
      thumbnailUrl: community.thumbnail_url,
      memberCount: community.member_count,
      createdAt: community.created_at,
      updatedAt: community.updated_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to create community');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create community',
    });
  }
}

/**
 * Get posts by community ID
 */
export async function getPostsByCommunityId(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const posts = await sql`
      SELECT
        p.*,
        pr.full_name as author_name,
        pr.avatar_url as author_avatar
      FROM posts p
      JOIN profiles pr ON p.author_id = pr.id
      WHERE p.community_id = ${id}
      ORDER BY p.created_at DESC
    `;

    return reply.send({
      posts: posts.map((post) => ({
        id: post.id,
        communityId: post.community_id,
        authorId: post.author_id,
        authorName: post.author_name,
        authorAvatar: post.author_avatar,
        title: post.title,
        content: post.content,
        likesCount: post.likes_count,
        commentsCount: post.comments_count,
        createdAt: post.created_at,
      })),
    });
  } catch (error) {
    request.log.error(error, 'Failed to get posts');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve posts',
    });
  }
}

/**
 * Create post
 */
export async function createPost(
  request: FastifyRequest<{
    Body: {
      communityId: string;
      authorId: string;
      title: string;
      content: string;
    };
  }>,
  reply: FastifyReply
) {
  const { communityId, authorId, title, content } = request.body;

  try {
    const [post] = await sql`
      INSERT INTO posts (community_id, author_id, title, content, likes_count, comments_count)
      VALUES (${communityId}, ${authorId}, ${title}, ${content}, 0, 0)
      RETURNING *
    `;

    return reply.code(201).send({
      id: post.id,
      communityId: post.community_id,
      authorId: post.author_id,
      title: post.title,
      content: post.content,
      likesCount: post.likes_count,
      commentsCount: post.comments_count,
      createdAt: post.created_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to create post');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create post',
    });
  }
}
