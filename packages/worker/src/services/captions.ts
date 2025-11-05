import { getEnvConfig } from '@trl/shared';

const config = getEnvConfig();

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
 * Detect language from VTT content
 * Simple heuristic based on common words
 */
export function detectVTTLanguage(vttContent: string): 'en' | 'es' | 'other' {
  const textOnly = vttContent
    .split('\n')
    .filter(line => !line.includes('-->') && !line.includes('WEBVTT') && line.trim())
    .join(' ')
    .toLowerCase();

  // Common Spanish words
  const spanishIndicators = ['el', 'la', 'los', 'las', 'de', 'que', 'y', 'a', 'en', 'un', 'una', 'por', 'para', 'con', 'su', 'es', 'como', 'este', 'está'];

  // Common English words
  const englishIndicators = ['the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'with', 'as', 'this', 'be'];

  let spanishScore = 0;
  let englishScore = 0;

  spanishIndicators.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = textOnly.match(regex);
    if (matches) spanishScore += matches.length;
  });

  englishIndicators.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = textOnly.match(regex);
    if (matches) englishScore += matches.length;
  });

  if (spanishScore > englishScore * 1.5) return 'es';
  if (englishScore > spanishScore * 1.5) return 'en';

  return 'other';
}

/**
 * Translate text using LibreTranslate (free, self-hosted option)
 * Supports translating from any language to any language
 */
export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const libreTranslateUrl = config.LIBRETRANSLATE_URL || 'https://libretranslate.com';
  const apiKey = config.LIBRETRANSLATE_API_KEY || '';

  try {
    const body: any = {
      q: text,
      source: sourceLanguage === 'other' ? 'auto' : sourceLanguage,
      target: targetLanguage,
    };

    if (apiKey) {
      body.api_key = apiKey;
    }

    const response = await fetch(`${libreTranslateUrl}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LibreTranslate error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.translatedText;
  } catch (error: any) {
    throw new Error(`LibreTranslate translation failed: ${error.message}`);
  }
}

/**
 * Translate WebVTT captions while preserving timestamps
 */
export async function translateWebVTT(
  vttContent: string,
  sourceLanguage: string,
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
          const translated = await translateText(text, sourceLanguage, targetLanguage);
          translatedLines.push(translated);
        } catch (error) {
          // If translation fails, keep original text
          console.error('Translation failed for line:', error);
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
 * Parse VTT and extract all text content (for language detection or full transcript)
 */
export function extractVTTText(vttContent: string): string {
  const lines = vttContent.split('\n');
  const textLines: string[] = [];

  for (const line of lines) {
    // Skip WEBVTT header, timestamps, and empty lines
    if (
      !line.startsWith('WEBVTT') &&
      !line.includes('-->') &&
      line.trim() !== '' &&
      !line.startsWith('NOTE')
    ) {
      textLines.push(line.trim());
    }
  }

  return textLines.join(' ');
}

/**
 * Format time in seconds to WebVTT timestamp format (HH:MM:SS.mmm)
 */
export function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}.${pad(ms, 3)}`;
}

function pad(num: number, size: number): string {
  return num.toString().padStart(size, '0');
}
