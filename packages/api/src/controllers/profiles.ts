import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

interface ProfileParams {
  id: string;
}

interface CreateProfileBody {
  email: string;
  full_name?: string;
  role?: 'student' | 'educator' | 'institution' | 'admin';
  subscription_status?: string;
  subscription_tier?: string;
  avatar_url?: string;
}

interface UpdateProfileBody {
  full_name?: string;
  role?: string;
  subscription_status?: string;
  subscription_tier?: string;
  avatar_url?: string;
}

/**
 * Get profile by ID
 */
export async function getProfileById(
  request: FastifyRequest<{ Params: ProfileParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const result = await sql`
      SELECT *
      FROM profiles
      WHERE id = ${id}
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Profile not found',
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
 * Create new profile
 */
export async function createProfile(
  request: FastifyRequest<{ Body: CreateProfileBody }>,
  reply: FastifyReply
) {
  try {
    const {
      email,
      full_name,
      role = 'student',
      subscription_status = 'trial',
      subscription_tier,
      avatar_url,
    } = request.body;

    // Check if email already exists
    const existing = await sql`
      SELECT id FROM profiles WHERE email = ${email}
    `;

    if (existing.length > 0) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'Email already exists',
      });
    }

    const result = await sql`
      INSERT INTO profiles (
        email,
        full_name,
        role,
        subscription_status,
        subscription_tier,
        avatar_url
      )
      VALUES (
        ${email},
        ${full_name || null},
        ${role},
        ${subscription_status},
        ${subscription_tier || null},
        ${avatar_url || null}
      )
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
 * Update profile
 */
export async function updateProfile(
  request: FastifyRequest<{ Params: ProfileParams; Body: UpdateProfileBody }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const updates = request.body;

    // Build dynamic update query
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.full_name !== undefined) {
      setClauses.push(`full_name = $${paramCount++}`);
      values.push(updates.full_name);
    }
    if (updates.role !== undefined) {
      setClauses.push(`role = $${paramCount++}`);
      values.push(updates.role);
    }
    if (updates.subscription_status !== undefined) {
      setClauses.push(`subscription_status = $${paramCount++}`);
      values.push(updates.subscription_status);
    }
    if (updates.subscription_tier !== undefined) {
      setClauses.push(`subscription_tier = $${paramCount++}`);
      values.push(updates.subscription_tier);
    }
    if (updates.avatar_url !== undefined) {
      setClauses.push(`avatar_url = $${paramCount++}`);
      values.push(updates.avatar_url);
    }

    if (setClauses.length === 0) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'No fields to update',
      });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await sql`
      UPDATE profiles
      SET ${sql(setClauses.join(', '))}
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Profile not found',
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
 * List all profiles (with pagination)
 */
export async function listProfiles(
  request: FastifyRequest<{
    Querystring: { limit?: number; offset?: number; role?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { limit = 50, offset = 0, role } = request.query;

    let query;
    if (role) {
      query = sql`
        SELECT *
        FROM profiles
        WHERE role = ${role}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT *
        FROM profiles
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    const profiles = await query;

    return reply.send({
      data: profiles,
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
