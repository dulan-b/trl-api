# Translation Service Options

**NO Google Cloud Platform required!** 🎉

This guide explains your options for translating captions from English to Spanish without using Google Cloud.

---

## Summary Comparison

| Service | Free Tier | Quality | Cost After Free | Setup Difficulty |
|---------|-----------|---------|-----------------|------------------|
| **DeepL** ⭐ | 500K chars/month | Excellent | €4.99/month | Easy |
| **LibreTranslate** | Unlimited | Good | Free (self-hosted) | Medium |
| **Azure Translator** | 2M chars/month | Excellent | $10/million chars | Easy |

---

## Option 1: DeepL (RECOMMENDED) ⭐

**Best choice for quality and ease of use.**

### Why DeepL?

- **Better quality** than Google Translate (especially for Spanish)
- **No GCP account needed**
- Simple REST API
- Generous free tier
- Low cost after free tier

### Pricing

- **Free:** 500,000 characters/month
- **Paid:** €4.99/month for 1 million characters
- **Typical caption size:** ~150 characters/minute of video
- **Free tier covers:** ~3,300 minutes of video (~55 hours)

### Setup Steps

1. **Sign up for DeepL API:**
   - Go to https://www.deepl.com/pro-api
   - Create account (no credit card required for free tier)
   - Get API key from dashboard

2. **Configure `.env`:**
   ```env
   TRANSLATION_PROVIDER=deepl
   DEEPL_API_KEY=your_deepl_api_key_here
   ```

3. **That's it!** The system will automatically use DeepL.

### Usage Example

```typescript
import { translateWebVTT } from './services/captions';

// Translate English captions to Spanish
const spanishVTT = await translateWebVTT(
  englishVTTContent,
  'es',
  'deepl' // Use DeepL
);
```

### API Limits

- **Free tier:** 500,000 characters/month
- **Rate limit:** Reasonable (no hard limit documented)
- **Supported languages:** 30+ including Spanish, French, German, Portuguese

---

## Option 2: LibreTranslate (FREE & Open Source)

**Best for maximum cost savings and privacy.**

### Why LibreTranslate?

- **Completely free** if self-hosted
- **Open source** - full control
- **Privacy-friendly** - your data stays on your server
- No account or API key needed (for self-hosted)

### Pricing

- **Self-hosted:** FREE (server costs only)
- **Public API:** FREE with rate limits (or ~$5-10/month for unlimited)
- **Typical VPS cost:** $5-10/month (Render, Railway, DigitalOcean)

### Setup Options

#### A. Use Public API (Quickest)

1. **Configure `.env`:**
   ```env
   TRANSLATION_PROVIDER=libretranslate
   LIBRETRANSLATE_URL=https://libretranslate.com
   # No API key needed for limited usage
   ```

2. **For higher limits, get API key:**
   - Go to https://portal.libretranslate.com
   - Sign up for API key ($9/month unlimited)
   ```env
   LIBRETRANSLATE_API_KEY=your_api_key
   ```

#### B. Self-Host (Best for Production)

1. **Deploy to Render/Railway:**
   ```bash
   # Using Docker
   docker run -ti --rm -p 5000:5000 libretranslate/libretranslate
   ```

2. **Or deploy to cloud:**
   - Railway: https://railway.app/template/libretranslate
   - Render: Deploy from Docker Hub
   - Cost: ~$7/month

3. **Configure `.env`:**
   ```env
   TRANSLATION_PROVIDER=libretranslate
   LIBRETRANSLATE_URL=https://your-libretranslate.railway.app
   ```

### Quality

- **Decent quality** for Spanish (uses Argos Translate models)
- Not as good as DeepL or Google, but acceptable for captions
- Improves with each release

---

## Option 3: Azure Translator

**Alternative if you prefer Microsoft over Google.**

### Why Azure?

- **Better free tier** than Google (2M chars vs 500K)
- **Easy setup** - similar to Google Cloud
- Good quality
- No GCP dependency

### Pricing

- **Free tier:** 2 million characters/month
- **Paid:** $10 per million characters
- **Free tier covers:** ~13,000 minutes of video (~220 hours)

### Setup Steps

1. **Create Azure account:**
   - Go to https://azure.microsoft.com/free
   - No credit card for free tier

2. **Create Translator resource:**
   - Search for "Translator" in Azure Portal
   - Create new resource
   - Get API key and region

