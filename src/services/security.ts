import { TokenDebugInfo } from '../types/instagram';
import { upsertSupabaseUserCredentials, fetchSupabaseUserCredentials } from './supabaseService';

/**
 * Security & Anti-Hacking Utilities for Instagram Graph API Automation
 */

export const REQUIRED_SCOPES = [
  { name: 'instagram_basic', description: 'Access account profile & media', required: true },
  { name: 'instagram_manage_comments', description: 'Read, reply, and moderate comments', required: true },
  { name: 'instagram_manage_insights', description: 'Access impressions, reach, & demographics', required: true },
  { name: 'instagram_content_publish', description: 'Publish single images, videos, reels & carousels', required: true },
  { name: 'pages_show_list', description: 'Fetch connected Facebook Pages', required: true },
  { name: 'pages_read_engagement', description: 'Read page engagement details', required: false },
];

/**
 * Mask sensitive token string for UI display
 */
export function maskToken(token: string): string {
  if (!token) return 'No token set';
  if (token.length <= 10) return '••••••••••••';
  return `${token.substring(0, 6)}••••••••••••${token.substring(token.length - 4)}`;
}

/**
 * Sanitize raw HTML / user input string to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Environment & Local Storage Persistent Key
 */
const STORAGE_KEY = 'insta_growth_sec_store_v2';
const ENV_STORAGE_KEY = 'insta_growth_env_config_v2';

export interface EnvCredentials {
  geminiApiKey: string;
  openRouterApiKey: string;
  appId: string;
  accessToken: string;
  selectedIgUserId: string;
  isAgentActive?: boolean;
  cloudinaryUrl?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  cloudinaryUploadPreset?: string;
}

/**
 * Parse standard Cloudinary URL format:
 * cloudinary://<api_key>:<api_secret>@<cloud_name>
 */
export function parseCloudinaryUrl(url: string): { apiKey?: string; apiSecret?: string; cloudName?: string } {
  if (!url) return {};
  const match = url.trim().match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (match) {
    return {
      apiKey: match[1],
      apiSecret: match[2],
      cloudName: match[3],
    };
  }
  return {};
}

// Current authenticated user account ID scope
let currentUserIdScope: string = 'default';

export function setCurrentUserScope(userId: string | null | undefined): void {
  currentUserIdScope = userId && userId.trim() ? userId.trim() : 'default';
}

export function getCurrentUserScope(): string {
  return currentUserIdScope;
}

export function getScopedKey(baseKey: string, userId?: string): string {
  const activeId = userId || currentUserIdScope;
  return !activeId || activeId === 'default' ? baseKey : `${baseKey}_user_${activeId}`;
}

function getScopedEnvStorageKey(): string {
  return currentUserIdScope === 'default'
    ? ENV_STORAGE_KEY
    : `${ENV_STORAGE_KEY}_user_${currentUserIdScope}`;
}

function getScopedSessionStorageKey(): string {
  return currentUserIdScope === 'default'
    ? STORAGE_KEY
    : `${STORAGE_KEY}_user_${currentUserIdScope}`;
}

