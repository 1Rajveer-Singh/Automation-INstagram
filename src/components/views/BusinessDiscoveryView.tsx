import React, { useState, useEffect } from 'react';
import { ApiConfig, BusinessDiscoveryResult, GrowthStrategyProfile, InstagramMedia, SinglePostDiscoveryResult } from '../../types/instagram';
import { discoverBusinessAccount, discoverPostOrReel, parseInstagramPostUrl } from '../../services/instagramApi';
import { analyzeMediaCrawl, generateGrowthPrescription, GrowthPrescription, analyzeSinglePostMechanisms } from '../../services/crawlAnalytics';
import { getScopedKey } from '../../services/security';
import { StickerCard } from '../common/StickerCard';
import { HardInput } from '../common/HardInput';
import { useActivity } from '../../context/ActivityContext';
import { CandyButton } from '../common/CandyButton';
import {
  Search,
  ExternalLink,
  Heart,
  MessageCircle,
  Copy,
  Sparkles,
  TrendingUp,
  Target,
  Clock,
  Calendar,
  Image as ImageIcon,
  Film,
  Layers,
  Check,
  AlertCircle,
  ArrowUpRight,
  BarChart2,
  Zap,
  X,
  ChevronLeft,
  ChevronRight,
  Award,
  History,
  Trash2,
  Video,
  Share2,
  Bookmark,
  Play,
  FileText,
  Lightbulb,
  Compass,
  Users,
  Tag,
  Flame,
  ShieldCheck,
} from 'lucide-react';

interface BusinessDiscoveryViewProps {
  config: ApiConfig;
  profile?: GrowthStrategyProfile | null;
  onOpenStrategyModal?: () => void;
  userId?: string;
}

