import type { FastifyInstance } from 'fastify';
import {
  enrollInCourse,
  getEnrollmentById,
  listStudentEnrollments,
  completeLesson,
  getEnrollmentProgress,
} from '../controllers/enrollments.js';
import { optionalAuth } from '../middleware/auth.js';

export async function enrollmentRoutes(fastify: FastifyInstance) {
  // Enroll in course
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: enrollInCourse,
  });

  // Get enrollment by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getEnrollmentById,
  });

  // List student's enrollments
  fastify.get('/student/:studentId', {
    onRequest: [optionalAuth],
    handler: listStudentEnrollments,
  });

  // Complete lesson
  fastify.post('/:id/lessons/:lessonId/complete', {
    onRequest: [optionalAuth],
    handler: completeLesson,
  });

  // Get enrollment progress
  fastify.get('/:id/progress', {
    onRequest: [optionalAuth],
    handler: getEnrollmentProgress,
  });
}
