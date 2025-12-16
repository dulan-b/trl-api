import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Micro Lessons Controller
 * Handles CRUD operations for short-form educational videos (<5 min)
 */

interface MicroLessonParams {
  id: string;
}

interface CreateMicroLessonBody {
  instructor_id: string;
  title: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  interest_tags?: string[];
}

interface UpdateMicroLessonBody {
  title?: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  level?: string;
  category?: string;
  interest_tags?: string[];
  is_active?: boolean;
}

/**
 * List micro lessons with optional filtering
 */
export async function listMicroLessons(
  request: FastifyRequest<{
    Querystring: {
      instructor_id?: string;
      category?: string;
      level?: string;
      interest_tags?: string;
      is_active?: string;
      include?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const {
      instructor_id,
      category,
      level,
      interest_tags,
      is_active,
      include
    } = request.query;

    const limit = parseInt(request.query.limit || '50', 10);
    const offset = parseInt(request.query.offset || '0', 10);
    const includeInstructor = include?.includes('instructor');

    // Simple query building based on filters
    let microLessons;

    if (includeInstructor) {
      if (instructor_id && category && level) {
        microLessons = await sql`
          SELECT ml.*, json_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) as instructor
          FROM micro_lessons ml LEFT JOIN profiles p ON ml.instructor_id = p.id
          WHERE ml.is_active = true AND ml.instructor_id = ${instructor_id} AND ml.category = ${category} AND ml.level = ${level}
          ORDER BY ml.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (instructor_id && category) {
        microLessons = await sql`
          SELECT ml.*, json_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) as instructor
          FROM micro_lessons ml LEFT JOIN profiles p ON ml.instructor_id = p.id
          WHERE ml.is_active = true AND ml.instructor_id = ${instructor_id} AND ml.category = ${category}
          ORDER BY ml.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (instructor_id && level) {
        microLessons = await sql`
          SELECT ml.*, json_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) as instructor
          FROM micro_lessons ml LEFT JOIN profiles p ON ml.instructor_id = p.id
          WHERE ml.is_active = true AND ml.instructor_id = ${instructor_id} AND ml.level = ${level}
          ORDER BY ml.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (category && level) {
        microLessons = await sql`
          SELECT ml.*, json_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) as instructor
          FROM micro_lessons ml LEFT JOIN profiles p ON ml.instructor_id = p.id
          WHERE ml.is_active = true AND ml.category = ${category} AND ml.level = ${level}
          ORDER BY ml.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (instructor_id) {
        microLessons = await sql`
          SELECT ml.*, json_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) as instructor
          FROM micro_lessons ml LEFT JOIN profiles p ON ml.instructor_id = p.id
          WHERE ml.is_active = true AND ml.instructor_id = ${instructor_id}
          ORDER BY ml.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (category) {
        microLessons = await sql`
          SELECT ml.*, json_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) as instructor
          FROM micro_lessons ml LEFT JOIN profiles p ON ml.instructor_id = p.id
          WHERE ml.is_active = true AND ml.category = ${category}
          ORDER BY ml.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (level) {
        microLessons = await sql`
          SELECT ml.*, json_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) as instructor
          FROM micro_lessons ml LEFT JOIN profiles p ON ml.instructor_id = p.id
          WHERE ml.is_active = true AND ml.level = ${level}
          ORDER BY ml.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        microLessons = await sql`
          SELECT ml.*, json_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) as instructor
          FROM micro_lessons ml LEFT JOIN profiles p ON ml.instructor_id = p.id
          WHERE ml.is_active = true
          ORDER BY ml.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      }
    } else {
      if (category && level) {
        microLessons = await sql`
          SELECT * FROM micro_lessons WHERE is_active = true AND category = ${category} AND level = ${level}
          ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (category) {
        microLessons = await sql`
          SELECT * FROM micro_lessons WHERE is_active = true AND category = ${category}
          ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (level) {
        microLessons = await sql`
          SELECT * FROM micro_lessons WHERE is_active = true AND level = ${level}
          ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        microLessons = await sql`
          SELECT * FROM micro_lessons WHERE is_active = true
          ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
      }
    }

    return reply.send({ data: microLessons, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get micro lesson by ID
 */
export async function getMicroLessonById(
  request: FastifyRequest<{
    Params: MicroLessonParams;
    Querystring: { include?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { include } = request.query;

    const includeInstructor = include?.includes('instructor');

    let result;
    if (includeInstructor) {
      result = await sql`
        SELECT
          ml.*,
          json_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'avatar_url', p.avatar_url
          ) as instructor
        FROM micro_lessons ml
        LEFT JOIN profiles p ON ml.instructor_id = p.id
        WHERE ml.id = ${id}
      `;
    } else {
      result = await sql`SELECT * FROM micro_lessons WHERE id = ${id}`;
    }

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Micro lesson not found' });
    }

    // Increment views count
    await sql`
      UPDATE micro_lessons
      SET views_count = views_count + 1
      WHERE id = ${id}
    `;

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Create micro lesson
 */
export async function createMicroLesson(
  request: FastifyRequest<{ Body: CreateMicroLessonBody }>,
  reply: FastifyReply
) {
  try {
    const {
      instructor_id,
      title,
      description,
      video_url,
      thumbnail_url,
      duration_seconds = 0,
      level = 'beginner',
      category,
      interest_tags = [],
    } = request.body;

    if (!title || !category || !instructor_id) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'title, category, and instructor_id are required'
      });
    }

    const result = await sql`
      INSERT INTO micro_lessons (
        instructor_id, title, description, video_url, thumbnail_url,
        duration_seconds, level, category, interest_tags
      )
      VALUES (
        ${instructor_id}, ${title}, ${description || null},
        ${video_url || null}, ${thumbnail_url || null},
        ${duration_seconds}, ${level}, ${category}, ${JSON.stringify(interest_tags)}
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
 * Update micro lesson
 */
export async function updateMicroLesson(
  request: FastifyRequest<{ Params: MicroLessonParams; Body: UpdateMicroLessonBody }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const updates = request.body;

    const updateData: Record<string, any> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.video_url !== undefined) updateData.video_url = updates.video_url;
    if (updates.thumbnail_url !== undefined) updateData.thumbnail_url = updates.thumbnail_url;
    if (updates.duration_seconds !== undefined) updateData.duration_seconds = updates.duration_seconds;
    if (updates.level !== undefined) updateData.level = updates.level;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.interest_tags !== undefined) updateData.interest_tags = JSON.stringify(updates.interest_tags);
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

    if (Object.keys(updateData).length === 0) {
      return reply.code(400).send({ error: 'Bad Request', message: 'No fields to update' });
    }

    const result = await sql`
      UPDATE micro_lessons
      SET ${sql(updateData)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Micro lesson not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Delete micro lesson
 */
export async function deleteMicroLesson(
  request: FastifyRequest<{ Params: MicroLessonParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const result = await sql`DELETE FROM micro_lessons WHERE id = ${id} RETURNING id`;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Micro lesson not found' });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Like a micro lesson
 */
export async function likeMicroLesson(
  request: FastifyRequest<{ Params: MicroLessonParams; Body: { user_id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { user_id } = request.body;

    if (!user_id) {
      return reply.code(400).send({ error: 'Bad Request', message: 'user_id is required' });
    }

    // Check if already liked
    const existing = await sql`
      SELECT id FROM micro_lesson_likes
      WHERE micro_lesson_id = ${id} AND user_id = ${user_id}
    `;

    if (existing.length > 0) {
      return reply.code(409).send({ error: 'Conflict', message: 'Already liked' });
    }

    // Add like
    await sql`
      INSERT INTO micro_lesson_likes (micro_lesson_id, user_id)
      VALUES (${id}, ${user_id})
    `;

    // Update count
    await sql`
      UPDATE micro_lessons
      SET likes_count = likes_count + 1
      WHERE id = ${id}
    `;

    return reply.code(201).send({ success: true });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Unlike a micro lesson
 */
export async function unlikeMicroLesson(
  request: FastifyRequest<{ Params: MicroLessonParams; Querystring: { user_id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { user_id } = request.query;

    if (!user_id) {
      return reply.code(400).send({ error: 'Bad Request', message: 'user_id is required' });
    }

    const result = await sql`
      DELETE FROM micro_lesson_likes
      WHERE micro_lesson_id = ${id} AND user_id = ${user_id}
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Like not found' });
    }

    // Update count
    await sql`
      UPDATE micro_lessons
      SET likes_count = GREATEST(likes_count - 1, 0)
      WHERE id = ${id}
    `;

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get comments for a micro lesson
 */
export async function getMicroLessonComments(
  request: FastifyRequest<{
    Params: MicroLessonParams;
    Querystring: { limit?: number; offset?: number };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { limit = 50, offset = 0 } = request.query;

    const comments = await sql`
      SELECT
        c.*,
        json_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        ) as user
      FROM micro_lesson_comments c
      LEFT JOIN profiles p ON c.user_id = p.id
      WHERE c.micro_lesson_id = ${id}
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return reply.send({ data: comments, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Add comment to micro lesson
 */
export async function addMicroLessonComment(
  request: FastifyRequest<{
    Params: MicroLessonParams;
    Body: { user_id: string; content: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { user_id, content } = request.body;

    if (!user_id || !content) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'user_id and content are required'
      });
    }

    const result = await sql`
      INSERT INTO micro_lesson_comments (micro_lesson_id, user_id, content)
      VALUES (${id}, ${user_id}, ${content})
      RETURNING *
    `;

    // Update comment count
    await sql`
      UPDATE micro_lessons
      SET comments_count = comments_count + 1
      WHERE id = ${id}
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Delete comment from micro lesson
 */
export async function deleteMicroLessonComment(
  request: FastifyRequest<{ Params: { id: string; commentId: string } }>,
  reply: FastifyReply
) {
  try {
    const { id, commentId } = request.params;

    const result = await sql`
      DELETE FROM micro_lesson_comments
      WHERE id = ${commentId} AND micro_lesson_id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Comment not found' });
    }

    // Update comment count
    await sql`
      UPDATE micro_lessons
      SET comments_count = GREATEST(comments_count - 1, 0)
      WHERE id = ${id}
    `;

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
