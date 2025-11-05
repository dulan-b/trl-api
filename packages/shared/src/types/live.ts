/**
 * Live streaming types for The Ready Lab platform
 * Phase 2 - Currently stubbed
 */

export enum LiveStreamStatus {
  IDLE = 'idle',
  ACTIVE = 'active',
  ENDED = 'ended',
}

export interface LiveStream {
  id: string;
  title: string;
  description?: string;
  educatorId: string;
  muxStreamKey?: string;
  muxPlaybackId?: string;
  status: LiveStreamStatus;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLiveStreamRequest {
  title: string;
  description?: string;
  educatorId: string;
}

export interface LiveStreamResponse {
  id: string;
  title: string;
  description?: string;
  status: LiveStreamStatus;
  streamKey?: string;
  playbackUrl?: string;
  createdAt: string;
}
