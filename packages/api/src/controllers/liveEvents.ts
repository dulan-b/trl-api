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
  instructor_id: string;
  scheduled_at?: string;
  duration_minutes?: number;
  status?: 'scheduled' | 'live' | 'completed' | 'cancelled';
  is_recording?: boolean;
  max_attendees?: number;
  meeting_url?: string;
  track_id?: string;
}

interface UpdateLiveEventBody {
  title?: string;
  description?: string;
  status?: string;
  is_recording?: boolean;
  viewer_count?: number;
  attendee_count?: number;
  recording_url?: string;
  started_at?: string;
  ended_at?: string;
}

/**
 * List live events
 */
export async function listLiveEvents(
  request: FastifyRequest<{
    Querystring: {
      instructor_id?: string;
      status?: string;
      track_id?: string;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const { instructor_id, status, track_id, limit = 50, offset = 0 } = request.query;

    let query;
    if (instructor_id && status) {
      query = sql`
        SELECT * FROM live_events
        WHERE instructor_id = ${instructor_id} AND status = ${status}
        ORDER BY scheduled_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (instructor_id) {
      query = sql`
        SELECT * FROM live_events
        WHERE instructor_id = ${instructor_id}
        ORDER BY scheduled_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (status) {
      query = sql`
        SELECT * FROM live_events
        WHERE status = ${status}
        ORDER BY scheduled_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (track_id) {
      query = sql`
        SELECT * FROM live_events
        WHERE track_id = ${track_id}
        ORDER BY scheduled_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT * FROM live_events
        ORDER BY scheduled_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const events = await query;
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
      instructor_id,
      scheduled_at,
      duration_minutes = 60,
      status = 'scheduled',
      is_recording = false,
      max_attendees,
      meeting_url,
      track_id,
    } = request.body;

    const result = await sql`
      INSERT INTO live_events (
        title, description, instructor_id, scheduled_at, duration_minutes,
        status, is_recording, max_attendees, meeting_url, track_id
      )
      VALUES (
        ${title}, ${description || null}, ${instructor_id},
        ${scheduled_at || new Date().toISOString()}, ${duration_minutes},
        ${status}, ${is_recording}, ${max_attendees || null},
        ${meeting_url || null}, ${track_id || null}
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
    if (updates.is_recording !== undefined) updateData.is_recording = updates.is_recording;
    if (updates.viewer_count !== undefined) updateData.viewer_count = updates.viewer_count;
    if (updates.attendee_count !== undefined) updateData.attendee_count = updates.attendee_count;
    if (updates.recording_url !== undefined) updateData.recording_url = updates.recording_url;
    if (updates.started_at !== undefined) updateData.started_at = updates.started_at;
    if (updates.ended_at !== undefined) updateData.ended_at = updates.ended_at;

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
