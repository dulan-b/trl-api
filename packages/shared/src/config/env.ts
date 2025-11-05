/**
 * Environment configuration types
 */

export interface EnvConfig {
  // Server
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;

  // Database
  DATABASE_URL: string;

  // Redis
  REDIS_URL: string;

  // Mux
  MUX_TOKEN_ID: string;
  MUX_TOKEN_SECRET: string;
  MUX_WEBHOOK_SECRET: string;

  // Storage (Supabase or S3)
  STORAGE_PROVIDER: 'supabase' | 's3';
  STORAGE_ENDPOINT?: string;
  STORAGE_BUCKET: string;
  STORAGE_REGION?: string;
  STORAGE_ACCESS_KEY?: string;
  STORAGE_SECRET_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;

  // Caption Services
  DEEPGRAM_API_KEY: string;

  // Translation Services (choose one - no GCP required!)
  TRANSLATION_PROVIDER?: 'deepl' | 'libretranslate';
  DEEPL_API_KEY?: string;
  LIBRETRANSLATE_URL?: string;
  LIBRETRANSLATE_API_KEY?: string;
}

export function getEnvConfig(): EnvConfig {
  return {
    NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
    PORT: parseInt(process.env.PORT || '4000', 10),

    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

    MUX_TOKEN_ID: process.env.MUX_TOKEN_ID || '',
    MUX_TOKEN_SECRET: process.env.MUX_TOKEN_SECRET || '',
    MUX_WEBHOOK_SECRET: process.env.MUX_WEBHOOK_SECRET || '',

    STORAGE_PROVIDER: (process.env.STORAGE_PROVIDER as 'supabase' | 's3') || 'supabase',
    STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
    STORAGE_BUCKET: process.env.STORAGE_BUCKET || '',
    STORAGE_REGION: process.env.STORAGE_REGION,
    STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
    STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',

    TRANSLATION_PROVIDER: (process.env.TRANSLATION_PROVIDER as 'deepl' | 'libretranslate'),
    DEEPL_API_KEY: process.env.DEEPL_API_KEY,
    LIBRETRANSLATE_URL: process.env.LIBRETRANSLATE_URL,
    LIBRETRANSLATE_API_KEY: process.env.LIBRETRANSLATE_API_KEY,
  };
}
