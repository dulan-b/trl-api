import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import {
  type CreateLessonRequest,
  type UpdateLessonRequest,
} from '@trl/shared';

/**
 * Create a new lesson
 */
interface CreateLessonBody {
  moduleId?: string;
  title: string;
  description?: string;
  lessonType: string;
  videoAssetId?: string;
  contentMarkdown?: string;
  orderIndex: number;
  duration?: number;
  isFreePreview?: boolean;
  isStandalone?: boolean;
  posterUrl?: string;
  thumbnailUrl?: string;
  videoDurationSeconds?: number;
  contentData?: Record<string, any>;
}

export async function createLesson(
  request: FastifyRequest<{
    Body: CreateLessonBody;
  }>,
  reply: FastifyReply
) {
  const {
    moduleId,
    title,
    description,
    lessonType,
    videoAssetId,
    contentMarkdown,
    orderIndex,
    duration,
    isFreePreview = false,
    isStandalone = false,
    posterUrl,
    thumbnailUrl,
    videoDurationSeconds,
    contentData,
  } = request.body;

  try {
    const [lesson] = await sql`
      INSERT INTO lessons (
        module_id,
        title,
        description,
        lesson_type,
        video_asset_id,
        content_markdown,
        order_index,
        duration,
        is_free_preview,
        is_standalone,
        poster_url,
        thumbnail_url,
        video_duration_seconds,
        content_data
      )
      VALUES (
        ${moduleId || null},
        ${title},
        ${description || null},
        ${lessonType},
        ${videoAssetId || null},
        ${contentMarkdown || null},
        ${orderIndex},
        ${duration || null},
        ${isFreePreview},
        ${isStandalone},
        ${posterUrl || null},
        ${thumbnailUrl || null},
        ${videoDurationSeconds || null},
        ${contentData ? JSON.stringify(contentData) : null}
      )
      RETURNING *
    `;

    request.log.info({ lessonId: lesson.id, moduleId }, 'Lesson created');

    return reply.code(201).send({
      id: lesson.id,
      title: lesson.title,
      lessonType: lesson.lesson_type,
      orderIndex: lesson.order_index,
      createdAt: lesson.created_at,
    });
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation (order_index)
      return reply.code(409).send({
        error: 'Conflict',
        message: 'A lesson with this order index already exists for this module',
      });
    }
    request.log.error(error, 'Failed to create lesson');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create lesson',
    });
  }
}

/**
 * Get lesson by ID
 */
export async function getLessonById(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const [lesson] = await sql`
      SELECT * FROM lessons WHERE id = ${id}
    `;

    if (!lesson) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Lesson not found',
      });
    }

    return reply.send({
      id: lesson.id,
      moduleId: lesson.module_id,
      title: lesson.title,
      description: lesson.description,
      lessonType: lesson.lesson_type,
      videoAssetId: lesson.video_asset_id,
      contentMarkdown: lesson.content_markdown,
      orderIndex: lesson.order_index,
      duration: lesson.duration,
      isFreePreview: lesson.is_free_preview,
      isStandalone: lesson.is_standalone,
      posterUrl: lesson.poster_url,
      thumbnailUrl: lesson.thumbnail_url,
      videoDurationSeconds: lesson.video_duration_seconds,
      contentData: lesson.content_data,
      createdAt: lesson.created_at,
      updatedAt: lesson.updated_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to get lesson');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve lesson',
    });
  }
}

/**
 * Update lesson
 */
export async function updateLesson(
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateLessonRequest;
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const updates = request.body;

  try {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.videoAssetId !== undefined) {
      updateFields.push(`video_asset_id = $${paramIndex++}`);
      values.push(updates.videoAssetId);
    }
    if (updates.contentMarkdown !== undefined) {
      updateFields.push(`content_markdown = $${paramIndex++}`);
      values.push(updates.contentMarkdown);
    }
    if (updates.orderIndex !== undefined) {
      updateFields.push(`order_index = $${paramIndex++}`);
      values.push(updates.orderIndex);
    }
    if (updates.duration !== undefined) {
      updateFields.push(`duration = $${paramIndex++}`);
      values.push(updates.duration);
    }
    if (updates.isFreePreview !== undefined) {
      updateFields.push(`is_free_preview = $${paramIndex++}`);
      values.push(updates.isFreePreview);
    }

    if (updateFields.length === 0) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'No fields to update',
      });
    }

    values.push(id);

    const [lesson] = await sql`
      UPDATE lessons
      SET ${sql.unsafe(updateFields.join(', '))}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!lesson) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Lesson not found',
      });
    }

    request.log.info({ lessonId: id }, 'Lesson updated');

    return reply.send({
      id: lesson.id,
      title: lesson.title,
      updatedAt: lesson.updated_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to update lesson');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to update lesson',
    });
  }
}

/**
 * Delete lesson
 */
export async function deleteLesson(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const result = await sql`
      DELETE FROM lessons WHERE id = ${id} RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Lesson not found',
      });
    }

    request.log.info({ lessonId: id }, 'Lesson deleted');

    return reply.code(204).send();
  } catch (error) {
    request.log.error(error, 'Failed to delete lesson');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to delete lesson',
    });
  }
}

