# System Architecture

Visual overview of The Ready Lab Video Platform infrastructure.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        The Ready Lab Platform                    │
│                                                                   │
│  ┌────────────┐         ┌──────────────┐       ┌─────────────┐ │
│  │  Frontend  │────────▶│  TRL API     │◀─────▶│  Database   │ │
│  │  (Lovable) │         │  (Fastify)   │       │ (Supabase)  │ │
│  └────────────┘         └──────────────┘       └─────────────┘ │
│                                │                                 │
│                                │                                 │
│                         ┌──────▼───────┐                        │
│                         │   Redis      │                         │
│                         │   (Queue)    │                         │
│                         └──────┬───────┘                        │
│                                │                                 │
│                         ┌──────▼───────┐                        │
│                         │   Worker     │                         │
│                         │  (BullMQ)    │                         │
│                         └──────┬───────┘                        │
│                                │                                 │
└────────────────────────────────┼─────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼────┐  ┌────▼────┐  ┌───▼──────┐
              │   Mux    │  │Deepgram │  │  Google  │
              │ (Video)  │  │  (ASR)  │  │Translate │
              └──────────┘  └─────────┘  └──────────┘
```

## Request Flow

### Video Upload Flow

```
1. User → Frontend → POST /api/videos/uploads
2. API → Mux → Create direct upload URL
3. API → Database → Store video record (status: uploading)
4. API → Frontend → Return upload URL + video ID
5. Frontend → Mux Upload URL → Upload video file
6. Mux → Process video
7. Mux → Webhook → POST /api/webhooks/mux (asset.ready)
8. API → Database → Update video (status: ready, playback_id)
9. API → Queue → Add caption generation job
10. Worker → Queue → Pick up job
11. Worker → Deepgram → Transcribe audio
12. Worker → Storage → Upload caption VTT file
13. Worker → Mux → Attach caption to video
14. Worker → Database → Update caption (status: ready)
```

### Video Playback Flow

```
1. User → Frontend → GET /api/videos/:id
2. API → Database → Fetch video + captions
3. API → Frontend → Return playback URL + caption URLs
4. Frontend → Video Player → Load HLS stream
5. Video Player → Mux CDN → Stream video chunks
6. Video Player → Storage → Load caption files
7. User watches video with captions
```

## Component Details

### API Server (`@trl/api`)

**Technology:** Fastify + TypeScript

**Responsibilities:**
- Handle HTTP requests
- Validate input
- Interact with Mux API
- Manage database operations
- Queue background jobs
- Process webhooks

**Key Routes:**
- `POST /api/videos/uploads` - Create upload URL
- `POST /api/videos` - Create from URL
- `GET /api/videos/:id` - Get video details
- `GET /api/videos` - List videos
- `POST /api/webhooks/mux` - Handle Mux events
- `POST /api/live` - Create live stream
- `GET /api/live/:id` - Get stream details

### Worker (`@trl/worker`)

**Technology:** BullMQ + TypeScript

**Responsibilities:**
- Process background jobs
- Generate captions via Deepgram
- Translate captions via Google Cloud
- Upload caption files to storage
- Attach captions to Mux videos

**Job Types:**
- `generate-captions` - Create English captions
- `translate-captions` - Create Spanish captions (future)
- `attach-captions-to-mux` - Add caption tracks

### Database (PostgreSQL/Supabase)

**Tables:**
- `video_assets` - Video metadata
- `captions` - Caption files and status
- `live_streams` - Live streaming sessions
- `comments` - User comments (future)
- `reactions` - Likes, hearts, etc. (future)

**Key Features:**
- Row Level Security (RLS) for multi-tenancy
- Automatic timestamps
- Indexed queries
- Foreign key constraints

### Queue (Redis)

**Queues:**
- `captions` - Caption generation jobs
- `translations` - Translation jobs
- `mux-attachments` - Caption attachment jobs

**Features:**
- Job retry with exponential backoff
- Job prioritization
- Dead letter queue
- Job progress tracking

## External Services

### Mux (Video Platform)

**Usage:**
- Video upload
- Video encoding
- HLS streaming
- Thumbnail generation
- Live streaming
- Caption track hosting

**Webhooks:**
- `video.asset.ready`
- `video.asset.errored`
- `video.upload.asset_created`
- `video.live_stream.active`

### Deepgram (Speech-to-Text)

**Usage:**
- Audio transcription
- Timestamp generation
- Multi-language support

**Features:**
- Fast transcription (~0.1x realtime)
- High accuracy
- Word-level timestamps

### Google Cloud Translation

**Usage:**
- English → Spanish translation
- Preserve formatting
- Batch translation

### Supabase (Database + Storage)

**Services Used:**
- PostgreSQL database
- Object storage (caption files)
- Row Level Security
- Automatic backups

## Data Models

### Video Asset

```typescript
{
  id: uuid
  title: string
  description?: string
  ownerId: string
  muxAssetId?: string
  muxPlaybackId?: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  duration?: number
  aspectRatio?: string
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Caption

```typescript
{
  id: uuid
  videoAssetId: uuid
  language: 'en' | 'es'
  status: 'pending' | 'processing' | 'ready' | 'error'
  vttUrl?: string
  muxTextTrackId?: string
  createdAt: timestamp
  updatedAt: timestamp
}
```

## Security

### Authentication (Future)

```
User → Supabase Auth → JWT Token → API Request → Verify JWT → Process
```

### Authorization

- Row Level Security in database
- Middleware checks user permissions
- API validates ownership

### Webhook Security

- Mux signature verification
- Reject unsigned webhooks
- Idempotent webhook processing

## Scaling Strategy

### Phase 1 (MVP - 100 users)

```
Single API instance
Single Worker instance
Supabase free tier
Redis free tier
```

### Phase 2 (Growth - 500 users)

```
2x API instances (load balanced)
2x Worker instances (parallel processing)
Supabase Pro
Managed Redis
```

### Phase 3 (Scale - 2000+ users)

```
Auto-scaling API (3-10 instances)
Worker pool (5-20 instances)
Dedicated PostgreSQL
Redis cluster
CDN for static assets
```

## Monitoring

### Metrics to Track

**API:**
- Request rate
- Response time
- Error rate
- Active connections

**Worker:**
- Job queue length
- Job processing time
- Job failure rate
- Worker memory usage

**Database:**
- Query performance
- Connection pool usage
- Storage size
- Active connections

**External Services:**
- Mux API latency
- Deepgram API latency
- Google Translate API latency
- Service quotas/limits

## Cost Breakdown

### Free Tier (0-100 users)

```
Mux:               $0 (5K viewer-minutes)
Deepgram:          $0 ($200 credits)
Google Translate:  $0 (minimal usage)
Supabase:          $0 (free tier)
Redis:             $0 (free tier)
Hosting:           $7/month
─────────────────────────────────
Total:             ~$7/month
```

### Growth Phase (500 users)

```
Mux:               $25/month
Deepgram:          $15/month
Google Translate:  $5/month
Supabase:          $0 (still under limits)
Redis:             $7/month
Hosting:           $14/month
─────────────────────────────────
Total:             ~$66/month
```

### Scale Phase (2000+ users)

```
Mux:               $150/month
Deepgram:          $30/month
Google Translate:  $10/month
Supabase:          $25/month
Redis:             $15/month
Hosting:           $50/month
─────────────────────────────────
Total:             ~$280/month
```

## Disaster Recovery

### Backup Strategy

**Database:**
- Automatic daily backups (Supabase)
- Point-in-time recovery
- Weekly manual exports

**Storage:**
- Caption files backed up to S3
- Video files managed by Mux (redundant)

**Recovery Time Objective (RTO):**
- Database: < 1 hour
- Storage: < 2 hours
- Full system: < 4 hours

## Performance Targets

**API Response Times:**
- GET requests: < 100ms
- POST requests: < 500ms
- Webhook processing: < 1s

**Video Processing:**
- Upload to playback: < 5 minutes
- Caption generation: < 2 minutes

**Uptime:**
- Target: 99.5% (43 minutes downtime/month)
- Measured via health checks

## Future Enhancements

### Phase 2
- [ ] Spanish caption generation
- [ ] Live streaming + chat
- [ ] Comments + reactions
- [ ] Supabase Auth integration

### Phase 3
- [ ] AI-powered video search
- [ ] Interactive transcripts
- [ ] Video analytics
- [ ] Multi-language UI
- [ ] Mobile apps

---

**Last Updated:** 2025-01-15
