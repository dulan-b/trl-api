/**
 * Video asset types for The Ready Lab platform
 */

export enum VideoStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error',
}

export enum CaptionLanguage {
  ENGLISH = 'en',
  SPANISH = 'es',
}

export enum CaptionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error',
}

export interface VideoAsset {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  muxAssetId?: string;
  muxPlaybackId?: string;
  status: VideoStatus;
  duration?: number;
  aspectRatio?: string;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
}

export interface Caption {
  id: string;
  videoAssetId: string;
  language: CaptionLanguage;
  status: CaptionStatus;
  vttUrl?: string;
  muxTextTrackId?: string;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
}

export interface CreateVideoRequest {
  sourceUrl?: string;
  title: string;
  description?: string;
  ownerId: string;
}

export interface VideoUploadUrlResponse {
  uploadUrl: string;
  videoId: string;
}

export interface VideoResponse {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  status: VideoStatus;
  playbackUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  aspectRatio?: string;
  captions: CaptionResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface CaptionResponse {
  id: string;
  language: CaptionLanguage;
  status: CaptionStatus;
  vttUrl?: string;
}