export const BusinessDiscoveryView: React.FC<BusinessDiscoveryViewProps> = ({
  config,
  profile = null,
  onOpenStrategyModal,
  userId,
}) => {
  const [targetUser, setTargetUser] = useState('');
  const [discoveryMode, setDiscoveryMode] = useState<'profile' | 'post'>('profile');
  const [result, setResult] = useState<BusinessDiscoveryResult | null>(null);
  const [postResult, setPostResult] = useState<SinglePostDiscoveryResult | null>(null);

  const [crawlHistory, setCrawlHistory] = useState<BusinessDiscoveryResult[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('bd_crawl_history', userId));
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [postHistory, setPostHistory] = useState<SinglePostDiscoveryResult[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('bd_post_crawl_history', userId));
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<InstagramMedia | null>(null);
  const [carouselSlideIdx, setCarouselSlideIdx] = useState(0);
  const [postCarouselSlideIdx, setPostCarouselSlideIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'timing' | 'keywords' | 'formats' | 'hashtags' | 'prescription'>('overview');
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [postPreviewMode, setPostPreviewMode] = useState<'embed' | 'cover'>('embed');

  const { addActivity } = useActivity();

  const handleSearch = async (queryToSearch?: string) => {
    const rawInput = (queryToSearch || targetUser || '').trim();
    if (!rawInput) {
      addActivity('Please enter a competitor username or Instagram Reel/Post URL.', 'error');
      return;
    }
    setIsSearching(true);
    setErrorMsg(null);

    // 1. Check if user provided an Instagram Post or Reel URL
    const parsedPost = parseInstagramPostUrl(rawInput);
    if (parsedPost.isPostUrl) {
      try {
        const postData = await discoverPostOrReel(
          rawInput,
          config.selectedIgUserId || '',
          config.accessToken || ''
        );

        setPostResult(postData);
        setDiscoveryMode('post');
        setTargetUser(rawInput);

        // Update post history in localStorage
        const updatedPosts = [
          postData,
          ...postHistory.filter(p => p.shortcode !== postData.shortcode)
        ].slice(0, 10);
        setPostHistory(updatedPosts);
        localStorage.setItem(getScopedKey('bd_post_crawl_history', userId), JSON.stringify(updatedPosts));

        addActivity(`Analyzed Instagram ${postData.media_type} mechanisms: "${postData.mechanisms.hook}"`, 'success');
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to extract post/reel mechanisms.');
        addActivity(`Post mechanism extraction failed: ${err.message}`, 'error');
      } finally {
        setIsSearching(false);
      }
      return;
    }

    // 2. Otherwise treat as Profile URL or username
    if (!config.accessToken || !config.selectedIgUserId) {
      addActivity('Please configure your Instagram Graph API credentials in Plugins to crawl full competitor profiles.', 'error');
      setIsSearching(false);
      return;
    }

    let handle = rawInput.replace('@', '');
    const profileUrlMatch = rawInput.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i);
    if (profileUrlMatch && profileUrlMatch[1]) {
      handle = profileUrlMatch[1];
    }
    handle = handle.replace(/[^a-zA-Z0-9_.]/g, '').trim();

    try {
      const data = await discoverBusinessAccount(
        handle,
        config.selectedIgUserId,
        config.accessToken
      );

      // Ensure analytics are attached
      if (!data.analytics) {
        data.analytics = analyzeMediaCrawl(data.recent_media, data.followers_count);
      }

      setResult(data);
      setDiscoveryMode('profile');
      setTargetUser(handle);

      // Update history in localStorage
      const updatedHistory = [
        data,
        ...crawlHistory.filter(c => c.username.toLowerCase() !== data.username.toLowerCase())
      ].slice(0, 10);
      setCrawlHistory(updatedHistory);
      localStorage.setItem(getScopedKey('bd_crawl_history', userId), JSON.stringify(updatedHistory));

    } catch (err: any) {
      const msg = err?.message || '';
      const isPrivateOrPersonal = /private|permission|unsupported|not found|does not exist|OAuthException/i.test(msg);
      if (isPrivateOrPersonal) {
        setErrorMsg(`Account @${handle} is either Private or Personal: Meta Graph API strictly protects private account data and only permits discovery on Public Business/Creator profiles.`);
      } else {
        setErrorMsg(err.message || 'Competitor business discovery failed.');
      }
      addActivity(`Crawl failed for @${handle}: ${err.message}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStatus(label);
    setTimeout(() => setCopiedStatus(null), 2500);
  };

  const clearHistory = () => {
    setCrawlHistory([]);
    localStorage.removeItem(getScopedKey('bd_crawl_history', userId));
    addActivity('Cleared crawl history.', 'info');
  };

  const clearPostHistory = () => {
    setPostHistory([]);
    localStorage.removeItem(getScopedKey('bd_post_crawl_history', userId));
    addActivity('Cleared analyzed post history.', 'info');
  };

  const prescription: GrowthPrescription | null = result
    ? generateGrowthPrescription(result, crawlHistory)
    : null;

  return (
    <div className="space-y-6">
      {/* Search Header & History */}
      <StickerCard
        title="Competitor Business Discovery & Strategic Crawler"
        subtitle="Live crawling for profiles, posts, reels & carousels: hooks, copy frameworks, psychological triggers & swipe templates"
        icon={Search}
        iconBgColor="bg-violetBrand text-white"
        shadowColor="violet"
      >
        {/* Discovery Mode Switcher */}
        <div className="bg-slate-100 p-1 sm:p-1.5 rounded-2xl border-2 border-slateDark flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full sm:w-fit mb-5 shadow-sm max-w-full">
          <button
            type="button"
            onClick={() => {
              setDiscoveryMode('profile');
              if (result && !targetUser.includes('instagram.com/')) {
                setTargetUser(result.username);
              }
            }}
            className={`px-3.5 py-2 sm:py-1.5 rounded-xl font-heading font-black text-xs transition-all flex items-center justify-center sm:justify-start gap-1.5 w-full sm:w-auto ${
              discoveryMode === 'profile'
                ? 'bg-violetBrand text-white border-2 border-slateDark shadow-pop-sm'
                : 'text-slate-600 hover:text-slateDark hover:bg-white/70'
            }`}
          >
            <Compass size={14} className="shrink-0" />
            <span className="truncate">Profile Discovery</span>
            {result && <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 font-mono truncate max-w-[120px] sm:max-w-none">@{result.username}</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              setDiscoveryMode('post');
              if (postResult) {
                setTargetUser(postResult.permalink);
              }
            }}
            className={`px-3.5 py-2 sm:py-1.5 rounded-xl font-heading font-black text-xs transition-all flex items-center justify-center sm:justify-start gap-1.5 w-full sm:w-auto ${
              discoveryMode === 'post'
                ? 'bg-yellowPop text-slateDark border-2 border-slateDark shadow-pop-sm'
                : 'text-slate-600 hover:text-slateDark hover:bg-white/70'
            }`}
          >
            <Play size={13} className="fill-current shrink-0" />
            <span className="truncate">Reel & Post Deep-Dive</span>
            {postResult && <span className="text-[10px] px-1.5 py-0.2 rounded bg-slateDark/10 font-mono truncate max-w-[100px] sm:max-w-none">{postResult.shortcode}</span>}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 max-w-xl w-full">
          <HardInput
            label={discoveryMode === 'post' ? "Instagram Reel or Post URL" : "Target Competitor Username or URL"}
            placeholder={
              discoveryMode === 'post'
                ? "https://www.instagram.com/reel/C8qA7... or /p/..."
                : "e.g. nike, @artisan_studio, or https://instagram.com/nike"
            }
            value={targetUser}
            onChange={e => setTargetUser(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            badge={discoveryMode === 'post' ? "Reel / Post URL" : "Business / Creator"}
          />
          <CandyButton
            variant={discoveryMode === 'post' ? "yellow" : "primary"}
            size="md"
            onClick={() => handleSearch()}
            disabled={isSearching}
            icon={discoveryMode === 'post' ? Sparkles : Search}
            className="shrink-0 mb-0.5 w-full sm:w-auto justify-center"
          >
            {isSearching
              ? 'Analyzing...'
              : discoveryMode === 'post'
              ? 'Extract Mechanisms'
              : 'Crawl & Analyze'}
          </CandyButton>
        </div>

        {/* Meta Graph API Account Support Matrix */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1 font-semibold text-slate-500">
          <span className="font-bold text-slateDark">Crawl Capability:</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
            🟢 Public Creator/Business (100% Crawlable)
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
            🟡 Following (Crawlable if Public)
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300" title="Protected by Meta privacy rules">
            🔒 Private Accounts (Protected by Meta)
          </span>
        </div>

        {/* Niche Configured Competitors */}
        {discoveryMode === 'profile' && profile?.competitorHandles && profile.competitorHandles.length > 0 && (
          <div className="mt-4 pt-3 border-t-2 border-slateDark/10 space-y-1.5">
            <div className="text-[11px] font-heading font-black text-slateDark flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Target size={13} className="text-violetBrand" />
                <span>Configured Niche Competitors ({profile.subNiche}):</span>
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
            <div className="flex items-center gap-2 flex-wrap">
              {profile.competitorHandles.map((handle, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTargetUser(handle);
                    handleSearch(handle);
                  }}
                  className={`px-3 py-1 rounded-xl font-heading font-black text-xs border-2 border-slateDark transition-all shadow-pop-sm ${
                    targetUser.toLowerCase() === handle.toLowerCase()
                      ? 'bg-violetBrand text-white'
                      : 'bg-violet-100 hover:bg-violet-200 text-slateDark'
                  }`}
                >
                  @{handle}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Crawl History Pills */}
        {discoveryMode === 'profile' && crawlHistory.length > 0 && (
          <div className="mt-4 pt-3 border-t-2 border-slateDark/10 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-heading font-black text-slate-500 flex items-center gap-1">
                <History size={13} /> Previous Crawls:
              </span>
              {crawlHistory.map((item) => (
                <button
                  key={item.username}
                  type="button"
                  onClick={() => {
                    setResult(item);
                    setTargetUser(item.username);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border-2 transition-all flex items-center gap-1.5 shadow-pop-sm ${
                    result?.username.toLowerCase() === item.username.toLowerCase()
                      ? 'bg-mintPop text-slateDark border-slateDark'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slateDark'
                  }`}
                >
                  <span>@{item.username}</span>
                  <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-slate-100 border border-slate-300 font-bold">
                    {item.engagement_rate}%
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCompareModal(true)}
                className="text-xs font-heading font-bold text-violetBrand hover:underline flex items-center gap-1"
              >
                <BarChart2 size={13} /> Compare Matrix
              </button>
              <button
                type="button"
                onClick={clearHistory}
                title="Clear Crawl History"
                className="text-slate-400 hover:text-rose-600 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Analyzed Post History Pills */}
        {discoveryMode === 'post' && postHistory.length > 0 && (
          <div className="mt-4 pt-3 border-t-2 border-slateDark/10 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-heading font-black text-slate-500 flex items-center gap-1">
                <History size={13} /> Analyzed Posts/Reels:
              </span>
              {postHistory.map((item) => (
                <button
                  key={item.shortcode}
                  type="button"
                  onClick={() => {
                    setPostResult(item);
                    setTargetUser(item.permalink);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border-2 transition-all flex items-center gap-1.5 shadow-pop-sm ${
                    postResult?.shortcode === item.shortcode
                      ? 'bg-yellowPop text-slateDark border-slateDark'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slateDark'
                  }`}
                >
                  <span>
                    {item.media_type === 'REELS' ? '🎬' : item.media_type === 'CAROUSEL_ALBUM' ? '🎠' : '📸'} {item.shortcode}
                  </span>
                  <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-slate-100 border border-slate-300 font-bold">
                    {item.mechanisms.hookScore}/100
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={clearPostHistory}
              title="Clear Post History"
              className="text-slate-400 hover:text-rose-600 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border-2 border-rose-500 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}
      </StickerCard>

      {/* Crawled Profile Details & Analysis */}
      {discoveryMode === 'profile' && result && (
        <div className="space-y-6">
          {/* Profile Header Card */}
          <StickerCard shadowColor="yellow" className="bg-white">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-5 border-b-2 border-slateDark/10 w-full min-w-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 sm:gap-4 w-full min-w-0">
                {result.profile_picture_url ? (
                  <img
                    src={result.profile_picture_url}
                    alt={result.username}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-3 border-slateDark shadow-pop object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-3 border-slateDark bg-violet-100 flex items-center justify-center font-heading font-black text-xl text-violetBrand shadow-pop shrink-0">
                    @{result.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="space-y-1.5 min-w-0 flex-1 w-full overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h2 className="font-heading text-xl sm:text-2xl font-black text-slateDark break-all leading-tight">@{result.username}</h2>
                    {result.name && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-mintPop text-slateDark border border-slateDark max-w-full truncate">
                        {result.name}
                      </span>
                    )}
                    {result.analytics?.engagementTier && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-heading font-black border border-slateDark flex items-center gap-1 shrink-0 ${
                        result.analytics.engagementTier === 'Viral' ? 'bg-yellowPop text-slateDark' :
                        result.analytics.engagementTier === 'High' ? 'bg-mintPop text-slateDark' :
                        result.analytics.engagementTier === 'Moderate' ? 'bg-sky-200 text-slateDark' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        <Flame size={12} className="fill-current shrink-0" />
                        <span>{result.analytics.engagementTier} Engagement</span>
                      </span>
                    )}
                  </div>
                  {result.biography && (
                    <p className="text-xs text-slate-600 font-medium max-w-2xl line-clamp-3 break-words">
                      {result.biography}
                    </p>
                  )}
                  {result.website && (
                    <a
                      href={result.website.startsWith('http') ? result.website : `https://${result.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-violetBrand hover:underline font-bold inline-flex items-center gap-1 font-mono break-all max-w-full"
                    >
                      <ExternalLink size={11} className="shrink-0" />
                      <span className="truncate">{result.website}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Metric Counters Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 pt-5">
              <div className="bg-slate-50 border-2 border-slateDark rounded-2xl p-2.5 sm:p-3.5 shadow-pop-sm flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-violet-100 border border-violet-300 text-violetBrand flex items-center justify-center shrink-0">
                  <Users size={16} className="sm:w-[18px] sm:h-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">Followers</span>
                  <span className="font-heading text-base sm:text-xl font-black text-slateDark leading-tight block truncate">
                    {(result.followers_count ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border-2 border-slateDark rounded-2xl p-2.5 sm:p-3.5 shadow-pop-sm flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-yellow-100 border border-yellow-300 text-yellow-800 flex items-center justify-center shrink-0">
                  <Layers size={16} className="sm:w-[18px] sm:h-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">Total Posts</span>
                  <span className="font-heading text-base sm:text-xl font-black text-slateDark leading-tight block truncate">
                    {(result.media_count ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border-2 border-slateDark rounded-2xl p-2.5 sm:p-3.5 shadow-pop-sm flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center shrink-0">
                  <TrendingUp size={16} className="sm:w-[18px] sm:h-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">Engagement</span>
                  <span className="font-heading text-base sm:text-xl font-black text-violetBrand leading-tight block truncate">
                    {result.engagement_rate}%
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border-2 border-slateDark rounded-2xl p-2.5 sm:p-3.5 shadow-pop-sm flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sky-100 border border-sky-300 text-sky-800 flex items-center justify-center shrink-0">
                  <Clock size={16} className="sm:w-[18px] sm:h-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider block truncate">Avg Cadence</span>
                  <span className="font-heading text-base sm:text-xl font-black text-slateDark leading-tight block truncate">
                    {result.analytics?.cadenceDaysAvg ? `${result.analytics.cadenceDaysAvg}d` : 'Daily'}
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnostic Badges Bar */}
            {result.analytics?.diagnosticBadges && result.analytics.diagnosticBadges.length > 0 && (
              <div className="mt-5 pt-4 border-t-2 border-slateDark/10 flex items-center gap-2.5 flex-wrap">
                {result.analytics.diagnosticBadges.map((badge, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-1.5 rounded-xl border-2 border-slateDark text-xs font-bold flex items-center gap-2 shadow-pop-sm ${
                      badge.type === 'warning' ? 'bg-amber-100 text-amber-900' :
                      badge.type === 'success' ? 'bg-mintPop text-slateDark' :
                      'bg-sky-100 text-sky-900'
                    }`}
                  >
                    <AlertCircle size={14} className="shrink-0" />
                    <span><strong>{badge.title}:</strong> {badge.message}</span>
                  </div>
                ))}
              </div>
            )}
          </StickerCard>

          {/* Analytics Navigation Tabs */}
          <div className="bg-slate-100 p-1.5 rounded-2xl border-2 border-slateDark flex items-center gap-1.5 overflow-x-auto shadow-sm no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-xl font-heading font-black text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-violetBrand text-white border-2 border-slateDark shadow-pop-sm'
                  : 'text-slate-600 hover:text-slateDark hover:bg-white/70'
              }`}
            >
              <TrendingUp size={14} />
              <span>Live Feed</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'overview' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {result.recent_media.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timing')}
              className={`px-3.5 py-2 rounded-xl font-heading font-black text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'timing'
                  ? 'bg-violetBrand text-white border-2 border-slateDark shadow-pop-sm'
                  : 'text-slate-600 hover:text-slateDark hover:bg-white/70'
              }`}
            >
              <Clock size={14} />
              <span>Post Timing</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('keywords')}
              className={`px-3.5 py-2 rounded-xl font-heading font-black text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'keywords'
                  ? 'bg-violetBrand text-white border-2 border-slateDark shadow-pop-sm'
                  : 'text-slate-600 hover:text-slateDark hover:bg-white/70'
              }`}
            >
              <Zap size={14} />
              <span>Keywords & Hooks</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('formats')}
              className={`px-3.5 py-2 rounded-xl font-heading font-black text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'formats'
                  ? 'bg-violetBrand text-white border-2 border-slateDark shadow-pop-sm'
                  : 'text-slate-600 hover:text-slateDark hover:bg-white/70'
              }`}
            >
              <Layers size={14} />
              <span>Visual Formats</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hashtags')}
              className={`px-3.5 py-2 rounded-xl font-heading font-black text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'hashtags'
                  ? 'bg-violetBrand text-white border-2 border-slateDark shadow-pop-sm'
                  : 'text-slate-600 hover:text-slateDark hover:bg-white/70'
              }`}
            >
              <Tag size={14} />
              <span>Hashtags</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('prescription')}
              className={`px-3.5 py-2 rounded-xl font-heading font-black text-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'prescription'
                  ? 'bg-yellowPop text-slateDark border-2 border-slateDark shadow-pop-sm'
                  : 'bg-yellow-100/80 text-yellow-900 hover:bg-yellow-100 hover:text-slateDark'
              }`}
            >
              <Sparkles size={14} className="text-violetBrand shrink-0" />
              <span>Strategic Prescription</span>
            </button>
          </div>

          {/* TAB 1: Live Media Feed */}
          {activeTab === 'overview' && (
            <StickerCard
              title="Crawled Media Feed"
              subtitle="Click on any post card to open the complete inspection view (thumbnail, keywords, caption & comments)"
              icon={TrendingUp}
              iconBgColor="bg-mintPop text-slateDark"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {result.recent_media.map((media: InstagramMedia) => {
                  const previewUrl = media.thumbnail_url || media.media_url;
                  const dateStr = media.timestamp
                    ? new Date(media.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : 'Recent';

                  return (
                    <div
                      key={media.id}
                      onClick={() => {
                        setSelectedPost(media);
                        setCarouselSlideIdx(0);
                      }}
                      className="bg-white border-2 border-slateDark rounded-2xl overflow-hidden shadow-pop-sm hover:-translate-y-1 hover:shadow-pop transition-all cursor-pointer flex flex-col justify-between group"
                    >
                      {/* Media Image / Thumbnail */}
                      <div className="relative aspect-square bg-slate-100 overflow-hidden border-b-2 border-slateDark">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={media.caption || 'Instagram Post'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center">
                            <ImageIcon size={32} />
                            <span className="text-xs font-mono">No visual preview</span>
                          </div>
                        )}

                        {/* Format Badge */}
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[10px] font-heading font-black bg-white/95 backdrop-blur-sm text-slateDark border border-slateDark flex items-center gap-1 shadow-sm">
                          {media.media_type === 'CAROUSEL_ALBUM' && <><Layers size={11} /> Carousel</>}
                          {media.media_type === 'VIDEO' && <><Film size={11} /> Reel/Video</>}
                          {media.media_type === 'IMAGE' && <><ImageIcon size={11} /> Image</>}
                        </span>

                        {/* Post Time Badge */}
                        <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slateDark/80 text-white backdrop-blur-sm">
                          {dateStr}
                        </span>
                      </div>

                      {/* Card Content */}
                      <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                        <p className="text-xs font-medium text-slate-700 line-clamp-2 min-h-[32px]">
                          {media.caption || <span className="italic text-slate-400">No caption provided</span>}
                        </p>

                        <div className="flex items-center justify-between text-xs font-bold pt-2.5 border-t border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <span className="flex items-center gap-1 text-rose-600 font-mono text-[11px]">
                              <Heart size={13} fill="currentColor" /> {(media.like_count ?? 0).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 text-violet-700 font-mono text-[11px]">
                              <MessageCircle size={13} /> {(media.comments_count ?? 0).toLocaleString()}
                            </span>
                          </div>
                          <span className="text-[11px] font-heading font-black text-slate-500 group-hover:text-violetBrand flex items-center gap-0.5">
                            Inspect <ArrowUpRight size={12} />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </StickerCard>
          )}

          {/* TAB 2: Post Timing Analysis */}
          {activeTab === 'timing' && result.analytics && (
            <div className="space-y-6">
              <StickerCard
                title="Best Posting Days & Times"
                subtitle={`Peak interaction window: ${result.analytics.bestPostingTimeSummary}`}
                icon={Clock}
                iconBgColor="bg-yellowPop text-slateDark"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Days Breakdown */}
                  <div>
                    <h3 className="font-heading font-black text-sm text-slateDark mb-3 flex items-center gap-1.5">
                      <Calendar size={15} className="text-violetBrand" /> Day-of-Week Interaction Heatmap
                    </h3>
                    <div className="space-y-2.5">
                      {result.analytics.bestPostingDays.map((item, idx) => {
                        const isTop = idx === 0 && item.count > 0;
                        return (
                          <div
                            key={item.day}
                            className={`p-2.5 rounded-xl border-2 border-slateDark flex items-center justify-between text-xs transition-all ${
                              isTop ? 'bg-mintPop font-black shadow-pop-sm' : 'bg-white font-medium'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {isTop && <Award size={14} className="text-slateDark" />}
                              <span>{item.day}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({item.count} uploads)</span>
                            </span>
                            <span className="font-mono font-bold">
                              {item.avgEngagement.toLocaleString()} avg interactions
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hourly Breakdown */}
                  <div>
                    <h3 className="font-heading font-black text-sm text-slateDark mb-3 flex items-center gap-1.5">
                      <Clock size={15} className="text-violetBrand" /> Peak Time Slots (Hourly Performance)
                    </h3>
                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {result.analytics.bestPostingHours.filter(h => h.count > 0).slice(0, 8).map((item, idx) => {
                        const isTop = idx === 0;
                        return (
                          <div
                            key={item.hour}
                            className={`p-2.5 rounded-xl border-2 border-slateDark flex items-center justify-between text-xs ${
                              isTop ? 'bg-yellowPop font-black shadow-pop-sm' : 'bg-white font-medium'
                            }`}
                          >
                            <span className="font-heading font-bold">{item.label}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-500 font-mono">{item.count} posts</span>
                              <span className="font-mono font-black text-violetBrand">
                                {item.avgEngagement.toLocaleString()} interactions
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </StickerCard>
            </div>
          )}

          {/* TAB 3: Keywords & Winning Hooks */}
          {activeTab === 'keywords' && result.analytics && (
            <div className="space-y-6">
              {/* Winning Opening Hooks */}
              {result.analytics.topHooks.length > 0 && (
                <StickerCard
                  title="Winning Opening Hooks (First 90 Characters)"
                  subtitle="Opening lines from competitor's highest-performing posts that drove maximum engagement"
                  icon={Zap}
                  iconBgColor="bg-yellowPop text-slateDark"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {result.analytics.topHooks.map((hook, idx) => (
                      <div
                        key={idx}
                        className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-heading font-black uppercase px-2 py-0.5 rounded bg-violet-100 text-violetBrand border border-violet-300 inline-block">
                            Top Hook #{idx + 1}
                          </span>
                          <p className="text-xs font-heading font-bold text-slateDark">"{hook.hook}"</p>
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono font-bold pt-2 border-t border-slate-100">
                          <span className="text-rose-600 flex items-center gap-1">
                            <Heart size={13} fill="currentColor" /> {hook.likes.toLocaleString()}
                          </span>
                          <span className="text-violet-700 flex items-center gap-1">
                            <MessageCircle size={13} /> {hook.comments.toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(hook.hook, `Hook #${idx + 1} copied!`)}
                            className="text-[11px] text-slate-500 hover:text-slateDark font-sans font-bold flex items-center gap-1"
                          >
                            <Copy size={11} /> Copy
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </StickerCard>
              )}

              {/* High-Impact Keyword Multipliers */}
              <StickerCard
                title="High-Converting Caption Keywords"
                subtitle="Keywords identified in posts that generated above-average interaction multiplier"
                icon={Sparkles}
                iconBgColor="bg-mintPop text-slateDark"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {result.analytics.topKeywords.map((kw) => (
                    <div
                      key={kw.word}
                      className="bg-white border-2 border-slateDark rounded-xl p-3 shadow-pop-sm space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-heading font-black text-sm text-slateDark capitalize">{kw.word}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-mintPop text-slateDark border border-slateDark">
                          +{kw.boostMultiplier}x
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {kw.count} posts • {kw.avgEngagement.toLocaleString()} avg
                      </span>
                    </div>
                  ))}
                </div>
              </StickerCard>
            </div>
          )}

          {/* TAB 4: Visual Format Performance */}
          {activeTab === 'formats' && result.analytics && (
            <StickerCard
              title="Visual Format Breakdown & Multipliers"
              subtitle="Comparison of engagement impact between multi-slide Carousels, Reels/Videos, and Single Images"
              icon={Layers}
              iconBgColor="bg-violetBrand text-white"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {result.analytics.formatPerformance.map((fmt, idx) => {
                  const isTop = idx === 0;
                  const FormatIcon = fmt.format.toLowerCase().includes('carousel')
                    ? Layers
                    : fmt.format.toLowerCase().includes('reel') || fmt.format.toLowerCase().includes('video')
                    ? Film
                    : ImageIcon;

                  return (
                    <div
                      key={fmt.format}
                      className={`border-2 border-slateDark rounded-2xl p-5 shadow-pop-sm space-y-4 flex flex-col justify-between ${
                        isTop ? 'bg-mintPop/30' : 'bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slateDark/20 flex items-center justify-center text-slateDark">
                              <FormatIcon size={16} />
                            </div>
                            <span className="font-heading font-black text-base text-slateDark">{fmt.format}</span>
                          </div>
                          {isTop && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-black bg-mintPop text-slateDark border border-slateDark">
                              Top Performing
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Average Interactions</span>
                          <span className="font-heading text-2xl font-black text-slateDark">
                            {fmt.avgEngagement.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slateDark/10 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-600">Upload Share:</span>
                          <span className="font-bold">{fmt.percent}% ({fmt.count} posts)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isTop ? 'bg-emerald-500' : 'bg-violetBrand'}`}
                            style={{ width: `${fmt.percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </StickerCard>
          )}

          {/* TAB 5: Hashtag Intelligence */}
          {activeTab === 'hashtags' && (
            <StickerCard
              title="Top Performing Hashtags"
              subtitle="Copy high-reach tags extracted directly from competitor's highest-converting posts"
              icon={Sparkles}
              iconBgColor="bg-yellowPop text-slateDark"
              headerAction={
                <CandyButton
                  variant="yellow"
                  size="sm"
                  onClick={() => handleCopy(result.top_hashtags.join(' '), 'All hashtags copied!')}
                  icon={Copy}
                >
                  {copiedStatus || 'Copy All Tags'}
                </CandyButton>
              }
            >
              <div className="flex flex-wrap gap-2.5">
                {result.top_hashtags.map((tag: string) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleCopy(tag, `Copied ${tag}`)}
                    className="px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold bg-white text-slateDark border-2 border-slateDark shadow-pop-sm hover:bg-yellowPop hover:shadow-pop transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{tag}</span>
                    <Copy size={11} className="text-slate-400" />
                  </button>
                ))}
              </div>
            </StickerCard>
          )}

          {/* TAB 6: Strategic Prescription & Blueprint */}
          {activeTab === 'prescription' && prescription && (
            <div className="space-y-6">
              <StickerCard
                title={prescription.title}
                subtitle={prescription.verdict}
                icon={Sparkles}
                iconBgColor="bg-yellowPop text-slateDark"
                shadowColor="yellow"
              >
                {/* Prescription Action List */}
                <div className="space-y-3.5">
                  {prescription.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-heading font-black bg-violetBrand text-white border border-slateDark">
                            {rec.category}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            rec.impact === 'Critical' ? 'bg-rose-100 text-rose-700' : 'bg-mintPop text-slateDark'
                          }`}>
                            {rec.impact} Priority
                          </span>
                        </div>
                        <h4 className="font-heading font-bold text-sm text-slateDark">{rec.action}</h4>
                        <p className="text-xs text-slate-600">{rec.rationale}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 1-Click Content Blueprint Generator */}
                <div className="mt-6 pt-5 border-t-2 border-slateDark/15 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-heading font-black text-base text-slateDark flex items-center gap-2">
                        <Zap size={16} className="text-yellowPop fill-yellowPop" />
                        <span>Ready-to-Deploy 7-Day Content Blueprint</span>
                      </h3>
                      <p className="text-xs text-slate-600">
                        Pre-assembled post structure formulated from @{result.username}'s winning data points.
                      </p>
                    </div>
                    <CandyButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const bpText = `PROVEN CONTENT BLUEPRINT\nTarget Slot: ${prescription.contentBlueprint.bestPostingSlot}\nFormat: ${prescription.contentBlueprint.recommendedFormat}\n\nWinning Hook:\n"${prescription.contentBlueprint.hookPrompt}"\n\nHigh-Converting Keywords to include:\n${prescription.contentBlueprint.suggestedKeywords.join(', ')}\n\nRecommended Hashtags:\n${prescription.contentBlueprint.hashtagSet.join(' ')}`;
                        handleCopy(bpText, 'Blueprint copied to clipboard!');
                      }}
                      icon={Copy}
                    >
                      {copiedStatus || 'Copy 7-Day Blueprint'}
                    </CandyButton>
                  </div>

                  <div className="p-4 bg-slate-50 border-2 border-slateDark rounded-2xl space-y-3 font-mono text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Recommended Format</span>
                        <span className="font-bold text-slateDark">{prescription.contentBlueprint.recommendedFormat}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Recommended Release Slot</span>
                        <span className="font-bold text-violetBrand">{prescription.contentBlueprint.bestPostingSlot}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Hook Model Prompt</span>
                      <p className="font-bold text-slateDark italic bg-white p-2.5 rounded-xl border border-slate-200">
                        "{prescription.contentBlueprint.hookPrompt}"
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Hashtags</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {prescription.contentBlueprint.hashtagSet.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slateDark text-[11px]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </StickerCard>
            </div>
          )}
        </div>
      )}

      {/* SINGLE POST / REEL MECHANISMS DEEP-DIVE VIEW */}
      {discoveryMode === 'post' && postResult && (
        <div className="space-y-6">
          {/* Post Overview & Visual Header */}
          <StickerCard shadowColor="yellow" className="bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Media Visual Column */}
              <div className="lg:col-span-5 space-y-3 w-full min-w-0">
                {/* View Switcher: Live Reel Player vs Cover Photo */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setPostPreviewMode('embed')}
                      className={`px-3 py-1 rounded-lg text-xs font-heading font-black transition-all flex items-center gap-1 ${
                        postPreviewMode === 'embed'
                          ? 'bg-violetBrand text-white shadow-sm'
                          : 'text-slate-600 hover:text-slateDark'
                      }`}
                    >
                      <Play size={12} className="fill-current shrink-0" />
                      <span>Real Reel / Player</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostPreviewMode('cover')}
                      className={`px-3 py-1 rounded-lg text-xs font-heading font-black transition-all flex items-center gap-1 ${
                        postPreviewMode === 'cover'
                          ? 'bg-violetBrand text-white shadow-sm'
                          : 'text-slate-600 hover:text-slateDark'
                      }`}
                    >
                      <ImageIcon size={12} className="shrink-0" />
                      <span>Visual Slides</span>
                    </button>
                  </div>

                  <span className="px-2 py-0.5 rounded-md text-[10px] font-heading font-black bg-yellowPop text-slateDark border border-slateDark shrink-0">
                    {postResult.media_type}
                  </span>
                </div>

                {/* Media Container */}
                <div className="relative rounded-2xl border-2 border-slateDark overflow-hidden bg-slate-50 shadow-pop-sm flex items-center justify-center min-h-[300px] sm:min-h-[440px] w-full">
                  {postPreviewMode === 'embed' && postResult.permalink ? (
                    <iframe
                      src={`${postResult.permalink.replace(/\/$/, '')}/embed/captioned/`}
                      title="Instagram Real Reel / Post Player"
                      className="w-full min-h-[340px] sm:min-h-[460px] h-full border-0 bg-white"
                      scrolling="no"
                      allowTransparency={true}
                    />
                  ) : postResult.children && postResult.children.length > 0 ? (
                    <div className="relative w-full aspect-square bg-slate-100">
                      <img
                        src={postResult.children[postCarouselSlideIdx]?.media_url || postResult.thumbnail_url || postResult.media_url}
                        alt="Slide"
                        className="w-full h-full object-cover"
                      />
                      {postResult.children.length > 1 && (
                        <div className="absolute inset-x-2 bottom-3 flex items-center justify-between z-10">
                          <button
                            type="button"
                            onClick={() => setPostCarouselSlideIdx(prev => Math.max(0, prev - 1))}
                            disabled={postCarouselSlideIdx === 0}
                            className="w-8 h-8 rounded-full bg-white/90 border-2 border-slateDark text-slateDark flex items-center justify-center disabled:opacity-30 shadow-pop-sm"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slateDark/90 text-white">
                            {postCarouselSlideIdx + 1} / {postResult.children.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPostCarouselSlideIdx(prev => Math.min((postResult.children?.length || 1) - 1, prev + 1))}
                            disabled={postCarouselSlideIdx === (postResult.children.length - 1)}
                            className="w-8 h-8 rounded-full bg-white/90 border-2 border-slateDark text-slateDark flex items-center justify-center disabled:opacity-30 shadow-pop-sm"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : postResult.thumbnail_url || postResult.media_url ? (
                    <div className="relative w-full aspect-square bg-slate-100">
                      <img
                        src={postResult.thumbnail_url || postResult.media_url}
                        alt="Post visual"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-2 p-8 text-center">
                      <Film size={44} />
                      <span className="text-xs font-mono">Instagram Media Content</span>
                    </div>
                  )}
                </div>

                {/* Direct Action Links */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                  {postResult.permalink && (
                    <a
                      href={postResult.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 px-3 rounded-xl border-2 border-slateDark bg-violetBrand text-white hover:bg-violet-700 transition-all font-heading font-black text-xs flex items-center justify-center gap-1.5 shadow-pop-sm"
                    >
                      <span>Open on Instagram</span>
                      <ExternalLink size={12} className="shrink-0" />
                    </a>
                  )}
                  {postResult.author_name && (
                    <button
                      type="button"
                      onClick={() => {
                        setDiscoveryMode('profile');
                        setTargetUser(postResult.author_name!);
                        handleSearch(postResult.author_name!);
                      }}
                      className="py-2 px-3 rounded-xl border-2 border-slateDark bg-mintPop text-slateDark hover:bg-emerald-300 transition-all font-heading font-black text-xs flex items-center justify-center gap-1 shadow-pop-sm"
                    >
                      <span className="truncate">@{postResult.author_name} Profile</span>
                      <ArrowUpRight size={13} className="shrink-0" />
                    </button>
                  )}
                </div>
              </div>

              {/* Metrics & Key Mechanism Highlights */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-heading font-black bg-yellowPop text-slateDark border border-slateDark">
                        {postResult.mechanisms.contentPillar}
                      </span>
                      {postResult.author_name && (
                        <span className="text-xs font-mono font-bold text-slate-500">
                          by @{postResult.author_name}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {postResult.shortcode}
                    </span>
                  </div>

                  <h2 className="font-heading text-lg sm:text-xl font-black text-slateDark leading-snug break-words">
                    "{postResult.mechanisms.hook}"
                  </h2>
                </div>

                {/* Metric Counters & Hook Rating */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                  <div className="bg-rose-50 border-2 border-slateDark rounded-xl p-2 sm:p-2.5 shadow-pop-sm min-w-0">
                    <span className="text-[9px] sm:text-[10px] font-bold text-rose-600 uppercase flex items-center justify-center gap-1 truncate">
                      <Heart size={11} fill="currentColor" className="shrink-0" /> Likes
                    </span>
                    <span className="font-heading text-sm sm:text-base font-black text-slateDark block truncate">
                      {postResult.like_count ? postResult.like_count.toLocaleString() : 'Public'}
                    </span>
                  </div>

                  <div className="bg-violet-50 border-2 border-slateDark rounded-xl p-2 sm:p-2.5 shadow-pop-sm min-w-0">
                    <span className="text-[9px] sm:text-[10px] font-bold text-violet-600 uppercase flex items-center justify-center gap-1 truncate">
                      <MessageCircle size={11} className="shrink-0" /> Comments
                    </span>
                    <span className="font-heading text-sm sm:text-base font-black text-slateDark block truncate">
                      {postResult.comments_count ? postResult.comments_count.toLocaleString() : 'Live'}
                    </span>
                  </div>

                  <div className="bg-mintPop border-2 border-slateDark rounded-xl p-2 sm:p-2.5 shadow-pop-sm min-w-0">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slateDark uppercase flex items-center justify-center gap-1 truncate">
                      <Zap size={11} className="fill-current shrink-0" /> Score
                    </span>
                    <span className="font-heading text-sm sm:text-base font-black text-slateDark block truncate">
                      {postResult.mechanisms.hookScore} / 100
                    </span>
                  </div>
                </div>

                {/* Hook Type & Retention Mechanism Highlight */}
                <div className="p-3.5 bg-slate-50 border-2 border-slateDark rounded-xl space-y-1.5 shadow-pop-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-heading font-black text-slateDark flex items-center gap-1.5">
                      <Sparkles size={14} className="text-violetBrand" />
                      <span>Hook Type: <strong>{postResult.mechanisms.hookType}</strong></span>
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-violet-100 text-violetBrand px-2 py-0.5 rounded border border-violet-300">
                      {postResult.mechanisms.copyFramework}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-sans leading-relaxed">
                    {postResult.mechanisms.retentionBreakdown}
                  </p>
                </div>

                {/* Detected Call to Action */}
                <div className="p-3 bg-amber-50 border-2 border-slateDark rounded-xl flex items-center justify-between gap-2 shadow-pop-sm">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-amber-900 uppercase block">Detected Conversion CTA</span>
                    <span className="font-heading font-black text-xs text-slateDark">
                      {postResult.mechanisms.detectedCta}
                    </span>
                  </div>
                  <span className="text-lg">🎯</span>
                </div>
              </div>
            </div>
          </StickerCard>

          {/* Strategic Mechanism Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Psychological Viral Triggers */}
            <div className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm space-y-3">
              <h3 className="font-heading font-black text-sm text-slateDark flex items-center gap-2">
                <span>🧠</span>
                <span>Psychological Viral Triggers</span>
              </h3>

              <div className="flex items-center gap-1.5 flex-wrap">
                {postResult.mechanisms.emotionalTriggers.map((trig, idx) => (
                  <span key={idx} className="px-2 py-1 rounded-lg text-xs font-bold bg-violet-100 text-violetBrand border border-violet-200">
                    ✨ {trig}
                  </span>
                ))}
              </div>

              <div className="space-y-2 text-xs font-sans text-slate-700">
                <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl space-y-1">
                  <span className="font-bold text-slateDark flex items-center gap-1">
                    <Share2 size={12} className="text-violetBrand" /> Shareability Trigger:
                  </span>
                  <p>{postResult.mechanisms.shareabilityFactor}</p>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl space-y-1">
                  <span className="font-bold text-slateDark flex items-center gap-1">
                    <Bookmark size={12} className="text-emerald-700" /> Bookmark / Save Incentive:
                  </span>
                  <p>{postResult.mechanisms.saveabilityFactor}</p>
                </div>
              </div>
            </div>

            {/* Card 2: Visual Delivery Mechanics & Hashtags */}
            <div className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm space-y-3">
              <h3 className="font-heading font-black text-sm text-slateDark flex items-center gap-2">
                <span>🎨</span>
                <span>Format Delivery & Discoverability</span>
              </h3>

              <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slateDark block mb-1">Production Recommendation:</span>
                {postResult.mechanisms.visualFormatTip}
              </div>

              {/* Hashtags list */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-heading font-bold text-slateDark">
                  <span>Extracted Hashtags ({postResult.mechanisms.hashtags.length})</span>
                  {postResult.mechanisms.hashtags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopy(postResult.mechanisms.hashtags.join(' '), 'Hashtags copied!')}
                      className="text-violetBrand hover:underline text-[11px] font-mono inline-flex items-center gap-0.5"
                    >
                      <Copy size={11} /> Copy All
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto">
                  {postResult.mechanisms.hashtags.length > 0 ? (
                    postResult.mechanisms.hashtags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-pink-50 text-pink-700 border border-pink-200">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No hashtags attached to this post.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reusable Swipe File Template */}
          <StickerCard
            title="Reusable Viral Swipe File Template"
            subtitle="Adapted framework formula from this post — ready to customize for your brand"
            icon={FileText}
            iconBgColor="bg-yellowPop text-slateDark"
            shadowColor="yellow"
          >
            <div className="space-y-3">
              <div className="p-4 bg-slate-50 border-2 border-slateDark rounded-2xl font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner max-h-64 overflow-y-auto">
                {postResult.mechanisms.reusableTemplate}
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-slate-500 font-sans">
                  💡 Customize the bracketed fields <code>[HOOK]</code> and <code>[Key Insight]</code> for your specific niche.
                </span>
                <div className="flex items-center gap-2">
                  <CandyButton
                    variant="yellow"
                    size="sm"
                    onClick={() => handleCopy(postResult.mechanisms.reusableTemplate, 'Swipe template copied!')}
                    icon={Copy}
                  >
                    {copiedStatus === 'Swipe template copied!' ? '✓ Copied Template' : 'Copy Template'}
                  </CandyButton>
                </div>
              </div>
            </div>
          </StickerCard>

          {/* Full Original Caption */}
          <div className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm space-y-2">
            <span className="font-heading font-black text-xs text-slateDark uppercase tracking-wider block">
              Original Post Full Caption
            </span>
            <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
              {postResult.caption || <span className="italic text-slate-400">No caption attached to this post.</span>}
            </div>
          </div>
        </div>
      )}

      {/* POST INSPECTOR MODAL */}
      {selectedPost && (
        <div className="fixed inset-0 bg-slateDark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-4 border-slateDark rounded-3xl max-w-3xl w-full shadow-pop overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Modal Header */}
            <div className="p-4 bg-cream border-b-4 border-slateDark flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-violetBrand text-white flex items-center justify-center font-heading font-black text-sm border-2 border-slateDark">
                  @{result?.username.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3 className="font-heading font-black text-sm text-slateDark">Post Inspection: @{result?.username}</h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    {selectedPost.timestamp ? new Date(selectedPost.timestamp).toLocaleString() : 'Recent Upload'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="w-8 h-8 rounded-xl border-2 border-slateDark bg-white hover:bg-rose-100 text-slateDark flex items-center justify-center font-bold transition-all shadow-pop-sm"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[75vh] overflow-y-auto">
              {/* Media Preview Column */}
              <div className="space-y-4">
                <div className="relative aspect-square bg-slate-100 rounded-2xl border-2 border-slateDark overflow-hidden flex items-center justify-center shadow-pop-sm">
                  {/* Carousel sliding */}
                  {selectedPost.media_type === 'CAROUSEL_ALBUM' && selectedPost.children?.data?.length ? (
                    <>
                      <img
                        src={selectedPost.children.data[carouselSlideIdx]?.media_url || selectedPost.media_url || selectedPost.thumbnail_url}
                        alt="Slide"
                        className="w-full h-full object-cover"
                      />
                      {selectedPost.children.data.length > 1 && (
                        <div className="absolute inset-x-2 bottom-3 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCarouselSlideIdx(prev => Math.max(0, prev - 1));
                            }}
                            disabled={carouselSlideIdx === 0}
                            className="w-8 h-8 rounded-full bg-white/90 border border-slateDark text-slateDark flex items-center justify-center disabled:opacity-30 shadow-sm"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slateDark/80 text-white">
                            {carouselSlideIdx + 1} / {selectedPost.children.data.length}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCarouselSlideIdx(prev => Math.min((selectedPost.children?.data?.length || 1) - 1, prev + 1));
                            }}
                            disabled={carouselSlideIdx === (selectedPost.children.data.length - 1)}
                            className="w-8 h-8 rounded-full bg-white/90 border border-slateDark text-slateDark flex items-center justify-center disabled:opacity-30 shadow-sm"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <img
                      src={selectedPost.thumbnail_url || selectedPost.media_url || ''}
                      alt={selectedPost.caption || 'Post Visual'}
                      className="w-full h-full object-cover"
                    />
                  )}

                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl text-[10px] font-heading font-black bg-white/95 text-slateDark border border-slateDark shadow-sm">
                    {selectedPost.media_type}
                  </span>
                </div>

                {/* Thumbnail Link & External Button */}
                <div className="space-y-2">
                  {(selectedPost.thumbnail_url || selectedPost.media_url) && (
                    <div className="flex items-center gap-2">
                      <CandyButton
                        variant="yellow"
                        size="sm"
                        className="w-full justify-center"
                        onClick={() => handleCopy(selectedPost.thumbnail_url || selectedPost.media_url || '', 'Thumbnail link copied!')}
                        icon={Copy}
                      >
                        {copiedStatus || 'Copy Direct Thumbnail Link'}
                      </CandyButton>
                    </div>
                  )}

                  <CandyButton
                    variant="primary"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => {
                      const mechanisms = analyzeSinglePostMechanisms(
                        selectedPost.caption || '',
                        selectedPost.media_type,
                        selectedPost.like_count,
                        selectedPost.comments_count
                      );
                      const singleResult: SinglePostDiscoveryResult = {
                        id: selectedPost.id,
                        shortcode: selectedPost.permalink?.split('/p/')[1]?.replace(/\//g, '') || selectedPost.permalink?.split('/reel/')[1]?.replace(/\//g, '') || selectedPost.id,
                        permalink: selectedPost.permalink || '',
                        media_type: selectedPost.media_type,
                        media_url: selectedPost.media_url,
                        thumbnail_url: selectedPost.thumbnail_url || selectedPost.media_url,
                        caption: selectedPost.caption || '',
                        author_name: result?.username,
                        author_url: result?.username ? `https://www.instagram.com/${result.username}/` : undefined,
                        like_count: selectedPost.like_count,
                        comments_count: selectedPost.comments_count,
                        timestamp: selectedPost.timestamp,
                        children: selectedPost.children?.data,
                        mechanisms,
                        crawledAt: new Date().toISOString(),
                      };
                      setPostResult(singleResult);
                      setDiscoveryMode('post');
                      setSelectedPost(null);
                    }}
                    icon={Sparkles}
                  >
                    Deep-Dive Viral Mechanisms
                  </CandyButton>

                  {selectedPost.permalink && (
                    <a
                      href={selectedPost.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl border-2 border-slateDark bg-violetBrand text-white hover:bg-violet-700 transition-all font-heading font-black text-xs flex items-center justify-center gap-1.5 shadow-pop-sm"
                    >
                      <span>Open Post & View Comments on Instagram</span>
                      <ArrowUpRight size={14} />
                    </a>
                  )}
                </div>
              </div>

              {/* Analysis & Details Column */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Engagement Counters */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-rose-50 border-2 border-slateDark rounded-2xl shadow-pop-sm">
                      <span className="text-[10px] font-bold text-rose-600 uppercase flex items-center justify-center gap-1">
                        <Heart size={12} fill="currentColor" /> Likes
                      </span>
                      <span className="font-heading text-lg font-black text-slateDark">
                        {(selectedPost.like_count ?? 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-3 bg-violet-50 border-2 border-slateDark rounded-2xl shadow-pop-sm">
                      <span className="text-[10px] font-bold text-violet-600 uppercase flex items-center justify-center gap-1">
                        <MessageCircle size={12} /> Comments
                      </span>
                      <span className="font-heading text-lg font-black text-slateDark">
                        {(selectedPost.comments_count ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Post Time & Peak Match */}
                  <div className="p-3 bg-slate-50 border-2 border-slateDark rounded-2xl space-y-1">
                    <span className="text-[10px] font-heading font-black text-slate-500 uppercase flex items-center gap-1">
                      <Clock size={12} /> Post Timestamp
                    </span>
                    <span className="font-mono text-xs font-bold text-slateDark block">
                      {selectedPost.timestamp
                        ? new Date(selectedPost.timestamp).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Unknown Date'}
                    </span>
                  </div>

                  {/* Full Caption */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-heading font-black text-slateDark">Post Caption</span>
                    <div className="p-3 bg-white border-2 border-slateDark rounded-2xl text-xs text-slate-700 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans">
                      {selectedPost.caption || <span className="italic text-slate-400">No caption attached to this post.</span>}
                    </div>
                  </div>
                </div>

                {/* Meta API Boundary Notice on Comments */}
                <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-[11px] text-amber-800 space-y-1">
                  <span className="font-bold flex items-center gap-1">
                    <AlertCircle size={12} /> Competitor Comments Boundary:
                  </span>
                  <p>
                    Meta Graph API restricts third-party apps from scraping public comments on competitor posts for privacy. Total count ({selectedPost.comments_count}) is verified live; click the link above to read comments directly on Instagram.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPARISON MATRIX MODAL */}
      {showCompareModal && (
        <div className="fixed inset-0 bg-slateDark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-4 border-slateDark rounded-3xl max-w-4xl w-full shadow-pop overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-4 bg-cream border-b-4 border-slateDark flex items-center justify-between">
              <h3 className="font-heading font-black text-base text-slateDark flex items-center gap-2">
                <BarChart2 size={18} className="text-violetBrand" />
                <span>Competitor Crawl Comparison Matrix</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                className="w-8 h-8 rounded-xl border-2 border-slateDark bg-white hover:bg-rose-100 text-slateDark flex items-center justify-center font-bold"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slateDark text-slateDark font-heading font-black">
                    <th className="p-3">Handle</th>
                    <th className="p-3">Followers</th>
                    <th className="p-3">Engagement Rate</th>
                    <th className="p-3">Tier</th>
                    <th className="p-3">Best Posting Slot</th>
                    <th className="p-3">Top Format</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {crawlHistory.map((item) => (
                    <tr
                      key={item.username}
                      className={result?.username.toLowerCase() === item.username.toLowerCase() ? 'bg-mintPop/20 font-bold' : ''}
                    >
                      <td className="p-3 font-heading font-black text-slateDark">@{item.username}</td>
                      <td className="p-3">{(item.followers_count ?? 0).toLocaleString()}</td>
                      <td className="p-3 text-violetBrand font-black">{item.engagement_rate}%</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-slate-100 border border-slate-300">
                          {item.analytics?.engagementTier || 'Standard'}
                        </span>
                      </td>
                      <td className="p-3 font-sans text-slate-600">
                        {item.analytics?.bestPostingTimeSummary || 'Midweek'}
                      </td>
                      <td className="p-3 font-sans">
                        {item.analytics?.formatPerformance[0]?.format || 'Image'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