3. **Add to code** (you'd need to implement this):
   ```typescript
   // packages/worker/src/services/captions.ts
   export async function translateTextWithAzure(
     text: string,
     targetLanguage: string
   ): Promise<string> {
     const endpoint = 'https://api.cognitive.microsofttranslator.com';
     const response = await fetch(`${endpoint}/translate?api-version=3.0&to=${targetLanguage}`, {
       method: 'POST',
       headers: {
         'Ocp-Apim-Subscription-Key': process.env.AZURE_TRANSLATOR_KEY,
         'Ocp-Apim-Subscription-Region': process.env.AZURE_REGION,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify([{ text }]),
     });

     const data = await response.json();
     return data[0].translations[0].text;
   }
   ```

---

## Comparison for The Ready Lab

### For MVP (First 3 months)

**Recommendation: DeepL**

- Easy setup (5 minutes)
- Excellent quality
- Free tier covers initial testing
- Low cost to scale

**Monthly breakdown:**
- 50 videos × 10 min avg = 500 minutes
- ~75,000 characters
- **Cost: $0** (well under free tier)

### For Growth (500+ active users)

**Recommendation: LibreTranslate (self-hosted)**

- 500 videos/month × 10 min = 5,000 minutes
- ~750,000 characters
- DeepL cost: €4.99/month
- LibreTranslate cost: $7/month (hosting)

**Winner: LibreTranslate saves €5/month**

### For Scale (2000+ users)

**Recommendation: DeepL or Azure**

- 2000 videos/month × 10 min = 20,000 minutes
- ~3M characters
- DeepL: ~€15/month
- Azure: $10/month
- LibreTranslate: $7/month + maintenance time

**Winner: Azure (best price + quality balance at scale)**

---

## How to Switch

### Currently Using Google Cloud?

1. **Remove Google dependency:**
   ```bash
   # Already done in the code!
   # packages/worker/package.json no longer includes @google-cloud/translate
   ```

2. **Choose your provider:**
   - Edit `.env`
   - Set `TRANSLATION_PROVIDER=deepl` or `libretranslate`
   - Add respective API key

3. **Test translation:**
   ```bash
   pnpm dev:worker
   # Upload a test video
   # Check caption generation logs
   ```

### Implementation Status

✅ **DeepL:** Fully implemented
✅ **LibreTranslate:** Fully implemented
⏳ **Azure:** Not implemented (easy to add if needed)

---

## Testing Translation Quality

### Sample Text

**English:** "In this lesson, we'll explore the fundamentals of entrepreneurship and how to validate your business idea."

**DeepL (Spanish):** "En esta lección, exploraremos los fundamentos del emprendimiento y cómo validar tu idea de negocio."

**LibreTranslate (Spanish):** "En esta lección exploraremos los fundamentos del espíritu empresarial y cómo validar su idea de negocio."

**Quality:** Both are good! DeepL is slightly more natural ("emprendimiento" vs "espíritu empresarial").

---

## Recommended Setup for TRL

### Phase 1: MVP (Now - Month 3)

```env
# Use DeepL for easy setup and great quality
TRANSLATION_PROVIDER=deepl
DEEPL_API_KEY=your_key_here
```

**Reasoning:**
- Quick setup (5 minutes)
- Best quality
- Free tier sufficient for testing
- Easy to monitor usage

### Phase 2: Growth (Month 4-12)

```env
# Self-host LibreTranslate for cost savings
TRANSLATION_PROVIDER=libretranslate
LIBRETRANSLATE_URL=https://trl-translate.railway.app
```

**Reasoning:**
- Lower costs at scale
- Full control
- Privacy-friendly
- Predictable pricing

### Phase 3: Scale (Year 2+)

Evaluate based on volume:
- < 5M chars/month: LibreTranslate
- 5-10M chars/month: DeepL
- > 10M chars/month: Azure (volume discounts)

---

## FAQs

### Can I use multiple services?

Yes! The code supports switching between providers via environment variable.

### What if DeepL free tier runs out?

The service will return an error. You can:
1. Upgrade to paid plan (€4.99/month)
2. Switch to LibreTranslate
3. Wait until next month (resets monthly)

### How do I monitor usage?

- **DeepL:** Dashboard shows character usage
- **LibreTranslate:** Check your server logs
- **In your app:** Count characters in caption files

### Can I translate to languages besides Spanish?

Yes! All services support:
- Spanish (es)
- French (fr)
- German (de)
- Portuguese (pt)
- Italian (it)
- And many more

Just change the `targetLanguage` parameter.

---

## Cost Calculator

Use this to estimate your costs:

```
Average video length: 10 minutes
Estimated characters: 10 min × 150 chars/min = 1,500 chars
```

**Monthly estimates:**

| Videos/Month | Characters | DeepL Cost | LibreTranslate | Azure Cost |
|--------------|------------|------------|----------------|------------|
| 50           | 75K        | Free       | Free           | Free       |
| 200          | 300K       | Free       | Free           | Free       |
| 500          | 750K       | €4.99      | $7 (hosting)   | Free       |
| 1000         | 1.5M       | €4.99      | $7             | Free       |
| 2000         | 3M         | €14.99     | $7             | $10        |
| 5000         | 7.5M       | €29.99     | $7             | $65        |

---

## Support

Need help choosing? Consider:

1. **Starting out?** → Use **DeepL** (easiest)
2. **Want free forever?** → Use **LibreTranslate** (self-hosted)
3. **Need best free tier?** → Use **Azure** (but requires implementation)

All three options avoid Google Cloud Platform entirely!

---

**Updated:** 2025-01-15
**Status:** DeepL and LibreTranslate fully implemented and ready to use
