import type { FastifyInstance } from 'fastify';
import {
  createLesson,
  getLessonById,
  updateLesson,
  deleteLesson,
  listLessons,
  getLessonsFeed,
} from '../controllers/lessons.js';
import { optionalAuth } from '../middleware/auth.js';

export async function lessonRoutes(fastify: FastifyInstance) {
  // Learning feed - lessons with optional related data (module, track, progress)
  // TRANSITIONAL: Uses include param, see controller for TODO notes
  fastify.get('/feed', {
    onRequest: [optionalAuth],
    handler: getLessonsFeed,
  });

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
