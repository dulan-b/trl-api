/**
 * Unified streaming service
 * Supports both Mux and Cloudflare Stream providers
 */

import { getEnvConfig } from '@trl/shared';
import * as muxService from './mux.js';
import * as cloudflareService from './cloudflare.js';

const config = getEnvConfig();

export interface CreateStreamOptions {
  playbackPolicy?: string[];
  metadata?: Record<string, string>;
}

export interface StreamResult {
  streamId: string;
  streamKey: string;
  playbackUrl: string;
  // For web streaming (Cloudflare only)
  whipUrl?: string;
  // For RTMP streaming (both providers)
  rtmpUrl?: string;
}

/**
 * Create a live stream using the configured provider
 */
export async function createLiveStream(options: CreateStreamOptions): Promise<StreamResult> {
  if (config.STREAM_PROVIDER === 'cloudflare') {
    // Use Cloudflare Stream with WHIP support for web streaming
    const stream = await cloudflareService.createCloudflareStream({
      metadata: options.metadata,
    });

    return {
      streamId: stream.streamId,
      streamKey: stream.streamKey!,
      playbackUrl: stream.playbackUrl!,
      whipUrl: stream.whipUrl,
      rtmpUrl: stream.rtmpsUrl,
    };
  }

  // Default to Mux (RTMP only, no web streaming)
  const stream = await muxService.createLiveStream({
    playbackPolicy: options.playbackPolicy,
  });

  return {
    streamId: stream.streamId,
    streamKey: stream.streamKey,
    playbackUrl: `https://stream.mux.com/${stream.playbackId}.m3u8`,
    rtmpUrl: 'rtmps://global-live.mux.com:443/app',
  };
}

/**
 * Get live stream details
 */
export async function getLiveStream(streamId: string) {
  if (config.STREAM_PROVIDER === 'cloudflare') {
    return await cloudflareService.getCloudflareStream(streamId);
  }

  return await muxService.getLiveStream(streamId);
}

/**
 * Delete live stream
 */
export async function deleteLiveStream(streamId: string) {
  if (config.STREAM_PROVIDER === 'cloudflare') {
    return await cloudflareService.deleteCloudflareStream(streamId);
  }

  // Mux doesn't have a delete endpoint for live streams
  throw new Error('Delete not supported for Mux streams');
}

/**
 * Check if web streaming (WHIP) is supported
 */
export function supportsWebStreaming(): boolean {
  return config.STREAM_PROVIDER === 'cloudflare';
}
