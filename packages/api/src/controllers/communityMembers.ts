import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Community Members Controller
 */

interface CommunityParams {
  communityId: string;
}

interface MemberParams {
  communityId: string;
  userId: string;
}

interface JoinCommunityBody {
  user_id: string;
  role?: 'member' | 'moderator' | 'admin';
}

interface UpdateMemberRoleBody {
  role: 'member' | 'moderator' | 'admin';
}

/**
 * List community members
 */
export async function listCommunityMembers(
  request: FastifyRequest<{
    Params: CommunityParams;
    Querystring: { limit?: number; offset?: number; role?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { communityId } = request.params;
    const { limit = 50, offset = 0, role } = request.query;

    let query;
    if (role) {
      query = sql`
        SELECT cm.*, p.full_name, p.avatar_url, p.email
        FROM community_members cm
        LEFT JOIN profiles p ON cm.user_id = p.id
        WHERE cm.community_id = ${communityId} AND cm.role = ${role}
        ORDER BY cm.joined_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT cm.*, p.full_name, p.avatar_url, p.email
        FROM community_members cm
        LEFT JOIN profiles p ON cm.user_id = p.id
        WHERE cm.community_id = ${communityId}
        ORDER BY cm.joined_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const members = await query;
    return reply.send({ data: members, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Join community
 */
export async function joinCommunity(
  request: FastifyRequest<{ Params: CommunityParams; Body: JoinCommunityBody }>,
  reply: FastifyReply
) {
  try {
    const { communityId } = request.params;
    const { user_id, role = 'member' } = request.body;

    // Check if user is banned
    const banned = await sql`
      SELECT id FROM community_bans
      WHERE community_id = ${communityId} AND user_id = ${user_id}
    `;
    if (banned.length > 0) {
      return reply.code(403).send({ error: 'Forbidden', message: 'User is banned from this community' });
    }

    // Check if already a member
    const existing = await sql`
      SELECT id FROM community_members
      WHERE community_id = ${communityId} AND user_id = ${user_id}
    `;
    if (existing.length > 0) {
      return reply.code(409).send({ error: 'Conflict', message: 'User is already a member' });
    }

    const result = await sql`
      INSERT INTO community_members (community_id, user_id, role)
      VALUES (${communityId}, ${user_id}, ${role})
      RETURNING *
    `;

    // Update member count
    await sql`
      UPDATE communities
      SET member_count = member_count + 1
      WHERE id = ${communityId}
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Leave community
 */
export async function leaveCommunity(
  request: FastifyRequest<{ Params: MemberParams }>,
  reply: FastifyReply
) {
  try {
    const { communityId, userId } = request.params;

    const result = await sql`
      DELETE FROM community_members
      WHERE community_id = ${communityId} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Member not found' });
    }

    // Update member count
    await sql`
      UPDATE communities
      SET member_count = GREATEST(member_count - 1, 0)
      WHERE id = ${communityId}
    `;

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Update member role
 */
export async function updateMemberRole(
  request: FastifyRequest<{ Params: MemberParams; Body: UpdateMemberRoleBody }>,
  reply: FastifyReply
) {
  try {
    const { communityId, userId } = request.params;
    const { role } = request.body;

    const result = await sql`
      UPDATE community_members
      SET role = ${role}, updated_at = NOW()
      WHERE community_id = ${communityId} AND user_id = ${userId}
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
