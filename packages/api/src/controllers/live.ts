import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import * as muxService from '../services/mux.js';
import {
  LiveStreamStatus,
  type CreateLiveStreamRequest,
  type LiveStreamResponse,
} from '@trl/shared';

/**
 * Create a new live stream
 * Phase 2 - Basic implementation
 */
export async function createLiveStream(
  request: FastifyRequest<{
    Body: CreateLiveStreamRequest;
  }>,
  reply: FastifyReply
) {
  const { title, description, educatorId } = request.body;

  try {
    // Create Mux live stream
    const { streamId, streamKey, playbackId } = await muxService.createLiveStream({
      playbackPolicy: ['public'],
    });

    // Create live stream record in database
    const [stream] = await sql`
      INSERT INTO live_streams (
        title,
        description,
        educator_id,
        mux_stream_id,
        mux_stream_key,
        mux_playback_id,
        status
      )
      VALUES (
        ${title},
        ${description || null},
        ${educatorId},
        ${streamId},
        ${streamKey},
        ${playbackId},
        ${LiveStreamStatus.IDLE}
      )
      RETURNING id, title, description, status, created_at
    `;

    request.log.info({ streamId: stream.id, muxStreamId: streamId }, 'Created live stream');

    const response: LiveStreamResponse = {
      id: stream.id,
      title: stream.title,
      description: stream.description,
      status: stream.status,
      streamKey,
      playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`,
      createdAt: stream.created_at,
    };

    return reply.code(201).send(response);
  } catch (error) {
    request.log.error(error, 'Failed to create live stream');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create live stream',
    });
  }
}

/**
 * Get live stream by ID
 */
export async function getLiveStreamById(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    const [stream] = await sql`
      SELECT *
      FROM live_streams
      WHERE id = ${id}
    `;

    if (!stream) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Live stream not found',
      });
    }

    const response: LiveStreamResponse = {
      id: stream.id,
      title: stream.title,
      description: stream.description,
      status: stream.status,
      // Only include stream key for the owner
      streamKey: stream.mux_stream_key,
      playbackUrl: stream.mux_playback_id
        ? `https://stream.mux.com/${stream.mux_playback_id}.m3u8`
        : undefined,
      createdAt: stream.created_at,
    };

    return reply.send(response);
  } catch (error) {
    request.log.error(error, 'Failed to get live stream');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve live stream',
    });
  }
}

/**
 * List live streams
 */
export async function listLiveStreams(
  request: FastifyRequest<{
    Querystring: {
      educatorId?: string;
      status?: LiveStreamStatus;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { educatorId, status, limit = 20, offset = 0 } = request.query;

  try {
    const conditions = [];
    const params: any[] = [];

    if (educatorId) {
      conditions.push(`educator_id = $${params.length + 1}`);
      params.push(educatorId);
    }

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const streams = await sql`
      SELECT
        id,
        title,
        description,
        educator_id,
        status,
        mux_playback_id,
        started_at,
        created_at
      FROM live_streams
      ${sql.unsafe(whereClause)}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const streamsWithPlayback = streams.map((stream) => ({
      id: stream.id,
      title: stream.title,
      description: stream.description,
      educatorId: stream.educator_id,
      status: stream.status,
      playbackUrl: stream.mux_playback_id
        ? `https://stream.mux.com/${stream.mux_playback_id}.m3u8`
        : undefined,
      startedAt: stream.started_at,
      createdAt: stream.created_at,
    }));

    return reply.send({
      streams: streamsWithPlayback,
      pagination: {
        limit,
        offset,
        total: streams.length,
      },
    });
  } catch (error) {
    request.log.error(error, 'Failed to list live streams');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve live streams',
    });
  }
}
