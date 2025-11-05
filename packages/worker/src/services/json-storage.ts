import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CAPTIONS_FILE = path.join(DATA_DIR, 'captions.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

interface CaptionData {
  id: string;
  videoAssetId: string;
  language: 'en' | 'es';
  status: 'processing' | 'ready' | 'error';
  vttUrl?: string;
  vttContent?: string;
  muxTextTrackId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface CaptionStore {
  captions: CaptionData[];
}

/**
 * Load captions from JSON file
 */
async function loadCaptions(): Promise<CaptionStore> {
  await ensureDataDir();

  try {
    const data = await fs.readFile(CAPTIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet, return empty store
    return { captions: [] };
  }
}

/**
 * Save captions to JSON file
 */
async function saveCaptions(store: CaptionStore): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(CAPTIONS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Create a new caption record
 */
export async function createCaption(data: {
  videoAssetId: string;
  language: 'en' | 'es';
}): Promise<CaptionData> {
  const store = await loadCaptions();

  const caption: CaptionData = {
    id: `caption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    videoAssetId: data.videoAssetId,
    language: data.language,
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.captions.push(caption);
  await saveCaptions(store);

  return caption;
}

/**
 * Update caption record
 */
export async function updateCaption(
  id: string,
  updates: Partial<Omit<CaptionData, 'id' | 'videoAssetId' | 'createdAt'>>
): Promise<CaptionData | null> {
  const store = await loadCaptions();

  const caption = store.captions.find(c => c.id === id);
  if (!caption) {
    return null;
  }

  Object.assign(caption, updates, { updatedAt: new Date().toISOString() });
  await saveCaptions(store);

  return caption;
}

/**
 * Get captions for a video
 */
export async function getCaptionsByVideoId(videoAssetId: string): Promise<CaptionData[]> {
  const store = await loadCaptions();
  return store.captions.filter(c => c.videoAssetId === videoAssetId);
}

/**
 * Mark captions as errored
 */
export async function markCaptionsAsErrored(
  videoAssetId: string,
  errorMessage: string
): Promise<void> {
  const store = await loadCaptions();

  store.captions
    .filter(c => c.videoAssetId === videoAssetId)
    .forEach(caption => {
      caption.status = 'error';
      caption.errorMessage = errorMessage;
      caption.updatedAt = new Date().toISOString();
    });

  await saveCaptions(store);
}

/**
 * Upload VTT file (for dev, just store in JSON + create local file)
 */
export async function uploadVTTFile(
  videoAssetId: string,
  language: 'en' | 'es',
  vttContent: string
): Promise<string> {
  await ensureDataDir();

  const vttDir = path.join(DATA_DIR, 'vtt', videoAssetId);
  await fs.mkdir(vttDir, { recursive: true });

  const vttFilePath = path.join(vttDir, `${language}.vtt`);
  await fs.writeFile(vttFilePath, vttContent, 'utf-8');

  // Return a local file URL (for dev purposes)
  return `file://${vttFilePath}`;
}
