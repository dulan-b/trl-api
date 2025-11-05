import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../config/database.js';
import * as muxService from '../services/mux.js';
import * as captionService from '../services/captions.js';
import { VideoStatus } from '@trl/shared';
import { getEnvConfig } from '@trl/shared';
import * as fs from 'fs/promises';
import * as path from 'path';

const config = getEnvConfig();

// JSON storage helpers for dev mode (test_dev/data/)
const DATA_DIR = path.join(process.cwd(), '../..', 'test_dev', 'data');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Directory already exists
  }
}

async function loadVideos() {
  try {
    const data = await fs.readFile(VIDEOS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return { videos: [] };
  }
}

async function saveVideos(data: any) {
  await ensureDataDir();
  await fs.writeFile(VIDEOS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Handle Mux webhooks
 */
export async function handleMuxWebhook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Verify webhook signature (skipped in development - ngrok breaks signatures)
  if (config.NODE_ENV === 'production') {
    const signature = request.headers['mux-signature'] as string;
    const rawBody = (request as any).rawBody || JSON.stringify(request.body);

    if (!muxService.verifyWebhookSignature(rawBody, signature, config.MUX_WEBHOOK_SECRET)) {
      request.log.warn('Invalid Mux webhook signature');
      return reply.code(401).send({ error: 'Invalid signature' });
    }
  }

  const event = request.body as any;
  request.log.info({ eventType: event.type, eventId: event.id }, 'Received Mux webhook');

  try {
    switch (event.type) {
      case 'video.asset.ready':
        await handleAssetReady(event.data, request);
        break;

      case 'video.asset.created':
        await handleAssetCreated(event.data, request);
        break;

      case 'video.asset.errored':
        await handleAssetErrored(event.data, request);
        break;

      case 'video.upload.asset_created':
        await handleUploadAssetCreated(event.data, request);
        break;

      case 'video.asset.track.ready':
        await handleTrackReady(event.data, request);
        break;

      case 'video.live_stream.active':
      case 'video.live_stream.idle':
        await handleLiveStreamStatusChange(event.data, request);
        break;

      default:
        request.log.info({ eventType: event.type }, 'Unhandled webhook event type');
    }

    return reply.send({ received: true });
  } catch (error) {
    request.log.error(error, 'Failed to process webhook');
    return reply.code(500).send({ error: 'Failed to process webhook' });
  }
}

/**
 * Handle asset ready event
 */
async function handleAssetReady(data: any, request: FastifyRequest) {
  const assetId = data.id;
  const playbackId = data.playback_ids?.[0]?.id;
  const duration = data.duration;
  const aspectRatio = data.aspect_ratio;
  const tracks = data.tracks || [];

  request.log.info({ assetId, playbackId, duration, aspectRatio, trackCount: tracks.length }, 'Asset ready');

  // Use JSON storage in dev mode
  if (config.NODE_ENV === 'development') {
    const store = await loadVideos();

    // Find or create video record
    let video = store.videos.find((v: any) => v.muxAssetId === assetId);

    if (!video) {
      video = {
        id: `video_${Date.now()}`,
        muxAssetId: assetId,
        status: VideoStatus.READY,
        muxPlaybackId: playbackId,
        duration,
        aspectRatio,
        tracks: tracks.map((t: any) => ({
          id: t.id,
          type: t.type,
          status: t.status,
          languageCode: t.language_code,
          name: t.name,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.videos.push(video);
    } else {
      video.status = VideoStatus.READY;
      video.muxPlaybackId = playbackId;
      video.duration = duration;
      video.aspectRatio = aspectRatio;
      video.tracks = tracks.map((t: any) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        languageCode: t.language_code,
        name: t.name,
      }));
      video.updatedAt = new Date().toISOString();
    }

    await saveVideos(store);
    request.log.info({ videoId: video.id, playbackId }, 'Video stored in JSON (dev mode)');
    return;
  }

  // Production: Use database
  const [video] = await sql`
    UPDATE video_assets
    SET
      status = ${VideoStatus.READY},
      mux_playback_id = ${playbackId},
      duration = ${duration},
      aspect_ratio = ${aspectRatio},
      updated_at = NOW()
    WHERE mux_asset_id = ${assetId}
    RETURNING id, mux_asset_id
  `;

  if (!video) {
    request.log.warn({ assetId }, 'Video not found for asset');
    return;
  }

  // Process caption generation directly (English + Spanish translation)
  // Run in background without blocking the webhook response
  captionService.processCaptionGeneration(video.id, assetId).catch(error => {
    request.log.error({ error, videoId: video.id }, 'Caption generation failed');
  });

  request.log.info({ videoId: video.id }, 'Started caption generation');
}

/**
 * Handle asset created event
 */
async function handleAssetCreated(data: any, request: FastifyRequest) {
  const assetId = data.id;

  request.log.info({ assetId }, 'Asset created');

  // Use JSON storage in dev mode
  if (config.NODE_ENV === 'development') {
    const store = await loadVideos();
    let video = store.videos.find((v: any) => v.muxAssetId === assetId);

    if (!video) {
      video = {
        id: `video_${Date.now()}`,
        muxAssetId: assetId,
        status: VideoStatus.PROCESSING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.videos.push(video);
    } else {
      video.status = VideoStatus.PROCESSING;
      video.updatedAt = new Date().toISOString();
    }

    await saveVideos(store);
    request.log.info({ videoId: video.id }, 'Asset created stored in JSON (dev mode)');
    return;
  }

  // Production: Use database
  await sql`
    UPDATE video_assets
    SET
      mux_asset_id = ${assetId},
      status = ${VideoStatus.PROCESSING},
      updated_at = NOW()
    WHERE mux_asset_id = ${assetId}
  `;
}

/**
 * Handle asset error event
 */
async function handleAssetErrored(data: any, request: FastifyRequest) {
  const assetId = data.id;
  const errorMessage = JSON.stringify(data.errors || []);

  request.log.error({ assetId, errorMessage }, 'Asset processing failed');

  // Use JSON storage in dev mode
  if (config.NODE_ENV === 'development') {
    const store = await loadVideos();
    const video = store.videos.find((v: any) => v.muxAssetId === assetId);

    if (video) {
      video.status = VideoStatus.ERROR;
      video.errorMessage = errorMessage;
      video.updatedAt = new Date().toISOString();
      await saveVideos(store);
    }

    request.log.info({ assetId }, 'Asset error stored in JSON (dev mode)');
    return;
  }

  // Production: Use database
  await sql`
    UPDATE video_assets
    SET
      status = ${VideoStatus.ERROR},
      error_message = ${errorMessage},
      updated_at = NOW()
    WHERE mux_asset_id = ${assetId}
  `;
}

/**
 * Handle upload asset created event
 */
async function handleUploadAssetCreated(data: any, request: FastifyRequest) {
  const uploadId = data.upload_id;
  const assetId = data.asset_id;

  request.log.info({ uploadId, assetId }, 'Upload completed, asset created');

  // Use JSON storage in dev mode
  if (config.NODE_ENV === 'development') {
    const store = await loadVideos();
    let video = store.videos.find((v: any) => v.muxUploadId === uploadId);

    if (!video) {
      video = {
        id: `video_${Date.now()}`,
        muxUploadId: uploadId,
        muxAssetId: assetId,
        status: VideoStatus.PROCESSING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.videos.push(video);
    } else {
      video.muxAssetId = assetId;
      video.status = VideoStatus.PROCESSING;
      video.updatedAt = new Date().toISOString();
    }

    await saveVideos(store);
    request.log.info({ videoId: video.id, assetId }, 'Upload asset created stored in JSON (dev mode)');
    return;
  }

  // Production: Use database
  await sql`
    UPDATE video_assets
    SET
      mux_asset_id = ${assetId},
      status = ${VideoStatus.PROCESSING},
      updated_at = NOW()
    WHERE mux_upload_id = ${uploadId}
  `;
}

/**
 * Handle track ready event (when captions are generated)
 */
async function handleTrackReady(data: any, request: FastifyRequest) {
  const assetId = data.id;
  const track = data.tracks?.find((t: any) => t.type === 'text' && t.status === 'ready');

  if (!track) {
    request.log.info({ assetId }, 'Track ready event but no ready text track found');
    return;
  }

  request.log.info({ assetId, trackId: track.id, language: track.language_code }, 'Caption track ready');

  // Use JSON storage in dev mode
  if (config.NODE_ENV === 'development') {
    const store = await loadVideos();
    const video = store.videos.find((v: any) => v.muxAssetId === assetId);

    if (video) {
      // Process caption translation
      captionService.processCaptionGeneration(video.id, assetId).catch(error => {
        request.log.error({ error, videoId: video.id }, 'Caption generation failed');
      });

      request.log.info({ videoId: video.id }, 'Started caption translation');
    }
    return;
  }

  // Production: Use database
  const [video] = await sql`
    SELECT id, mux_asset_id
    FROM video_assets
    WHERE mux_asset_id = ${assetId}
  `;

  if (!video) {
    request.log.warn({ assetId }, 'Video not found for track ready event');
    return;
  }

  // Process caption translation
  captionService.processCaptionGeneration(video.id, assetId).catch(error => {
    request.log.error({ error, videoId: video.id }, 'Caption generation failed');
  });

  request.log.info({ videoId: video.id }, 'Started caption translation');
}

/**
 * Handle live stream status changes
 */
async function handleLiveStreamStatusChange(data: any, request: FastifyRequest) {
  const streamId = data.id;
  const status = data.status;

  request.log.info({ streamId, status }, 'Live stream status changed');

  await sql`
    UPDATE live_streams
    SET
      status = ${status},
      updated_at = NOW()
    WHERE mux_stream_id = ${streamId}
  `;
}
