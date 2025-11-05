# Changes Summary: Removed Google Cloud Dependency

**TL;DR:** API endpoints are unchanged. Only configuration and internal translation service changed.

---

## What Changed

### ✅ API Endpoints (NO CHANGES)

All API endpoints work exactly the same:

```bash
# Video upload - SAME
POST /api/videos/uploads

# Get video with captions - SAME
GET /api/videos/:id

# Response format - SAME
{
  "id": "...",
  "captions": [
    {
      "language": "en",
      "vttUrl": "..."
    },
    {
      "language": "es",
      "vttUrl": "..."
    }
  ]
}
```

### ✅ Environment Configuration (NEW VARIABLES)

**Old (with Google Cloud):**
```env
GOOGLE_TRANSLATE_API_KEY=your_google_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id
```

**New (no GCP required):**
```env
# Choose ONE:
TRANSLATION_PROVIDER=deepl
DEEPL_API_KEY=your_deepl_key

# OR
TRANSLATION_PROVIDER=libretranslate
LIBRETRANSLATE_URL=https://libretranslate.com
```

### ✅ Dependencies (REMOVED)

**Removed from `packages/worker/package.json`:**
```json
"@google-cloud/translate": "^8.0.0"  // ❌ Removed
```

### ✅ Internal Implementation (UPDATED)

**File:** `packages/worker/src/services/captions.ts`

**What changed:**
- Removed Google Cloud Translation import
- Added `translateTextWithDeepL()` function
- Added `translateTextWithLibreTranslate()` function
- Updated `translateWebVTT()` to support both providers

**Old code:**
```typescript
import { v2 as translate } from '@google-cloud/translate';

const translator = new translate.Translate({
  key: config.GOOGLE_TRANSLATE_API_KEY,
  projectId: config.GOOGLE_CLOUD_PROJECT_ID,
});
```

**New code:**
```typescript
// No Google Cloud imports!
// Uses fetch() to call DeepL or LibreTranslate APIs directly
```

---

## What Stayed the Same

✅ **All API endpoints**
✅ **Response formats**
✅ **Caption generation flow**
✅ **WebVTT format**
✅ **Database schema**
✅ **Mux integration**
✅ **Deepgram integration**

---

## How It Works Now

### Caption Generation Flow (Updated)

```
1. User uploads video → API
2. Mux processes video → Webhook
3. API queues caption job → Redis
4. Worker picks up job:
   ✅ Transcribe English with Deepgram (same)
   ✅ Convert to WebVTT (same)
   ✅ Upload English VTT (same)
   🆕 Translate with DeepL or LibreTranslate (NEW!)
   ✅ Upload Spanish VTT (same)
5. Captions ready!
```

### Translation Flow (NEW)

**Option 1: DeepL**
```
Worker → DeepL API (https://api-free.deepl.com/v2/translate)
       → Get Spanish translation
       → Create Spanish VTT
       → Upload to storage
```

**Option 2: LibreTranslate**
```
Worker → LibreTranslate API (your instance or libretranslate.com)
       → Get Spanish translation
       → Create Spanish VTT
       → Upload to storage
```

---

## Frontend Impact

**None!** Your frontend code doesn't change at all.

The video player still receives:
```json
{
  "captions": [
    {
      "language": "en",
      "vttUrl": "https://storage/captions/video-id/en.vtt"
    },
    {
      "language": "es",
      "vttUrl": "https://storage/captions/video-id/es.vtt"
    }
  ]
}
```

Just use the caption URLs in your video player:
```html
<video controls>
  <source src="video.m3u8">
  <track kind="captions" srclang="en" src="[en.vtt]" label="English">
  <track kind="captions" srclang="es" src="[es.vtt]" label="Español">
</video>
```

---

## Setup Instructions

### 1. Remove old Google Cloud config

Remove these from your `.env`:
```env
# ❌ Delete these
GOOGLE_TRANSLATE_API_KEY=...
GOOGLE_CLOUD_PROJECT_ID=...
```

