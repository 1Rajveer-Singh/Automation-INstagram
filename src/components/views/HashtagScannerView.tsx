import React, { useState, useEffect } from 'react';
import { ApiConfig, HashtagSearchResult, InstagramMedia, GrowthStrategyProfile } from '../../types/instagram';
import { searchHashtags, getHashtagTopMedia } from '../../services/instagramApi';
import { getScopedKey } from '../../services/security';
import { StickerCard } from '../common/StickerCard';
import { HardInput } from '../common/HardInput';
import { useActivity } from '../../context/ActivityContext';
import { CandyButton } from '../common/CandyButton';
import { Hash, Search, ExternalLink, Heart, MessageCircle, Flame, Target } from 'lucide-react';

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
  const [recentAiHashtags, setRecentAiHashtags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('instagrowth_recent_hashtags', userId));
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
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

  const handleSearchWithTerm = async (searchTerm: string) => {
    const clean = searchTerm.replace(/#/g, '').trim();
    setQuery(clean);
    if (!clean || !config.accessToken || !config.selectedIgUserId) {
      addActivity('Please connect your Instagram Graph API credentials first.', 'error');
      return;
    }

    setIsSearching(true);
    try {
      const tags = await searchHashtags(clean, config.selectedIgUserId, config.accessToken);
      setHashtags(tags);
      if (tags.length > 0) {
        handleSelectHashtag(tags[0]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => handleSearchWithTerm(query);

  const handleSelectHashtag = async (tag: HashtagSearchResult) => {
    setSelectedTag(tag);
    if (!config.accessToken || !config.selectedIgUserId) return;
    try {
      const media = await getHashtagTopMedia(
        tag.id,
        config.selectedIgUserId,
        config.accessToken
      );
      setTopMedia(media);
    } catch (err: any) {
      console.warn('Failed to load top media for hashtag:', err?.message || err);
      setTopMedia([]);
    }
  };

  return (
    <div className="space-y-6">
      <StickerCard
        title="Live Niche Hashtag Search & Viral Top Media Engine"
        subtitle="Graph API Endpoints GET /ig_hashtag_search & GET /{hashtag-id}/top_media"
        icon={Hash}
        iconBgColor="bg-yellowPop text-slateDark"
        shadowColor="yellow"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-end gap-3 max-w-xl">
            <HardInput
              label="Search Niche Keyword"
              placeholder="e.g. artisan, ceramics, reels"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <CandyButton
              variant="yellow"
              size="md"
              onClick={handleSearch}
              disabled={isSearching}
              icon={Search}
              className="shrink-0 mb-0.5"
            >
              {isSearching ? 'Scanning...' : 'Scan Hashtags'}
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
          {hashtags.length === 0 ? (
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
          {topMedia.length === 0 ? (
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
