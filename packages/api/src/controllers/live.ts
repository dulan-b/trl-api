import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import * as streamingService from '../services/streaming.js';
import {
  LiveStreamStatus,
  type CreateLiveStreamRequest,
  type LiveStreamResponse,
  getEnvConfig,
} from '@trl/shared';
import * as fs from 'fs/promises';
import * as path from 'path';

const config = getEnvConfig();

// JSON storage helpers for dev mode (test_dev/data/)
const DATA_DIR = path.join(process.cwd(), '../..', 'test_dev', 'data');
const DATA_FILE = path.join(DATA_DIR, 'videos.json');

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Directory already exists
  }
}

async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return { videos: [], liveStreams: [] };
  }
}

async function saveData(data: any) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

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
    // Create live stream (uses Mux or Cloudflare based on STREAM_PROVIDER)
    const stream = await streamingService.createLiveStream({
      playbackPolicy: ['public'],
      metadata: {
        title,
        description: description || '',
        educatorId,
      },
    });

    const { streamId, streamKey, playbackUrl, whipUrl, rtmpUrl } = stream;

    // Use JSON storage in dev mode
    if (config.NODE_ENV === 'development') {
      const store = await loadData();

      const streamRecord = {
        id: `stream_${Date.now()}`,
        title,
        description: description || null,
        educatorId,
        streamId,
        streamKey,
        playbackUrl,
        whipUrl, // For web streaming (Cloudflare only)
        rtmpUrl, // For OBS/encoder streaming
        status: LiveStreamStatus.IDLE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!store.liveStreams) {
        store.liveStreams = [];
      }
      store.liveStreams.push(streamRecord);
      await saveData(store);

      request.log.info({ streamId: streamRecord.id, providerStreamId: streamId }, 'Created live stream (dev mode)');

      const response: LiveStreamResponse = {
        id: streamRecord.id,
        title: streamRecord.title,
        description: streamRecord.description,
        status: streamRecord.status,
        streamKey,
        playbackUrl,
        whipUrl, // Include WHIP URL if available
        rtmpUrl, // Include RTMP URL for OBS
        createdAt: streamRecord.createdAt,
      };

      return reply.code(201).send(response);
    }

    // Production: Use database
    const [dbStream] = await sql`
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
        ${streamId},
        ${LiveStreamStatus.IDLE}
      )
      RETURNING id, title, description, status, created_at
    `;

    request.log.info({ streamId: dbStream.id, providerStreamId: streamId }, 'Created live stream');

    const response: LiveStreamResponse = {
      id: dbStream.id,
      title: dbStream.title,
      description: dbStream.description,
      status: dbStream.status,
      streamKey,
      playbackUrl,
      whipUrl,
      rtmpUrl,
      createdAt: dbStream.created_at,
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
    // Use JSON storage in dev mode
    if (config.NODE_ENV === 'development') {
      const store = await loadData();
      const foundStream = store.liveStreams?.find((s: any) => s.id === id);

      if (!foundStream) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Live stream not found',
        });
      }

      const response: LiveStreamResponse = {
        id: foundStream.id,
        title: foundStream.title,
        description: foundStream.description,
        status: foundStream.status,
        streamKey: foundStream.streamKey,
        playbackUrl: foundStream.playbackUrl,
        whipUrl: foundStream.whipUrl,
        rtmpUrl: foundStream.rtmpUrl,
        createdAt: foundStream.createdAt,
      };

      return reply.send(response);
    }

    // Production: Use database
    const [dbStream] = await sql`
      SELECT *
      FROM live_streams
      WHERE id = ${id}
    `;

    if (!dbStream) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Live stream not found',
      });
    }

    const response: LiveStreamResponse = {
      id: dbStream.id,
      title: dbStream.title,
      description: dbStream.description,
      status: dbStream.status,
      // Only include stream key for the owner
      streamKey: dbStream.mux_stream_key,
      playbackUrl: dbStream.mux_playback_id
        ? `https://stream.mux.com/${dbStream.mux_playback_id}.m3u8`
        : undefined,
      createdAt: dbStream.created_at,
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
