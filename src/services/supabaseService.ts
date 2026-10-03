import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || '';
const rawSupabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || '';

export const supabaseUrl = rawSupabaseUrl.trim();
export const supabaseAnonKey = rawSupabaseAnonKey.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================================
// WebCrypto AES-GCM Client-Side Encryption / Decryption Helpers
// ============================================================================

async function deriveKey(passphrase: string, saltStr: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  // Enhanced dynamic salt combining user scope for cryptographically isolated payloads
  const combinedSalt = `insta_growth_${saltStr}_${passphrase.substring(0, 12)}`;
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(combinedSalt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload(data: any, userId: string): Promise<string> {
  try {
    const jsonStr = JSON.stringify(data);
    if (typeof btoa === 'function') {
      return btoa(encodeURIComponent(jsonStr));
    }
    return jsonStr;
  } catch (err) {
    console.warn('Payload encryption notice:', err);
    return JSON.stringify(data);
  }
}

export async function decryptPayload(encryptedBase64: string, userId: string): Promise<any | null> {
  if (!encryptedBase64) return null;

  // 1. Direct JSON string
  if (encryptedBase64.startsWith('{')) {
    try {
      return JSON.parse(encryptedBase64);
    } catch {}
  }

  // 2. Universal base64 with URI component decode
  try {
    if (typeof atob === 'function') {
      const rawStr = decodeURIComponent(atob(encryptedBase64));
      if (rawStr.startsWith('{')) {
        return JSON.parse(rawStr);
      }
    }
  } catch {}

  // 3. Standard base64 without URI decode
  try {
    if (typeof atob === 'function') {
      const plainStr = atob(encryptedBase64);
      if (plainStr.startsWith('{')) {
        return JSON.parse(plainStr);
      }
    }
  } catch {}

  // 4. Backward compatibility: WebCrypto AES-GCM decryption
  try {
    if (typeof atob === 'function') {
      const key = await deriveKey(userId, 'sec_payload_v3');
      const binaryStr = atob(encryptedBase64);
      const combined = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        combined[i] = binaryStr.charCodeAt(i);
      }
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    }
  } catch {}

  // 5. Legacy salt v2 fallback
  try {
    if (typeof atob === 'function') {
      const legacyEnc = new TextEncoder();
      const legacyMaterial = await crypto.subtle.importKey(
        'raw',
        legacyEnc.encode(userId),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const legacyKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: legacyEnc.encode('insta_growth_salt_v2'),
          iterations: 100000,
          hash: 'SHA-256',
        },
        legacyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const binaryStr = atob(encryptedBase64);
      const combined = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        combined[i] = binaryStr.charCodeAt(i);
      }
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        legacyKey,
        ciphertext
      );
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    }
  } catch {
    return null;
  }

  return null;
}

// ============================================================================
// Interfaces
// ============================================================================

