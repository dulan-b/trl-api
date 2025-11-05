import { Worker, Job } from 'bullmq';
import { getEnvConfig } from '@trl/shared';
import type { GenerateCaptionsJobData } from '@trl/shared';
import { CaptionStatus, CaptionLanguage } from '@trl/shared';
import postgres from 'postgres';
import { downloadVTT, detectVTTLanguage, translateWebVTT } from '../services/captions.js';
import { uploadFile } from '../services/storage.js';
import Mux from '@mux/mux-node';
import pino from 'pino';

const config = getEnvConfig();
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Database connection
const sql = postgres(config.DATABASE_URL);

// Mux client
const mux = new Mux({
  tokenId: config.MUX_TOKEN_ID,
  tokenSecret: config.MUX_TOKEN_SECRET,
});

/**
 * Process caption generation jobs using Mux auto-captions + LibreTranslate
 *
 * Workflow:
 * 1. Trigger Mux to auto-generate captions (uses Whisper AI)
 * 2. Wait for Mux to finish processing
 * 3. Download the generated VTT file
 * 4. Detect language (EN, ES, or other)
 * 5. Translate to both EN + ES using LibreTranslate
 * 6. Store all VTT files in database and upload to Mux
 */
export const captionWorker = new Worker<GenerateCaptionsJobData>(
  'captions',
  async (job: Job<GenerateCaptionsJobData>) => {
    const { videoAssetId, muxAssetId } = job.data;

    logger.info({ videoAssetId, muxAssetId }, 'Starting caption generation with Mux auto-captions');

    try {
      // Step 1: Request Mux to generate auto-captions
      logger.info({ muxAssetId }, 'Requesting Mux auto-caption generation');

      const track = await mux.video.assets.createTrack(muxAssetId, {
        type: 'text',
        text_type: 'subtitles',
        language_code: 'en', // Try English first (Mux will detect actual language)
        name: 'Auto-generated',
        closed_captions: true,
        passthrough: 'auto-generated',
      });

      logger.info({ trackId: track.id }, 'Mux caption track created, waiting for processing...');

      // Step 2: Wait for Mux to finish processing (poll every 5 seconds, max 5 minutes)
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes
      let trackReady = false;
      let vttUrl = '';

      while (attempts < maxAttempts && !trackReady) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const trackStatus = await mux.video.assets.retrieveTrack(muxAssetId, track.id);
        logger.info({ trackId: track.id, status: trackStatus.status }, 'Checking track status');

        if (trackStatus.status === 'ready') {
          trackReady = true;
          // Get the VTT URL from the asset playback
          const asset = await mux.video.assets.retrieve(muxAssetId);
          const playbackId = asset.playback_ids?.[0]?.id;

          if (playbackId) {
            // Mux VTT URL format: https://stream.mux.com/{PLAYBACK_ID}/text/{TRACK_ID}.vtt
            vttUrl = `https://stream.mux.com/${playbackId}/text/${track.id}.vtt`;
          } else {
            throw new Error('No playback ID found for asset');
          }
        } else if (trackStatus.status === 'errored') {
          throw new Error('Mux caption generation failed');
        }

        attempts++;
      }

      if (!trackReady) {
        throw new Error('Mux caption generation timed out');
      }

      logger.info({ vttUrl }, 'Mux caption ready, downloading VTT');

      // Step 3: Download the VTT file
      const originalVTT = await downloadVTT(vttUrl);

      // Step 4: Detect language
      const detectedLanguage = detectVTTLanguage(originalVTT);
      logger.info({ detectedLanguage }, 'Detected language from VTT content');

      // Step 5: Create captions for both EN and ES
      const captionsToCreate: Array<{ lang: 'en' | 'es', vttContent: string, isOriginal: boolean }> = [];

      if (detectedLanguage === 'en') {
        // Original is English, translate to Spanish
        captionsToCreate.push({ lang: 'en', vttContent: originalVTT, isOriginal: true });

        logger.info('Translating English to Spanish...');
        const spanishVTT = await translateWebVTT(originalVTT, 'en', 'es');
        captionsToCreate.push({ lang: 'es', vttContent: spanishVTT, isOriginal: false });

      } else if (detectedLanguage === 'es') {
        // Original is Spanish, translate to English
        captionsToCreate.push({ lang: 'es', vttContent: originalVTT, isOriginal: true });

        logger.info('Translating Spanish to English...');
        const englishVTT = await translateWebVTT(originalVTT, 'es', 'en');
        captionsToCreate.push({ lang: 'en', vttContent: englishVTT, isOriginal: false });

      } else {
        // Other language, translate to both EN and ES
        logger.info('Translating to both English and Spanish...');

        const englishVTT = await translateWebVTT(originalVTT, 'auto', 'en');
        captionsToCreate.push({ lang: 'en', vttContent: englishVTT, isOriginal: false });

        const spanishVTT = await translateWebVTT(originalVTT, 'auto', 'es');
        captionsToCreate.push({ lang: 'es', vttContent: spanishVTT, isOriginal: false });
      }

      // Step 6: Store captions in database and upload to Mux
      const captionResults = [];

      for (const caption of captionsToCreate) {
        logger.info({ language: caption.lang, isOriginal: caption.isOriginal }, 'Storing caption');

        // Create caption record in database
        const [dbCaption] = await sql`
          INSERT INTO captions (
            video_asset_id,
            language,
            status
          )
          VALUES (
            ${videoAssetId},
            ${caption.lang},
            ${CaptionStatus.PROCESSING}
          )
          RETURNING id
        `;

        const captionId = dbCaption.id;

        // Upload VTT to storage
        const vttPath = `captions/${videoAssetId}/${caption.lang}.vtt`;
        const uploadedVttUrl = await uploadFile(vttPath, caption.vttContent, 'text/vtt');

        logger.info({ captionId, vttUrl: uploadedVttUrl, language: caption.lang }, 'Uploaded caption file');

        // Update caption record with VTT URL
        await sql`
          UPDATE captions
          SET
            status = ${CaptionStatus.READY},
            vtt_url = ${uploadedVttUrl},
            updated_at = NOW()
          WHERE id = ${captionId}
        `;

        // Add caption track to Mux (if not the original)
        if (!caption.isOriginal) {
          const muxTrack = await mux.video.assets.createTrack(muxAssetId, {
            url: uploadedVttUrl,
            type: 'text',
            text_type: 'subtitles',
            language_code: caption.lang,
            name: caption.lang === 'en' ? 'English' : 'Español',
            closed_captions: true,
          });

          // Update with Mux track ID
          await sql`
            UPDATE captions
            SET mux_text_track_id = ${muxTrack.id}
            WHERE id = ${captionId}
          `;

          logger.info({ captionId, muxTrackId: muxTrack.id }, 'Added caption track to Mux');
        } else {
          // For original caption, use the existing track ID
          await sql`
            UPDATE captions
            SET mux_text_track_id = ${track.id}
            WHERE id = ${captionId}
          `;
        }

        captionResults.push({ captionId, language: caption.lang, vttUrl: uploadedVttUrl });
      }

      logger.info({ videoAssetId, captions: captionResults.length }, 'Caption generation complete (EN + ES)');

      return { videoAssetId, captions: captionResults };

    } catch (error: any) {
      logger.error({ error: error.message, videoAssetId }, 'Caption generation failed');

      // Mark any existing captions as errored
      await sql`
        UPDATE captions
        SET
          status = ${CaptionStatus.ERROR},
          error_message = ${error.message},
          updated_at = NOW()
        WHERE video_asset_id = ${videoAssetId}
      `;

      throw error;
    }
  },
  {
    connection: {
      url: config.REDIS_URL,
    },
    concurrency: 1, // Process 1 caption job at a time (due to Mux API rate limits)
  }
);

captionWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Caption job completed');
});

captionWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Caption job failed');
});

captionWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Caption worker error');
});
