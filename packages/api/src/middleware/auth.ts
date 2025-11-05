import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthContext } from '@trl/shared';

/**
 * Authentication middleware - STUBBED for future implementation
 *
 * TODO: Integrate with Supabase Auth
 * - Extract JWT token from Authorization header
 * - Verify token with Supabase
 * - Attach user context to request
 *
 * For now, this allows all requests through
 */

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // STUB: For now, set authentication context as unauthenticated
  // In production, this would:
  // 1. Extract JWT from header: const token = request.headers.authorization?.split(' ')[1]
  // 2. Verify with Supabase: const { data, error } = await supabase.auth.getUser(token)
  // 3. Set user context: request.auth = { userId: data.user.id, ... }

  request.auth = {
    isAuthenticated: false,
    // userId: undefined,
    // userRole: undefined,
  };
}

/**
 * Optional authentication - runs auth middleware but doesn't require auth
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await authMiddleware(request, reply);
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await authMiddleware(request, reply);

  if (!request.auth.isAuthenticated) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }
}

/**
 * Require specific role
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);

    if (!request.auth.userRole || !roles.includes(request.auth.userRole)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
      });
    }
  };
}
