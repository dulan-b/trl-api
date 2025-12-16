// Cloudflare Stream service

/**
 * Cloudflare Stream service for web-based live streaming
 *
 * TODO: Add Cloudflare credentials to environment:
 * - CLOUDFLARE_ACCOUNT_ID
 * - CLOUDFLARE_API_TOKEN
 *
 * Setup instructions:
 * 1. Go to https://dash.cloudflare.com/
 * 2. Enable Cloudflare Stream
 * 3. Get Account ID from dashboard URL
 * 4. Create API Token with Stream:Edit permissions
 */

interface CloudflareStreamConfig {
  accountId: string;
  apiToken: string;
}

function getCloudflareConfig(): CloudflareStreamConfig {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
    );
  }

  return { accountId, apiToken };
}

/**
 * Create a Cloudflare Stream live input
 * Returns WHIP endpoint for browser streaming + HLS/DASH for playback
 */
export async function createCloudflareStream(options: {
  metadata?: Record<string, string>;
}) {
  const { accountId, apiToken } = getCloudflareConfig();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meta: options.metadata || {},
        recording: {
          mode: 'automatic',
          timeoutSeconds: 3600, // 1 hour
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Cloudflare stream: ${error}`);
  }

  const data = await response.json() as { result: any };
  const result = data.result;

  return {
    streamId: result.uid,
    // WHIP endpoint for browser WebRTC streaming
    whipUrl: result.webRTC?.url,
    // RTMPS endpoint for OBS/encoder backup
    rtmpsUrl: result.rtmps?.url,
    streamKey: result.rtmps?.streamKey,
    // Playback URLs
    playbackUrl: result.playback?.hls,
    dashUrl: result.playback?.dash,
  };
}

/**
 * Get Cloudflare Stream live input details
 */
export async function getCloudflareStream(streamId: string) {
  const { accountId, apiToken } = getCloudflareConfig();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${streamId}`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Cloudflare stream: ${error}`);
  }

  const data = await response.json() as { result: any };
  const result = data.result;

  return {
    streamId: result.uid,
    status: result.status, // 'ready', 'live', 'error'
    whipUrl: result.webRTC?.url,
    rtmpsUrl: result.rtmps?.url,
    streamKey: result.rtmps?.streamKey,
    playbackUrl: result.playback?.hls,
    dashUrl: result.playback?.dash,
    recording: result.recording,
  };
}

/**
 * Delete Cloudflare Stream live input
 */
export async function deleteCloudflareStream(streamId: string) {
  const { accountId, apiToken } = getCloudflareConfig();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${streamId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete Cloudflare stream: ${error}`);
  }

  return { success: true };
}

/**
 * List all Cloudflare Stream live inputs
 */
export async function listCloudflareStreams() {
  const { accountId, apiToken } = getCloudflareConfig();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list Cloudflare streams: ${error}`);
  }

  const data = await response.json() as { result: any[] };

  return data.result.map((stream: any) => ({
    streamId: stream.uid,
    status: stream.status,
    created: stream.created,
    meta: stream.meta,
  }));
}
