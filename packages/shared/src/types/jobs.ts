/**
 * Background job types for BullMQ
 */

export enum JobType {
  GENERATE_CAPTIONS = 'generate-captions',
  TRANSLATE_CAPTIONS = 'translate-captions',
  ATTACH_CAPTIONS_TO_MUX = 'attach-captions-to-mux',
}

export interface GenerateCaptionsJobData {
  videoAssetId: string;
  muxAssetId: string;
  language: 'en';
}

export interface TranslateCaptionsJobData {
  videoAssetId: string;
  sourceCaptionId: string;
  sourceLanguage: 'en';
  targetLanguage: 'es';
}

export interface AttachCaptionsJobData {
  videoAssetId: string;
  captionId: string;
  vttUrl: string;
  language: string;
}
