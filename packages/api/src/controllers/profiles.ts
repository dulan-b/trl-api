import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

interface ProfileParams {
  id: string;
}

interface CreateProfileBody {
  id?: string; // Allow passing ID from Supabase auth
  email: string;
  full_name?: string;
  role?: 'student' | 'educator' | 'admin';
  subscription_status?: string;
  subscription_tier?: string;
  avatar_url?: string;
  preferred_language?: string;
  show_content_in_language_first?: boolean;
}

interface UpdateProfileBody {
  full_name?: string;
  role?: string;
  subscription_status?: string;
  subscription_tier?: string;
  avatar_url?: string;
  preferred_language?: string;
  show_content_in_language_first?: boolean;
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
      id,
      email,
      full_name,
      role = 'student',
      subscription_status = 'trial',
      subscription_tier,
      avatar_url,
      preferred_language,
      show_content_in_language_first,
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

    // If ID is provided (from Supabase auth), use it; otherwise let DB generate
    const result = id
      ? await sql`
          INSERT INTO profiles (
            id,
            email,
            full_name,
            role,
            subscription_status,
            subscription_tier,
            avatar_url,
            preferred_language,
            show_content_in_language_first
          )
          VALUES (
            ${id},
            ${email},
            ${full_name || null},
            ${role},
            ${subscription_status},
            ${subscription_tier || null},
            ${avatar_url || null},
            ${preferred_language || null},
            ${show_content_in_language_first ?? null}
          )
          RETURNING *
        `
      : await sql`
          INSERT INTO profiles (
            email,
            full_name,
            role,
            subscription_status,
            subscription_tier,
            avatar_url,
            preferred_language,
            show_content_in_language_first
          )
          VALUES (
            ${email},
            ${full_name || null},
            ${role},
            ${subscription_status},
            ${subscription_tier || null},
            ${avatar_url || null},
            ${preferred_language || null},
            ${show_content_in_language_first ?? null}
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

    // Check if any fields to update
    const hasUpdates = Object.keys(updates).length > 0;
    if (!hasUpdates) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'No fields to update',
      });
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (updates.full_name !== undefined) updateData.full_name = updates.full_name;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.subscription_status !== undefined) updateData.subscription_status = updates.subscription_status;
    if (updates.subscription_tier !== undefined) updateData.subscription_tier = updates.subscription_tier;
    if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;
    if (updates.preferred_language !== undefined) updateData.preferred_language = updates.preferred_language;
    if (updates.show_content_in_language_first !== undefined) updateData.show_content_in_language_first = updates.show_content_in_language_first;

    const result = await sql`
      UPDATE profiles
      SET ${sql(updateData)}, updated_at = NOW()
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
