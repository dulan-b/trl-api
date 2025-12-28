import type { FastifyInstance } from 'fastify';
import { login, signup, getCurrentUser } from '../controllers/auth.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', { handler: login });

  // Signup
  fastify.post('/signup', { handler: signup });

  // Get current user (requires token)
  fastify.get('/me', { handler: getCurrentUser });
}
