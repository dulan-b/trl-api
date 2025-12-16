import type { FastifyInstance } from 'fastify';
import {
  listMicroLessons,
  getMicroLessonById,
  createMicroLesson,
  updateMicroLesson,
  deleteMicroLesson,
  likeMicroLesson,
  unlikeMicroLesson,
  getMicroLessonComments,
  addMicroLessonComment,
  deleteMicroLessonComment,
} from '../controllers/microLessons.js';
import { optionalAuth } from '../middleware/auth.js';

export async function microLessonRoutes(fastify: FastifyInstance) {
  // List micro lessons (with filtering)
  fastify.get('/', { onRequest: [optionalAuth], handler: listMicroLessons });

  // Get micro lesson by ID
  fastify.get('/:id', { onRequest: [optionalAuth], handler: getMicroLessonById });

  // Create micro lesson
  fastify.post('/', { onRequest: [optionalAuth], handler: createMicroLesson });

  // Update micro lesson
  fastify.put('/:id', { onRequest: [optionalAuth], handler: updateMicroLesson });

  // Delete micro lesson
  fastify.delete('/:id', { onRequest: [optionalAuth], handler: deleteMicroLesson });

  // Like/unlike micro lesson
  fastify.post('/:id/like', { onRequest: [optionalAuth], handler: likeMicroLesson });
  fastify.delete('/:id/like', { onRequest: [optionalAuth], handler: unlikeMicroLesson });

  // Comments
  fastify.get('/:id/comments', { onRequest: [optionalAuth], handler: getMicroLessonComments });
  fastify.post('/:id/comments', { onRequest: [optionalAuth], handler: addMicroLessonComment });
  fastify.delete('/:id/comments/:commentId', { onRequest: [optionalAuth], handler: deleteMicroLessonComment });
}
