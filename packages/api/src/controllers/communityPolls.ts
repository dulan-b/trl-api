import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Community Polls Controller
 * Handles CRUD operations for community polls with voting functionality
 */

interface PollParams {
  id: string;
}

interface CreatePollBody {
  created_by: string;
  question: string;
  options: string[];
  ends_at?: string;
}

interface VoteBody {
  user_id: string;
  option_id: string;
}

/**
 * List active polls
 */
export async function listPolls(
  request: FastifyRequest<{
    Querystring: {
      is_active?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const limit = parseInt(request.query.limit || '10', 10);
    const offset = parseInt(request.query.offset || '0', 10);
    const isActive = request.query.is_active !== 'false';

    const polls = await sql`
      SELECT
        p.*,
        json_agg(
          json_build_object(
            'id', o.id,
            'text', o.text,
            'votes_count', o.votes_count,
            'order_index', o.order_index
          ) ORDER BY o.order_index
        ) as options
      FROM community_polls p
      LEFT JOIN community_poll_options o ON o.poll_id = p.id
      WHERE p.is_active = ${isActive}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return reply.send({ data: polls, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get poll by ID with options
 */
export async function getPollById(
  request: FastifyRequest<{
    Params: PollParams;
    Querystring: { user_id?: string };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { user_id } = request.query;

    const result = await sql`
      SELECT
        p.*,
        json_agg(
          json_build_object(
            'id', o.id,
            'text', o.text,
            'votes_count', o.votes_count,
            'order_index', o.order_index
          ) ORDER BY o.order_index
        ) as options
      FROM community_polls p
      LEFT JOIN community_poll_options o ON o.poll_id = p.id
      WHERE p.id = ${id}
      GROUP BY p.id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Poll not found' });
    }

    const poll = result[0];

    // If user_id provided, check if they've voted
    if (user_id) {
      const voteResult = await sql`
        SELECT option_id FROM community_poll_votes
        WHERE poll_id = ${id} AND user_id = ${user_id}
      `;
      (poll as any).user_vote = voteResult.length > 0 ? voteResult[0].option_id : null;
    }

    return reply.send(poll);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Create a new poll
 */
export async function createPoll(
  request: FastifyRequest<{ Body: CreatePollBody }>,
  reply: FastifyReply
) {
  try {
    const { created_by, question, options, ends_at } = request.body;

    if (!question || !created_by || !options || options.length < 2) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'question, created_by, and at least 2 options are required'
      });
    }

    // Create the poll
    const pollResult = await sql`
      INSERT INTO community_polls (created_by, question, ends_at)
      VALUES (${created_by}, ${question}, ${ends_at || null})
      RETURNING *
    `;

    const poll = pollResult[0];

    // Create the options
    for (let i = 0; i < options.length; i++) {
      await sql`
        INSERT INTO community_poll_options (poll_id, text, order_index)
        VALUES (${poll.id}, ${options[i]}, ${i})
      `;
    }

    // Fetch the complete poll with options
    const result = await sql`
      SELECT
        p.*,
        json_agg(
          json_build_object(
            'id', o.id,
            'text', o.text,
            'votes_count', o.votes_count,
            'order_index', o.order_index
          ) ORDER BY o.order_index
        ) as options
      FROM community_polls p
      LEFT JOIN community_poll_options o ON o.poll_id = p.id
      WHERE p.id = ${poll.id}
      GROUP BY p.id
    `;

    return reply.code(201).send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Vote on a poll
 */
export async function votePoll(
  request: FastifyRequest<{ Params: PollParams; Body: VoteBody }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { user_id, option_id } = request.body;

    if (!user_id || !option_id) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'user_id and option_id are required'
      });
    }

    // Check if poll exists and is active
    const pollCheck = await sql`
      SELECT id, is_active, ends_at FROM community_polls WHERE id = ${id}
    `;

    if (pollCheck.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Poll not found' });
    }

    const poll = pollCheck[0];
    if (!poll.is_active) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Poll is no longer active' });
    }

    if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Poll has ended' });
    }

    // Check if option belongs to this poll
    const optionCheck = await sql`
      SELECT id FROM community_poll_options WHERE id = ${option_id} AND poll_id = ${id}
    `;

    if (optionCheck.length === 0) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Invalid option for this poll' });
    }

    // Check if user already voted
    const existingVote = await sql`
      SELECT id, option_id FROM community_poll_votes
      WHERE poll_id = ${id} AND user_id = ${user_id}
    `;

    if (existingVote.length > 0) {
      // User already voted - update their vote
      const oldOptionId = existingVote[0].option_id;

      if (oldOptionId === option_id) {
        return reply.code(409).send({ error: 'Conflict', message: 'Already voted for this option' });
      }

      // Update the vote
      await sql`
        UPDATE community_poll_votes
        SET option_id = ${option_id}
        WHERE poll_id = ${id} AND user_id = ${user_id}
      `;

      // Decrement old option count
      await sql`
        UPDATE community_poll_options
        SET votes_count = GREATEST(votes_count - 1, 0)
        WHERE id = ${oldOptionId}
      `;

      // Increment new option count
      await sql`
        UPDATE community_poll_options
        SET votes_count = votes_count + 1
        WHERE id = ${option_id}
      `;

      return reply.send({ success: true, message: 'Vote updated' });
    }

    // Create new vote
    await sql`
      INSERT INTO community_poll_votes (poll_id, option_id, user_id)
      VALUES (${id}, ${option_id}, ${user_id})
    `;

    // Increment option vote count
    await sql`
      UPDATE community_poll_options
      SET votes_count = votes_count + 1
      WHERE id = ${option_id}
    `;

    // Increment poll total votes
    await sql`
      UPDATE community_polls
      SET total_votes = total_votes + 1
      WHERE id = ${id}
    `;

    return reply.code(201).send({ success: true, message: 'Vote recorded' });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Delete a poll
 */
export async function deletePoll(
  request: FastifyRequest<{ Params: PollParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const result = await sql`DELETE FROM community_polls WHERE id = ${id} RETURNING id`;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Poll not found' });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Close a poll (set is_active to false)
 */
export async function closePoll(
  request: FastifyRequest<{ Params: PollParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    const result = await sql`
      UPDATE community_polls
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Poll not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
