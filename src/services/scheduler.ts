import { ScheduledPost, MediaContainerRequest } from '../types/instagram';
import { createMediaContainer, checkContainerStatus, publishMediaContainer, createCarouselItemContainer } from './instagramApi';
import { ensureHttpsMediaUrl } from './cloudinaryService';
import {
  fetchSupabaseScheduledPosts,
  upsertSupabaseScheduledPost,
  deleteSupabaseScheduledPost,
  DbScheduledPost,
} from './supabaseService';

const BASE_STORAGE_KEY = 'insta_growth_scheduled_posts_v1';
let _schedulerUserId = 'default';

/** Call once after Clerk resolves — scopes all queue reads/writes to this user */
export function setSchedulerUserScope(userId: string | null | undefined): void {
  _schedulerUserId = userId && userId.trim() ? userId.trim() : 'default';
}

export function getSchedulerUserScope(): string {
  return _schedulerUserId;
}

function getStorageKey(userId?: string): string {
  const activeId = userId || _schedulerUserId;
  return activeId && activeId !== 'default'
    ? `${BASE_STORAGE_KEY}_user_${activeId}`
    : `${BASE_STORAGE_KEY}_default`;
}

export function getScheduledPosts(userId?: string): ScheduledPost[] {
  const activeId = userId || _schedulerUserId;
  // Strictly prevent unauthenticated/default queue data leakage across accounts
  if (!activeId || activeId === 'default') {
    return [];
  }
  try {
    const raw = localStorage.getItem(getStorageKey(activeId));
    if (!raw) return [];
    const parsed: ScheduledPost[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Directly syncs queue with Supabase cloud database per authenticated user.
 * The database is the authoritative source of truth — no stale demo or orphaned local storage posts.
 */
export async function syncScheduledPostsWithSupabase(userId?: string): Promise<ScheduledPost[]> {
  const activeId = userId || _schedulerUserId;
  if (!activeId || activeId === 'default') {
    return [];
  }

  // Purge any unauthenticated/default demo keys
  try {
    localStorage.removeItem(`${BASE_STORAGE_KEY}_default`);
  } catch {}

  try {
    const remotePosts = await fetchSupabaseScheduledPosts(activeId);
    if (Array.isArray(remotePosts)) {
      const mapped: ScheduledPost[] = remotePosts.map(r => ({
        id: r.id,
        mediaType: r.media_type,
        mediaUrl: r.media_url,
        caption: r.caption,
        scheduledTime: r.scheduled_time,
        status: r.status,
        containerId: r.container_id,
        errorMessage: r.error_message,
        dateStr: r.date_str,
        dayOfWeek: r.day_of_week,
        timeStr: r.time_str,
        platform: r.platform,
        contentPillar: r.content_pillar,
        postTopic: r.post_topic,
        visualType: r.visual_type,
        thumbnailUrl: r.thumbnail_url || r.media_url?.split(/[\n,]+/)[0]?.trim(),
        finalContentLink: r.final_content_link || r.media_url,
        designReference: r.design_reference,
        carouselMedia: r.media_url?.includes('\n') ? r.media_url : undefined,
        createdAt: r.created_at || new Date().toISOString(),
      }));

      // Directly update local cache with authoritative Supabase database rows
      localStorage.setItem(getStorageKey(activeId), JSON.stringify(mapped));
      return mapped;
    }
  } catch (err) {
    console.warn('Supabase queue sync notice:', err);
  }
  return getScheduledPosts(activeId);
}

function mapToDbPost(post: ScheduledPost): Omit<DbScheduledPost, 'user_id'> {
  return {
    id: post.id,
    media_type: post.mediaType,
    media_url: post.mediaUrl,
    caption: post.caption,
    scheduled_time: post.scheduledTime,
    status: post.status,
    container_id: post.containerId,
    error_message: post.errorMessage,
    date_str: post.dateStr,
    day_of_week: post.dayOfWeek,
    time_str: post.timeStr,
    platform: post.platform,
    content_pillar: post.contentPillar,
    post_topic: post.postTopic,
    visual_type: post.visualType,
    thumbnail_url: post.thumbnailUrl,
    final_content_link: post.finalContentLink,
    design_reference: post.designReference,
    created_at: post.createdAt,
    updated_at: new Date().toISOString(),
  };
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function saveScheduledPost(
  post: Omit<ScheduledPost, 'id' | 'createdAt' | 'status'> & { status?: ScheduledPost['status'] },
  userId?: string
): Promise<ScheduledPost> {
  const activeId = userId || _schedulerUserId;
  if (!activeId || activeId === 'default') {
    throw new Error('User authentication scope required to schedule posts.');
  }

  const newPost: ScheduledPost = {
    ...post,
    id: generateUuid(),
    status: post.status || 'QUEUED',
    createdAt: new Date().toISOString(),
  };

  // 1. Persist directly to Supabase cloud database
  try {
    await upsertSupabaseScheduledPost(activeId, mapToDbPost(newPost));
  } catch (err) {
    console.warn('Failed to upsert to Supabase scheduled_posts:', err);
  }

  // 2. Update local storage cache
  const posts = getScheduledPosts(activeId);
  const updated = [newPost, ...posts.filter(p => p.id !== newPost.id)];
  localStorage.setItem(getStorageKey(activeId), JSON.stringify(updated));

  return newPost;
}

export async function saveBatchScheduledPosts(
  batch: Array<Omit<ScheduledPost, 'id' | 'createdAt' | 'status'> & { status?: ScheduledPost['status'] }>,
  userId?: string
): Promise<ScheduledPost[]> {
  const activeId = userId || _schedulerUserId;
  if (!activeId || activeId === 'default') {
    throw new Error('User authentication scope required to batch schedule posts.');
  }

  const created: ScheduledPost[] = [];
  for (const item of batch) {
    const newPost: ScheduledPost = {
      ...item,
      id: generateUuid(),
      status: item.status || 'QUEUED',
      createdAt: new Date().toISOString(),
    };
    created.push(newPost);
    try {
      await upsertSupabaseScheduledPost(activeId, mapToDbPost(newPost));
    } catch (err) {
      console.warn('Failed to upsert batch post to Supabase:', err);
    }
  }

  const existing = getScheduledPosts(activeId);
  const combined = [...created, ...existing];
  localStorage.setItem(getStorageKey(activeId), JSON.stringify(combined));
  return created;
}

export async function updateScheduledPost(id: string, updates: Partial<ScheduledPost>, userId?: string): Promise<void> {
  const activeId = userId || _schedulerUserId;
  if (!activeId || activeId === 'default') return;

  const currentPosts = getScheduledPosts(activeId);
  const target = currentPosts.find(p => p.id === id);
  if (target) {
    const updated = { ...target, ...updates };
    try {
      await upsertSupabaseScheduledPost(activeId, mapToDbPost(updated));
    } catch (err) {
      console.warn('Failed to update post in Supabase:', err);
    }
  }

  const posts = currentPosts.map(p => {
    if (p.id === id) {
      return { ...p, ...updates };
    }
    return p;
  });
  localStorage.setItem(getStorageKey(activeId), JSON.stringify(posts));
}

export async function deleteScheduledPost(id: string, userId?: string): Promise<void> {
  const activeId = userId || _schedulerUserId;
  if (!activeId || activeId === 'default') return;

  // 1. Delete from Supabase database
  try {
    await deleteSupabaseScheduledPost(activeId, id);
  } catch (err) {
    console.warn('Failed to delete post from Supabase:', err);
  }

  // 2. Remove from local cache
  const posts = getScheduledPosts(activeId).filter(p => p.id !== id);
  localStorage.setItem(getStorageKey(activeId), JSON.stringify(posts));
}

/**
 * Auto-publish due posts loop via Meta Graph API
 */
function resolvePostMediaType(
  mediaUrl: string,
  declaredType?: string
): 'IMAGE' | 'REELS' {
  const url = (mediaUrl || '').toLowerCase();
  if (
    url.includes('.mp4') ||
    url.includes('.mov') ||
    url.includes('.webm') ||
    url.includes('/video/upload/')
  ) {
    return 'REELS';
  }
  if (
    url.includes('.jpg') ||
    url.includes('.jpeg') ||
    url.includes('.png') ||
    url.includes('.webp') ||
    url.includes('/image/upload/') ||
    url.includes('unsplash.com')
  ) {
    return 'IMAGE';
  }
  const upper = (declaredType || '').toUpperCase().trim();
  if (upper.includes('REEL') || upper.includes('VIDEO')) return 'REELS';
  return 'IMAGE';
}

export async function checkAndPublishDuePosts(
  igUserId: string,
  accessToken: string,
  userId?: string
): Promise<number> {
  const activeId = userId || _schedulerUserId;
  if (!accessToken || !igUserId || !activeId || activeId === 'default') return 0;
  
  const posts = await syncScheduledPostsWithSupabase(activeId);
  const now = new Date().getTime();
  let publishedCount = 0;

  for (const post of posts) {
    if (post.status !== 'QUEUED') continue;

    const scheduledTime = new Date(post.scheduledTime).getTime();
    if (scheduledTime <= now) {
      await updateScheduledPost(post.id, { status: 'PROCESSING' }, activeId);

      try {
        const rawCarousel = post.carouselMedia || (post.mediaUrl?.includes('\n') ? post.mediaUrl : '');
        const carouselUrls = rawCarousel
          ? rawCarousel.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
          : [];
        const isMultiCarousel = (post.mediaType === 'CAROUSEL' || carouselUrls.length > 1) && carouselUrls.length >= 2;

        let activeContainerId = '';

        if (isMultiCarousel) {
          const childIds: string[] = [];
          for (let i = 0; i < carouselUrls.length; i++) {
            let itemUrl = carouselUrls[i];
            if (!itemUrl.toLowerCase().startsWith('https://')) {
              itemUrl = await ensureHttpsMediaUrl(itemUrl, 'image', undefined, activeId);
            }
            const itemRes = await createCarouselItemContainer(igUserId, accessToken, itemUrl);
            childIds.push(itemRes.id);
          }
          const parentRes = await createMediaContainer(igUserId, accessToken, {
            media_type: 'CAROUSEL',
            children: childIds,
            caption: post.caption,
            location_id: post.locationName || undefined,
          });
          activeContainerId = parentRes.id;
        } else {
          let rawMediaUrl = post.finalContentLink || post.mediaUrl || carouselUrls[0];
          if (!rawMediaUrl) {
            throw new Error('A valid media URL is required to publish.');
          }
          let targetMedia = rawMediaUrl.split(/[\n,;]+/)[0].trim();

          const resolvedType = resolvePostMediaType(targetMedia, post.mediaType || post.visualType);
          const isVideo = resolvedType === 'REELS';

          // Auto-resolve non-HTTPS URLs / local disk paths to Cloudinary HTTPS
          if (!targetMedia.toLowerCase().startsWith('https://')) {
            const resType = isVideo ? 'video' : 'image';
            targetMedia = await ensureHttpsMediaUrl(targetMedia, resType, undefined, activeId);
            await updateScheduledPost(post.id, {
              mediaUrl: targetMedia,
              finalContentLink: targetMedia,
            }, activeId);
          }

          let resolvedCoverUrl = post.coverUrl;
          if (resolvedCoverUrl && !resolvedCoverUrl.toLowerCase().startsWith('https://')) {
            try {
              resolvedCoverUrl = await ensureHttpsMediaUrl(resolvedCoverUrl, 'image', undefined, activeId);
              await updateScheduledPost(post.id, { coverUrl: resolvedCoverUrl }, activeId);
            } catch {
              resolvedCoverUrl = undefined;
            }
          }

          const req: MediaContainerRequest = {
            media_type: isVideo ? 'REELS' : 'IMAGE',
            image_url: !isVideo ? targetMedia : undefined,
            video_url: isVideo ? targetMedia : undefined,
            cover_url: resolvedCoverUrl || undefined,
            caption: post.caption,
            location_id: post.locationName || undefined,
          };
          const container = await createMediaContainer(igUserId, accessToken, req);
          activeContainerId = container.id;
        }

        await updateScheduledPost(post.id, { containerId: activeContainerId }, activeId);

        // Poll container status until ready
        for (let attempt = 0; attempt < 12; attempt++) {
          await new Promise(r => setTimeout(r, 1500));
          const status = await checkContainerStatus(activeContainerId, accessToken);

          if (status.status_code === 'FINISHED' || status.status_code === 'PUBLISHED' || !status.status_code) {
            break;
          }

          if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
            throw new Error(status.status || 'Container creation error');
          }
        }

        await new Promise(r => setTimeout(r, 1000));
        await publishMediaContainer(igUserId, activeContainerId, accessToken);
        await updateScheduledPost(post.id, { status: 'PUBLISHED', errorMessage: undefined }, activeId);
        publishedCount++;
      } catch (err: any) {
        await updateScheduledPost(post.id, {
          status: 'FAILED',
          errorMessage: err.message || 'Publishing error',
        }, activeId);
      }
    }
  }

  return publishedCount;
}

/**
 * Manually trigger immediate publishing for a specific scheduled post
 */
export async function publishSingleScheduledPost(
  postId: string,
  igUserId: string,
  accessToken: string,
  userId?: string
): Promise<{ success: boolean; containerId?: string; error?: string }> {
  const activeId = userId || _schedulerUserId;
  if (!accessToken || !igUserId || !activeId || activeId === 'default') {
    throw new Error('Meta Graph API Access Token, IG User ID, and User Scope are required.');
  }

  const posts = await syncScheduledPostsWithSupabase(activeId);
  const post = posts.find(p => p.id === postId);
  if (!post) {
    throw new Error(`Scheduled post with ID ${postId} not found.`);
  }

  await updateScheduledPost(postId, { status: 'PROCESSING', errorMessage: undefined }, activeId);

  try {
    const rawCarousel = post.carouselMedia || (post.mediaUrl?.includes('\n') ? post.mediaUrl : '');
    const carouselUrls = rawCarousel
      ? rawCarousel.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
      : [];
    const isMultiCarousel = (post.mediaType === 'CAROUSEL' || carouselUrls.length > 1) && carouselUrls.length >= 2;

    let activeContainerId = '';

    if (isMultiCarousel) {
      const childIds: string[] = [];
      for (let i = 0; i < carouselUrls.length; i++) {
        let itemUrl = carouselUrls[i];
        if (!itemUrl.toLowerCase().startsWith('https://')) {
          itemUrl = await ensureHttpsMediaUrl(itemUrl, 'image', undefined, activeId);
        }
        const itemRes = await createCarouselItemContainer(igUserId, accessToken, itemUrl);
        childIds.push(itemRes.id);
      }
      const parentRes = await createMediaContainer(igUserId, accessToken, {
        media_type: 'CAROUSEL',
        children: childIds,
        caption: post.caption,
        location_id: post.locationName || undefined,
      });
      activeContainerId = parentRes.id;
    } else {
      let rawMediaUrl = post.finalContentLink || post.mediaUrl || carouselUrls[0];
      if (!rawMediaUrl) {
        throw new Error('A valid public media URL (Media URL or Carousel Media) is required to publish to Instagram.');
      }
      let targetMediaUrl = rawMediaUrl.split(/[\n,;]+/)[0].trim();

      const resolvedType = resolvePostMediaType(targetMediaUrl, post.mediaType || post.visualType);
      const isVideo = resolvedType === 'REELS';

      // Auto-resolve non-HTTPS URLs / local disk paths to Cloudinary HTTPS
      if (!targetMediaUrl.toLowerCase().startsWith('https://')) {
        const resType = isVideo ? 'video' : 'image';
        targetMediaUrl = await ensureHttpsMediaUrl(targetMediaUrl, resType, undefined, activeId);
        await updateScheduledPost(postId, {
          mediaUrl: targetMediaUrl,
          finalContentLink: targetMediaUrl,
        }, activeId);
      }

      let resolvedCoverUrl = post.coverUrl;
      if (resolvedCoverUrl && !resolvedCoverUrl.toLowerCase().startsWith('https://')) {
        try {
          resolvedCoverUrl = await ensureHttpsMediaUrl(resolvedCoverUrl, 'image', undefined, activeId);
          await updateScheduledPost(postId, { coverUrl: resolvedCoverUrl }, activeId);
        } catch {
          resolvedCoverUrl = undefined;
        }
      }

      const req: MediaContainerRequest = {
        media_type: isVideo ? 'REELS' : 'IMAGE',
        image_url: !isVideo ? targetMediaUrl : undefined,
        video_url: isVideo ? targetMediaUrl : undefined,
        cover_url: resolvedCoverUrl || undefined,
        caption: post.caption,
        location_id: post.locationName || undefined,
      };

      const container = await createMediaContainer(igUserId, accessToken, req);
      activeContainerId = container.id;
    }

    await updateScheduledPost(postId, { containerId: activeContainerId }, activeId);

    // Poll status until ready
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 1500));
      const status = await checkContainerStatus(activeContainerId, accessToken);

      if (status.status_code === 'FINISHED' || status.status_code === 'PUBLISHED' || !status.status_code) {
        break;
      }

      if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
        throw new Error(status.status || 'Container creation error');
      }
    }

    await new Promise(r => setTimeout(r, 1000));
    await publishMediaContainer(igUserId, activeContainerId, accessToken);
    await updateScheduledPost(postId, { status: 'PUBLISHED', errorMessage: undefined }, activeId);
    return { success: true, containerId: activeContainerId };
  } catch (err: any) {
    await updateScheduledPost(postId, {
      status: 'FAILED',
      errorMessage: err.message || 'Publishing error',
    }, activeId);
    return { success: false, error: err.message || 'Publishing error' };
  }
}
