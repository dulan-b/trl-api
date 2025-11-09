import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import {
  type CreateLessonRequest,
  type UpdateLessonRequest,
} from '@trl/shared';

/**
 * Create a new lesson
 */
export async function createLesson(
  request: FastifyRequest<{
    Body: CreateLessonRequest & { moduleId: string };
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
        is_free_preview
      )
      VALUES (
        ${moduleId},
        ${title},
        ${description || null},
        ${lessonType},
        ${videoAssetId || null},
        ${contentMarkdown || null},
        ${orderIndex},
        ${duration || null},
        ${isFreePreview}
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
