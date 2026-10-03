import React, { useState, useEffect, useRef } from 'react';
import { ApiConfig, HashtagSearchResult, InstagramMedia, GrowthStrategyProfile } from '../../types/instagram';
import { searchHashtags, getHashtagTopMedia } from '../../services/instagramApi';
import { getScopedKey } from '../../services/security';
import { StickerCard } from '../common/StickerCard';
import { HardInput } from '../common/HardInput';
import { useActivity } from '../../context/ActivityContext';
import { CandyButton } from '../common/CandyButton';
import { Hash, Search, ExternalLink, Heart, MessageCircle, Flame, Target, Loader2, Zap, Sparkles } from 'lucide-react';

interface HashtagScannerViewProps {
  config: ApiConfig;
  profile?: GrowthStrategyProfile | null;
  onOpenStrategyModal?: () => void;
  userId?: string;
}

export const HashtagScannerView: React.FC<HashtagScannerViewProps> = ({
  config,
  profile,
  onOpenStrategyModal,
  userId,
}) => {
  const { addActivity } = useActivity();

  const getCleanTopic = (prof?: GrowthStrategyProfile | null) => {
    if (!prof?.subNiche) return '';
    const words = prof.subNiche.split(/[\s,]+/).map(w => w.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean);
    return words[0] || 'growth';
  };

  const [query, setQuery] = useState(() => getCleanTopic(profile) || 'growth');
  const [hashtags, setHashtags] = useState<HashtagSearchResult[]>([]);
  const [selectedTag, setSelectedTag] = useState<HashtagSearchResult | null>(null);
  const [topMedia, setTopMedia] = useState<InstagramMedia[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingTopMedia, setIsLoadingTopMedia] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [prefetchedTerm, setPrefetchedTerm] = useState<string | null>(null);

  // In-memory cache for fast instant display
  const cacheRef = useRef<Map<string, { tags: HashtagSearchResult[]; topMediaMap: Record<string, InstagramMedia[]> }>>(new Map());
  const activePrefetchRef = useRef<{ term: string; promise: Promise<{ tags: HashtagSearchResult[]; topMediaMap: Record<string, InstagramMedia[]> }> } | null>(null);

  const [recentAiHashtags, setRecentAiHashtags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('instagrowth_recent_hashtags', userId));
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (profile?.subNiche) {
      const cleanKeyword = getCleanTopic(profile);
      if (cleanKeyword && !query) {
        setQuery(cleanKeyword);
      }
      // Refresh recent tags from localStorage in case profile just updated it
      try {
        const saved = localStorage.getItem(getScopedKey('instagrowth_recent_hashtags', userId));
        if (saved) {
          setRecentAiHashtags(JSON.parse(saved));
        }
      } catch (e) {
        // ignore
      }
    }
  }, [profile, userId]);

  // Background pre-fetching as the user writes before touching "Scan Hashtags"
  useEffect(() => {
    const clean = query.replace(/^#+/, '').trim().toLowerCase();
    if (!clean || clean.length < 2 || !config.accessToken || !config.selectedIgUserId) {
      setIsPrefetching(false);
      return;
    }

    // If already in memory cache, mark as ready
    const cached = cacheRef.current.get(clean);
    if (cached && cached.tags.length > 0) {
      setPrefetchedTerm(clean);
      setIsPrefetching(false);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsPrefetching(true);
      try {
        const promise = (async () => {
          const tags = await searchHashtags(clean, config.selectedIgUserId!, config.accessToken!);
          const topMediaMap: Record<string, InstagramMedia[]> = {};
          if (tags.length > 0) {
            try {
              const media = await getHashtagTopMedia(tags[0].id, config.selectedIgUserId!, config.accessToken!);
              topMediaMap[tags[0].id] = media;
            } catch (e) {
              // ignore
            }
          }
          return { tags, topMediaMap };
        })();

        activePrefetchRef.current = { term: clean, promise };
        const result = await promise;
        if (!isCancelled) {
          cacheRef.current.set(clean, result);
          setPrefetchedTerm(clean);
          setIsPrefetching(false);
        }
      } catch (e) {
        if (!isCancelled) {
          setIsPrefetching(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, config.accessToken, config.selectedIgUserId]);

  const handleSearchWithTerm = async (searchTerm: string) => {
    const clean = searchTerm.replace(/^#+/, '').trim().toLowerCase();
    setQuery(clean);
    if (!clean || !config.accessToken || !config.selectedIgUserId) {
      addActivity('Please connect your Instagram Graph API credentials first.', 'error');
      return;
    }

    // 1. Instant cache hit - zero delay!
    const cached = cacheRef.current.get(clean);
    if (cached && cached.tags.length > 0) {
      setHashtags(cached.tags);
      const firstTag = cached.tags[0];
      setSelectedTag(firstTag);
      if (cached.topMediaMap[firstTag.id]) {
        setTopMedia(cached.topMediaMap[firstTag.id]);
      } else {
        handleSelectHashtag(firstTag, clean);
      }
      return;
    }

    // 2. Active background prefetch in flight - await and show loader immediately
    if (activePrefetchRef.current && activePrefetchRef.current.term === clean) {
      setIsSearching(true);
      try {
        const prefetched = await activePrefetchRef.current.promise;
        cacheRef.current.set(clean, prefetched);
        setHashtags(prefetched.tags);
        if (prefetched.tags.length > 0) {
          const firstTag = prefetched.tags[0];
          setSelectedTag(firstTag);
          setTopMedia(prefetched.topMediaMap[firstTag.id] || []);
        } else {
          setSelectedTag(null);
          setTopMedia([]);
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
      return;
    }

    // 3. Direct fetch with loader
    setIsSearching(true);
    try {
      const tags = await searchHashtags(clean, config.selectedIgUserId, config.accessToken);
      setHashtags(tags);
      if (tags.length > 0) {
        const firstTag = tags[0];
        setSelectedTag(firstTag);
        setIsLoadingTopMedia(true);
        try {
          const media = await getHashtagTopMedia(firstTag.id, config.selectedIgUserId, config.accessToken);
          setTopMedia(media);
          cacheRef.current.set(clean, { tags, topMediaMap: { [firstTag.id]: media } });
        } catch {
          setTopMedia([]);
        } finally {
          setIsLoadingTopMedia(false);
        }
      } else {
        setSelectedTag(null);
        setTopMedia([]);
      }
    } catch (err: any) {
      console.error(err);
      addActivity(`Hashtag scan error: ${err.message || err}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => handleSearchWithTerm(query);

  const handleSelectHashtag = async (tag: HashtagSearchResult, currentTerm?: string) => {
    setSelectedTag(tag);
    const term = (currentTerm || query).replace(/^#+/, '').trim().toLowerCase();

    // Check if top media for this specific hashtag is cached
    const cached = cacheRef.current.get(term);
    if (cached && cached.topMediaMap[tag.id]) {
      setTopMedia(cached.topMediaMap[tag.id]);
      return;
    }

    if (!config.accessToken || !config.selectedIgUserId) return;
    setIsLoadingTopMedia(true);
    try {
      const media = await getHashtagTopMedia(
        tag.id,
        config.selectedIgUserId,
        config.accessToken
      );
      setTopMedia(media);
      if (cached) {
        cached.topMediaMap[tag.id] = media;
      } else {
        cacheRef.current.set(term, { tags: hashtags, topMediaMap: { [tag.id]: media } });
      }
    } catch (err: any) {
      console.warn('Failed to load top media for hashtag:', err?.message || err);
      setTopMedia([]);
    } finally {
      setIsLoadingTopMedia(false);
    }
  };

  const cleanQueryLower = query.replace(/^#+/, '').trim().toLowerCase();
  const isDataPrecached = prefetchedTerm === cleanQueryLower;

  return (
    <div className="space-y-6">
      {/* Meta 2025/2026 Policy Guidance */}
      <div className="p-3.5 bg-gradient-to-r from-violet-50 to-blue-50 border-2 border-violet-200 rounded-2xl flex items-center gap-3 text-xs text-slate-700">
        <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white font-extrabold text-[10px] uppercase tracking-wider shrink-0">
          Meta 2025/2026 Standard
        </span>
        <p className="font-medium text-slate-700">
          Use scanner to find <strong>3–5 ultra-specific niche tags</strong> matching your industry. High-volume generic tags no longer boost Explore distribution; pair these tags with keyword-rich post captions.
        </p>
      </div>

      <StickerCard
        title="Live Niche Hashtag Search & Viral Top Media Engine"
        subtitle="Graph API Endpoints GET /ig_hashtag_search & GET /{hashtag-id}/top_media"
        icon={Hash}
        iconBgColor="bg-yellowPop text-slateDark"
        shadowColor="yellow"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 max-w-xl w-full">
            <HardInput
              label="Search Niche Keyword"
              placeholder="e.g. artisan, ceramics, reels"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              badge={
                isPrefetching
                  ? "⚡ Pre-collecting data..."
                  : isDataPrecached
                  ? "⚡ Instant Ready"
                  : undefined
              }
            />
            <CandyButton
              variant="yellow"
              size="md"
              onClick={handleSearch}
              disabled={isSearching}
              icon={isSearching ? Loader2 : Search}
              className="shrink-0 mb-0.5 w-full sm:w-auto justify-center"
            >
              {isSearching ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" /> Scanning...
                </span>
              ) : (
                'Scan Hashtags'
              )}
            </CandyButton>
          </div>

          {/* AI Discovered & Saved Hashtags Strip */}
          {recentAiHashtags.length > 0 && (
            <div className="pt-2 border-t-2 border-slateDark/10 space-y-1.5">
              <div className="text-[11px] font-heading font-black text-slateDark flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Target size={12} className="text-violetBrand" />
                  <span>
                    ⚡ Niche & AI Hashtags {profile?.subNiche ? `(${profile.subNiche})` : '(from Publisher & Strategy)'}:
                  </span>
                </span>
                {onOpenStrategyModal && (
                  <button
                    type="button"
                    onClick={onOpenStrategyModal}
                    className="text-[10px] text-violetBrand hover:underline font-bold"
                  >
                    Edit Strategy
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {recentAiHashtags.map((tag: string, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSearchWithTerm(tag)}
                    className="px-2.5 py-1 rounded-lg bg-yellowPop/80 hover:bg-yellowPop text-slateDark font-heading font-bold text-[11px] border border-slateDark transition-all shadow-pop-sm"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </StickerCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Column 1: Matching Hashtag IDs with Vertical Scrollbar */}
        <StickerCard title="Matching Hashtag IDs" subtitle="Select hashtag to view top viral posts" className="lg:col-span-1">
          {isSearching ? (
            <div className="space-y-2.5 p-1 animate-pulse">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="p-3 rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-slate-300" />
                    <div className="w-24 h-4 rounded bg-slate-300" />
                  </div>
                  <div className="w-16 h-4 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : hashtags.length === 0 ? (
            <p className="text-xs text-slate-500 font-bold p-3 text-center">
              Search a keyword above to find official Meta hashtag IDs.
            </p>
          ) : (
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-300">
              {hashtags.map((t: HashtagSearchResult) => {
                const displayName = t.name || query.replace(/^#+/, '').trim();
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectHashtag(t)}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between gap-2 ${
                      selectedTag?.id === t.id
                        ? 'bg-yellowPop border-slateDark shadow-pop-sm font-bold text-slateDark'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-heading font-bold text-xs truncate">
                      <Hash size={16} className="shrink-0" />
                      <span className="truncate">#{displayName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                      ID: {t.id}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </StickerCard>

        {/* Column 2: Top Media with Vertical Scrollbar */}
        <StickerCard
          title={`Top Media for #${selectedTag?.name || query.replace(/^#+/, '').trim() || 'hashtag'}`}
          subtitle="Fetched directly via Graph API /{hashtag-id}/top_media"
          icon={Flame}
          iconBgColor="bg-rose-500 text-white"
          shadowColor="pink"
          className="lg:col-span-2"
        >
          {isSearching || isLoadingTopMedia ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-violetBrand bg-violet-50 py-2.5 px-3.5 rounded-xl border-2 border-violet-200">
                <Loader2 size={16} className="animate-spin text-violetBrand shrink-0" />
                <span>Fetching viral top media directly from Meta Graph API...</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map(n => (
                  <div key={n} className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm animate-pulse">
                    <div className="h-44 bg-slate-200" />
                    <div className="p-3 space-y-2">
                      <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : topMedia.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-bold bg-white border-2 border-dashed border-slate-200 rounded-2xl">
              <p className="text-xs">No media found for this hashtag yet.</p>
              <p className="text-[11px] text-slate-400 font-normal mt-1">Select another matching hashtag on the left or try another niche keyword.</p>
            </div>
          ) : (
            <div className="max-h-[580px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-1">
                {topMedia.map((m: InstagramMedia) => (
                  <div key={m.id} className="bg-white border-2 border-slateDark rounded-xl overflow-hidden shadow-pop-sm flex flex-col justify-between">
                    <div className="relative h-44 bg-slate-100 border-b-2 border-slateDark flex items-center justify-center overflow-hidden">
                      {m.media_url ? (
                        <img src={m.media_url} alt="Hashtag media" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                          <Flame size={28} className="text-pinkPop" />
                          <span className="text-[10px] font-mono font-bold uppercase">{m.media_type || 'POST'}</span>
                        </div>
                      )}
                      {m.permalink && (
                        <a
                          href={m.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute top-2 right-2 w-7 h-7 bg-white text-slateDark rounded-full border border-slateDark flex items-center justify-center shadow-pop-sm hover:bg-yellowPop transition-all"
                          title="View on Instagram"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <p className="text-xs font-medium text-slate-700 line-clamp-2">{m.caption || 'No caption'}</p>
                      <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1 text-rose-600">
                          <Heart size={14} fill="currentColor" /> {m.like_count || 0}
                        </span>
                        <span className="flex items-center gap-1 text-violet-700">
                          <MessageCircle size={14} /> {m.comments_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </StickerCard>
      </div>
    </div>
  );
};
