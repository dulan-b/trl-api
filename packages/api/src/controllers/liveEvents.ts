import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';

/**
 * Live Events Controller
 * Aligned with Supabase live_events table schema
 */

interface LiveEventParams {
  id: string;
}

interface CreateLiveEventBody {
  title: string;
  description?: string;
  host_id: string;
  scheduled_start: string;
  scheduled_end: string;
  status?: 'scheduled' | 'live' | 'completed' | 'cancelled';
  stream_url?: string;
  max_participants?: number;
}

interface UpdateLiveEventBody {
  title?: string;
  description?: string;
  status?: string;
  stream_url?: string;
  max_participants?: number;
  actual_start?: string;
  actual_end?: string;
}

/**
 * List live events
 */
export async function listLiveEvents(
  request: FastifyRequest<{
    Querystring: {
      host_id?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { host_id, status, limit = 50, offset = 0 } = request.query;

    let events;
    if (host_id && status) {
      events = await sql`
        SELECT * FROM live_events
        WHERE host_id = ${host_id} AND status = ${status}
        ORDER BY scheduled_start DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (host_id) {
      events = await sql`
        SELECT * FROM live_events
        WHERE host_id = ${host_id}
        ORDER BY scheduled_start DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (status) {
      events = await sql`
        SELECT * FROM live_events
        WHERE status = ${status}
        ORDER BY scheduled_start DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      events = await sql`
        SELECT * FROM live_events
        ORDER BY scheduled_start DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return reply.send({ data: events, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get live event by ID
 */
export async function getLiveEventById(
  request: FastifyRequest<{ Params: LiveEventParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const result = await sql`SELECT * FROM live_events WHERE id = ${id}`;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Live event not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Create live event
 */
export async function createLiveEvent(
  request: FastifyRequest<{ Body: CreateLiveEventBody }>,
  reply: FastifyReply
) {
  try {
    const {
      title,
      description,
      host_id,
      scheduled_start,
      scheduled_end,
      status = 'scheduled',
      stream_url,
      max_participants,
    } = request.body;

    const result = await sql`
      INSERT INTO live_events (
        title, description, host_id, scheduled_start, scheduled_end,
        status, stream_url, max_participants
      )
      VALUES (
        ${title}, ${description || null}, ${host_id},
        ${scheduled_start}, ${scheduled_end},
        ${status}, ${stream_url || null}, ${max_participants || null}
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
 * Update live event
 */
export async function updateLiveEvent(
  request: FastifyRequest<{ Params: LiveEventParams; Body: UpdateLiveEventBody }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const updates = request.body;

    const updateData: Record<string, any> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.stream_url !== undefined) updateData.stream_url = updates.stream_url;
    if (updates.max_participants !== undefined) updateData.max_participants = updates.max_participants;
    if (updates.actual_start !== undefined) updateData.actual_start = updates.actual_start;
    if (updates.actual_end !== undefined) updateData.actual_end = updates.actual_end;

    if (Object.keys(updateData).length === 0) {
      return reply.code(400).send({ error: 'Bad Request', message: 'No fields to update' });
    }

    const result = await sql`
      UPDATE live_events
      SET ${sql(updateData)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Live event not found' });
    }

    return reply.send(result[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Delete live event
 */
export async function deleteLiveEvent(
  request: FastifyRequest<{ Params: LiveEventParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const result = await sql`DELETE FROM live_events WHERE id = ${id} RETURNING id`;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Live event not found' });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get live event credentials (stream key)
 */
export async function getLiveEventCredentials(
  request: FastifyRequest<{ Params: LiveEventParams }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    // Check if event exists and get instructor_id
    const event = await sql`SELECT instructor_id FROM live_events WHERE id = ${id}`;
    if (event.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Live event not found' });
    }

    // TODO: Verify requesting user is the instructor

    const credentials = await sql`
      SELECT * FROM live_event_credentials WHERE event_id = ${id}
    `;

    if (credentials.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Credentials not found' });
    }

    return reply.send(credentials[0]);
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Get chat history for live event
 */
export async function getLiveEventChat(
  request: FastifyRequest<{
    Params: LiveEventParams;
    Querystring: { limit?: number; offset?: number };
  }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { limit = 100, offset = 0 } = request.query;

    const messages = await sql`
      SELECT * FROM stream_chat_messages
      WHERE event_id = ${id}
      ORDER BY created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return reply.send({ data: messages, pagination: { limit, offset } });
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

/**
 * Delete chat message (moderation)
 */
export async function deleteChatMessage(
  request: FastifyRequest<{ Params: { id: string; messageId: string } }>,
  reply: FastifyReply
) {
  try {
    const { messageId } = request.params;

    const result = await sql`
      DELETE FROM stream_chat_messages WHERE id = ${messageId} RETURNING id
    `;

    if (result.length === 0) {
      return reply.code(404).send({ error: 'Not Found', message: 'Message not found' });
    }

    return reply.code(204).send();
  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
