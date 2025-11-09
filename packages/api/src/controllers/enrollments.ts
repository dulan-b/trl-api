import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Enroll a user in a track
 */
export async function enrollInCourse(
  request: FastifyRequest<{
    Body: {
      userId: string;
      trackId: string;
    };
  }>,
  reply: FastifyReply
) {
  const { userId, trackId } = request.body;

  try {
    // Check if user exists
    const [user] = await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `;

    if (!user) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    // Check if track exists
    const [track] = await sql`
      SELECT * FROM tracks WHERE id = ${trackId}
    `;

    if (!track) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Track not found',
      });
    }

    // Check if already enrolled
    const [existingEnrollment] = await sql`
      SELECT * FROM enrollments
      WHERE user_id = ${userId} AND track_id = ${trackId}
    `;

    if (existingEnrollment) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'Already enrolled in this track',
      });
    }

    // Create enrollment
    const [enrollment] = await sql`
      INSERT INTO enrollments (
        user_id,
        track_id,
        status,
        progress
      )
      VALUES (
        ${userId},
        ${trackId},
        'active',
        0
      )
      RETURNING *
    `;

    request.log.info(
      { enrollmentId: enrollment.id, userId, trackId },
      'User enrolled in track'
    );

    return reply.code(201).send({
      id: enrollment.id,
      userId: enrollment.user_id,
      trackId: enrollment.track_id,
      status: enrollment.status,
      progress: enrollment.progress,
      enrolledAt: enrollment.enrolled_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to enroll in track');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to enroll in track',
    });
  }
}

/**
 * Get enrollment by ID
 */
export async function getEnrollmentById(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const [enrollment] = await sql`
      SELECT
        e.*,
        t.title as track_title,
        t.description as track_description,
        t.thumbnail_url as track_thumbnail,
        p.full_name as user_name
      FROM enrollments e
      JOIN tracks t ON e.track_id = t.id
      JOIN profiles p ON e.user_id = p.id
      WHERE e.id = ${id}
    `;

    if (!enrollment) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Enrollment not found',
      });
    }

    return reply.send({
      id: enrollment.id,
      userId: enrollment.user_id,
      userName: enrollment.user_name,
      track: {
        id: enrollment.track_id,
        title: enrollment.track_title,
        description: enrollment.track_description,
        thumbnailUrl: enrollment.track_thumbnail,
      },
      status: enrollment.status,
      progress: enrollment.progress,
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to get enrollment');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve enrollment',
    });
  }
}

/**
 * List user's enrollments
 */
export async function listStudentEnrollments(
  request: FastifyRequest<{
    Params: { studentId: string };
  }>,
  reply: FastifyReply
) {
  const { studentId: userId } = request.params;

  try {
    const enrollments = await sql`
      SELECT
        e.*,
        t.title as track_title,
        t.description as track_description,
        t.thumbnail_url as track_thumbnail,
        t.category
      FROM enrollments e
      JOIN tracks t ON e.track_id = t.id
      WHERE e.user_id = ${userId}
      ORDER BY e.enrolled_at DESC
    `;

    return reply.send({
      enrollments: enrollments.map((enrollment) => ({
        id: enrollment.id,
        track: {
          id: enrollment.track_id,
          title: enrollment.track_title,
          description: enrollment.track_description,
          thumbnailUrl: enrollment.track_thumbnail,
          category: enrollment.category,
        },
        status: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: enrollment.enrolled_at,
        completedAt: enrollment.completed_at,
      })),
    });
  } catch (error) {
    request.log.error(error, 'Failed to list enrollments');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to list enrollments',
    });
  }
}

/**
 * Complete a lesson
 */
export async function completeLesson(
  request: FastifyRequest<{
    Params: { id: string; lessonId: string };
    Body: {
      timeSpent?: number;
      lastPosition?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { id: enrollmentId, lessonId } = request.params;
  const { timeSpent = 0, lastPosition = 0 } = request.body;

  try {
    // Get enrollment to find user_id
    const [enrollment] = await sql`
      SELECT * FROM enrollments WHERE id = ${enrollmentId}
    `;

    if (!enrollment) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Enrollment not found',
      });
    }

    // Check if lesson exists
    const [lesson] = await sql`
      SELECT * FROM lessons WHERE id = ${lessonId}
    `;

    if (!lesson) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Lesson not found',
      });
    }

    // Update or create lesson progress
    const [existingProgress] = await sql`
      SELECT * FROM lesson_progress
      WHERE user_id = ${enrollment.user_id} AND lesson_id = ${lessonId}
    `;

    let progress;
    if (existingProgress) {
      [progress] = await sql`
        UPDATE lesson_progress
        SET
          completed = true,
          watched_duration = ${timeSpent},
          last_watched_at = NOW(),
          updated_at = NOW()
        WHERE id = ${existingProgress.id}
        RETURNING *
      `;
    } else {
      [progress] = await sql`
        INSERT INTO lesson_progress (
          user_id,
          lesson_id,
          completed,
          watched_duration,
          last_watched_at
        )
        VALUES (
          ${enrollment.user_id},
          ${lessonId},
          true,
          ${timeSpent},
          NOW()
        )
        RETURNING *
      `;
    }

    request.log.info(
      { enrollmentId, lessonId, userId: enrollment.user_id },
      'Lesson completed'
    );

    return reply.send({
      lessonId: progress.lesson_id,
      completed: progress.completed,
      watchedDuration: progress.watched_duration,
      lastWatchedAt: progress.last_watched_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to complete lesson');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to complete lesson',
    });
  }
}

/**
 * Get enrollment progress
 */
export async function getEnrollmentProgress(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const [enrollment] = await sql`
      SELECT * FROM enrollments WHERE id = ${id}
    `;

    if (!enrollment) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Enrollment not found',
      });
    }

    return reply.send({
      enrollmentId: enrollment.id,
      progress: enrollment.progress,
      status: enrollment.status,
      completedAt: enrollment.completed_at,
    });
  } catch (error) {
    request.log.error(error, 'Failed to get enrollment progress');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve enrollment progress',
    });
  }
}
