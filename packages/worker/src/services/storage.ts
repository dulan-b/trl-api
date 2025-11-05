import { getEnvConfig } from '@trl/shared';
import { createClient } from '@supabase/supabase-js';
import AWS from 'aws-sdk';

const config = getEnvConfig();

/**
 * Storage service - supports both Supabase Storage and S3
 */

// Initialize based on provider
let supabase: ReturnType<typeof createClient> | null = null;
let s3: AWS.S3 | null = null;

if (config.STORAGE_PROVIDER === 'supabase') {
  if (config.SUPABASE_URL && config.SUPABASE_SERVICE_KEY) {
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
  }
} else if (config.STORAGE_PROVIDER === 's3') {
  s3 = new AWS.S3({
    endpoint: config.STORAGE_ENDPOINT,
    region: config.STORAGE_REGION,
    accessKeyId: config.STORAGE_ACCESS_KEY,
    secretAccessKey: config.STORAGE_SECRET_KEY,
  });
}

/**
 * Upload a file to storage
 */
export async function uploadFile(
  path: string,
  content: Buffer | string,
  contentType: string
): Promise<string> {
  if (config.STORAGE_PROVIDER === 'supabase' && supabase) {
    const { data, error } = await supabase.storage
      .from(config.STORAGE_BUCKET)
      .upload(path, content, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(config.STORAGE_BUCKET)
      .getPublicUrl(path);

    return urlData.publicUrl;
  } else if (config.STORAGE_PROVIDER === 's3' && s3) {
    await s3
      .putObject({
        Bucket: config.STORAGE_BUCKET,
        Key: path,
        Body: content,
        ContentType: contentType,
        ACL: 'public-read',
      })
      .promise();

    return `https://${config.STORAGE_BUCKET}.${config.STORAGE_ENDPOINT}/${path}`;
  }

  throw new Error('No storage provider configured');
}

/**
 * Download a file from storage
 */
export async function downloadFile(path: string): Promise<Buffer> {
  if (config.STORAGE_PROVIDER === 'supabase' && supabase) {
    const { data, error } = await supabase.storage
      .from(config.STORAGE_BUCKET)
      .download(path);

    if (error) {
      throw new Error(`Supabase download failed: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  } else if (config.STORAGE_PROVIDER === 's3' && s3) {
    const result = await s3
      .getObject({
        Bucket: config.STORAGE_BUCKET,
        Key: path,
      })
      .promise();

    return result.Body as Buffer;
  }

  throw new Error('No storage provider configured');
}

/**
 * Delete a file from storage
 */
export async function deleteFile(path: string): Promise<void> {
  if (config.STORAGE_PROVIDER === 'supabase' && supabase) {
    const { error } = await supabase.storage
      .from(config.STORAGE_BUCKET)
      .remove([path]);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  } else if (config.STORAGE_PROVIDER === 's3' && s3) {
    await s3
      .deleteObject({
        Bucket: config.STORAGE_BUCKET,
        Key: path,
      })
      .promise();
  }
}
