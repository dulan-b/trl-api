import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import * as muxService from '../services/mux.js';
import {
  VideoStatus,
  type CreateVideoRequest,
  type VideoResponse,
} from '@trl/shared';

/**
 * Create a direct upload URL for video upload
 */
export async function createVideoUpload(
  request: FastifyRequest<{
    Body: {
      title: string;
      description?: string;
      ownerId: string;
      corsOrigin?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { title, description, ownerId, corsOrigin } = request.body;

  try {
    // Create Mux direct upload
    const { uploadUrl, uploadId } = await muxService.createDirectUpload({
      corsOrigin,
    });

    // Create video record in database
    const [video] = await sql`
      INSERT INTO video_assets (
        title,
        description,
        owner_id,
        status,
        mux_upload_id
      )
      VALUES (
        ${title},
        ${description || null},
        ${ownerId},
        ${VideoStatus.UPLOADING},
        ${uploadId}
      )
      RETURNING id, title, status, created_at
    `;

    request.log.info({ videoId: video.id, uploadId }, 'Created video upload');

    return reply.code(201).send({
      id: video.id,
      uploadUrl,
      title: video.title,
      status: video.status,
    });
  } catch (error) {
    request.log.error(error, 'Failed to create video upload');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create video upload',
    });
  }
}

/**
 * Create video from URL
 */
export async function createVideoFromUrl(
  request: FastifyRequest<{
    Body: CreateVideoRequest;
  }>,
  reply: FastifyReply
) {
  const { sourceUrl, title, description, ownerId } = request.body;

  if (!sourceUrl) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: 'sourceUrl is required',
    });
  }

  try {
    // Create Mux asset from URL
    const { assetId } = await muxService.createAssetFromUrl(sourceUrl);

    // Create video record in database
    const [video] = await sql`
      INSERT INTO video_assets (
        title,
        description,
        owner_id,
        mux_asset_id,
        status
      )
      VALUES (
        ${title},
        ${description || null},
        ${ownerId},
        ${assetId},
        ${VideoStatus.PROCESSING}
      )
      RETURNING id, title, mux_asset_id, status, created_at
    `;

    request.log.info({ videoId: video.id, muxAssetId: assetId }, 'Created video from URL');

    return reply.code(201).send({
      id: video.id,
      title: video.title,
      muxAssetId: video.mux_asset_id,
      status: video.status,
    });
  } catch (error) {
    request.log.error(error, 'Failed to create video from URL');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to create video',
    });
  }
}

/**
 * Get video by ID
 */
export async function getVideoById(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  try {
    // Get video with captions
    const [video] = await sql`
      SELECT
        v.*,
        json_agg(
          json_build_object(
            'id', c.id,
            'language', c.language,
            'status', c.status,
            'vttUrl', c.vtt_url
          )
        ) FILTER (WHERE c.id IS NOT NULL) as captions
      FROM video_assets v
      LEFT JOIN captions c ON c.video_asset_id = v.id
      WHERE v.id = ${id}
      GROUP BY v.id
    `;

    if (!video) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Video not found',
      });
    }

    // Build playback URL if ready
    let playbackUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    if (video.mux_playback_id) {
      playbackUrl = `https://stream.mux.com/${video.mux_playback_id}.m3u8`;
      thumbnailUrl = `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg`;
    }

    const response: VideoResponse = {
      id: video.id,
      title: video.title,
      description: video.description,
      ownerId: video.owner_id,
      status: video.status,
      playbackUrl,
      thumbnailUrl,
      duration: video.duration,
      aspectRatio: video.aspect_ratio,
      captions: video.captions || [],
      createdAt: video.created_at,
      updatedAt: video.updated_at,
    };

    return reply.send(response);
  } catch (error) {
    request.log.error(error, 'Failed to get video');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve video',
    });
  }
}

/**
 * List videos
 */
export async function listVideos(
  request: FastifyRequest<{
    Querystring: {
      ownerId?: string;
      status?: VideoStatus;
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { ownerId, status, limit = 20, offset = 0 } = request.query;

  try {
    const conditions = [];
    const params: any[] = [];

    if (ownerId) {
      conditions.push(`owner_id = $${params.length + 1}`);
      params.push(ownerId);
    }

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const videos = await sql`
      SELECT
        id,
        title,
        description,
        owner_id,
        status,
        mux_playback_id,
        duration,
        aspect_ratio,
        created_at,
        updated_at
      FROM video_assets
      ${sql.unsafe(whereClause)}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const videosWithPlayback = videos.map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      ownerId: video.owner_id,
      status: video.status,
      playbackUrl: video.mux_playback_id
        ? `https://stream.mux.com/${video.mux_playback_id}.m3u8`
        : undefined,
      thumbnailUrl: video.mux_playback_id
        ? `https://image.mux.com/${video.mux_playback_id}/thumbnail.jpg`
        : undefined,
      duration: video.duration,
      aspectRatio: video.aspect_ratio,
      createdAt: video.created_at,
      updatedAt: video.updated_at,
    }));

    return reply.send({
      videos: videosWithPlayback,
      pagination: {
        limit,
        offset,
        total: videos.length,
      },
    });
  } catch (error) {
    request.log.error(error, 'Failed to list videos');
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve videos',
    });
  }
}