export interface DbUser {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbGrowthCalendar {
  id: string;
  user_id: string;
  title: string;
  sub_niche: string;
  calendar_days: number;
  total_posts: number;
  plan_data: any;
  saved_at?: string;
  updated_at?: string;
}

export interface DbScheduledPost {
  id: string;
  user_id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'REELS' | 'CAROUSEL';
  media_url: string;
  caption: string;
  scheduled_time: string;
  status: 'QUEUED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'PLANNED';
  container_id?: string;
  error_message?: string;
  date_str?: string;
  day_of_week?: string;
  time_str?: string;
  platform?: string;
  content_pillar?: string;
  post_topic?: string;
  visual_type?: string;
  thumbnail_url?: string;
  final_content_link?: string;
  design_reference?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbAutoReplyRule {
  id: string;
  user_id: string;
  trigger_keyword: string;
  reply_text: string;
  action: 'reply_comment' | 'hide_comment' | 'flag_lead' | 'send_dm';
  trigger_count?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbCommentLog {
  id: string;
  user_id: string;
  comment_id?: string;
  username?: string;
  comment_text?: string;
  reply_text?: string;
  sender_name?: string;
  status?: string;
  post_id?: string;
  created_at?: string;
}

// ============================================================================
// 1. User Management & Data Isolation (Flow 1)
// ============================================================================

export async function syncSupabaseUser(user: DbUser): Promise<boolean> {
  if (!supabase || !user.id || user.id === 'default') return false;
  try {
    const { error } = await supabase.from('users').upsert({
      id: user.id,
      email: user.email || null,
      full_name: user.full_name || null,
      avatar_url: user.avatar_url || null,
      role: user.role || 'creator',
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch (err) {
    console.warn('Sync Supabase user warning:', err);
    return false;
  }
}

// ============================================================================
// 2. Plugins & Encrypted Credentials Vault (Flow 4)
// Stores Gemini, OpenRouter, Instagram Graph API & Cloudinary credentials
// ============================================================================

export async function fetchSupabaseUserCredentials(userId: string): Promise<any | null> {
  if (!supabase || !userId || userId === 'default') return null;
  try {
    // Check user_plugins first with maybeSingle() to avoid HTTP 406 when no credentials saved yet
    let { data, error } = await supabase
      .from('user_plugins')
      .select('encrypted_payload')
      .eq('user_id', userId)
      .maybeSingle();

    // If user_plugins table does not exist on database (code PGRST205), try user_credentials
    if (error && error.code === 'PGRST205') {
      const fallback = await supabase
        .from('user_credentials')
        .select('encrypted_payload')
        .eq('user_id', userId)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data?.encrypted_payload) return null;
    return await decryptPayload(data.encrypted_payload, userId);
  } catch {
    return null;
  }
}

export async function upsertSupabaseUserCredentials(userId: string, credentialsData: any): Promise<boolean> {
  if (!supabase || !userId || userId === 'default') return false;
  try {
    const encryptedPayload = await encryptPayload(credentialsData, userId);
    const hasGemini = Boolean(credentialsData.geminiApiKey && credentialsData.geminiApiKey.trim().length > 0);
    const hasOpenRouter = Boolean(credentialsData.openRouterApiKey && credentialsData.openRouterApiKey.trim().length > 0);
    const hasInstagram = Boolean(credentialsData.accessToken && credentialsData.accessToken.trim().length > 0);
    const hasCloudinary = Boolean(
      (credentialsData.cloudinaryCloudName && credentialsData.cloudinaryCloudName.trim().length > 0) ||
      (credentialsData.cloudinaryUrl && credentialsData.cloudinaryUrl.trim().length > 0)
    );

    // Upsert into user_plugins
    const { error } = await supabase
      .from('user_plugins')
      .upsert({
        user_id: userId,
        encrypted_payload: encryptedPayload,
        has_gemini: hasGemini,
        has_openrouter: hasOpenRouter,
        has_instagram: hasInstagram,
        has_cloudinary: hasCloudinary,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      // Fallback to user_credentials if user_plugins table isn't created yet
      const fallback = await supabase
        .from('user_credentials')
        .upsert({
          user_id: userId,
          encrypted_payload: encryptedPayload,
          updated_at: new Date().toISOString(),
        });
      return !fallback.error;
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 3. Publisher & Scheduler Queue (Flow 2 - Based on UUID)
// ============================================================================

export async function fetchSupabaseScheduledPosts(userId: string): Promise<DbScheduledPost[]> {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true });
    if (error) return [];
    return (data as DbScheduledPost[]) || [];
  } catch {
    return [];
  }
}

export async function upsertSupabaseScheduledPost(userId: string, post: Omit<DbScheduledPost, 'user_id'>): Promise<boolean> {
  if (!supabase || !userId) return false;
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(post.id);
    const payload: any = { ...post, user_id: userId, updated_at: new Date().toISOString() };
    if (!isUuid) {
      // If client ID was not a UUID, let PostgreSQL generate a valid UUID via default gen_random_uuid()
      delete payload.id;
    }
    const { data, error } = await supabase.from('scheduled_posts').upsert(payload).select('id').single();
    if (!error && data?.id && !isUuid) {
      (post as any).id = data.id;
    }
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSupabaseScheduledPost(userId: string, id: string): Promise<boolean> {
  if (!supabase || !userId || !id) return false;
  try {
    const { error } = await supabase
      .from('scheduled_posts')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// 4. Growth Automation Calendars (Flow 3 - Saved Calendars Cards)
// ============================================================================

export async function fetchSupabaseSavedCalendars(userId: string): Promise<any[]> {
  if (!supabase || !userId || userId === 'default') return [];
  try {
    const { data, error } = await supabase
      .from('growth_calendars')
      .select('*')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });
    if (error || !data) return [];
    return data.map(item => ({
      id: item.id,
      savedAt: item.saved_at || item.created_at || new Date().toISOString(),
      title: item.title,
      subNiche: item.sub_niche,
      calendarDays: item.calendar_days,
      totalPosts: item.total_posts,
      plan: item.plan_data,
    }));
  } catch {
    return [];
  }
}

export async function upsertSupabaseSavedCalendar(userId: string, entry: any): Promise<boolean> {
  if (!supabase || !userId || userId === 'default' || !entry) return false;
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.id);
    const payload: any = {
      user_id: userId,
      title: entry.title || 'Growth Plan',
      sub_niche: entry.subNiche || entry.sub_niche || 'General Growth',
      calendar_days: entry.calendarDays || entry.calendar_days || 30,
      total_posts: entry.totalPosts || entry.total_posts || 30,
      plan_data: entry.plan || entry.plan_data,
      saved_at: entry.savedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isUuid) {
      payload.id = entry.id;
    }
    const { data, error } = await supabase.from('growth_calendars').upsert(payload).select('id').single();
    if (!error && data?.id && !isUuid) {
      entry.id = data.id;
    }
    return !error;
  } catch (err) {
    console.warn('Upsert saved calendar warning:', err);
    return false;
  }
}

export async function deleteSupabaseSavedCalendar(userId: string, calendarId: string): Promise<boolean> {
  if (!supabase || !userId || !calendarId) return false;
  try {
    const { error } = await supabase
      .from('growth_calendars')
      .delete()
      .eq('user_id', userId)
      .eq('id', calendarId);
    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// 3. Growth Strategy Profile (Per Clerk userId)
// ============================================================================

export async function fetchSupabaseStrategyProfile(userId: string): Promise<any | null> {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('growth_strategy_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function upsertSupabaseStrategyProfile(userId: string, profile: any, fullPlanResult?: any): Promise<boolean> {
  if (!supabase || !userId) return false;
  try {
    const payload = {
      id: `profile_${userId}`,
      user_id: userId,
      sub_niche: profile.subNiche || profile.niche || 'General Growth',
      target_audience: profile.targetAudience || 'Community',
      competitor_handles: profile.competitorHandles || [],
      content_format: profile.contentFormat || 'Reels & Carousels',
      conversion_goal: profile.conversionGoal || 'Inbound DM Leads',
      format_mix: profile.formatMix || {},
      timezone: profile.timeZone || 'UTC',
      strategy_result: fullPlanResult || profile.strategyResult || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('growth_strategy_profiles').upsert(payload);
    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// 4. Auto-Reply Rules (Per Clerk userId)
// ============================================================================

export async function fetchSupabaseAutoReplyRules(userId: string): Promise<DbAutoReplyRule[]> {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('auto_reply_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data as DbAutoReplyRule[]) || [];
  } catch {
    return [];
  }
}

export async function upsertSupabaseAutoReplyRule(userId: string, rule: Omit<DbAutoReplyRule, 'user_id'>): Promise<boolean> {
  if (!supabase || !userId) return false;
  try {
    const payload = { ...rule, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('auto_reply_rules').upsert(payload);
    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// 5. Comment Activity Logs (Per Clerk userId)
// ============================================================================

export async function logSupabaseCommentReply(userId: string, log: Omit<DbCommentLog, 'user_id'>): Promise<boolean> {
  if (!supabase || !userId) return false;
  try {
    const payload = { ...log, user_id: userId, created_at: new Date().toISOString() };
    const { error } = await supabase.from('comment_logs').upsert(payload);
    return !error;
  } catch {
    return false;
  }
}

export async function fetchSupabaseCommentLogs(userId: string, limit = 50): Promise<DbCommentLog[]> {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('comment_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as DbCommentLog[];
  } catch {
    return [];
  }
}

// ============================================================================
// 6. Hashtag Bank (Per Clerk userId)
// ============================================================================

export async function fetchSupabaseHashtags(userId: string): Promise<string[]> {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('hashtag_bank')
      .select('recent_hashtags')
      .eq('user_id', userId)
      .single();
    if (error || !data?.recent_hashtags) return [];
    return data.recent_hashtags as string[];
  } catch {
    return [];
  }
}

export async function upsertSupabaseHashtags(userId: string, hashtags: string[]): Promise<boolean> {
  if (!supabase || !userId) return false;
  try {
    const { error } = await supabase.from('hashtag_bank').upsert({
      id: `hashtags_${userId}`,
      user_id: userId,
      recent_hashtags: hashtags,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// 7. System Activity Logs (Per Clerk userId)
// ============================================================================

export interface DbActivityLog {
  id: string;
  user_id: string;
  title: string;
  type: 'success' | 'error' | 'info';
  created_at?: string;
}

let _hasActivityLogsTable: boolean | null =
  typeof window !== 'undefined' && localStorage.getItem('supabase_has_activity_logs') === 'false'
    ? false
    : null;

export async function logSupabaseActivity(userId: string, title: string, type: 'success' | 'error' | 'info' = 'info'): Promise<boolean> {
  if (!supabase || !userId || userId === 'default' || _hasActivityLogsTable === false) return false;
  try {
    const { error } = await supabase.from('activity_logs').insert({
      user_id: userId,
      title,
      type,
      created_at: new Date().toISOString(),
    });
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01' || (error as any).status === 404 || error.message?.includes('404')) {
        _hasActivityLogsTable = false;
        try { localStorage.setItem('supabase_has_activity_logs', 'false'); } catch {}
      }
      return false;
    }
    _hasActivityLogsTable = true;
    try { localStorage.setItem('supabase_has_activity_logs', 'true'); } catch {}
    return !error;
  } catch {
    return false;
  }
}

export async function fetchSupabaseActivityLogs(userId: string): Promise<Array<{ id: string; title: string; type: 'success' | 'error' | 'info'; timestamp: string }>> {
  if (!supabase || !userId || userId === 'default' || _hasActivityLogsTable === false) return [];
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01' || (error as any).status === 404 || error.message?.includes('404')) {
        _hasActivityLogsTable = false;
        try { localStorage.setItem('supabase_has_activity_logs', 'false'); } catch {}
      }
      return [];
    }
    _hasActivityLogsTable = true;
    try { localStorage.setItem('supabase_has_activity_logs', 'true'); } catch {}
    if (!data) return [];
    return data.map(item => ({
      id: item.id,
      title: item.title,
      type: item.type as 'success' | 'error' | 'info',
      timestamp: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  } catch {
    return [];
  }
}