/**
 * List lessons for a module
 */
export async function listLessons(
  request: FastifyRequest<{
    Querystring: {
      moduleId: string;
    };
  }>,
  reply: FastifyReply
) {
  const { moduleId } = request.query;

  if (!moduleId) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: 'moduleId is required',
    });
  }

  try {
    const lessons = await sql`
      SELECT * FROM lessons
      WHERE module_id = ${moduleId}
      ORDER BY order_index ASC
    `;

    return reply.send({
      lessons: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        lessonType: lesson.lesson_type,
        orderIndex: lesson.order_index,
        duration: lesson.duration,
        isFreePreview: lesson.is_free_preview,
        createdAt: lesson.created_at,
      })),
    });
  } catch (error) {
    request.log.error(error, 'Failed to list lessons');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to list lessons',
    });
  }
}

/**
 * Get learning feed lessons with optional related data
 *
 * TRANSITIONAL IMPLEMENTATION: This uses an `include` query parameter to optionally
 * join related tables. While functional and secure (whitelisted includes only),
 * this exposes internal table structure to the client.
 *
 * TODO: Replace with purpose-built endpoints or a GraphQL-style approach
 * that abstracts internal schema details from the API contract.
 *
 * Allowed includes: module, track, progress
 */
const FEED_ALLOWED_INCLUDES = ['module', 'track', 'progress'] as const;
type FeedInclude = typeof FEED_ALLOWED_INCLUDES[number];

export async function getLessonsFeed(
  request: FastifyRequest<{
    Querystring: {
      user_id?: string;
      include?: string;
      interest_tags?: string;
      is_standalone?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const {
      user_id,
      include,
      interest_tags: interestTagsParam,
      is_standalone,
      limit = '20',
      offset = '0'
    } = request.query;

    // Parse and whitelist includes - SECURITY: only allow predefined values
    const requestedIncludes = (include?.split(',') || [])
      .filter((i): i is FeedInclude => FEED_ALLOWED_INCLUDES.includes(i as FeedInclude));

    const includeModule = requestedIncludes.includes('module');
    const includeTrack = requestedIncludes.includes('track');
    const includeProgress = requestedIncludes.includes('progress') && user_id;

    // Parse interest tags for filtering
    const interestTags = interestTagsParam?.split(',').filter(Boolean) || [];

    // Build query dynamically based on includes
    // Note: We use conditional SQL fragments with hardcoded table names (never user input)
    let lessons;

    if (includeModule || includeTrack || includeProgress) {
      lessons = await sql`
        SELECT
          l.*
          ${includeModule ? sql`, json_build_object(
            'id', m.id,
            'title', m.title,
            'order_index', m.order_index
          ) as module` : sql``}
          ${includeTrack ? sql`, json_build_object(
            'id', t.id,
            'title', t.title,
            'thumbnail_url', t.thumbnail_url,
            'category', t.category,
            'interest_tags', t.interest_tags
          ) as track` : sql``}
          ${includeProgress ? sql`, json_build_object(
            'completed', COALESCE(lp.completed, false),
            'watched_duration', COALESCE(lp.watched_duration, 0),
            'last_watched_at', lp.last_watched_at
          ) as progress` : sql``}
        FROM lessons l
        ${includeModule ? sql`LEFT JOIN modules m ON l.module_id = m.id` : sql``}
        ${includeTrack ? sql`LEFT JOIN tracks t ON m.track_id = t.id` : sql``}
        ${includeProgress ? sql`LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = ${user_id}` : sql``}
        WHERE 1=1
        ${is_standalone === 'true' ? sql`AND l.is_standalone = true` : sql``}
        ${interestTags.length > 0 && includeTrack ? sql`AND t.interest_tags && ${interestTags}::text[]` : sql``}
        ORDER BY l.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    } else {
      // Simple query without joins
      lessons = await sql`
        SELECT * FROM lessons l
        WHERE 1=1
        ${is_standalone === 'true' ? sql`AND l.is_standalone = true` : sql``}
        ORDER BY l.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    }

    return reply.send({
      data: lessons.map((lesson) => ({
        id: lesson.id,
        moduleId: lesson.module_id,
        title: lesson.title,
        description: lesson.description,
        lessonType: lesson.lesson_type,
        orderIndex: lesson.order_index,
        duration: lesson.duration,
        isFreePreview: lesson.is_free_preview,
        isStandalone: lesson.is_standalone,
        posterUrl: lesson.poster_url,
        thumbnailUrl: lesson.thumbnail_url,
        videoDurationSeconds: lesson.video_duration_seconds,
        contentData: lesson.content_data,
        createdAt: lesson.created_at,
        ...(includeModule && lesson.module ? { module: lesson.module } : {}),
        ...(includeTrack && lesson.track ? { track: lesson.track } : {}),
        ...(includeProgress && lesson.progress ? { progress: lesson.progress } : {}),
      })),
      pagination: { limit: parseInt(limit), offset: parseInt(offset) },
    });
  } catch (error) {
    request.log.error(error, 'Failed to get lessons feed');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve lessons feed',
    });
  }
}
