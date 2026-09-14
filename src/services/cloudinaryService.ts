/**
 * Cloudinary Media Storage Service
 * Handles direct browser upload and automatic cleanup deletion for Instagram publishing.
 */

import { loadEnvCredentials } from './security';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey?: string;
  apiSecret?: string;
  uploadPreset?: string;
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  resourceType: 'image' | 'video';
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
}

/**
 * Native SHA-1 signature generator using browser Web Crypto API
 */
async function generateSha1(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if Cloudinary credentials are validly configured
 */
export function isCloudinaryConfigured(config: CloudinaryConfig): boolean {
  if (!config.cloudName) return false;
  return Boolean(config.uploadPreset || (config.apiKey && config.apiSecret));
}

/**
 * Upload a local image/video file, Blob, or remote URL/base64 directly to Cloudinary
 */
export async function uploadToCloudinary(
  file: File | Blob | string,
  resourceType: 'image' | 'video' | 'auto' = 'auto',
  config: CloudinaryConfig
): Promise<CloudinaryUploadResult> {
  if (!config.cloudName) {
    throw new Error('Cloudinary Cloud Name is missing. Please configure Cloudinary in the Plugins tab (synced with your Supabase database).');
  }

  // If local blob URL, resolve into real Blob
  let uploadPayload: any = file;
  if (typeof file === 'string' && file.startsWith('blob:')) {
    try {
      const blobRes = await fetch(file);
      uploadPayload = await blobRes.blob();
    } catch (bErr) {
      console.warn('Failed to resolve local blob URL for Cloudinary upload:', bErr);
    }
  }

  const effectiveResourceType = resourceType === 'auto' ? 'auto' : resourceType;
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${effectiveResourceType}/upload`;
  const formData = new FormData();
  formData.append('file', uploadPayload);

  const timestamp = Math.round(Date.now() / 1000);

  if (config.apiKey && config.apiSecret) {
    // Signed Upload using API Key and Secret
    const paramsToSign = `timestamp=${timestamp}`;
    const signature = await generateSha1(`${paramsToSign}${config.apiSecret}`);
    formData.append('api_key', config.apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
  } else if (config.uploadPreset) {
    // Unsigned Upload using Upload Preset
    formData.append('upload_preset', config.uploadPreset);
  } else {
    throw new Error(
      'Cloudinary upload requires either an Upload Preset or API Key + API Secret. Please configure in the Plugins tab (synced with Supabase).'
    );
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const json = await response.json();

  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `Cloudinary upload failed with status ${response.status}`);
  }

  return {
    url: json.url,
    secureUrl: json.secure_url,
    publicId: json.public_id,
    resourceType: (json.resource_type as 'image' | 'video') || (resourceType === 'auto' ? 'image' : resourceType),
    format: json.format || '',
    bytes: json.bytes || (typeof file === 'string' ? file.length : (file as Blob).size),
    width: json.width,
    height: json.height,
    duration: json.duration,
  };
}

/**
 * Check if a string is a local disk file path or local filename
 */
export function isLikelyLocalFilePath(pathOrUrl: string): boolean {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return false;
  const trimmed = pathOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return false;
  }
  if (
    trimmed.startsWith('file://') ||
    /^[a-zA-Z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\')
  ) {
    return true;
  }
  // Standalone filename with media extension
  return /\.(png|jpe?g|webp|gif|mp4|mov|avi|m4v)$/i.test(trimmed);
}

/**
 * Ensures any image or video asset URL is a secure HTTPS link.
 * 1. If already https://, returned immediately.
 * 2. If a local file path (e.g. C:\Users\...\image.png), automatically reads the file buffer
 *    via local dev endpoint /api/read-local-asset, uploads to Cloudinary, and returns the HTTPS URL.
 * 3. If http:// or data URI (base64) or blob:, directly uploads to Cloudinary.
 */
export async function ensureHttpsMediaUrl(
  urlOrData: string,
  resourceType: 'image' | 'video' = 'image',
  customConfig?: CloudinaryConfig,
  userId?: string
): Promise<string> {
  const trimmed = urlOrData.trim();
  if (!trimmed) return '';

  // Already HTTPS - valid for Instagram Graph API directly
  if (trimmed.toLowerCase().startsWith('https://')) {
    return trimmed;
  }

  // Load Cloudinary credentials from user environment
  const env = loadEnvCredentials(userId);
  const config: CloudinaryConfig = customConfig || {
    cloudName: env.cloudinaryCloudName || '',
    apiKey: env.cloudinaryApiKey || '',
    apiSecret: env.cloudinaryApiSecret || '',
    uploadPreset: env.cloudinaryUploadPreset || '',
  };

  // Case A: Local disk file path (e.g. C:\Users\...\image.png)
  if (isLikelyLocalFilePath(trimmed)) {
    if (!isCloudinaryConfigured(config)) {
      throw new Error(
        `Cloudinary is not configured. Please configure your Cloudinary credentials in the Plugins tab (synced with your Supabase database) to upload local media: "${trimmed}".`
      );
    }

    // 1. Try streaming the file as a binary Blob directly from local Vite dev server
    try {
      const serveRes = await fetch(`/api/serve-local-asset?path=${encodeURIComponent(trimmed)}`);
      if (serveRes.ok) {
        const blob = await serveRes.blob();
        const filename = trimmed.split(/[\\/]/).pop() || 'media';
        const fileObj = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        const res = await uploadToCloudinary(fileObj, resourceType, config);
        if (res && res.secureUrl) {
          console.info(`[Cloudinary Auto-Sync] Streamed & uploaded local disk file "${trimmed}" to Cloudinary: ${res.secureUrl}`);
          return res.secureUrl;
        }
      }
    } catch (streamErr: any) {
      console.warn(`[Local Asset Stream] Could not stream local file directly:`, streamErr?.message || streamErr);
    }

    // 2. Fallback: read as base64 dataUri
    try {
      const localRes = await fetch('/api/read-local-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: trimmed }),
      });

      if (localRes.ok) {
        const localData = await localRes.json();
        if (localData.dataUri) {
          const res = await uploadToCloudinary(localData.dataUri, resourceType, config);
          if (res && res.secureUrl) {
            console.info(`[Cloudinary Auto-Sync] Uploaded local disk file "${trimmed}" to Cloudinary: ${res.secureUrl}`);
            return res.secureUrl;
          }
        }
      } else {
        const errJson = await localRes.json().catch(() => ({}));
        const errMsg = errJson.error || `HTTP ${localRes.status}`;
        console.warn(`[Local Asset Sync] Could not read local file "${trimmed}":`, errMsg);
      }
    } catch (localErr: any) {
      console.warn(`[Local Asset Sync] Local endpoint fetch error for "${trimmed}":`, localErr?.message || localErr);
    }

    // If local file could not be read or uploaded, throw so caller does not queue a broken local Windows path
    throw new Error(
      `Cannot upload local file path "${trimmed}". Please ensure the file exists on local disk or provide a valid HTTPS link.`
    );
  }

  // Case B: Remote HTTP, base64 data URI, or Blob URL
  try {
    const res = await uploadToCloudinary(trimmed, resourceType, config);
    if (res && res.secureUrl) {
      console.info(`[Cloudinary Auto-Sync] Uploaded media to Cloudinary: ${res.secureUrl}`);
      return res.secureUrl;
    }
  } catch (err: any) {
    console.warn('Cloudinary upload notice:', err?.message || err);
    throw new Error(`Cloudinary upload failed for "${trimmed}": ${err?.message || err}`);
  }

  throw new Error(`Failed to convert "${trimmed}" into a secure HTTPS URL.`);
}

/**
 * Automatically delete an asset from Cloudinary when user cancels or clears the selection
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' = 'image',
  config: CloudinaryConfig
): Promise<boolean> {
  if (!config.cloudName || !publicId) return false;

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/destroy`;
    const formData = new FormData();
    formData.append('public_id', publicId);

    if (config.apiKey && config.apiSecret) {
      // Standard signed destroy
      const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
      const signature = await generateSha1(`${paramsToSign}${config.apiSecret}`);
      formData.append('api_key', config.apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);

      const res = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      return data.result === 'ok';
    } else {
      console.warn('Cloudinary asset auto-delete requires API Key and API Secret configured in the Plugins tab (synced with Supabase).');
      return false;
    }
  } catch (err: any) {
    console.warn(`Cloudinary auto-cleanup notice for ${publicId}:`, err?.message || err);
    return false;
  }
}
