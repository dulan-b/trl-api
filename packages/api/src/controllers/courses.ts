import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import {
  CourseType,
  type CreateCourseRequest,
  type UpdateCourseRequest,
  type CourseResponse,
} from '@trl/shared';

/**
 * Create a new course
 */
export async function createCourse(
  request: FastifyRequest<{
    Body: CreateCourseRequest & { educatorId: string };
  }>,
  reply: FastifyReply
) {
  const {
    educatorId,
    title,
    description,
    courseType,
    teachingStyle = [],
    language = 'en',
    price = 0,
    isFree = false,
    thumbnailUrl,
  } = request.body;

  try {
    const [course] = await sql`
      INSERT INTO courses (
        educator_id,
        title,
        description,
        course_type,
        teaching_style,
        language,
        price,
        is_free,
        thumbnail_url
      )
      VALUES (
        ${educatorId},
        ${title},
        ${description || null},
        ${courseType},
        ${sql.array(teachingStyle)},
        ${language},
        ${price},
        ${isFree},
        ${thumbnailUrl || null}
      )
      RETURNING *
    `;

    request.log.info({ courseId: course.id, educatorId }, 'Course created');

    return reply.code(201).send({
      id: course.id,
      title: course.title,
      description: course.description,
      courseType: course.course_type,
      isPublished: course.is_published,
      createdAt: course.created_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to create course');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create course',
    });
  }
}

/**
 * Get course by ID with lessons and educator info
 */
export async function getCourseById(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    // Get course with educator info
    const [course] = await sql`
      SELECT
        c.*,
        up.full_name as educator_name,
        up.profile_image_url as educator_image
      FROM courses c
      JOIN educator_profiles ep ON c.educator_id = ep.user_id
      JOIN user_profiles up ON ep.user_id = up.id
      WHERE c.id = ${id}
    `;

    if (!course) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Course not found',
      });
    }

    // Get lessons
    const lessons = await sql`
      SELECT
        id,
        title,
        description,
        lesson_type,
        order_index,
        duration,
        is_free_preview,
        video_asset_id
      FROM lessons
      WHERE course_id = ${id}
      ORDER BY order_index ASC
    `;

    // Get tags
    const tags = await sql`
      SELECT tag FROM course_tags WHERE course_id = ${id}
    `;

    // Build response
    const response: CourseResponse = {
      id: course.id,
      educator: {
        id: course.educator_id,
        fullName: course.educator_name,
        profileImageUrl: course.educator_image,
      },
      title: course.title,
      description: course.description,
      courseType: course.course_type,
      teachingStyle: course.teaching_style,
      language: course.language,
      price: parseFloat(course.price),
      isFree: course.is_free,
      isPublished: course.is_published,
      publishedAt: course.published_at,
      thumbnailUrl: course.thumbnail_url,
      previewVideoId: course.preview_video_id,
      totalEnrollments: course.total_enrollments,
      totalCompletions: course.total_completions,
      averageRating: parseFloat(course.average_rating),
      totalReviews: course.total_reviews,
      tags: tags.map((t) => t.tag),
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        lessonType: l.lesson_type,
        orderIndex: l.order_index,
        duration: l.duration,
        isFreePreview: l.is_free_preview,
        isLocked: false, // TODO: Calculate based on enrollment/progress
        videoUrl: l.video_asset_id ? `/api/videos/${l.video_asset_id}` : undefined,
        createdAt: l.created_at,
      })),
      createdAt: course.created_at,
      updatedAt: course.updated_at,
    };

    return reply.send(response);
  } catch (error) {
    request.log.error(error, 'Failed to get course');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve course',
    });
  }
}

/**
 * Update course
 */
