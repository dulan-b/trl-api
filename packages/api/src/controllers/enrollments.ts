import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import type { EnrollmentRequest, CompletelessonRequest } from '@trl/shared';

/**
 * Enroll a student in a course
 */
export async function enrollInCourse(
  request: FastifyRequest<{
    Body: EnrollmentRequest;
  }>,
  reply: FastifyReply
) {
  const { courseId, studentId } = request.body;

  try {
    // Check if student exists
    const [student] = await sql`
      SELECT * FROM student_profiles WHERE user_id = ${studentId}
    `;

    if (!student) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Student not found',
      });
    }

    // Check if course exists and is published
    const [course] = await sql`
      SELECT * FROM courses WHERE id = ${courseId}
    `;

    if (!course) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Course not found',
      });
    }

    if (!course.is_published) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Cannot enroll in unpublished course',
      });
    }

    // Check if already enrolled
    const [existingEnrollment] = await sql`
      SELECT * FROM enrollments
      WHERE student_id = ${studentId} AND course_id = ${courseId}
    `;

    if (existingEnrollment) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'Already enrolled in this course',
      });
    }

    // Create enrollment
    const [enrollment] = await sql`
      INSERT INTO enrollments (
        student_id,
        course_id,
        progress_percentage
      )
      VALUES (
        ${studentId},
        ${courseId},
        0
      )
      RETURNING *
    `;

    // Update course total enrollments
    await sql`
      UPDATE courses
      SET total_enrollments = total_enrollments + 1
      WHERE id = ${courseId}
    `;

    request.log.info(
      { enrollmentId: enrollment.id, studentId, courseId },
      'Student enrolled in course'
    );

    return reply.code(201).send({
      id: enrollment.id,
      studentId: enrollment.student_id,
      courseId: enrollment.course_id,
      enrolledAt: enrollment.enrolled_at,
      progressPercentage: enrollment.progress_percentage,
    });
  } catch (error) {
    request.log.error(error, 'Failed to enroll in course');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to enroll in course',
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
        c.title as course_title,
        c.description as course_description,
        c.thumbnail_url as course_thumbnail,
        up.full_name as student_name
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      JOIN user_profiles up ON e.student_id = up.id
      WHERE e.id = ${id}
    `;

    if (!enrollment) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Enrollment not found',
      });
    }

    // Get last accessed lesson info if exists
    let lastAccessedLesson = null;
    if (enrollment.last_accessed_lesson_id) {
      const [lesson] = await sql`
        SELECT id, title FROM lessons
        WHERE id = ${enrollment.last_accessed_lesson_id}
      `;
      if (lesson) {
        lastAccessedLesson = {
          id: lesson.id,
          title: lesson.title,
        };
      }
    }

    return reply.send({
      id: enrollment.id,
      studentId: enrollment.student_id,
      studentName: enrollment.student_name,
      course: {
        id: enrollment.course_id,
        title: enrollment.course_title,
        description: enrollment.course_description,
        thumbnailUrl: enrollment.course_thumbnail,
      },
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at,
      progressPercentage: enrollment.progress_percentage,
      lastAccessedLesson,
      lastAccessedAt: enrollment.last_accessed_at,
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
 * List student's enrollments
 */
export async function listStudentEnrollments(
  request: FastifyRequest<{
    Params: { studentId: string };
  }>,
  reply: FastifyReply
) {
  const { studentId } = request.params;

  try {
    const enrollments = await sql`
      SELECT
        e.*,
        c.title as course_title,
        c.description as course_description,
        c.thumbnail_url as course_thumbnail,
        c.course_type
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.student_id = ${studentId}
      ORDER BY e.enrolled_at DESC
    `;

    return reply.send({
      enrollments: enrollments.map((enrollment) => ({
        id: enrollment.id,
        course: {
          id: enrollment.course_id,
          title: enrollment.course_title,
          description: enrollment.course_description,
          thumbnailUrl: enrollment.course_thumbnail,
          courseType: enrollment.course_type,
        },
        enrolledAt: enrollment.enrolled_at,
        completedAt: enrollment.completed_at,
        progressPercentage: enrollment.progress_percentage,
        lastAccessedAt: enrollment.last_accessed_at,
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
    Body: CompletelessonRequest;
  }>,
  reply: FastifyReply
) {
  const { id: enrollmentId, lessonId } = request.params;
  const { timeSpent = 0, lastPosition = 0 } = request.body;

  try {
    // Check if enrollment exists
    const [enrollment] = await sql`
      SELECT * FROM enrollments WHERE id = ${enrollmentId}
    `;

    if (!enrollment) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Enrollment not found',
      });
    }

    // Check if lesson exists and belongs to the enrolled course
    const [lesson] = await sql`
      SELECT * FROM lessons
      WHERE id = ${lessonId} AND course_id = ${enrollment.course_id}
    `;

    if (!lesson) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Lesson not found or does not belong to this course',
      });
    }

    // Check if lesson progress already exists
    const [existingProgress] = await sql`
      SELECT * FROM lesson_progress
      WHERE enrollment_id = ${enrollmentId} AND lesson_id = ${lessonId}
    `;

    let progress;
    if (existingProgress) {
      // Update existing progress
      [progress] = await sql`
        UPDATE lesson_progress
        SET
          completed = true,
          completed_at = NOW(),
          time_spent = ${timeSpent},
          last_position = ${lastPosition}
        WHERE id = ${existingProgress.id}
        RETURNING *
      `;
    } else {
      // Create new progress record
      [progress] = await sql`
        INSERT INTO lesson_progress (
          enrollment_id,
          lesson_id,
          completed,
          completed_at,
          time_spent,
          last_position
        )
        VALUES (
          ${enrollmentId},
          ${lessonId},
          true,
          NOW(),
          ${timeSpent},
          ${lastPosition}
        )
        RETURNING *
      `;
    }

    // Update enrollment's last accessed lesson
    await sql`
      UPDATE enrollments
      SET
        last_accessed_lesson_id = ${lessonId},
        last_accessed_at = NOW()
      WHERE id = ${enrollmentId}
    `;

    // Calculate progress percentage
    const [totalLessons] = await sql`
      SELECT COUNT(*) as count FROM lessons
      WHERE course_id = ${enrollment.course_id}
    `;

    const [completedLessons] = await sql`
      SELECT COUNT(*) as count FROM lesson_progress
      WHERE enrollment_id = ${enrollmentId} AND completed = true
    `;

    const progressPercentage = Math.round(
      (completedLessons.count / totalLessons.count) * 100
    );

    // Update enrollment progress
    const updateResult = await sql`
      UPDATE enrollments
      SET
        progress_percentage = ${progressPercentage},
        completed_at = CASE
          WHEN ${progressPercentage} = 100 THEN NOW()
          ELSE completed_at
        END
      WHERE id = ${enrollmentId}
      RETURNING *
    `;

    // If course is now completed, update course stats
    if (progressPercentage === 100 && !enrollment.completed_at) {
      await sql`
        UPDATE courses
        SET total_completions = total_completions + 1
        WHERE id = ${enrollment.course_id}
      `;
    }

    request.log.info(
      { enrollmentId, lessonId, progressPercentage },
      'Lesson completed'
    );

    return reply.send({
      lessonId: progress.lesson_id,
      completed: progress.completed,
      completedAt: progress.completed_at,
      progressPercentage,
      courseCompleted: progressPercentage === 100,
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
    // Get enrollment
    const [enrollment] = await sql`
      SELECT * FROM enrollments WHERE id = ${id}
    `;

    if (!enrollment) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Enrollment not found',
      });
    }

    // Get all lessons for the course with progress info
    const lessons = await sql`
      SELECT
        l.id,
        l.title,
        l.lesson_type,
        l.order_index,
        l.duration,
        lp.completed,
        lp.completed_at,
        lp.time_spent,
        lp.last_position
      FROM lessons l
      LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.enrollment_id = ${id}
      WHERE l.course_id = ${enrollment.course_id}
      ORDER BY l.order_index ASC
    `;

    return reply.send({
      enrollmentId: enrollment.id,
      progressPercentage: enrollment.progress_percentage,
      completedAt: enrollment.completed_at,
      lessons: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        lessonType: lesson.lesson_type,
        orderIndex: lesson.order_index,
        duration: lesson.duration,
        completed: lesson.completed || false,
        completedAt: lesson.completed_at,
        timeSpent: lesson.time_spent || 0,
        lastPosition: lesson.last_position || 0,
      })),
    });
  } catch (error) {
    request.log.error(error, 'Failed to get enrollment progress');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve enrollment progress',
    });
  }
}
