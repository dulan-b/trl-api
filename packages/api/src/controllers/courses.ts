import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * List courses (tracks) with filtering
 */
export async function listCourses(
  request: FastifyRequest<{
    Querystring: {
      category?: string;
      level?: string;
      format?: string;
      learning_style?: string;
      is_active?: string;
      is_featured?: string;
      is_free?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
) {
  const {
    category,
    level,
    format,
    learning_style,
    is_active,
    is_featured,
    is_free,
    search,
    limit = '20',
    offset = '0',
  } = request.query;

  try {
    // Build dynamic query
    let query = `
      SELECT
        t.*,
        p.full_name as instructor_name,
        p.avatar_url as instructor_avatar
      FROM tracks t
      LEFT JOIN profiles p ON t.created_by = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND t.category = $${paramIndex++}`;
      params.push(category);
    }
    if (level) {
      query += ` AND t.level = $${paramIndex++}`;
      params.push(level.toLowerCase());
    }
    if (format) {
      query += ` AND t.format = $${paramIndex++}`;
      params.push(format);
    }
    if (learning_style) {
      query += ` AND t.learning_style = $${paramIndex++}`;
      params.push(learning_style);
    }
    if (is_active !== undefined) {
      query += ` AND t.is_active = $${paramIndex++}`;
      params.push(is_active === 'true');
    }
    if (is_featured !== undefined) {
      query += ` AND t.is_featured = $${paramIndex++}`;
      params.push(is_featured === 'true');
    }
    if (is_free !== undefined) {
      if (is_free === 'true') {
        query += ` AND t.price = 0`;
      } else {
        query += ` AND t.price > 0`;
      }
    }
    if (search) {
      query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY t.is_featured DESC, t.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const courses = await sql.unsafe(query, params);

    const response = courses.map((course: any) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      price: parseFloat(course.price) || 0,
      category: course.category,
      level: course.level.charAt(0).toUpperCase() + course.level.slice(1), // Capitalize
      thumbnailUrl: course.thumbnail_url,
      estimatedHours: course.estimated_hours,
      enrollmentCount: course.enrollment_count,
      averageRating: parseFloat(course.average_rating) || 0,
      format: course.format,
      learningStyle: course.learning_style,
      isFeatured: course.is_featured,
      isActive: course.is_active,
      instructorName: course.instructor_name || 'The Ready Lab',
      instructorAvatar: course.instructor_avatar,
      createdAt: course.created_at,
    }));

    return reply.send({
      courses: response,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
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
 * Get course by ID with modules and lessons
 */
export async function getCourseById(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    // Get course with instructor info
    const [course] = await sql`
      SELECT
        t.*,
        p.full_name as instructor_name,
        p.avatar_url as instructor_avatar
      FROM tracks t
      LEFT JOIN profiles p ON t.created_by = p.id
      WHERE t.id = ${id}
    `;

    if (!course) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Course not found',
      });
    }

    // Get modules with lessons
    const modules = await sql`
      SELECT
        m.*,
        (
          SELECT json_agg(
            json_build_object(
              'id', l.id,
              'title', l.title,
              'description', l.description,
              'contentType', l.content_type,
              'contentUrl', l.content_url,
              'duration', l.duration,
              'orderIndex', l.order_index
            ) ORDER BY l.order_index
          )
          FROM lessons l
          WHERE l.module_id = m.id
        ) as lessons
      FROM modules m
      WHERE m.track_id = ${id}
      ORDER BY m.order_index
    `;

    return reply.send({
      id: course.id,
      title: course.title,
      description: course.description,
      price: parseFloat(course.price) || 0,
      category: course.category,
      level: course.level.charAt(0).toUpperCase() + course.level.slice(1),
      thumbnailUrl: course.thumbnail_url,
      estimatedHours: course.estimated_hours,
      enrollmentCount: course.enrollment_count,
      averageRating: parseFloat(course.average_rating) || 0,
      format: course.format,
      learningStyle: course.learning_style,
      isFeatured: course.is_featured,
      isActive: course.is_active,
      certificationType: course.certification_type,
      completionRequirement: course.completion_requirement,
      instructor: {
        id: course.created_by,
        name: course.instructor_name || 'The Ready Lab',
        avatarUrl: course.instructor_avatar,
      },
      modules: modules.map((m: any) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        orderIndex: m.order_index,
        lessons: m.lessons || [],
      })),
      createdAt: course.created_at,
      updatedAt: course.updated_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to get course');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve course',
    });
  }
}

/**
 * Create a new course (track)
 */
export async function createCourse(
  request: FastifyRequest<{
    Body: {
      title: string;
      description?: string;
      price?: number;
      category: string;
      level?: string;
      thumbnailUrl?: string;
      estimatedHours?: number;
      format?: string;
      learningStyle?: string;
      createdBy?: string;
    };
  }>,
  reply: FastifyReply
) {
  const {
    title,
    description,
    price = 0,
    category,
    level = 'beginner',
    thumbnailUrl,
    estimatedHours = 1,
    format = 'Video',
    learningStyle = 'visual',
    createdBy,
  } = request.body;

  try {
    const [course] = await sql`
      INSERT INTO tracks (
        title,
        description,
        price,
        category,
        level,
        thumbnail_url,
        estimated_hours,
        format,
        learning_style,
        created_by
      )
      VALUES (
        ${title},
        ${description || null},
        ${price},
        ${category},
        ${level},
        ${thumbnailUrl || null},
        ${estimatedHours},
        ${format},
        ${learningStyle},
        ${createdBy || null}
      )
      RETURNING *
    `;

    return reply.code(201).send({
      id: course.id,
      title: course.title,
      description: course.description,
      price: parseFloat(course.price) || 0,
      category: course.category,
      level: course.level,
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
 * Update course
 */
export async function updateCourse(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      price?: number;
      category?: string;
      level?: string;
      thumbnailUrl?: string;
      estimatedHours?: number;
      format?: string;
      learningStyle?: string;
      isActive?: boolean;
      isFeatured?: boolean;
    };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;
  const updates = request.body;

  try {
    // Build dynamic update query
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
    if (updates.price !== undefined) {
      updateFields.push(`price = $${paramIndex++}`);
      values.push(updates.price);
    }
    if (updates.category !== undefined) {
      updateFields.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.level !== undefined) {
      updateFields.push(`level = $${paramIndex++}`);
      values.push(updates.level);
    }
    if (updates.thumbnailUrl !== undefined) {
      updateFields.push(`thumbnail_url = $${paramIndex++}`);
      values.push(updates.thumbnailUrl);
    }
    if (updates.estimatedHours !== undefined) {
      updateFields.push(`estimated_hours = $${paramIndex++}`);
      values.push(updates.estimatedHours);
    }
    if (updates.format !== undefined) {
      updateFields.push(`format = $${paramIndex++}`);
      values.push(updates.format);
    }
    if (updates.learningStyle !== undefined) {
      updateFields.push(`learning_style = $${paramIndex++}`);
      values.push(updates.learningStyle);
    }
    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }
    if (updates.isFeatured !== undefined) {
      updateFields.push(`is_featured = $${paramIndex++}`);
      values.push(updates.isFeatured);
    }

    if (updateFields.length === 0) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'No fields to update',
      });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE tracks
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const [course] = await sql.unsafe(query, values);

    if (!course) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Course not found',
      });
    }

    return reply.send({
      id: course.id,
      title: course.title,
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
      DELETE FROM tracks WHERE id = ${id} RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Course not found',
      });
    }

    return reply.code(204).send();
  } catch (error) {
    request.log.error(error, 'Failed to delete course');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to delete course',
    });
  }
}