export async function updateCourse(
  request: FastifyRequest<{
    Params: { id: string };
    Body: UpdateCourseRequest;
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
    if (updates.courseType !== undefined) {
      updateFields.push(`course_type = $${paramIndex++}`);
      values.push(updates.courseType);
    }
    if (updates.teachingStyle !== undefined) {
      updateFields.push(`teaching_style = $${paramIndex++}`);
      values.push(sql.array(updates.teachingStyle));
    }
    if (updates.language !== undefined) {
      updateFields.push(`language = $${paramIndex++}`);
      values.push(updates.language);
    }
    if (updates.price !== undefined) {
      updateFields.push(`price = $${paramIndex++}`);
      values.push(updates.price);
    }
    if (updates.isFree !== undefined) {
      updateFields.push(`is_free = $${paramIndex++}`);
      values.push(updates.isFree);
    }
    if (updates.thumbnailUrl !== undefined) {
      updateFields.push(`thumbnail_url = $${paramIndex++}`);
      values.push(updates.thumbnailUrl);
    }

    if (updateFields.length === 0) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'No fields to update',
      });
    }

    values.push(id);

    const [course] = await sql`
      UPDATE courses
      SET ${sql.unsafe(updateFields.join(', '))}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!course) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Course not found',
      });
    }

    request.log.info({ courseId: id }, 'Course updated');

    return reply.send({
      id: course.id,
      title: course.title,
      description: course.description,
      updatedAt: course.updated_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to update course');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to update course',
    });
  }
}

/**
 * Delete course
 */
export async function deleteCourse(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const result = await sql`
      DELETE FROM courses WHERE id = ${id} RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Course not found',
      });
    }

    request.log.info({ courseId: id }, 'Course deleted');

    return reply.code(204).send();
  } catch (error) {
    request.log.error(error, 'Failed to delete course');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to delete course',
    });
  }
}

/**
 * List courses with filtering
 */
export async function listCourses(
  request: FastifyRequest<{
    Querystring: {
      educatorId?: string;
      courseType?: CourseType;
      isPublished?: boolean;
      isFree?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
) {
  const {
    educatorId,
    courseType,
    isPublished,
    isFree,
    search,
    limit = 20,
    offset = 0,
  } = request.query;

  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (educatorId) {
      conditions.push(`c.educator_id = $${paramIndex++}`);
      params.push(educatorId);
    }
    if (courseType) {
      conditions.push(`c.course_type = $${paramIndex++}`);
      params.push(courseType);
    }
    if (isPublished !== undefined) {
      conditions.push(`c.is_published = $${paramIndex++}`);
      params.push(isPublished);
    }
    if (isFree !== undefined) {
      conditions.push(`c.is_free = $${paramIndex++}`);
      params.push(isFree);
    }
    if (search) {
      conditions.push(`(c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);

    const courses = await sql`
      SELECT
        c.*,
        up.full_name as educator_name,
        up.profile_image_url as educator_image
      FROM courses c
      JOIN educator_profiles ep ON c.educator_id = ep.user_id
      JOIN user_profiles up ON ep.user_id = up.id
      ${sql.unsafe(whereClause)}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex}
    `.values(params);

    const response = courses.map((course) => ({
      id: course.id,
      educator: {
        id: course.educator_id,
        fullName: course.educator_name,
        profileImageUrl: course.educator_image,
      },
      title: course.title,
      description: course.description,
      courseType: course.course_type,
      price: parseFloat(course.price),
      isFree: course.is_free,
      isPublished: course.is_published,
      thumbnailUrl: course.thumbnail_url,
      totalEnrollments: course.total_enrollments,
      averageRating: parseFloat(course.average_rating),
      createdAt: course.created_at,
    }));

    return reply.send({
      courses: response,
      pagination: {
        limit,
        offset,
        total: courses.length,
      },
    });
  } catch (error) {
    request.log.error(error, 'Failed to list courses');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to list courses',
    });
  }
}

/**
 * Publish a course
 */
export async function publishCourse(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const [course] = await sql`
      UPDATE courses
      SET is_published = TRUE, published_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!course) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Course not found',
      });
    }

    request.log.info({ courseId: id }, 'Course published');

    return reply.send({
      id: course.id,
      title: course.title,
      isPublished: course.is_published,
      publishedAt: course.published_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to publish course');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to publish course',
    });
  }
}
