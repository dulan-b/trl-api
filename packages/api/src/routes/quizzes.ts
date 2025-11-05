import type { FastifyInstance } from 'fastify';
import {
  createQuiz,
  getQuizByLessonId,
  submitQuizAnswers,
  getQuizAttempts,
} from '../controllers/quizzes.js';
import { optionalAuth } from '../middleware/auth.js';

export async function quizRoutes(fastify: FastifyInstance) {
  // Create quiz for a lesson
  fastify.post('/', {
    onRequest: [optionalAuth],
    handler: createQuiz,
  });

  // Get quiz by lesson ID
  fastify.get('/lesson/:lessonId', {
    onRequest: [optionalAuth],
    handler: getQuizByLessonId,
  });

  // Submit quiz answers
  fastify.post('/:quizId/submit', {
    onRequest: [optionalAuth],
    handler: submitQuizAnswers,
  });

  // Get quiz attempts for a student
  fastify.get('/:quizId/attempts/:studentId', {
    onRequest: [optionalAuth],
    handler: getQuizAttempts,
  });
}
