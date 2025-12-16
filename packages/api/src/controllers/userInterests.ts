import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

interface UserIdParams {
  userId: string;
}

interface InterestParams {
  userId: string;
  interestTag: string;
}

interface CreateInterestBody {
  interest_tag: string;
}

interface BulkInterestsBody {
  interest_tags: string[];
}

/**
 * Get all interests for a user
 */
export async function getUserInterests(
  request: FastifyRequest<{ Params: UserIdParams }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;

    const result = await sql`
      SELECT *
      FROM user_interests
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return reply.send({
      data: result,
      user_id: userId,
    });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Add interest for a user
 */
export async function addUserInterest(
  request: FastifyRequest<{ Params: UserIdParams; Body: CreateInterestBody }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const { interest_tag } = request.body;

    if (!interest_tag || interest_tag.trim() === '') {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Interest tag is required',
      });
    }

    // Check if already exists
    const existing = await sql`
      SELECT id FROM user_interests
      WHERE user_id = ${userId} AND interest_tag = ${interest_tag}
    `;

    if (existing.length > 0) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'Interest already exists for this user',
      });
    }

    const result = await sql`
      INSERT INTO user_interests (user_id, interest_tag)
      VALUES (${userId}, ${interest_tag})
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
 * Bulk set interests for a user (replaces all existing)
 */
export async function setUserInterests(
  request: FastifyRequest<{ Params: UserIdParams; Body: BulkInterestsBody }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const { interest_tags } = request.body;

    if (!Array.isArray(interest_tags)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'interest_tags must be an array',
      });
    }

    // Delete existing interests
    await sql`
      DELETE FROM user_interests
      WHERE user_id = ${userId}
    `;

    // Insert new interests if any
    if (interest_tags.length > 0) {
      const values = interest_tags.map(tag => ({
        user_id: userId,
        interest_tag: tag,
      }));

      await sql`
        INSERT INTO user_interests ${sql(values)}
      `;
    }

    // Return the new interests
    const result = await sql`
      SELECT *
      FROM user_interests
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return reply.send({
      data: result,
      user_id: userId,
    });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}

/**
 * Remove interest for a user
 */
export async function removeUserInterest(
  request: FastifyRequest<{ Params: InterestParams }>,
  reply: FastifyReply
) {
  try {
    const { userId, interestTag } = request.params;

    const result = await sql`
      DELETE FROM user_interests
      WHERE user_id = ${userId} AND interest_tag = ${interestTag}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Interest not found for this user',
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
