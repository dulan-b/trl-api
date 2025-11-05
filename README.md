# The Ready Lab - Video Platform API

Backend infrastructure for The Ready Lab's educational video platform, providing video upload, storage, auto-captioning (English + Spanish), and live streaming capabilities.

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running Locally](#running-locally)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Translation Services](#translation-services)
- [Video Playback](#video-playback)
- [Deployment](#deployment)
- [Development Guide](#development-guide)
- [Troubleshooting](#troubleshooting)
- [Cost Management](#cost-management)

---

## Architecture

This is a **monorepo** containing three packages:

- **`@trl/api`** - Fastify REST API server
- **`@trl/worker`** - BullMQ background job processor
- **`@trl/shared`** - Shared types and utilities

### Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify (API), BullMQ (Workers)
- **Database**: PostgreSQL (Supabase recommended)
- **Queue**: Redis
- **Video Platform**: Mux
- **Captions**: Deepgram (transcription) + DeepL or LibreTranslate (translation)
- **Storage**: Supabase Storage or AWS S3

### System Flow

```
User Upload → API → Mux (processing) → Webhook → Queue
                                                    ↓
Worker ← Queue ← Caption Job ← Deepgram (transcribe)
  ↓
Translation (DeepL/LibreTranslate) → Storage → Mux (attach captions)
```

---

## Features

### Phase 1 (MVP) - ✅ Implemented

- ✅ Video upload (direct upload + URL ingest)
- ✅ Video storage and streaming via Mux
- ✅ Automatic English caption generation via Deepgram
- ✅ Spanish translation via DeepL or LibreTranslate
- ✅ WebVTT caption file generation
- ✅ Live streaming infrastructure (stubbed for Phase 2)
- ✅ Authentication middleware (stubbed for future Supabase Auth)

### Phase 2 (Coming Soon)

- ⏳ Spanish caption translation (pipeline ready, needs activation)
- ⏳ Live streaming with GetStream integration
- ⏳ Comments and reactions
- ⏳ Supabase Auth integration

---

## Prerequisites

### Required Services

#### 1. Mux Account (Video Platform)
- Sign up: https://dashboard.mux.com
- Free tier: 5,000 viewer-minutes/month
- Get: Token ID, Token Secret, Webhook Secret

#### 2. Deepgram Account (Speech-to-Text)
- Sign up: https://console.deepgram.com
- Free tier: $200 credits (~770 hours)
- Get: API Key

#### 3. Translation Service (Choose One)

**Option A: DeepL** (Recommended - Best Quality)
- Sign up: https://www.deepl.com/pro-api
- Free tier: 500,000 characters/month
- Cost after: €4.99/month for 1M characters
- Setup: 5 minutes (just API key)

**Option B: LibreTranslate** (Free Alternative)
- Public API: https://libretranslate.com
- Self-host: https://github.com/LibreTranslate/LibreTranslate
- Free tier: Unlimited (self-hosted)
- Cost: $7/month (hosting) or free (if you self-host)

#### 4. Supabase Project (Database + Storage)
- Sign up: https://supabase.com
- Free tier: 500MB database, 1GB storage
- Get: Database URL, Service Role Key

### Local Development Tools

```bash
# macOS
brew install node@20       # Node.js 20+
brew install redis         # Redis for job queue
corepack enable            # Enable pnpm

# Verify installations
node -v                    # Should be 20+
redis-server --version     # Should be 7+
pnpm -v                    # Should be 9+
```

---

## Setup

### 1. Clone and Install

```bash
cd TRL-API
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
# Server
NODE_ENV=development
PORT=4000

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Redis
REDIS_URL=redis://localhost:6379

# Mux (Video Platform)
MUX_TOKEN_ID=your_token_id
MUX_TOKEN_SECRET=your_token_secret
MUX_WEBHOOK_SECRET=your_webhook_secret

# Storage (Supabase)
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
STORAGE_BUCKET=captions

# Captions
DEEPGRAM_API_KEY=your_deepgram_api_key

# Translation (choose one)
TRANSLATION_PROVIDER=deepl
DEEPL_API_KEY=your_deepl_api_key

# OR use LibreTranslate:
# TRANSLATION_PROVIDER=libretranslate
# LIBRETRANSLATE_URL=https://libretranslate.com
# LIBRETRANSLATE_API_KEY=optional_key
```

### 3. Set Up Database

In your Supabase SQL Editor:

```bash
# Copy the schema
cat database/schema.sql
```

Paste and execute in Supabase SQL Editor.

### 4. Create Storage Bucket

In Supabase Dashboard:
1. Go to **Storage**
2. Create bucket named `captions`
3. Set to **Public** (captions need to be accessible by video player)

### 5. Start Redis

```bash
brew services start redis
```

### 6. Configure Mux Webhooks

1. Go to https://dashboard.mux.com/settings/webhooks
2. Add webhook URL: `https://[your-domain]/api/webhooks/mux`
   - For local dev, use ngrok: `npx ngrok http 4000`
3. Copy the webhook secret to your `.env`

---

## Running Locally

### Start All Services

```bash
# Terminal 1: Start API
pnpm dev:api

# Terminal 2: Start Worker
pnpm dev:worker
```

Or run both together:

```bash
pnpm dev
```

### Expose Webhooks (Development Only)

Mux needs to reach your local server:

```bash
npx ngrok http 4000
```

Copy the `https://` URL and add it to Mux webhook settings.

---

## API Endpoints

Base URL: `http://localhost:4000`

### Health Check

```bash
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "services": {
    "database": "up"
  }
}
```

### Videos

#### Create Direct Upload

```bash
POST /api/videos/uploads
Content-Type: application/json

{
  "title": "My Course Video",
  "description": "Introduction to JavaScript",
  "ownerId": "user-123"
}

Response: 201 Created
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "uploadUrl": "https://storage.googleapis.com/mux-uploads/...",
  "title": "My Course Video",
  "status": "uploading"
}
```

**Usage Flow:**
1. Call this endpoint to get an upload URL
2. Upload your video file to the `uploadUrl` via PUT request
3. Mux will process and trigger webhooks

#### Create from URL

```bash
POST /api/videos
Content-Type: application/json

{
  "sourceUrl": "https://example.com/video.mp4",
  "title": "External Video",
  "ownerId": "user-123"
}

Response: 201 Created
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "title": "External Video",
  "muxAssetId": "mux-asset-id",
  "status": "processing"
}
```

#### Get Video

```bash
GET /api/videos/:id

Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My Course Video",
  "description": "Introduction to JavaScript",
  "ownerId": "user-123",
  "status": "ready",
  "playbackUrl": "https://stream.mux.com/abc123.m3u8",
  "thumbnailUrl": "https://image.mux.com/abc123/thumbnail.jpg",
  "duration": 120.5,
  "aspectRatio": "16:9",
  "captions": [
    {
      "id": "caption-uuid",
      "language": "en",
      "status": "ready",
      "vttUrl": "https://storage/captions/video-id/en.vtt"
    },
    {
      "id": "caption-uuid-2",
      "language": "es",
      "status": "ready",
      "vttUrl": "https://storage/captions/video-id/es.vtt"
    }
  ],
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:35:00Z"
}
```

**Status Values:**
- `uploading` - Video is being uploaded
- `processing` - Mux is processing the video
- `ready` - Video is ready for playback
- `error` - Processing failed

#### List Videos

```bash
GET /api/videos?ownerId=user-123&status=ready&limit=20&offset=0

Query Parameters:
- ownerId (optional) - Filter by owner
- status (optional) - Filter by status
- limit (optional) - Results per page (default: 20, max: 100)
- offset (optional) - Pagination offset (default: 0)

Response: 200 OK
{
  "videos": [...],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 45
  }
}
```

### Live Streams

#### Create Live Stream

```bash
POST /api/live
Content-Type: application/json

{
  "title": "Live Class: Entrepreneurship 101",
  "description": "Interactive Q&A session",
  "educatorId": "educator-123"
}

Response: 201 Created
{
  "id": "stream-uuid",
  "title": "Live Class: Entrepreneurship 101",
  "status": "idle",
  "streamKey": "your-secret-stream-key",
  "playbackUrl": "https://stream.mux.com/xyz789.m3u8",
  "createdAt": "2025-01-15T14:00:00Z"
}
```

**Stream Key Usage:**
Configure your streaming software (OBS, StreamYard):
- **RTMP URL:** `rtmps://global-live.mux.com:443/app`
- **Stream Key:** Use the `streamKey` from response

#### Get Live Stream

```bash
GET /api/live/:id

Response: 200 OK
{
  "id": "stream-uuid",
  "title": "Live Class",
  "status": "active",
  "playbackUrl": "https://stream.mux.com/xyz789.m3u8",
  "createdAt": "2025-01-15T14:00:00Z"
}
```

**Status Values:**
- `idle` - Stream created but not active
- `active` - Currently streaming
- `ended` - Stream has ended

---

## Testing

### Quick Test Script

```bash
./scripts/test-api.sh
```

### Manual Testing Flow

#### 1. Upload a Video

```bash
curl -X POST http://localhost:4000/api/videos/uploads \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Video",
    "ownerId": "test-user"
  }'
```

Save the `uploadUrl` from the response.

#### 2. Upload Video File

```bash
curl -X PUT "[UPLOAD-URL]" \
  -H "Content-Type: video/mp4" \
  --data-binary @your-video.mp4
```

#### 3. Monitor Processing

Mux will process the video and send webhooks:
- `video.upload.asset_created` → Video starts processing
- `video.asset.ready` → Video ready, captions queued

Check worker logs:

```bash
# In worker terminal, you'll see:
[INFO] Processing caption generation
[INFO] Transcribing audio
[INFO] Translating with DeepL
[INFO] Uploaded caption file
[INFO] Caption generation complete
```

#### 4. Retrieve Video

```bash
curl http://localhost:4000/api/videos/[VIDEO-ID]
```

#### 5. Test in Browser

Open `examples/video-player.html` and replace the placeholder URLs with your actual video data.

---

## Translation Services

### DeepL (Recommended)

**Setup:**
```env
TRANSLATION_PROVIDER=deepl
DEEPL_API_KEY=your_api_key
```

**Pricing:**
- Free: 500,000 characters/month (~3,300 minutes of video)
- Paid: €4.99/month for 1M characters

**Quality:** Excellent, often better than alternatives for Spanish

**Get API Key:** https://www.deepl.com/pro-api

### LibreTranslate (Free Alternative)

**Setup (Public API):**
```env
TRANSLATION_PROVIDER=libretranslate
LIBRETRANSLATE_URL=https://libretranslate.com
```

**Setup (Self-Hosted):**
```bash
# Deploy to Railway/Render
docker run -p 5000:5000 libretranslate/libretranslate

# Then configure:
LIBRETRANSLATE_URL=https://your-instance.railway.app
```

**Pricing:**
- Self-hosted: Free (server costs ~$7/month)
- Public API: Free with limits, $9/month unlimited

**Quality:** Good, improves with each release

**Repository:** https://github.com/LibreTranslate/LibreTranslate

### Cost Comparison

| Videos/Month | Characters | DeepL Cost | LibreTranslate Cost |
|--------------|------------|------------|---------------------|
| 50           | 75K        | Free       | Free                |
| 500          | 750K       | €4.99      | $7 (hosting)        |
| 2000         | 3M         | €14.99     | $7                  |

**Estimation:** Average video (10 min) ≈ 1,500 characters

---

## Video Playback

### HTML5 Video Player

```html
<video controls>
  <source src="https://stream.mux.com/[PLAYBACK-ID].m3u8" type="application/x-mpegURL">
  <track kind="captions" srclang="en" src="[EN-CAPTION-URL]" label="English" default>
  <track kind="captions" srclang="es" src="[ES-CAPTION-URL]" label="Español">
</video>
```

### Video.js (Recommended)

```html
<link href="https://vjs.zencdn.net/8.0.4/video-js.css" rel="stylesheet">
<script src="https://vjs.zencdn.net/8.0.4/video.min.js"></script>

<video id="my-video" class="video-js" controls preload="auto">
  <source src="https://stream.mux.com/[PLAYBACK-ID].m3u8" type="application/x-mpegURL">
  <track kind="captions" src="[EN-CAPTION]" srclang="en" label="English" default>
  <track kind="captions" src="[ES-CAPTION]" srclang="es" label="Español">
</video>

<script>
  videojs('my-video', {
    controls: true,
    playbackRates: [0.5, 1, 1.25, 1.5, 2]
  });
</script>
```

### Thumbnail Images

```
https://image.mux.com/[PLAYBACK-ID]/thumbnail.jpg?width=640&time=5
```

Query parameters:
- `width` - Image width (height auto-scales)
- `height` - Image height
- `time` - Timestamp in seconds

---

## Deployment

### Recommended Platforms

#### Railway (Fastest Setup)

```bash
# Install CLI
npm i -g @railway/cli

# Initialize
railway init

# Deploy
railway up
```

**Cost:** ~$5-15/month usage-based

#### Render (Most Popular)

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect GitHub repo
4. Configure:
   - Build: `pnpm install && pnpm build`
   - Start: `pnpm --filter @trl/api start`
5. Add environment variables
6. Deploy!

**Cost:** $7/month per service

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database schema applied
- [ ] Storage bucket created (public)
- [ ] Mux webhook URL updated
- [ ] SSL configured (automatic on most platforms)
- [ ] Test video upload flow
- [ ] Monitor logs for errors

### Cost Estimates

**Month 1 (Free Tiers):**
- Mux: $0 (5K viewer-minutes free)
- Deepgram: $0 ($200 credits)
- DeepL: $0 (500K chars free)
- Supabase: $0 (free tier)
- Hosting: $7-14/month
- **Total: ~$7-14/month**

**Growth Phase (500 users):**
- Mux: ~$25/month
- Deepgram: ~$15/month
- DeepL: ~$5/month
- Supabase: $0
- Hosting: $14/month
- **Total: ~$59/month**

**Scale Phase (2000+ users):**
- Mux: ~$150/month
- Deepgram: ~$30/month
- DeepL: ~$15/month
- Supabase: ~$25/month
- Hosting: ~$50/month
- **Total: ~$270/month**

---

## Development Guide

### Project Structure

```
TRL-API/
├── packages/
│   ├── api/                 # REST API server
│   │   ├── src/
│   │   │   ├── config/      # DB, queue, etc.
│   │   │   ├── controllers/ # Route handlers
│   │   │   ├── middleware/  # Auth, etc.
│   │   │   ├── routes/      # API routes
│   │   │   ├── services/    # External services (Mux)
│   │   │   └── index.ts     # Server entry
│   │   └── package.json
│   │
│   ├── worker/              # Background job processor
│   │   ├── src/
│   │   │   ├── services/    # Caption, storage
│   │   │   ├── workers/     # Job handlers
│   │   │   └── index.ts     # Worker entry
│   │   └── package.json
│   │
│   └── shared/              # Shared types & utils
│       ├── src/
│       │   ├── types/       # TypeScript types
│       │   ├── config/      # Config helpers
│       │   └── index.ts
│       └── package.json
│
├── database/
│   └── schema.sql           # PostgreSQL schema
│
├── examples/
│   ├── video-player.html    # Example video player
│   └── sample-captions.vtt  # Sample caption file
│
├── scripts/
│   └── test-api.sh          # API test script
│
├── .env.example             # Environment template
├── package.json             # Root package
├── pnpm-workspace.yaml      # Monorepo config
└── README.md                # This file
```

### Adding New Endpoints

1. **Add route** in `packages/api/src/routes/`
2. **Add controller** in `packages/api/src/controllers/`
3. **Test manually** with curl or test script

### Adding New Job Types

1. **Define type** in `packages/shared/src/types/jobs.ts`
2. **Create queue** in `packages/api/src/config/queue.ts`
3. **Create worker** in `packages/worker/src/workers/`
4. **Register worker** in `packages/worker/src/index.ts`
5. **Queue job** from API controller

### Authentication Integration

Authentication is **stubbed** for future implementation.

**To integrate Supabase Auth:**

1. Set up Supabase Auth in your project
2. Update `packages/api/src/middleware/auth.ts`:
   - Extract JWT from `Authorization` header
   - Verify with Supabase
   - Attach user to `request.auth`
3. Update RLS policies in database

### Enabling Spanish Captions

The translation pipeline is ready but not activated.

**To enable:**

1. Uncomment translation queue code in `packages/api/src/controllers/webhooks.ts`
2. Create translation worker in `packages/worker/src/workers/translation-worker.ts`
3. Queue Spanish translation after English completes
4. Test with a sample video

---

## Troubleshooting

### Database Connection Failed

```bash
# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL

# Verify Supabase project is running
```

**Solution:** Ensure connection string is correct and Supabase project is active.

### Redis Connection Refused

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running:
brew services start redis
```

### Mux Webhooks Not Working

- Ensure webhook URL is publicly accessible (use ngrok for local dev)
- Check `MUX_WEBHOOK_SECRET` matches Mux dashboard
- View webhook delivery attempts in Mux dashboard
- Check API logs for signature verification errors

### Caption Generation Failing

- Verify `DEEPGRAM_API_KEY` is valid
- Check Deepgram credit balance
- Check `TRANSLATION_PROVIDER` and API key
- View worker logs for detailed errors

### Video Upload Timing Out

- Check file size (Mux supports up to 500GB)
- Verify Mux token credentials
- Check network connection
- Review Mux dashboard for asset status

---

## Cost Management

### Free Tier Limits

- **Mux:** 5,000 viewer-minutes/month
- **Deepgram:** $200 credits (~770 hours)
- **DeepL:** 500,000 characters/month
- **LibreTranslate:** Unlimited (self-hosted)
- **Supabase:** 500MB database, 1GB storage

### Monitoring Usage

**Mux:** Dashboard → Analytics → View minutes used

**Deepgram:** Console → Usage → Check credits remaining

**DeepL:** Account → Usage → Character count

**Supabase:** Dashboard → Settings → Usage

### Cost Optimization Tips

1. **Use LibreTranslate** for translation (free when self-hosted)
2. **Compress videos** before upload to reduce storage
3. **Cache frequently accessed data** in Redis
4. **Monitor Deepgram usage** - transcription is the main cost driver
5. **Consider video length limits** for free tier users

---

## Support

### Getting Help

- **Check logs:** API and Worker terminals show detailed errors
- **Mux dashboard:** View video processing status
- **Supabase logs:** Database query performance
- **Redis CLI:** Monitor job queues

### Common Questions

**Q: How do I add more languages?**
A: Both DeepL and LibreTranslate support 30+ languages. Just change the `targetLanguage` parameter in the translation function.

**Q: Can I use a different video provider?**
A: The architecture supports it, but Mux integration is built-in. You'd need to replace the Mux service layer.

**Q: How do I backup my data?**
A: Supabase provides automatic daily backups. For manual backups, use `pg_dump`.

**Q: Can I customize caption timing?**
A: Yes, edit the `chunkDuration` parameter in `convertToWebVTT()` function.

---

## License

Proprietary - The Ready Lab

---

**Built with ❤️ for The Ready Lab**

For additional documentation, see:
- `examples/video-player.html` - Sample video player
- `scripts/test-api.sh` - API testing script
- `.env.example` - Complete environment configuration
