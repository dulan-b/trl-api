import translate from 'translate';
import { createClient } from '@supabase/supabase-js';
import Mux from '@mux/mux-node';
import { getEnvConfig } from '@trl/shared';
import { sql } from '../config/database.js';
import { CaptionStatus } from '@trl/shared';
import pino from 'pino';

const config = getEnvConfig();
const logger = pino({ level: 'info' });

// Configure translate package to use Google Translate
translate.engine = 'google';

// Mux client
const mux = new Mux({
  tokenId: config.MUX_TOKEN_ID,
  tokenSecret: config.MUX_TOKEN_SECRET,
});

// Supabase client for VTT storage
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

/**
 * Download VTT file from URL
 */
export async function downloadVTT(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download VTT: ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Translate WebVTT captions while preserving timestamps
 * Uses the 'translate' npm package with Google Translate backend
 */
export async function translateWebVTT(
  vttContent: string,
  targetLanguage: string
): Promise<string> {
  const lines = vttContent.split('\n');
  const translatedLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Keep WEBVTT header
    if (line.startsWith('WEBVTT')) {
      translatedLines.push(line);
      i++;
      continue;
    }

    // Keep timestamp lines
    if (line.includes('-->')) {
      translatedLines.push(line);
      i++;

      // Next line(s) should be the text to translate
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
        textLines.push(lines[i]);
        i++;
      }

      if (textLines.length > 0) {
        const text = textLines.join('\n');
        try {
          const translated = await translate(text, targetLanguage);
          translatedLines.push(translated);
        } catch (error) {
          // If translation fails, keep original text
          logger.error({ error }, 'Translation failed for line');
          translatedLines.push(text);
        }
      }

      continue;
    }

    // Keep empty lines
    if (line.trim() === '') {
      translatedLines.push('');
    }

    i++;
  }

  return translatedLines.join('\n');
}

/**
 * Upload VTT file to Supabase Storage
 * Returns public URL for the uploaded file
 */
export async function uploadVTTToStorage(
  vttContent: string,
  assetId: string,
  language: string
): Promise<string> {
  const filePath = `captions/${assetId}-${language}.vtt`;

  const { data, error } = await supabase.storage
    .from(config.STORAGE_BUCKET)
    .upload(filePath, vttContent, {
      contentType: 'text/vtt',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload VTT to Supabase: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(config.STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Process caption generation for a video asset
 * This runs directly in the webhook handler (no queue)
 *
 * Workflow:
 * 1. Mux auto-generates English captions (already done via API)
 * 2. Wait for captions to be ready
 * 3. Download English VTT
 * 4. Translate to Spanish
 * 5. Upload Spanish VTT to Supabase
 * 6. Add Spanish track to Mux
 */
export async function processCaptionGeneration(
  videoAssetId: string,
  muxAssetId: string
): Promise<void> {
  logger.info({ videoAssetId, muxAssetId }, 'Starting caption generation');

  try {
    // Step 1: Get the asset to find the English caption track
    const asset = await mux.video.assets.retrieve(muxAssetId);
    const playbackId = asset.playback_ids?.[0]?.id;

    if (!playbackId) {
      throw new Error('No playback ID found for asset');
    }

    // Find the auto-generated English track
    const tracks = asset.tracks || [];
    const englishTrack = tracks.find(
      (t: any) => t.type === 'text' && t.language_code === 'en'
    );

    if (!englishTrack) {
      logger.warn({ muxAssetId }, 'No English caption track found yet');
      return;
    }

    if (englishTrack.status !== 'ready') {
      logger.info({ muxAssetId, status: englishTrack.status }, 'English captions not ready yet');
      return;
    }

    // Step 2: Download English VTT
    const vttUrl = `https://stream.mux.com/${playbackId}/text/${englishTrack.id}.vtt`;
    logger.info({ vttUrl }, 'Downloading English captions');

    const englishVTT = await downloadVTT(vttUrl);

    // Step 3: Translate to Spanish
    logger.info('Translating English to Spanish');
    const spanishVTT = await translateWebVTT(englishVTT, 'es');

    // Step 4: Upload Spanish VTT to Supabase
    logger.info('Uploading Spanish VTT to Supabase');
    const spanishVTTUrl = await uploadVTTToStorage(spanishVTT, muxAssetId, 'es');

    // Step 5: Add Spanish track to Mux
    logger.info({ spanishVTTUrl }, 'Adding Spanish track to Mux');
    const spanishTrack = await mux.video.assets.createTrack(muxAssetId, {
      url: spanishVTTUrl,
      type: 'text',
      text_type: 'subtitles',
      language_code: 'es',
      name: 'Spanish',
      closed_captions: true,
    });

    // Step 6: Store caption records in database (if in production mode)
    if (config.NODE_ENV === 'production') {
      // Create English caption record
      await sql`
        INSERT INTO captions (video_asset_id, language, status, mux_text_track_id, vtt_url)
        VALUES (${videoAssetId}, 'en', ${CaptionStatus.READY}, ${englishTrack.id}, ${vttUrl})
        ON CONFLICT (video_asset_id, language) DO UPDATE
        SET status = ${CaptionStatus.READY}, mux_text_track_id = ${englishTrack.id}, vtt_url = ${vttUrl}
      `;

      // Create Spanish caption record
      await sql`
        INSERT INTO captions (video_asset_id, language, status, mux_text_track_id, vtt_url)
        VALUES (${videoAssetId}, 'es', ${CaptionStatus.READY}, ${spanishTrack.id}, ${spanishVTTUrl})
        ON CONFLICT (video_asset_id, language) DO UPDATE
        SET status = ${CaptionStatus.READY}, mux_text_track_id = ${spanishTrack.id}, vtt_url = ${spanishVTTUrl}
      `;
    }

    logger.info({ videoAssetId, englishTrackId: englishTrack.id, spanishTrackId: spanishTrack.id }, 'Caption generation complete');

  } catch (error: any) {
    logger.error({ error: error.message, videoAssetId }, 'Caption generation failed');

    // Mark captions as errored in production
    if (config.NODE_ENV === 'production') {
      await sql`
        UPDATE captions
        SET status = ${CaptionStatus.ERROR}, error_message = ${error.message}
        WHERE video_asset_id = ${videoAssetId}
      `;
    }

    throw error;
  }
}
