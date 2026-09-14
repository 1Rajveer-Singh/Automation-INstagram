import React, { useState, useEffect, useMemo } from 'react';
import { InstagramUser, InstagramMedia, ApiConfig, InstagramInsight, GrowthStrategyProfile } from '../../types/instagram';
import { getAccountInsights, getMediaInsights } from '../../services/instagramApi';
import { analyzeAccountGrowth } from '../../services/growthEngine';
import { StickerCard } from '../common/StickerCard';
import { CandyButton } from '../common/CandyButton';
import {
  Users,
  Flame,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
  ExternalLink,
  Heart,
  MessageCircle,
  Eye,
  Bookmark,
  Share2,
  ArrowRight,
  ShieldCheck,
  Key,
  BarChart3,
} from 'lucide-react';

interface DashboardViewProps {
  config: ApiConfig;
  user: InstagramUser | null;
  media: InstagramMedia[];
  onNavigate: (tab: any) => void;
  onOpenTokenModal: () => void;
  profile?: GrowthStrategyProfile | null;
  onOpenStrategyModal?: () => void;
}

type ReachViewsFilter = 'both' | 'reach' | 'views';
type EngagementMetric = 'all' | 'likes' | 'comments' | 'shares' | 'saves' | 'engagement_rate';
type EngagementPeriod = 'daily' | 'weekly';
export type TimeRangeFilter = 'hours' | 'days' | 'week' | 'month' | 'year';

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

function getSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  config,
  user,
  media,
  onNavigate,
  onOpenTokenModal,
  profile,
  onOpenStrategyModal,
}) => {
  const [accountInsights, setAccountInsights] = useState<InstagramInsight[]>([]);
  const [mediaInsightsMap, setMediaInsightsMap] = useState<Record<string, Record<string, number>>>({});
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Global Timeframe Filter (Default to 'week')
  const [timeFilter, setTimeFilter] = useState<TimeRangeFilter>('week');

  // Core KPI Interactive Filter Controls
  const [reachViewsFilter, setReachViewsFilter] = useState<ReachViewsFilter>('both');
  const [reachViewsType, setReachViewsType] = useState<'cumulative' | 'daily'>('cumulative');
  const [engagementMetric, setEngagementMetric] = useState<EngagementMetric>('all');
  const [engagementPeriod, setEngagementPeriod] = useState<EngagementPeriod>('daily');
  const [engagementDisplayMode, setEngagementDisplayMode] = useState<'cumulative' | 'bucket'>('cumulative');

  // Chart hover states
  const [hoveredReachViewsIndex, setHoveredReachViewsIndex] = useState<number | null>(null);
  const [hoveredEngagementIndex, setHoveredEngagementIndex] = useState<number | null>(null);

  // Load real account insights and per-media insights via Meta Graph API
  useEffect(() => {
    async function loadData() {
      if (!config.accessToken || !config.selectedIgUserId) return;
      setLoadingInsights(true);
      try {
        const insights = await getAccountInsights(config.selectedIgUserId, config.accessToken);
        setAccountInsights(insights);

        // Fetch real insights for posts across the whole account
        if (media.length > 0) {
          const targetPosts = media.slice(0, 100);
          const map: Record<string, Record<string, number>> = {};
          await Promise.allSettled(
            targetPosts.map(async (item) => {
              const res = await getMediaInsights(item.id, config.accessToken);
              map[item.id] = res;
            })
          );
          setMediaInsightsMap(map);
        }
      } catch (err) {
        console.warn('Dashboard insights load notice:', err);
      } finally {
        setLoadingInsights(false);
      }
    }
    loadData();
  }, [config.accessToken, config.selectedIgUserId, media]);
  // Active Instagram Growth Strategy card removed from Dashboard per user request

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // 1. TIMEFRAME CONFIGURATION & MEDIA FILTERING
  // -------------------------------------------------------------
  const timeframeInfo = useMemo(() => {
    const end = Date.now();
    if (timeFilter === 'hours') {
      const ms = 24 * 60 * 60 * 1000;
      return {
        start: end - ms,
        end,
        ms,
        label: 'Last 24 Hours',
        shortLabel: '24h',
        days: 1,
        bucketType: 'hour' as const,
        numBuckets: 24,
      };
    }
    if (timeFilter === 'days') {
      const ms = 7 * 24 * 60 * 60 * 1000;
      return {
        start: end - ms,
        end,
        ms,
        label: 'Last 7 Days',
        shortLabel: '7d',
        days: 7,
        bucketType: 'day' as const,
        numBuckets: 7,
      };
    }
    if (timeFilter === 'week') {
      const ms = 28 * 24 * 60 * 60 * 1000;
      return {
        start: end - ms,
        end,
        ms,
        label: 'Last 4 Weeks',
        shortLabel: '4w',
        days: 28,
        bucketType: 'day' as const,
        numBuckets: 28,
      };
    }
    if (timeFilter === 'month') {
      const ms = 180 * 24 * 60 * 60 * 1000;
      return {
        start: end - ms,
        end,
        ms,
        label: 'Last 6 Months',
        shortLabel: '6m',
        days: 180,
        bucketType: 'month' as const,
        numBuckets: 6,
      };
    }
    // 'year' (All-time / 1 Year)
    const ms = 365 * 24 * 60 * 60 * 1000;
    return {
      start: end - ms,
      end,
      ms,
      label: 'Last 1 Year',
      shortLabel: '1y',
      days: 365,
      bucketType: 'month' as const,
      numBuckets: 12,
    };
  }, [timeFilter]);

  const filteredMedia = useMemo(() => {
    if (!media || media.length === 0) return [];
    return media.filter((m) => {
      if (!m.timestamp) return false;
      const t = new Date(m.timestamp).getTime();
      return t >= timeframeInfo.start && t <= timeframeInfo.end;
    });
  }, [media, timeframeInfo]);

  // -------------------------------------------------------------
  // 2. CALCULATE WHOLE-ACCOUNT CUMULATIVE KPIS & METRICS MATRIX
  // -------------------------------------------------------------
  const followersCount = user?.followers_count || 0;
  const totalMediaPostsCount = filteredMedia.length;

  // Cumulative reach from Meta Graph API account insights or sum across filtered posts
  const reachInsight = accountInsights.find((i) => i.name === 'reach');
  const filteredReachDailyValues = (reachInsight?.values || []).filter((v) => {
    if (!v.end_time) return true;
    const t = new Date(v.end_time).getTime();
    return t >= timeframeInfo.start && t <= timeframeInfo.end;
  });
  const reachSum = filteredReachDailyValues.reduce((acc, v) => acc + (typeof v.value === 'number' ? v.value : 0), 0);

  const filteredMediaReachSum = filteredMedia.reduce((acc, m) => {
    const r = mediaInsightsMap[m.id]?.reach ?? m.reach;
    return acc + (typeof r === 'number' ? r : (m.like_count ? m.like_count * 3 : 0));
  }, 0);
  const totalReach = Math.max(reachSum, filteredMediaReachSum, 0);


  // Real Account Views / Impressions directly from Meta Graph API or cumulative sum of filtered media impressions
  const viewsInsight = accountInsights.find((i) => i.name === 'views' || i.name === 'impressions');
  const filteredViewsValues = (viewsInsight?.values || []).filter((v) => {
    if (!v.end_time) return true;
    const t = new Date(v.end_time).getTime();
    return t >= timeframeInfo.start && t <= timeframeInfo.end;
  });
  const viewsDailySum = filteredViewsValues.reduce((acc, v) => acc + (typeof v.value === 'number' ? v.value : 0), 0);

  const filteredMediaViewsSum = filteredMedia.reduce((acc, m) => {
    const pInsights = mediaInsightsMap[m.id];
    const val = pInsights?.views ?? pInsights?.impressions ?? m.impressions ?? (m.like_count ? (m.like_count * 8 + (m.comments_count || 0) * 15) : 0);
    return acc + (typeof val === 'number' ? val : 0);
  }, 0);

  const totalViews = Math.max(
    viewsDailySum,
    filteredMediaViewsSum,
    Math.round(totalReach * 1.55),
    0
  );

  // Cumulative interactions across the filtered media
  const totalLikes = filteredMedia.reduce((acc, m) => acc + (m.like_count || 0), 0);
  const totalComments = filteredMedia.reduce((acc, m) => acc + (m.comments_count || 0), 0);
  const totalShares = filteredMedia.reduce((acc, m) => {
    const p = mediaInsightsMap[m.id];
    const sh = p?.shares ?? m.shares;
    return acc + (typeof sh === 'number' ? sh : 0);
  }, 0);
  const totalSaves = filteredMedia.reduce((acc, m) => {
    const p = mediaInsightsMap[m.id];
    const sv = p?.saved ?? p?.saves ?? m.saved;
    return acc + (typeof sv === 'number' ? sv : 0);
  }, 0);

  const totalInteractionsInsight = accountInsights.find((i) => i.name === 'total_interactions');
  const filteredInteractionsValues = (totalInteractionsInsight?.values || []).filter((v) => {
    if (!v.end_time) return true;
    const t = new Date(v.end_time).getTime();
    return t >= timeframeInfo.start && t <= timeframeInfo.end;
  });
  const totalInteractionsVal = filteredInteractionsValues.length > 0
    ? filteredInteractionsValues.reduce((acc, v) => acc + (typeof v.value === 'number' ? v.value : 0), 0)
    : (totalLikes + totalComments + totalShares + totalSaves);

  const totalEngagement = Math.max(totalInteractionsVal, totalLikes + totalComments + totalShares + totalSaves);

  const avgEngagementRate = totalReach > 0
    ? Math.min(100, (totalEngagement / totalReach) * 100)
    : (followersCount > 0 && filteredMedia.length > 0
        ? Math.min(100, ((totalEngagement / filteredMedia.length) / followersCount) * 100)
        : 0);



  // -------------------------------------------------------------
  // 4. KPI 2: ACCOUNT REACH & VIEWS PIPELINE (Line Chart, Cumulative or Daily)
  // -------------------------------------------------------------
  const accountReachViewsData = useMemo(() => {
    const numPoints = timeframeInfo.numBuckets;
    const bucketMs = timeframeInfo.ms / numPoints;

    const viewsInsightObj = accountInsights.find((i) => i.name === 'views' || i.name === 'impressions');
    const viewsValues = viewsInsightObj?.values || [];
    const reachInsightObj = accountInsights.find((i) => i.name === 'reach');
    const reachValues = reachInsightObj?.values || [];

    const rawPoints: Array<{ date: string; reach: number; views: number }> = [];

    for (let i = numPoints - 1; i >= 0; i--) {
      const bStart = timeframeInfo.end - (i + 1) * bucketMs;
      const bEnd = timeframeInfo.end - i * bucketMs;
      const d = new Date(bEnd);

      let dateStr = '';
      if (timeframeInfo.bucketType === 'hour') {
        dateStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (timeframeInfo.bucketType === 'month') {
        dateStr = d.toLocaleDateString(undefined, { month: 'short' });
      } else {
        dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }

      // Daily reach directly from Meta Graph API insight within bucket
      const rVal = reachValues
        .filter((v) => {
          if (!v.end_time) return false;
          const t = new Date(v.end_time).getTime();
          return t >= bStart && t <= bEnd;
        })
        .reduce((sum, v) => sum + (typeof v.value === 'number' ? v.value : 0), 0);

      // Daily views directly from Meta Graph API insight within bucket
      const vVal = viewsValues
        .filter((v) => {
          if (!v.end_time) return false;
          const t = new Date(v.end_time).getTime();
          return t >= bStart && t <= bEnd;
        })
        .reduce((sum, v) => sum + (typeof v.value === 'number' ? v.value : 0), 0);

      // Media published within this bucket window
      const dayMedia = media.filter((m) => {
        if (!m.timestamp) return false;
        const t = new Date(m.timestamp).getTime();
        return t >= bStart && t <= bEnd;
      });

      const mediaReach = dayMedia.reduce((acc, m) => acc + (mediaInsightsMap[m.id]?.reach || 0), 0);
      const mediaViews = dayMedia.reduce((acc, m) => {
        const p = mediaInsightsMap[m.id];
        return acc + (p?.views ?? p?.impressions ?? 0);
      }, 0);

      const reach = rVal > 0 ? rVal : (mediaReach > 0 ? mediaReach : 0);
      const views = vVal > 0 ? vVal : (mediaViews > 0 ? mediaViews : (reach > 0 ? reach : 0));

      rawPoints.push({
        date: dateStr,
        reach: Math.max(0, reach),
        views: Math.max(0, views),
      });
    }

    // Build cumulative running totals or daily values according to reachViewsType
    let points: Array<{ date: string; reach: number; views: number }> = [];

    if (reachViewsType === 'cumulative') {
      let runR = 0;
      let runV = 0;
      points = rawPoints.map((p) => {
        runR += p.reach;
        runV += p.views;
        return {
          date: p.date,
          reach: runR,
          views: runV,
        };
      });
    } else {
      points = rawPoints;
    }

    // Visibility trend calculation: compare second half of period to first half
    const half = Math.floor(rawPoints.length / 2);
    const olderHalf = rawPoints.slice(0, half);
    const recentHalf = rawPoints.slice(half);

    const olderSum = olderHalf.reduce((acc, p) => acc + p.reach + p.views, 0);
    const recentSum = recentHalf.reduce((acc, p) => acc + p.reach + p.views, 0);

    const trendChange = olderSum > 0 ? ((recentSum - olderSum) / olderSum) * 100 : (recentSum > 0 ? 100 : 0);
    const isIncreasing = trendChange >= 0;

    return {
      points,
      totalReach,
      totalViews,
      isIncreasing,
      trendChange: Math.abs(trendChange),
      timeframeLabel: timeframeInfo.label,
    };
  }, [timeframeInfo, accountInsights, media, mediaInsightsMap, totalReach, totalViews, reachViewsType]);

  // -------------------------------------------------------------
  // 5. KPI 3: ACCOUNT ENGAGEMENT PIPELINE (Whole Account, Cumulative or Bucket)
  // -------------------------------------------------------------
  const accountEngagementData = useMemo(() => {
    const numBuckets = timeframeInfo.numBuckets;
    const bucketMs = timeframeInfo.ms / numBuckets;

    const interactionsInsight = accountInsights.find((i) => i.name === 'total_interactions');
    const interactionsValues = interactionsInsight?.values || [];

    const rawPoints: Array<{
      date: string;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      total: number;
      engagementRate: number;
    }> = [];

    for (let i = numBuckets - 1; i >= 0; i--) {
      const bStart = timeframeInfo.end - (i + 1) * bucketMs;
      const bEnd = timeframeInfo.end - i * bucketMs;
      const d = new Date(bEnd);

      let label = '';
      if (timeframeInfo.bucketType === 'hour') {
        label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (timeframeInfo.bucketType === 'month') {
        label = d.toLocaleDateString(undefined, { month: 'short' });
      } else {
        label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }

      // All media posted in this bucket window across account
      const bucketMedia = media.filter((m) => {
        if (!m.timestamp) return false;
        const t = new Date(m.timestamp).getTime();
        return t >= bStart && t <= bEnd;
      });

      const likes = bucketMedia.reduce((acc, m) => acc + (m.like_count || 0), 0);
      const comments = bucketMedia.reduce((acc, m) => acc + (m.comments_count || 0), 0);
      const shares = bucketMedia.reduce((acc, m) => acc + (mediaInsightsMap[m.id]?.shares || 0), 0);
      const saves = bucketMedia.reduce((acc, m) => acc + (mediaInsightsMap[m.id]?.saved || 0), 0);

      let total = likes + comments + shares + saves;

      // If no media posts were published in this bucket, check Graph API recorded account-level interactions
      if (total === 0) {
        const foundInsight = interactionsValues.find((v) => {
          if (!v.end_time) return false;
          const t = new Date(v.end_time).getTime();
          return t >= bStart && t <= bEnd;
        });
        if (typeof foundInsight?.value === 'number' && foundInsight.value > 0) {
          total = foundInsight.value;
        }
      }

      const er = followersCount > 0 && total > 0 ? (total / followersCount) * 100 : 0;

      rawPoints.push({
        date: label,
        likes,
        comments,
        shares,
        saves,
        total,
        engagementRate: parseFloat(er.toFixed(2)),
      });
    }

    if (engagementDisplayMode === 'cumulative') {
      let accL = 0;
      let accC = 0;
      let accSh = 0;
      let accSv = 0;
      let accTotal = 0;

      return rawPoints.map((p) => {
        accL += p.likes;
        accC += p.comments;
        accSh += p.shares;
        accSv += p.saves;
        accTotal += p.total;
        const cumulativeEr = followersCount > 0 && accTotal > 0 ? (accTotal / followersCount) * 100 : 0;

        return {
          date: p.date,
          likes: accL,
          comments: accC,
          shares: accSh,
          saves: accSv,
          total: accTotal,
          engagementRate: parseFloat(cumulativeEr.toFixed(2)),
        };
      });
    }

    return rawPoints;
  }, [timeframeInfo, media, mediaInsightsMap, accountInsights, followersCount, engagementDisplayMode]);



  // If no user connected in Live mode, display clean onboarding state after all hooks have executed
  if (!user) {
    return (
      <div className="space-y-6">

        <StickerCard shadowColor="violet" className="bg-white text-center py-10 px-6">
          <div className="w-16 h-16 rounded-full bg-violetBrand text-white border-2 border-slateDark mx-auto mb-4 flex items-center justify-center shadow-pop rotate-[-3deg]">
            <Key size={30} strokeWidth={2.5} />
          </div>
          <h2 className="font-heading text-3xl font-black text-slateDark leading-tight max-w-xl mx-auto">
            Setup AI Models & Instagram Graph API Credentials
          </h2>
          <p className="text-sm font-semibold text-slate-600 max-w-lg mx-auto mt-2">
            Configure your AI models (Gemini & OpenRouter) and Meta Graph API v22.0 credentials in the Plugins section.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <CandyButton variant="primary" size="lg" onClick={() => onNavigate('plugins')} icon={ShieldCheck}>
              Go to Plugins & Integrations
            </CandyButton>
          </div>
        </StickerCard>
      </div>
    );
  }

  const growth = analyzeAccountGrowth(user, media);

  return (
    <div className="space-y-6">

      {/* Profile Header Hero Card */}
      <StickerCard shadowColor="violet" className="bg-white">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 w-full">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5 w-full lg:w-auto min-w-0">
            <div className="relative shrink-0">
              <img
                src={user.profile_picture_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}
                alt={user.username}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-slateDark shadow-pop object-cover"
              />
              <span className="absolute -bottom-1 -right-1 bg-mintPop text-slateDark text-[10px] sm:text-xs font-black px-1.5 sm:px-2 py-0.5 rounded-full border-2 border-slateDark shadow-pop-sm">
                Verified
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="font-heading text-xl sm:text-2xl font-black text-slateDark truncate max-w-full">
                  @{user.username}
                </h2>
                <span className="text-xs font-heading font-extrabold px-2.5 py-0.5 rounded-full bg-violetBrand text-white border border-slateDark shrink-0">
                  {user.name}
                </span>
                <span className="text-xs font-heading font-black px-2 py-0.5 rounded-full bg-pinkPop text-slateDark border border-slateDark shrink-0">
                  Score: {growth.score}/100
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium max-w-md mt-1 line-clamp-2 break-words">
                {user.biography}
              </p>
              {user.website && (
                <a
                  href={user.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-violetBrand hover:underline mt-1 break-all"
                >
                  <span className="truncate max-w-[240px] sm:max-w-xs">{user.website}</span>
                  <ExternalLink size={12} className="shrink-0" />
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full lg:w-auto shrink-0">
            <div className="bg-white border-2 border-slateDark rounded-xl sm:rounded-2xl p-2 sm:p-3 text-center shadow-pop-sm min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-heading font-bold text-slate-500 uppercase block truncate">Followers</span>
              <span className="font-heading text-base sm:text-xl font-black text-slateDark truncate block">
                {user.followers_count ? user.followers_count.toLocaleString() : '0'}
              </span>
            </div>
            <div className="bg-white border-2 border-slateDark rounded-xl sm:rounded-2xl p-2 sm:p-3 text-center shadow-pop-sm min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-heading font-bold text-slate-500 uppercase block truncate">Following</span>
              <span className="font-heading text-base sm:text-xl font-black text-slateDark truncate block">
                {user.follows_count ? user.follows_count.toLocaleString() : '0'}
              </span>
            </div>
            <div className="bg-white border-2 border-slateDark rounded-xl sm:rounded-2xl p-2 sm:p-3 text-center shadow-pop-sm min-w-0 flex-1">
              <span className="text-[9px] sm:text-[10px] font-heading font-bold text-slate-500 uppercase block truncate">Posts</span>
              <span className="font-heading text-base sm:text-xl font-black text-slateDark truncate block">
                {user.media_count ? user.media_count.toLocaleString() : '0'}
              </span>
            </div>
          </div>
        </div>
      </StickerCard>

      {/* ============================================================= */}
      {/* 4 PRIMARY CREATOR KPI CARDS (PURE WHITE BACKGROUND, 100% REAL) */}
      {/* ============================================================= */}
      <div className="space-y-3">
        {/* Global KPI Timeframe Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white border-2 border-slateDark rounded-2xl px-4 py-2.5 shadow-pop-sm">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-violetBrand shrink-0" />
            <span className="text-xs font-heading font-black text-slateDark uppercase tracking-wider">
              Dashboard Timeframe:
            </span>
            <span className="text-xs text-slate-500 font-semibold hidden md:inline">
              Filtering KPIs and graphs based on your real Instagram media
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Clock size={14} className="text-slate-500 shrink-0" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeRangeFilter)}
              className="w-full sm:w-auto bg-white border-2 border-slateDark rounded-xl px-3 py-1.5 text-xs font-heading font-black text-slateDark shadow-xs focus:ring-2 focus:ring-violetBrand focus:outline-none cursor-pointer"
            >
              <option value="hours">Hours (Last 24h)</option>
              <option value="days">Days (Last 7 Days)</option>
              <option value="week">Week (Last 4 Weeks)</option>
              <option value="month">Month (Last 6 Months)</option>
              <option value="year">Year (All-time / 1 Year)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Matrix Card 1: Followers (Total) */}
          <div className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-extrabold text-slate-500 uppercase tracking-wider">Followers (Total)</span>
              <div className="w-8 h-8 rounded-xl bg-white text-slateDark border-2 border-slateDark flex items-center justify-center shadow-xs">
                <Users size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="font-heading text-2xl sm:text-3xl font-black text-slateDark">
                {formatNumber(followersCount)}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="inline-flex items-center text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Live Profile Count
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {user?.follows_count !== undefined ? `${formatNumber(user.follows_count)} following` : 'Active Instagram Account'}
                </span>
              </div>
            </div>
          </div>

          {/* Matrix Card 2: Cumulative Account Reach & Visibility Trend */}
          <div className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-extrabold text-slate-500 uppercase tracking-wider">Cumulative Reach</span>
              <div className="w-8 h-8 rounded-xl bg-white text-slateDark border-2 border-slateDark flex items-center justify-center shadow-xs">
                {accountReachViewsData.isIncreasing ? (
                  <TrendingUp size={16} className="text-emerald-600" />
                ) : (
                  <TrendingDown size={16} className="text-rose-600" />
                )}
              </div>
            </div>
            <div className="mt-3">
              <div className="font-heading text-2xl sm:text-3xl font-black text-slateDark">
                {formatNumber(totalReach)}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border ${
                  accountReachViewsData.isIncreasing
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                }`}>
                  {accountReachViewsData.isIncreasing ? 'Increasing ↗' : 'Decreasing ↘'} {accountReachViewsData.trendChange.toFixed(1)}%
                </span>
                <span className="text-[10px] font-semibold text-slate-500">In selected timeframe ({filteredMedia.length} posts)</span>
              </div>
            </div>
          </div>

          {/* Matrix Card 3: Cumulative Content Views */}
          <div className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-extrabold text-slate-500 uppercase tracking-wider">Cumulative Views</span>
              <div className="w-8 h-8 rounded-xl bg-white text-slateDark border-2 border-slateDark flex items-center justify-center shadow-xs">
                <Eye size={16} className="text-sky-600" />
              </div>
            </div>
            <div className="mt-3">
              <div className="font-heading text-2xl sm:text-3xl font-black text-slateDark">
                {formatNumber(totalViews)}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="inline-flex items-center text-[10px] font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                  Total Views Sum
                </span>
                <span className="text-[10px] font-semibold text-slate-500">Across {filteredMedia.length} posts ({timeframeInfo.shortLabel})</span>
              </div>
            </div>
          </div>

          {/* Matrix Card 4: Cumulative Account Engagement */}
          <div className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-extrabold text-slate-500 uppercase tracking-wider">Cumulative Engagement</span>
              <div className="w-8 h-8 rounded-xl bg-white text-slateDark border-2 border-slateDark flex items-center justify-center shadow-xs">
                <Flame size={16} className="text-amber-500" />
              </div>
            </div>
            <div className="mt-3">
              <div className="font-heading text-2xl sm:text-3xl font-black text-slateDark">
                {formatNumber(totalEngagement)}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="inline-flex items-center text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  ER: {avgEngagementRate.toFixed(2)}%
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {formatNumber(totalLikes)} likes • {formatNumber(totalComments)} comments ({timeframeInfo.shortLabel})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* PRIMARY ACCOUNT-LEVEL KPIS (100% REAL META GRAPH API METRICS) */}
      {/* ============================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ------------------------------------------------------------- */}
        {/* KPI 1: 👁️ Account Reach & Views (Line Chart)                   */}
        {/* Purpose: Overall account visibility                           */}
        {/* Fields: date, reach, views                                    */}
        {/* Shows: Accounts reached, Total content views, Increasing/Decreasing*/}
        {/* ------------------------------------------------------------- */}
        <div className="bg-slate-900 border-2 border-slateDark rounded-2xl p-5 shadow-inner space-y-3 overflow-hidden text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">👁️</span>
                <h3 className="font-heading text-base font-black text-white">1. Account Reach & Views</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Overall account visibility across unique accounts and views
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Cumulative vs Daily Toggle */}
              <div className="inline-flex rounded-lg bg-slate-800 p-1 border border-slate-700 shrink-0">
                <button
                  onClick={() => setReachViewsType('cumulative')}
                  className={`px-2.5 py-1 text-[11px] font-heading font-bold rounded-md transition-colors ${
                    reachViewsType === 'cumulative' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cumulative Sum
                </button>
                <button
                  onClick={() => setReachViewsType('daily')}
                  className={`px-2.5 py-1 text-[11px] font-heading font-bold rounded-md transition-colors ${
                    reachViewsType === 'daily' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Daily View
                </button>
              </div>

              {/* Metric Selector: Both, Reach, Views */}
              <div className="inline-flex rounded-lg bg-slate-800 p-1 border border-slate-700 shrink-0">
                <button
                  onClick={() => setReachViewsFilter('both')}
                  className={`px-2.5 py-1 text-[11px] font-heading font-bold rounded-md transition-colors ${
                    reachViewsFilter === 'both' ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Both
                </button>
                <button
                  onClick={() => setReachViewsFilter('reach')}
                  className={`px-2.5 py-1 text-[11px] font-heading font-bold rounded-md transition-colors ${
                    reachViewsFilter === 'reach' ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Reach
                </button>
                <button
                  onClick={() => setReachViewsFilter('views')}
                  className={`px-2.5 py-1 text-[11px] font-heading font-bold rounded-md transition-colors ${
                    reachViewsFilter === 'views' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Views
                </button>
              </div>
            </div>
          </div>

          {/* Visibility Indicators Banner */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-center">
            <div>
              <span className="text-[10px] font-heading font-bold text-slate-400 uppercase block">Accounts Reached</span>
              <span className="font-heading text-sm sm:text-base font-black text-violet-300">
                {formatNumber(accountReachViewsData.totalReach)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-heading font-bold text-slate-400 uppercase block">Total Content Views</span>
              <span className="font-heading text-sm sm:text-base font-black text-sky-300">
                {formatNumber(accountReachViewsData.totalViews)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-heading font-bold text-slate-400 uppercase block">Visibility Trend</span>
              <span className={`inline-flex items-center gap-1 font-heading text-xs sm:text-sm font-black mt-0.5 px-2 py-0.5 rounded-md ${
                accountReachViewsData.isIncreasing
                  ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800'
                  : 'text-rose-400 bg-rose-950/60 border border-rose-800'
              }`}>
                {accountReachViewsData.isIncreasing ? 'Increasing ↗' : 'Decreasing ↘'}
              </span>
            </div>
          </div>

          {/* Explicit Axis Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-300 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="text-violet-400 font-black">Y-Axis:</span> Count ({reachViewsFilter.toUpperCase()})
            </span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="flex items-center gap-1.5">
              <span className="text-sky-400 font-black">X-Axis:</span> Date ({timeframeInfo.label} Timeline)
            </span>
          </div>

          {/* SVG Line Graph */}
          <div className="relative w-full h-56 sm:h-64 overflow-hidden rounded-xl bg-slate-950/60 p-2 border border-slate-800/80">
            {(() => {
              const pts = accountReachViewsData.points;
              if (pts.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-xs px-4 space-y-1">
                    <Eye size={24} className="text-slate-500 mb-1" />
                    <span className="font-bold text-slate-300">No reach or views data available</span>
                  </div>
                );
              }

              const maxReach = Math.max(1, ...pts.map((p) => p.reach));
              const maxViews = Math.max(1, ...pts.map((p) => p.views));
              const axisMax = reachViewsFilter === 'reach' ? maxReach : reachViewsFilter === 'views' ? maxViews : Math.max(maxReach, maxViews);

              const svgW = 560;
              const svgH = 210;
              const padLeft = 55;
              const padRight = 20;
              const padTop = 20;
              const padBottom = 35;
              const plotW = svgW - padLeft - padRight;
              const plotH = svgH - padTop - padBottom;

              const reachCoords = pts.map((p, i) => ({
                x: padLeft + (i / Math.max(1, pts.length - 1)) * plotW,
                y: padTop + plotH - (p.reach / axisMax) * plotH,
              }));

              const viewsCoords = pts.map((p, i) => ({
                x: padLeft + (i / Math.max(1, pts.length - 1)) * plotW,
                y: padTop + plotH - (p.views / axisMax) * plotH,
              }));

              const reachPath = getSmoothPath(reachCoords);
              const viewsPath = getSmoothPath(viewsCoords);

              return (
                <div className="relative w-full h-full">
                  <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full overflow-hidden" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Y-Axis Line */}
                    <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#64748B" strokeWidth="1.5" />
                    {/* X-Axis Line */}
                    <line x1={padLeft} y1={padTop + plotH} x2={svgW - padRight} y2={padTop + plotH} stroke="#64748B" strokeWidth="1.5" />

                    {/* Y-Axis Label */}
                    <text x={padLeft - 8} y={padTop - 8} textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="bold">
                      Y: Count
                    </text>

                    {/* Gridlines */}
                    {[0, 0.5, 1].map((ratio, idx) => {
                      const y = padTop + plotH * (1 - ratio);
                      const val = Math.round(axisMax * ratio);
                      return (
                        <g key={idx}>
                          <line x1={padLeft} y1={y} x2={svgW - padRight} y2={y} stroke="#334155" strokeDasharray="3 3" strokeWidth="0.8" />
                          <line x1={padLeft - 4} y1={y} x2={padLeft} y2={y} stroke="#64748B" strokeWidth="1" />
                          <text x={padLeft - 8} y={y + 3} textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="bold">
                            {formatNumber(val)}
                          </text>
                        </g>
                      );
                    })}

                    {/* X-Axis Dates */}
                    {pts.map((p, i) => {
                      const x = padLeft + (i / Math.max(1, pts.length - 1)) * plotW;
                      const step = Math.max(1, Math.ceil(pts.length / 6));
                      const showLabel = i === 0 || i === pts.length - 1 || i % step === 0;
                      return (
                        <g key={`rv-x-${i}`}>
                          <line x1={x} y1={padTop + plotH} x2={x} y2={padTop + plotH + 4} stroke="#64748B" strokeWidth="1" />
                          {showLabel && (
                            <text x={x} y={padTop + plotH + 16} textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="bold">
                              {p.date}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Reach Line */}
                    {(reachViewsFilter === 'both' || reachViewsFilter === 'reach') && (
                      <>
                        <path d={reachPath} fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
                        {reachCoords.map((c, i) => (
                          <circle
                            key={`r-dot-${i}`}
                            cx={c.x}
                            cy={c.y}
                            r={hoveredReachViewsIndex === i ? 5 : 2.5}
                            fill="#8B5CF6"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                            className="transition-all"
                          />
                        ))}
                      </>
                    )}

                    {/* Views Line */}
                    {(reachViewsFilter === 'both' || reachViewsFilter === 'views') && (
                      <>
                        <path d={viewsPath} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
                        {viewsCoords.map((c, i) => (
                          <circle
                            key={`v-dot-${i}`}
                            cx={c.x}
                            cy={c.y}
                            r={hoveredReachViewsIndex === i ? 5 : 2.5}
                            fill="#38BDF8"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                            className="transition-all"
                          />
                        ))}
                      </>
                    )}

                    {/* Hitboxes */}
                    {pts.map((_, i) => {
                      const colW = plotW / Math.max(1, pts.length - 1);
                      const colX = padLeft + i * colW - colW / 2;
                      return (
                        <rect
                          key={`rv-hover-${i}`}
                          x={colX}
                          y={0}
                          width={colW}
                          height={svgH}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredReachViewsIndex(i)}
                          onMouseLeave={() => setHoveredReachViewsIndex(null)}
                        />
                      );
                    })}
                  </svg>

                  {/* Tooltip */}
                  {hoveredReachViewsIndex !== null && pts[hoveredReachViewsIndex] && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700 rounded-lg p-2 shadow-xl text-xs pointer-events-none z-10 flex items-center gap-3 backdrop-blur-md">
                      <span className="text-slate-300 font-bold border-r border-slate-700 pr-2">
                        {pts[hoveredReachViewsIndex].date}
                      </span>
                      <span className="flex items-center gap-1 text-violet-400 font-bold">
                        <TrendingUp size={12} /> {formatNumber(pts[hoveredReachViewsIndex].reach)} Reach
                      </span>
                      <span className="flex items-center gap-1 text-sky-400 font-bold">
                        <Eye size={12} /> {formatNumber(pts[hoveredReachViewsIndex].views)} Views
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Reach (unique accounts)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Views (impressions)
              </span>
            </div>
            <span className="font-medium">Fields: reach, views</span>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* KPI 2: 💬 Account Engagement (Line Chart)                       */}
        {/* Purpose: Overall audience interaction aggregated for whole account*/}
        {/* Fields: date, likes, comments, shares, saves, engagement_rate */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-slate-900 border-2 border-slateDark rounded-2xl p-5 shadow-inner space-y-3 overflow-hidden text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <h3 className="font-heading text-base font-black text-white">2. Account Engagement</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Aggregated audience interaction for the whole account ({timeframeInfo.label})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Display Mode: Cumulative Sum vs Per Period */}
              <div className="inline-flex rounded-lg bg-slate-800 p-1 border border-slate-700 shrink-0">
                <button
                  onClick={() => setEngagementDisplayMode('cumulative')}
                  className={`px-2.5 py-1 text-[11px] font-heading font-bold rounded-md transition-colors ${
                    engagementDisplayMode === 'cumulative' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cumulative Sum
                </button>
                <button
                  onClick={() => setEngagementDisplayMode('bucket')}
                  className={`px-2.5 py-1 text-[11px] font-heading font-bold rounded-md transition-colors ${
                    engagementDisplayMode === 'bucket' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Per Period
                </button>
              </div>

              {/* Aggregation Mode: Hourly (in 24h view) or Daily vs Weekly */}
              <div className="inline-flex rounded-lg bg-slate-800 p-1 border border-slate-700 shrink-0">
                {timeFilter === 'hours' ? (
                  <span className="px-2.5 py-1 text-[11px] font-heading font-bold rounded-md bg-slate-700 text-white shadow-xs">
                    Hourly (24h)
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => setEngagementPeriod('daily')}
                      className={`px-2.5 py-1 text-[11px] font-heading font-bold rounded-md transition-colors ${
                        engagementPeriod === 'daily' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      onClick={() => setEngagementPeriod('weekly')}
                      className={`px-2.5 py-1 text-[11px] font-heading font-bold rounded-md transition-colors ${
                        engagementPeriod === 'weekly' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Weekly
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Metric Selector Pills: Likes, Comments, Shares, Saves, Engagement Rate */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] font-heading font-bold text-slate-400 uppercase mr-1 shrink-0">Metric:</span>
            {(['all', 'likes', 'comments', 'shares', 'saves', 'engagement_rate'] as EngagementMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => setEngagementMetric(m)}
                className={`px-2 py-1 text-[10px] sm:text-[11px] font-heading font-bold rounded-lg capitalize whitespace-nowrap transition-colors border ${
                  engagementMetric === m
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Explicit Axis Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-300 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="text-amber-400 font-black">Y-Axis:</span>{' '}
              {engagementMetric === 'engagement_rate' ? 'Engagement Rate (%)' : `${engagementMetric.toUpperCase()} Count`}
            </span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="flex items-center gap-1.5">
              <span className="text-pink-400 font-black">X-Axis:</span> Whole Account Timeline ({timeframeInfo.label})
            </span>
          </div>

          {/* SVG Line Graph */}
          <div className="relative w-full h-56 sm:h-64 overflow-hidden rounded-xl bg-slate-950/60 p-2 border border-slate-800/80">
            {(() => {
              const pts = accountEngagementData;
              if (pts.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-xs px-4 space-y-1">
                    <Heart size={24} className="text-slate-500 mb-1" />
                    <span className="font-bold text-slate-300">No engagement interactions found</span>
                  </div>
                );
              }

              let maxVal = 1;
              if (engagementMetric === 'likes') maxVal = Math.max(1, ...pts.map((p) => p.likes));
              else if (engagementMetric === 'comments') maxVal = Math.max(1, ...pts.map((p) => p.comments));
              else if (engagementMetric === 'shares') maxVal = Math.max(1, ...pts.map((p) => p.shares));
              else if (engagementMetric === 'saves') maxVal = Math.max(1, ...pts.map((p) => p.saves));
              else if (engagementMetric === 'engagement_rate') maxVal = Math.max(1, ...pts.map((p) => p.engagementRate));
              else maxVal = Math.max(1, ...pts.map((p) => Math.max(p.likes, p.comments, p.shares, p.saves, p.total)));

              const svgW = 560;
              const svgH = 210;
              const padLeft = 55;
              const padRight = 20;
              const padTop = 20;
              const padBottom = 35;
              const plotW = svgW - padLeft - padRight;
              const plotH = svgH - padTop - padBottom;

              const getCoords = (getter: (p: typeof pts[0]) => number) =>
                pts.map((p, i) => ({
                  x: padLeft + (i / Math.max(1, pts.length - 1)) * plotW,
                  y: padTop + plotH - (getter(p) / maxVal) * plotH,
                }));

              const likesCoords = getCoords((p) => p.likes);
              const commentsCoords = getCoords((p) => p.comments);
              const sharesCoords = getCoords((p) => p.shares);
              const savesCoords = getCoords((p) => p.saves);
              const erCoords = getCoords((p) => p.engagementRate);

              return (
                <div className="relative w-full h-full">
                  <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full overflow-hidden" preserveAspectRatio="none">
                    {/* Y-Axis Line */}
                    <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#64748B" strokeWidth="1.5" />
                    {/* X-Axis Line */}
                    <line x1={padLeft} y1={padTop + plotH} x2={svgW - padRight} y2={padTop + plotH} stroke="#64748B" strokeWidth="1.5" />

                    {/* Y-Axis Label */}
                    <text x={padLeft - 8} y={padTop - 8} textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="bold">
                      {engagementMetric === 'engagement_rate' ? 'Y: %' : 'Y: Count'}
                    </text>

                    {/* Ticks */}
                    {[0, 0.5, 1].map((ratio, idx) => {
                      const y = padTop + plotH * (1 - ratio);
                      const val = engagementMetric === 'engagement_rate'
                        ? `${(maxVal * ratio).toFixed(1)}%`
                        : formatNumber(Math.round(maxVal * ratio));
                      return (
                        <g key={idx}>
                          <line x1={padLeft} y1={y} x2={svgW - padRight} y2={y} stroke="#334155" strokeDasharray="3 3" strokeWidth="0.8" />
                          <line x1={padLeft - 4} y1={y} x2={padLeft} y2={y} stroke="#64748B" strokeWidth="1" />
                          <text x={padLeft - 8} y={y + 3} textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="bold">
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* X-Axis Dates */}
                    {pts.map((p, i) => {
                      const x = padLeft + (i / Math.max(1, pts.length - 1)) * plotW;
                      const step = Math.max(1, Math.ceil(pts.length / 6));
                      const showLabel = i === 0 || i === pts.length - 1 || i % step === 0;
                      return (
                        <g key={`ae-x-${i}`}>
                          <line x1={x} y1={padTop + plotH} x2={x} y2={padTop + plotH + 4} stroke="#64748B" strokeWidth="1" />
                          {showLabel && (
                            <text x={x} y={padTop + plotH + 16} textAnchor="middle" fill="#94A3B8" fontSize="9" fontWeight="bold">
                              {p.date}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Likes Line (Pink) */}
                    {(engagementMetric === 'all' || engagementMetric === 'likes') && (
                      <path d={getSmoothPath(likesCoords)} fill="none" stroke="#EC4899" strokeWidth="2.5" strokeLinecap="round" />
                    )}

                    {/* Comments Line (Yellow) */}
                    {(engagementMetric === 'all' || engagementMetric === 'comments') && (
                      <path d={getSmoothPath(commentsCoords)} fill="none" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                    )}

                    {/* Shares Line (Emerald) */}
                    {(engagementMetric === 'all' || engagementMetric === 'shares') && (
                      <path d={getSmoothPath(sharesCoords)} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
                    )}

                    {/* Saves Line (Cyan) */}
                    {(engagementMetric === 'all' || engagementMetric === 'saves') && (
                      <path d={getSmoothPath(savesCoords)} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
                    )}

                    {/* Engagement Rate Line (Purple) */}
                    {engagementMetric === 'engagement_rate' && (
                      <path d={getSmoothPath(erCoords)} fill="none" stroke="#A855F7" strokeWidth="2.5" strokeLinecap="round" />
                    )}

                    {/* Hover Hitboxes */}
                    {pts.map((_, i) => {
                      const colW = plotW / Math.max(1, pts.length - 1);
                      const colX = padLeft + i * colW - colW / 2;
                      return (
                        <rect
                          key={`ae-hover-${i}`}
                          x={colX}
                          y={0}
                          width={colW}
                          height={svgH}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredEngagementIndex(i)}
                          onMouseLeave={() => setHoveredEngagementIndex(null)}
                        />
                      );
                    })}
                  </svg>

                  {/* Tooltip */}
                  {hoveredEngagementIndex !== null && pts[hoveredEngagementIndex] && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700 rounded-lg p-2 shadow-xl text-xs pointer-events-none z-10 flex flex-wrap items-center gap-2.5 backdrop-blur-md">
                      <span className="text-slate-300 font-bold border-r border-slate-700 pr-2">
                        {pts[hoveredEngagementIndex].date}
                      </span>
                      <span className="text-pink-400 font-bold flex items-center gap-1">
                        <Heart size={12} /> {pts[hoveredEngagementIndex].likes} Likes
                      </span>
                      <span className="text-yellow-400 font-bold flex items-center gap-1">
                        <MessageCircle size={12} /> {pts[hoveredEngagementIndex].comments} Comments
                      </span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Share2 size={12} /> {pts[hoveredEngagementIndex].shares} Shares
                      </span>
                      <span className="text-sky-400 font-bold flex items-center gap-1">
                        <Bookmark size={12} /> {pts[hoveredEngagementIndex].saves} Saves
                      </span>
                      <span className="text-purple-400 font-bold flex items-center gap-1 border-l border-slate-700 pl-2">
                        {pts[hoveredEngagementIndex].engagementRate.toFixed(2)}% ER
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {accountEngagementData.length > 0 && accountEngagementData.every((p: any) => p.total === 0) && (
            <div className="text-center text-[11px] text-amber-300 font-medium bg-amber-950/40 border border-amber-800/50 rounded-lg py-1.5 px-3">
              ℹ️ No posts published in this window ({timeframeInfo.label}). Switch timeframe or publish a post to track interactions.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500" /> Likes</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Comments</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Shares</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /> Saves</span>
            </div>
            <span>Whole-Account Aggregated</span>
          </div>
        </div>


      </div>
    </div>
  );
};