function getSafeStorage(type: 'local' | 'session') {
  if (typeof window === 'undefined') return null;
  try {
    return type === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveEnvCredentials(credentials: Partial<EnvCredentials>, userId?: string): void {
  try {
    const activeId = userId || currentUserIdScope;
    const scopeKey = getScopedKey(ENV_STORAGE_KEY, activeId);
    const sessionScopeKey = getScopedKey(STORAGE_KEY, activeId);
    const existing = loadEnvCredentials(activeId);
    const updated = { ...existing, ...credentials };
    const local = getSafeStorage('local');
    const session = getSafeStorage('session');
    if (local) local.setItem(scopeKey, JSON.stringify(updated));
    if (session) session.setItem(sessionScopeKey, btoa(encodeURIComponent(JSON.stringify(updated))));

    // Async sync encrypted credentials to Supabase DB per Clerk user ID
    if (activeId && activeId !== 'default') {
      upsertSupabaseUserCredentials(activeId, updated).catch(err => {
        console.warn('Supabase credentials sync notice:', err);
      });
    }
  } catch (err) {
    console.error('Failed to auto-save credentials to env store:', err);
  }
}

/**
 * Hydrate credentials from encrypted Supabase DB table into local scope
 */
export async function syncCredentialsFromSupabase(userId: string): Promise<EnvCredentials> {
  if (!userId || userId === 'default') return loadEnvCredentials(userId);
  try {
    const remote = await fetchSupabaseUserCredentials(userId);
    if (remote && typeof remote === 'object') {
      if (
        remote.cloudinaryCloudName === 'mb7dl5ox' ||
        remote.cloudinaryApiKey === '627249216271315' ||
        (typeof remote.cloudinaryUrl === 'string' && remote.cloudinaryUrl.includes('mb7dl5ox'))
      ) {
        remote.cloudinaryCloudName = '';
        remote.cloudinaryApiKey = '';
        remote.cloudinaryApiSecret = '';
        remote.cloudinaryUrl = '';
        remote.cloudinaryUploadPreset = '';
      }
      saveEnvCredentials(remote, userId);
      return loadEnvCredentials(userId);
    }
  } catch (err) {
    console.warn('Sync credentials from Supabase note:', err);
  }
  return loadEnvCredentials(userId);
}

export function loadEnvCredentials(userId?: string): EnvCredentials {
  if (userId) {
    setCurrentUserScope(userId);
  }
  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  const rawCloudinaryUrl = (metaEnv.VITE_CLOUDINARY_URL as string) || (metaEnv.CLOUDINARY_URL as string) || '';
  const parsedFromUrl = parseCloudinaryUrl(rawCloudinaryUrl);

  const envFromFiles: EnvCredentials = {
    geminiApiKey: (metaEnv.VITE_GEMINI_API_KEY as string) || '',
    openRouterApiKey: (metaEnv.VITE_OPENROUTER_API_KEY as string) || '',
    appId: (metaEnv.VITE_META_APP_ID as string) || '',
    accessToken: (metaEnv.VITE_INSTAGRAM_ACCESS_TOKEN as string) || '',
    selectedIgUserId: (metaEnv.VITE_INSTAGRAM_USER_ID as string) || '',
    cloudinaryUrl: rawCloudinaryUrl,
    cloudinaryCloudName: (metaEnv.VITE_CLOUDINARY_CLOUD_NAME as string) || (metaEnv.CLOUDINARY_CLOUD_NAME as string) || parsedFromUrl.cloudName || '',
    cloudinaryApiKey: (metaEnv.VITE_CLOUDINARY_API_KEY as string) || (metaEnv.CLOUDINARY_API_KEY as string) || parsedFromUrl.apiKey || '',
    cloudinaryApiSecret: (metaEnv.VITE_CLOUDINARY_API_SECRET as string) || (metaEnv.CLOUDINARY_API_SECRET as string) || parsedFromUrl.apiSecret || '',
    cloudinaryUploadPreset: (metaEnv.VITE_CLOUDINARY_UPLOAD_PRESET as string) || '',
  };

  try {
    const activeId = userId || currentUserIdScope;
    const scopeKey = getScopedKey(ENV_STORAGE_KEY, activeId);
    const sessionScopeKey = getScopedKey(STORAGE_KEY, activeId);
    const local = getSafeStorage('local');
    const session = getSafeStorage('session');
    const saved = (local && local.getItem(scopeKey)) || (session && session.getItem(sessionScopeKey));
    if (!saved) return envFromFiles;
    
    let parsed: any = {};
    if (saved.startsWith('{')) {
      parsed = JSON.parse(saved);
    } else {
      parsed = JSON.parse(decodeURIComponent(atob(saved)));
    }

    const isStaleDemoCloudinary =
      parsed.cloudinaryCloudName === 'mb7dl5ox' ||
      parsed.cloudinaryApiKey === '627249216271315' ||
      (typeof parsed.cloudinaryUrl === 'string' && parsed.cloudinaryUrl.includes('mb7dl5ox'));

    // Multi-tenant precedence: User-scoped saved settings take priority over build env fallbacks
    return {
      geminiApiKey: parsed.geminiApiKey || envFromFiles.geminiApiKey || '',
      openRouterApiKey: parsed.openRouterApiKey || envFromFiles.openRouterApiKey || '',
      appId: parsed.appId || parsed.app_id || envFromFiles.appId || '',
      accessToken: parsed.accessToken || parsed.token || envFromFiles.accessToken || '',
      selectedIgUserId: parsed.selectedIgUserId || parsed.igUserId || envFromFiles.selectedIgUserId || '',
      cloudinaryUrl: isStaleDemoCloudinary ? '' : (parsed.cloudinaryUrl || ''),
      cloudinaryCloudName: isStaleDemoCloudinary ? '' : (parsed.cloudinaryCloudName || ''),
      cloudinaryApiKey: isStaleDemoCloudinary ? '' : (parsed.cloudinaryApiKey || ''),
      cloudinaryApiSecret: isStaleDemoCloudinary ? '' : (parsed.cloudinaryApiSecret || ''),
      cloudinaryUploadPreset: isStaleDemoCloudinary ? '' : (parsed.cloudinaryUploadPreset || ''),
      isAgentActive: parsed.isAgentActive !== undefined ? Boolean(parsed.isAgentActive) : true,
    };
  } catch (err) {
    return envFromFiles;
  }
}


export function saveEncryptedToken(appId: string, token: string, userId?: string): void {
  saveEnvCredentials({ appId, accessToken: token }, userId);
}

export function loadEncryptedToken(userId?: string): { appId: string; token: string } | null {
  const env = loadEnvCredentials(userId);
  if (env.accessToken || env.appId) {
    return { appId: env.appId, token: env.accessToken };
  }
  return null;
}

export function clearSecureToken(userId?: string): void {
  const scopeKey = userId ? `${ENV_STORAGE_KEY}_user_${userId}` : getScopedEnvStorageKey();
  const sessionScopeKey = userId ? `${STORAGE_KEY}_user_${userId}` : getScopedSessionStorageKey();
  const local = getSafeStorage('local');
  const session = getSafeStorage('session');
  if (local) local.removeItem(scopeKey);
  if (session) session.removeItem(sessionScopeKey);
}

export function resetUserCloudinaryCredentials(userId?: string): void {
  saveEnvCredentials({
    cloudinaryUrl: '',
    cloudinaryCloudName: '',
    cloudinaryApiKey: '',
    cloudinaryApiSecret: '',
    cloudinaryUploadPreset: '',
  }, userId);
}



/**
 * Parse Meta Rate Limit Headers: X-Business-Use-Case-Usage
 */
export function parseRateLimitHeader(headerValue: string | null): number {
  if (!headerValue) return 12;
  try {
    const data = JSON.parse(headerValue);
    const firstKey = Object.keys(data)[0];
    if (firstKey && data[firstKey] && data[firstKey][0]) {
      const usage = data[firstKey][0];
      const maxUtil = Math.max(
        usage.call_count || 0,
        usage.total_cputime || 0,
        usage.total_time || 0
      );
      return Math.min(100, Math.max(0, maxUtil));
    }
  } catch (e) {
    // fallback
  }
  return 15;
}

/**
 * Audit Granted Scopes vs Required Scopes
 */
export function auditScopes(grantedScopes: string[]): {
  isValid: boolean;
  missing: string[];
  granted: string[];
} {
  const granted = grantedScopes || [];
  const missing = REQUIRED_SCOPES
    .filter(s => s.required && !granted.includes(s.name))
    .map(s => s.name);

  return {
    isValid: missing.length === 0,
    missing,
    granted,
  };
}
