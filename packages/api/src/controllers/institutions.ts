import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Institutions Controller
 * B2B organizations with bulk access
 */

interface InstitutionParams {
  id: string;
}

interface CreateInstitutionBody {
  name: string;
  description?: string;
  logo_url?: string;
  admin_user_id: string;
  subscription_tier?: string;
  max_members?: number;
}

/**
 * Get institution by ID
 */
export async function getInstitutionById(
  request: FastifyRequest<{ Params: InstitutionParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const result = await sql`SELECT * FROM institutions WHERE id = ${id}`;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Institution not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Create institution
 */
export async function createInstitution(
  request: FastifyRequest<{ Body: CreateInstitutionBody }>,
  reply: FastifyReply
) {
  try {
    const {
      name,
      description,
      logo_url,
      admin_user_id,
      subscription_tier = 'basic',
      max_members = 50,
    } = request.body;

    const result = await sql`
      INSERT INTO institutions (
        name, description, logo_url, admin_user_id, subscription_tier, max_members
      )
      VALUES (
        ${name}, ${description || null}, ${logo_url || null},
        ${admin_user_id}, ${subscription_tier}, ${max_members}
      )
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Update institution
 */
export async function updateInstitution(
  request: FastifyRequest<{
    Params: InstitutionParams;
    Body: Partial<CreateInstitutionBody>;
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const updates = request.body;

    const updateData: Record<string, any> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url;
    if (updates.subscription_tier !== undefined) updateData.subscription_tier = updates.subscription_tier;
    if (updates.max_members !== undefined) updateData.max_members = updates.max_members;

    if (Object.keys(updateData).length === 0) {
      return reply.code(400).send({ error: 'Bad Request', message: 'No fields to update' });
    }

    const result = await sql`
      UPDATE institutions
      SET ${sql(updateData)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Institution not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * List institution members
 */
export async function listInstitutionMembers(
  request: FastifyRequest<{
    Params: InstitutionParams;
    Querystring: { limit?: number; offset?: number };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { limit = 50, offset = 0 } = request.query;

    const members = await sql`
      SELECT im.*, p.full_name, p.email, p.avatar_url
      FROM institution_members im
      LEFT JOIN profiles p ON im.user_id = p.id
      WHERE im.institution_id = ${id}
      ORDER BY im.joined_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return reply.send({ data: members, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Add member to institution
 */
export async function addInstitutionMember(
  request: FastifyRequest<{
    Params: InstitutionParams;
    Body: { user_id: string; role?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { user_id, role = 'member' } = request.body;

    // Check max members
    const institution = await sql`SELECT max_members FROM institutions WHERE id = ${id}`;
    if (institution.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Institution not found' });
    }

    const currentCount = await sql`
      SELECT COUNT(*) as count FROM institution_members WHERE institution_id = ${id}
    `;

    if (Number(currentCount[0].count) >= institution[0].max_members) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Institution has reached max members' });
    }

    const result = await sql`
      INSERT INTO institution_members (institution_id, user_id, role)
      VALUES (${id}, ${user_id}, ${role})
      RETURNING *
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return reply.code(409).send({ error: 'Conflict', message: 'User is already a member' });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Remove member from institution
 */
export async function removeInstitutionMember(
  request: FastifyRequest<{ Params: { id: string; userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { id, userId } = request.params;

    const result = await sql`
      DELETE FROM institution_members
      WHERE institution_id = ${id} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Member not found' });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Update member role in institution
 */
export async function updateInstitutionMemberRole(
  request: FastifyRequest<{
    Params: { id: string; userId: string };
    Body: { role: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id, userId } = request.params;
    const { role } = request.body;

    const result = await sql`
      UPDATE institution_members
      SET role = ${role}, updated_at = NOW()
      WHERE institution_id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Member not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
