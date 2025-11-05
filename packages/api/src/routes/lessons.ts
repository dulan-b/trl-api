import type { FastifyInstance } from 'fastify';
import {
  createLesson,
  getLessonById,
  updateLesson,
  deleteLesson,
  listLessons,
} from '../controllers/lessons.js';
import { optionalAuth } from '../middleware/auth.js';

export async function lessonRoutes(fastify: FastifyInstance) {
  // Create lesson
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createLesson,
  });

  // Get lesson by ID
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    handler: getLessonById,
  });

  // Update lesson
  fastify.put('/:id', {
    onRequest: [optionalAuth],
    handler: updateLesson,
  });

  // Delete lesson
  fastify.delete('/:id', {
    onRequest: [optionalAuth],
    handler: deleteLesson,
  });

  // List lessons for a course
  fastify.get('/', {
    onRequest: [optionalAuth],
    handler: listLessons,
  });
}