### 2. Add new translation config

Choose **DeepL** (recommended):
```env
TRANSLATION_PROVIDER=deepl
DEEPL_API_KEY=your_deepl_api_key
```

Or **LibreTranslate** (free):
```env
TRANSLATION_PROVIDER=libretranslate
LIBRETRANSLATE_URL=https://libretranslate.com
```

### 3. Get API key (if using DeepL)

1. Go to https://www.deepl.com/pro-api
2. Sign up (free tier: 500K chars/month)
3. Get API key from dashboard
4. Add to `.env`

### 4. Reinstall dependencies

```bash
pnpm install
```

This removes the Google Cloud package.

### 5. Test it!

```bash
# Start services
pnpm dev:api
pnpm dev:worker

# Upload a test video
curl -X POST http://localhost:4000/api/videos/uploads \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","ownerId":"user"}'
```

Watch worker logs - you should see:
```
[INFO] Transcribing audio
[INFO] Translating with DeepL
[INFO] Caption generation complete
```

---

## Benefits of This Change

### ✅ No Google Cloud Platform Account Needed

- No GCP setup
- No credit card required (for DeepL/LibreTranslate free tiers)
- One less service to manage

### ✅ Better Translation Quality (with DeepL)

DeepL is often rated as better than Google Translate, especially for European languages like Spanish.

### ✅ Cost Savings (with LibreTranslate)

LibreTranslate is free if self-hosted. DeepL free tier is also generous (500K chars/month).

### ✅ More Flexibility

Easy to switch between providers by changing one environment variable:
```env
TRANSLATION_PROVIDER=deepl  # or libretranslate
```

### ✅ Privacy-Friendly Option

LibreTranslate can be self-hosted, keeping all your data on your own servers.

---

## Comparison: Before vs After

| Aspect | Before (Google Cloud) | After (DeepL/LibreTranslate) |
|--------|----------------------|------------------------------|
| Setup complexity | Medium (GCP account) | Easy (just API key) |
| Free tier | 500K chars/month | 500K chars (DeepL) or unlimited (LibreTranslate) |
| Translation quality | Excellent | Excellent (DeepL) / Good (LibreTranslate) |
| Cost after free tier | $20/1M chars | €4.99/1M chars (DeepL) or free (LibreTranslate) |
| Privacy | Data sent to Google | Data sent to DeepL or self-hosted |
| API changes | N/A | **None!** |

---

## Migration Checklist

- [x] Remove `@google-cloud/translate` dependency
- [x] Add DeepL translation function
- [x] Add LibreTranslate translation function
- [x] Update environment config types
- [x] Update `.env.example`
- [ ] Get DeepL or LibreTranslate API key
- [ ] Update your `.env` file
- [ ] Run `pnpm install`
- [ ] Test caption generation
- [ ] Deploy to production

---

## Still Need Help?

### Want to use DeepL?
1. Sign up: https://www.deepl.com/pro-api
2. Get API key
3. Add to `.env`: `DEEPL_API_KEY=your_key`

### Want to use LibreTranslate?
**Option A:** Use public API (free with limits)
```env
TRANSLATION_PROVIDER=libretranslate
LIBRETRANSLATE_URL=https://libretranslate.com
```

**Option B:** Self-host (free, unlimited)
```bash
# Deploy to Railway or Render
docker run -p 5000:5000 libretranslate/libretranslate
```

### Want to stick with Google?
The old code is still available in git history, but you'll need to:
1. Add back `@google-cloud/translate` to package.json
2. Revert changes to `captions.ts`
3. Configure GCP credentials

**But we don't recommend it!** DeepL and LibreTranslate are easier and often better.

---

## Questions?

See the full comparison: [docs/TRANSLATION-OPTIONS.md](./TRANSLATION-OPTIONS.md)

---

**Summary:** Your API is unchanged. Just update environment variables and you're good to go! 🎉
