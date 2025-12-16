import Mux from '@mux/mux-node';
import { getEnvConfig } from '@trl/shared';

const config = getEnvConfig();

// Initialize Mux client
export const mux = new Mux({
  tokenId: config.MUX_TOKEN_ID,
  tokenSecret: config.MUX_TOKEN_SECRET,
});

/**
 * Create a direct upload URL for video upload
 */
export async function createDirectUpload(options: {
  corsOrigin?: string;
  newAssetSettings?: {
    playback_policy?: ('public' | 'signed')[];
    mp4_support?: string;
  };
}) {
  const upload = await mux.video.uploads.create({
    cors_origin: options.corsOrigin || '*',
    new_asset_settings: {
      playback_policy: options.newAssetSettings?.playback_policy || ['public'] as ('public' | 'signed')[],
      mp4_support: (options.newAssetSettings?.mp4_support as 'standard' | 'none') || 'standard',
    },
  });

  return {
    uploadUrl: upload.url,
    uploadId: upload.id,
  };
}

/**
 * Create asset from URL
 */
export async function createAssetFromUrl(url: string) {
  const asset = await mux.video.assets.create({
    input: [{ url }],
    playback_policy: ['public'],
    mp4_support: 'standard',
  });

  return {
    assetId: asset.id,
    status: asset.status,
  };
}

/**
 * Get asset details
 */
export async function getAsset(assetId: string) {
  const asset = await mux.video.assets.retrieve(assetId);

  return {
    id: asset.id,
    status: asset.status,
    playbackId: asset.playback_ids?.[0]?.id,
    duration: asset.duration,
    aspectRatio: asset.aspect_ratio,
    tracks: asset.tracks,
  };
}

/**
 * Generate auto-captions for Mux asset
 * Uses Mux's built-in Whisper AI to transcribe in original language
 */
export async function generateAutoCaption(assetId: string, languageCode?: string) {
  // Note: Mux auto-generated captions require a URL source or are generated automatically
  // This is a placeholder - actual implementation depends on Mux's current API
  const track = await mux.video.assets.createTrack(assetId, {
    url: '', // Required by Mux API - for auto-generated, this would come from a captions service
    type: 'text',
    text_type: 'subtitles',
    language_code: languageCode || 'en',
    name: 'Auto-generated',
    closed_captions: true,
  });

  return {
    trackId: track.id,
    status: track.status,
  };
}

/**
 * Get track details including VTT URL
 */
export async function getTrack(assetId: string, trackId: string) {
  // Get asset and find the track
  const asset = await mux.video.assets.retrieve(assetId);
  const track = asset.tracks?.find(t => t.id === trackId);

  if (!track) {
    throw new Error(`Track ${trackId} not found on asset ${assetId}`);
  }

  return {
    id: track.id,
    status: track.status,
    languageCode: track.language_code,
    name: track.name,
    // VTT URL is available when status is 'ready'
  };
}

/**
 * Add text track (captions) to Mux asset from external VTT file
 */
export async function addTextTrack(assetId: string, options: {
  url: string;
  languageCode: string;
  name: string;
  closedCaptions: boolean;
}) {
  const track = await mux.video.assets.createTrack(assetId, {
    url: options.url,
    type: 'text',
    text_type: 'subtitles',
    language_code: options.languageCode,
    name: options.name,
    closed_captions: options.closedCaptions,
  });

  return {
    trackId: track.id,
    status: track.status,
  };
}

/**
 * Create live stream
 */
export async function createLiveStream(options: {
  playbackPolicy?: ('public' | 'signed')[];
  newAssetSettings?: {
    playbackPolicy?: ('public' | 'signed')[];
  };
}) {
  const liveStream = await mux.video.liveStreams.create({
    playback_policy: options.playbackPolicy || (['public'] as ('public' | 'signed')[]),
    new_asset_settings: {
      playback_policy: options.newAssetSettings?.playbackPolicy || (['public'] as ('public' | 'signed')[]),
    },
  });

  return {
    streamId: liveStream.id,
    streamKey: liveStream.stream_key,
    playbackId: liveStream.playback_ids?.[0]?.id,
    status: liveStream.status,
  };
}

/**
 * Get live stream details
 */
export async function getLiveStream(streamId: string) {
  const stream = await mux.video.liveStreams.retrieve(streamId);

  return {
    id: stream.id,
    status: stream.status,
    streamKey: stream.stream_key,
    playbackId: stream.playback_ids?.[0]?.id,
  };
}

/**
 * Verify Mux webhook signature
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  try {
    return Mux.Webhooks.verifyHeader(rawBody, signature, secret);
  } catch {
    return false;
  }
}
