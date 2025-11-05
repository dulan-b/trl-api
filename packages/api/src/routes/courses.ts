import type { FastifyInstance } from 'fastify';
import {
  createCourse,
  getCourseById,
  updateCourse,
  deleteCourse,
  listCourses,
  publishCourse,
} from '../controllers/courses.js';
import { optionalAuth } from '../middleware/auth.js';

export async function courseRoutes(fastify: FastifyInstance) {
  // Create course
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createCourse,
  });

  // Get course by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getCourseById,
  });

  // Update course
  fastify.put('/:id', {
    onRequest: [optionalAuth],
    handler: updateCourse,
  });

  // Delete course
  fastify.delete('/:id', {
    onRequest: [optionalAuth],
    handler: deleteCourse,
  });

  // List courses (explore/browse)
  fastify.get('/', {
    onRequest: [optionalAuth],
    handler: listCourses,
  });

  // Publish course
  fastify.post('/:id/publish', {
    onRequest: [optionalAuth],
    handler: publishCourse,
  });
}
