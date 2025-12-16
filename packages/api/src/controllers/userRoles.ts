import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

type UserRole = 'student' | 'educator' | 'admin';

interface UserIdParams {
  userId: string;
}

interface CreateUserRoleBody {
  user_id: string;
  role: UserRole;
}

interface UpdateUserRoleBody {
  role: UserRole;
}

/**
 * Get user role by user ID
 */
export async function getUserRole(
  request: FastifyRequest<{ Params: UserIdParams }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;

    const result = await sql`
      SELECT *
      FROM user_roles
      WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'User role not found',
      });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Create or set user role
 */
export async function createUserRole(
  request: FastifyRequest<{ Body: CreateUserRoleBody }>,
  reply: FastifyReply
) {
  try {
    const { user_id, role } = request.body;

    // Validate role
    const validRoles: UserRole[] = ['student', 'educator', 'admin'];
    if (!validRoles.includes(role)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Upsert - insert or update if exists
    const result = await sql`
      INSERT INTO user_roles (user_id, role)
      VALUES (${user_id}, ${role})
      ON CONFLICT (user_id)
      DO UPDATE SET role = ${role}, updated_at = NOW()
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Update user role
 */
export async function updateUserRole(
  request: FastifyRequest<{ Params: UserIdParams; Body: UpdateUserRoleBody }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const { role } = request.body;

    // Validate role
    const validRoles: UserRole[] = ['student', 'educator', 'admin'];
    if (!validRoles.includes(role)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    const result = await sql`
      UPDATE user_roles
      SET role = ${role}, updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'User role not found',
      });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Delete user role
 */
export async function deleteUserRole(
  request: FastifyRequest<{ Params: UserIdParams }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;

    const result = await sql`
      DELETE FROM user_roles
      WHERE user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'User role not found',
      });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
