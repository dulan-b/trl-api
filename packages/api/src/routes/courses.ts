import type { FastifyInstance } from 'fastify';
import {
  createCourse,
  getCourseById,
  updateCourse,
  deleteCourse,
  listCourses,
} from '../controllers/courses.js';
import { optionalAuth } from '../middleware/auth.js';

export async function courseRoutes(fastify: FastifyInstance) {
  // List courses (explore/browse)
  fastify.get('/', {
    onRequest: [optionalAuth],
    handler: listCourses,
  });

  // Get course by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getCourseById,
  });

  // Create course
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createCourse,
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
}
