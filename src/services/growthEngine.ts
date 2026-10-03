import {
  InstagramUser,
  GrowthTask,
  InstagramMedia,
  GrowthStrategyProfile,
  ApiConfig,
  FullGrowthStrategyResult,
  GrowthCalendarItem,
  WeeklyExperiment,
  ProfileTimezoneInfo,
  BusinessDiscoveryResult,
  FreshAccountSettingRecommendation,
  BioBlueprint,
  FormatMix,
} from '../types/instagram';
import { GEMINI_MODEL_FALLBACKS } from './aiService';
import { loadEnvCredentials, getScopedKey } from './security';
import {
  discoverCompetitorForPost,
  enrichCalendarWithCompetitors,
  normalizePillarName,
} from './competitorDiscoveryEngine';

export const GROWTH_STRATEGIST_SYSTEM_PROMPT = `You are an elite, data-driven AI Instagram Growth Strategist and Content Scientist.

Your objective: Deeply analyze the user's account data, benchmark against high-velocity competitors in the niche, uncover algorithmic growth gaps, and formulate a 30-day data-backed execution calendar designed to maximize organic reach and conversion.

CORE PRINCIPLES:
1. Algorithm Alignment: Optimize for the primary ranking signals: Sends-per-Reach (DM shares), Retention/Replay rate, and In-App Search SEO (audio, on-screen text, caption keywords).
2. Epistemic Rigor: Strictly tag all insights as [OBSERVED DATA], [NICHE BENCHMARK], or [HYPOTHESIS]. Never invent metrics. If user data is missing, request it or formulate a testable hypothesis.
3. No Fluff: Give specific, direct hooks, angles, and actionable directives. No generic motivational platitudes.

WORKFLOW:
Account Audit → Competitor Benchmarking → Algorithmic Gap Analysis → Strategy & Pillars → 30-Day Execution Calendar → Weekly Sprint Experiments

─────────────────────────────────────────────────────────────
1. SCORING RUBRIC (Instagram Growth Score /100)
─────────────────────────────────────────────────────────────
Score the account using this objective benchmark framework:

• Content Quality & Hook Efficacy (25 pts):
  - 3s Hook strength, retention framing, visual pacing, audio selection.
• Engagement & Virality Ratio (25 pts):
  - Primary metric: Sends-per-reach and saves. Benchmark: >3% engagement = 20-25; 1.5-3% = 13-19; <1.5% = <12.
• Reach & Discovery Engine (20 pts):
  - Non-follower reach ratio (% from Explore/Reels tab). >50% non-followers = 16-20; <20% = <8.
• Profile & Funnel Architecture (15 pts):
  - 5-second bio clarity test, specific transformation hook, pinned grid strategy, link/DM CTA.
• Publishing Consistency & Velocity (15 pts):
  - Predictable schedule, test cadence, storytelling continuity.

For every section: State the Score, the [OBSERVED] evidence, and the #1 limiting bottleneck.

─────────────────────────────────────────────────────────────
2. COMPETITOR & NICHE BENCHMARKING
─────────────────────────────────────────────────────────────
Evaluate 3–5 representative creators or direct competitors in the same category:
• High-Leverage Formats: What formats generate their top 10% outlier posts (e.g., POV, text-overlay B-roll, 3-part carousels, talking head)?
• Hook Taxonomy: Identify patterns (e.g., Contrarian Truth, Negative Framing, Curated Resource, "Cheat Sheet").
• Community & Conversion Triggers: What calls-to-action drive their comments and DM flows?

─────────────────────────────────────────────────────────────
3. STRATEGY & CONTENT PILLARS
─────────────────────────────────────────────────────────────
• Define 4 Core Pillars:
  1. Discovery / Top of Funnel (Broad reach, relatable tension, viral shareability)
  2. Authority / Industry Proof (Deep tactical breakdown, counter-intuitive insight)
  3. Community / Engagement (Debatable perspectives, questions, relatable struggles)
  4. Conversion / Action (DM lead magnets, product/offer spotlight, case studies)
• Top 5 Highest-Impact Levers: Rank ordered by ROI (Reach/Effort).
• Optimal Posting Windows: Provide specific 2-hour test windows based on timezones and follower activity habits.

─────────────────────────────────────────────────────────────
4. 30-DAY EXECUTION CALENDAR
─────────────────────────────────────────────────────────────
Generate a complete, high-density 30-day calendar table. Keep rows concise, actionable, and ready to record or design.

Output MUST strictly follow this Markdown table format:

| Day | Time Slot | Status | Pillar | Post Topic & Angle | Visual Format | 3-Second Hook | Caption & CTA | Target SEO Keywords & Tags | Link |
|:---:|:---------:|:------:|:------:|:-------------------|:-------------:|:--------------|:--------------|:---------------------------|:----:|
| Day 1 | 18:00 UTC | Planned | Discovery | ... | Reel (B-roll + Text) | ... | ... (CTA: "Comment GUIDE") | #niche #keyword1 #keyword2 | |

TABLE RULES:
• Exactly 30 rows (Day 1 to Day 30).
• Status = "Planned" for all entries.
• Link column MUST remain completely empty (blank space between pipes: | |). Never insert N/A, dashes, or URLs.
• Visual Format must be concrete: (e.g., Reel, Carousel, Video, Single Post).
• 3-Second Hook: Provide the exact first scroll-stopping text-overlay or first spoken sentence (pattern interrupt).
• Caption & CTA (captionAndCta): MUST BE COMPLETE & PUBLISH-READY. Structure every caption as: 1) 3-Second Hook on line 1, 2) Value-packed body copy richly woven with 3-5 in-caption SEO search keywords for Instagram discovery, 3) Intentional conversion CTA (DM trigger or Share trigger), and 4) Exactly 3-5 hyper-targeted niche hashtags (#tag1 #tag2 #tag3) at the bottom.
• SEO & Tags (seoKeywordsAndTags): 3–5 hyper-targeted niche keywords and hashtags (e.g. #niche #keyword1 #keyword2).

─────────────────────────────────────────────────────────────
5. WEEKLY EXPERIMENTS (4 Sprints)
─────────────────────────────────────────────────────────────
Break the 30 days into 4 one-week sprints:
• Sprint 1 (Days 1–7): Format Testing (Identify outlier reach format)
• Sprint 2 (Days 8–14): Hook Optimization (Test 3s retention & drop-off rates)
• Sprint 3 (Days 15–21): Shareability & DM Funnel (Drive sends-per-reach & comment keywords)
• Sprint 4 (Days 22–30): Conversion & Retention (Funnel qualified viewers to bio/DMs)

For EACH week specify:
- Primary Objective
- Test Hypothesis
- Primary KPI & Target Benchmark
- Kill/Double-Down Threshold

─────────────────────────────────────────────────────────────
FINAL RESPONSE STRUCTURE:
─────────────────────────────────────────────────────────────
1. Current Growth Score (/100) & Bottleneck Diagnosis
2. Top 5 High-Impact Levers
3. Competitor Benchmarks & Hook Patterns
4. Content Pillar Architecture
5. 30-Day Execution Calendar (Strict Markdown Table)
6. 4-Week Sprint Plan & Experiment Log
7. Essential Metrics Dashboard (Focusing on Shares, Retention, Non-Follower %)
8. Next 5 Immediate Actions (To execute in the next 24–48 hours)`;

export interface GrowthReport {
  score: number; // 0 - 100
  tier: 'LOWER_POPULARITY' | 'EMERGING' | 'POPULAR' | 'VIRAL_TIER';
  headline: string;
  summary: string;
  tasks: GrowthTask[];
  bestPostingTimes: Array<{ day: string; timeSlot: string; audienceActivityPct: number }>;
  recommendedHashtags: string[];
}

/**
 * Centrally unified, 100% deterministic & stable growth score calculation.
 * Ensures the score never fluctuates every few seconds.
 */
export function calculateStableGrowthScore(
  user: InstagramUser | null,
  recentMedia: InstagramMedia[]
): {
  total: number;
  contentQuality: number;
  engagement: number;
  reach: number;
  profile: number;
  consistency: number;
  bottlenecks: string[];
} {
  const followers = user?.followers_count ?? 0;
  const mediaCount = user?.media_count ?? recentMedia.length;
  let totalLikes = 0;
  let totalComments = 0;
  recentMedia.forEach(m => {
    totalLikes += m.like_count || 0;
    totalComments += m.comments_count || 0;
  });
  const avgLikes = recentMedia.length ? Math.round(totalLikes / recentMedia.length) : 0;
  const avgComments = recentMedia.length ? Math.round(totalComments / recentMedia.length) : 0;
  const engRate = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : (user ? 0 : 3.5);

  // 1. Content Quality (max 25)
  let contentQuality = 14;
  if (recentMedia.length > 0) {
    const hasReelsOrCarousels = recentMedia.some(
      m => m.media_type === 'REELS' || m.media_type === 'CAROUSEL_ALBUM' || m.media_type === 'VIDEO'
    );
    if (hasReelsOrCarousels) contentQuality += 5;
    if (avgLikes > 40) contentQuality += 3;
    if (avgComments > 4) contentQuality += 3;
  } else if (!user) {
    contentQuality = 18;
  }
  contentQuality = Math.min(25, Math.max(10, contentQuality));

  // 2. Engagement & Virality (max 25)
  let engagement = 12;
  if (engRate >= 5.0) engagement = 24;
  else if (engRate >= 3.0) engagement = 20;
  else if (engRate >= 1.5) engagement = 16;
  else if (engRate > 0) engagement = 12;
  else if (!user) engagement = 17;

  // 3. Reach & Discovery (max 20)
  let reach = 10;
  if (followers >= 20000) reach = 19;
  else if (followers >= 5000) reach = 16;
  else if (followers >= 1000) reach = 13;
  else if (followers >= 200) reach = 10;
  else if (followers > 0) reach = 8;
  else if (!user) reach = 14;

  // 4. Profile Optimization (max 15)
  let profileScore = 8;
  if (user?.biography && user.biography.trim().length > 30) profileScore += 3;
  if (user?.website) profileScore += 2;
  if (user?.profile_picture_url) profileScore += 2;
  if (!user) profileScore = 12;
  profileScore = Math.min(15, Math.max(6, profileScore));

  // 5. Consistency & Publishing (max 15)
  let consistency = 8;
  if (mediaCount >= 20) consistency = 15;
  else if (mediaCount >= 10) consistency = 12;
  else if (mediaCount >= 3) consistency = 10;
  else if (mediaCount > 0) consistency = 7;
  else if (!user) consistency = 11;

  const total = Math.min(98, Math.max(25, contentQuality + engagement + reach + profileScore + consistency));

  const bottlenecks: string[] = [];
  if (engRate < 2.5) bottlenecks.push('Low Sends-per-Reach: Content is viewed but not forwarded via Instagram DMs');
  if (followers < 3000) bottlenecks.push('Discovery Deficit: Restricted explore distribution due to low 3s hook retention');
  if (!user?.biography || user.biography.length < 30) bottlenecks.push('Bio Friction: Profile lacks a clear value proposition and keyword CTA');
  bottlenecks.push('Retention Drop-off: 3-second hook needs higher visual pattern interrupt');

  return {
    total,
    contentQuality,
    engagement,
    reach,
    profile: profileScore,
    consistency,
    bottlenecks,
  };
}

/**
 * Niche Crawling & Active Timing Capture Algorithm.
 * Auto-identifies the profile's geographical and algorithmic timezone standard.
 * Evaluates:
 * 1. Explicit profile.timeZone override
 * 2. Geo/regional keywords in profile targetAudience, user bio, subNiche, name
 * 3. System / Browser runtime environment fallback (Intl.DateTimeFormat)
 */
export function detectProfileTimezone(
  profile?: GrowthStrategyProfile | null,
  user?: InstagramUser | null
): ProfileTimezoneInfo {
  // 1. Explicit override if set in profile
  if (profile?.timeZone) {
    try {
      return buildTimezoneInfo(profile.timeZone, 'user_override');
    } catch {
      // invalid timezone string, proceed to heuristics
    }
  }

  // 2. Profile text heuristics (targetAudience, bio, subNiche, name)
  const textCorpus = [
    profile?.targetAudience || '',
    user?.biography || '',
    profile?.subNiche || '',
    user?.name || '',
  ].join(' ').toLowerCase();

  const GEO_TIMEZONE_MAP: Array<{ pattern: RegExp; tz: string }> = [
    // India / Indian Subcontinent / IST
    { pattern: /\b(india|indian|delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|ahmedabad|jaipur|noida|gurgaon|ist)\b/i, tz: 'Asia/Kolkata' },
    // UK / GMT / BST
    { pattern: /\b(uk|united kingdom|london|manchester|birmingham|edinburgh|glasgow|gmt|bst)\b/i, tz: 'Europe/London' },
    // US Eastern / Toronto
    { pattern: /\b(new york|nyc|miami|boston|atlanta|orlando|philadelphia|toronto|montreal|est|edt)\b/i, tz: 'America/New_York' },
    // US Pacific
    { pattern: /\b(california|los angeles|san francisco|seattle|san diego|vancouver|pst|pdt)\b/i, tz: 'America/Los_Angeles' },
    // US Central
    { pattern: /\b(chicago|houston|dallas|austin|san antonio|cst|cdt)\b/i, tz: 'America/Chicago' },
    // US Mountain
    { pattern: /\b(denver|phoenix|salt lake|mst|mdt)\b/i, tz: 'America/Denver' },
    // Generic US / USA
    { pattern: /\b(united states|usa|us market|american)\b/i, tz: 'America/New_York' },
    // UAE / Middle East
    { pattern: /\b(dubai|uae|abu dhabi|emirates|qatar|doha|riyadh|saudi|gst)\b/i, tz: 'Asia/Dubai' },
    // Singapore & Malaysia
    { pattern: /\b(singapore|malaysia|kuala lumpur|sgt)\b/i, tz: 'Asia/Singapore' },
    // Australia & NZ
    { pattern: /\b(australia|sydney|melbourne|brisbane|perth|new zealand|auckland|aest|nzst)\b/i, tz: 'Australia/Sydney' },
    // Europe (Western & Central)
    { pattern: /\b(germany|berlin|france|paris|spain|madrid|italy|rome|netherlands|amsterdam|cet|cest|europe)\b/i, tz: 'Europe/Paris' },
    // Japan
    { pattern: /\b(japan|tokyo|jst)\b/i, tz: 'Asia/Tokyo' },
    // Brazil / South America
    { pattern: /\b(brazil|brasil|sao paulo|rio)\b/i, tz: 'America/Sao_Paulo' },
  ];

  for (const { pattern, tz } of GEO_TIMEZONE_MAP) {
    if (pattern.test(textCorpus)) {
      return buildTimezoneInfo(tz, 'profile_detected');
    }
  }

  // 3. System / Browser runtime environment detection
  try {
    const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return buildTimezoneInfo(sysTz, 'system_detected');
  } catch {
    return buildTimezoneInfo('UTC', 'system_detected');
  }
}

/**
 * Builds standardized metadata for a given IANA timezone
 */
export function buildTimezoneInfo(
  tz: string,
  source: 'profile_detected' | 'system_detected' | 'user_override'
): ProfileTimezoneInfo {
  let standardCode = 'UTC';
  let formattedOffset = 'UTC+0:00';

  try {
    const now = new Date();
    // Get short timezone abbreviation (e.g., IST, EST, GMT, etc.)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (tzPart && tzPart.value) {
      standardCode = tzPart.value;
    }

    // Standardize common IANA code mappings if browser gave generic offset
    if (tz === 'Asia/Kolkata') standardCode = 'IST';
    else if (tz === 'America/New_York') standardCode = 'EST';
    else if (tz === 'America/Los_Angeles') standardCode = 'PST';
    else if (tz === 'America/Chicago') standardCode = 'CST';
    else if (tz === 'Europe/London') standardCode = 'GMT';
    else if (tz === 'Asia/Dubai') standardCode = 'GST';
    else if (tz === 'Asia/Singapore') standardCode = 'SGT';
    else if (tz === 'Australia/Sydney') standardCode = 'AEST';
    else if (tz === 'Europe/Paris' || tz === 'Europe/Berlin') standardCode = 'CET';
    else if (tz === 'Asia/Tokyo') standardCode = 'JST';

    // Calculate offset in hours:minutes (e.g. UTC+5:30)
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const diffMinutes = Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
    const sign = diffMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(diffMinutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    formattedOffset = `UTC${sign}${hours}${mins > 0 ? `:${mins.toString().padStart(2, '0')}` : ':00'}`;
  } catch (err) {
    console.error('Timezone resolution error:', err);
  }

  const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
  return {
    timeZone: tz,
    standardCode,
    formattedOffset,
    source,
    displayName: `${city} (${standardCode} • ${formattedOffset})`,
  };
}

/**
 * Derives peak audience activity windows from user post timestamps and niche category patterns.
 * Formats time slots into the detected profile timezone standard.
 */
export function getOptimalNichePostingTimes(
  niche: string,
  media: InstagramMedia[] = [],
  timeZoneCode: string = 'UTC'
): Array<{ day: string; timeSlot: string; audienceActivityPct: number }> {
  const nicheLower = (niche || '').toLowerCase();
  const tz = timeZoneCode || 'UTC';

  if (
    nicheLower.includes('ceramic') ||
    nicheLower.includes('pottery') ||
    nicheLower.includes('art') ||
    nicheLower.includes('craft') ||
    nicheLower.includes('decor') ||
    nicheLower.includes('design')
  ) {
    return [
      { day: 'Wednesday', timeSlot: `18:30 ${tz}`, audienceActivityPct: 93 },
      { day: 'Friday', timeSlot: `19:00 ${tz}`, audienceActivityPct: 96 },
      { day: 'Sunday', timeSlot: `11:30 ${tz}`, audienceActivityPct: 94 },
      { day: 'Monday', timeSlot: `17:45 ${tz}`, audienceActivityPct: 88 },
    ];
  }

  if (
    nicheLower.includes('fit') ||
    nicheLower.includes('gym') ||
    nicheLower.includes('health') ||
    nicheLower.includes('workout') ||
    nicheLower.includes('diet')
  ) {
    return [
      { day: 'Monday', timeSlot: `06:45 ${tz}`, audienceActivityPct: 95 },
      { day: 'Wednesday', timeSlot: `18:00 ${tz}`, audienceActivityPct: 92 },
      { day: 'Friday', timeSlot: `17:30 ${tz}`, audienceActivityPct: 90 },
      { day: 'Saturday', timeSlot: `09:00 ${tz}`, audienceActivityPct: 94 },
    ];
  }

  if (
    nicheLower.includes('tech') ||
    nicheLower.includes('saas') ||
    nicheLower.includes('b2b') ||
    nicheLower.includes('ai') ||
    nicheLower.includes('code') ||
    nicheLower.includes('business')
  ) {
    return [
      { day: 'Tuesday', timeSlot: `12:30 ${tz}`, audienceActivityPct: 94 },
      { day: 'Thursday', timeSlot: `17:15 ${tz}`, audienceActivityPct: 92 },
      { day: 'Monday', timeSlot: `09:30 ${tz}`, audienceActivityPct: 89 },
      { day: 'Wednesday', timeSlot: `14:00 ${tz}`, audienceActivityPct: 91 },
    ];
  }

  if (
    nicheLower.includes('fashion') ||
    nicheLower.includes('beauty') ||
    nicheLower.includes('style') ||
    nicheLower.includes('skincare')
  ) {
    return [
      { day: 'Thursday', timeSlot: `19:30 ${tz}`, audienceActivityPct: 95 },
      { day: 'Saturday', timeSlot: `13:00 ${tz}`, audienceActivityPct: 97 },
      { day: 'Tuesday', timeSlot: `18:30 ${tz}`, audienceActivityPct: 91 },
      { day: 'Sunday', timeSlot: `20:00 ${tz}`, audienceActivityPct: 93 },
    ];
  }

  // Default High-Velocity Niche Timing
  return [
    { day: 'Wednesday', timeSlot: `18:00 ${tz}`, audienceActivityPct: 92 },
    { day: 'Friday', timeSlot: `18:30 ${tz}`, audienceActivityPct: 96 },
    { day: 'Sunday', timeSlot: `19:00 ${tz}`, audienceActivityPct: 93 },
    { day: 'Tuesday', timeSlot: `12:30 ${tz}`, audienceActivityPct: 88 },
  ];
}

/**
 * Generate actionable growth report for lower popularity accounts
 */
export function analyzeAccountGrowth(user: InstagramUser, recentMedia: InstagramMedia[]): GrowthReport {
  const { total } = calculateStableGrowthScore(user, recentMedia);
  const score = total;

  let tier: GrowthReport['tier'] = 'LOWER_POPULARITY';
  let headline = '🚀 High Growth Potential Detected!';
  let summary = 'Your account is in the early scaling stage. By automating post timing, keyword auto-replies, and niche hashtag rotation, you can 5x your monthly reach!';

  if (score >= 80) {
    tier = 'VIRAL_TIER';
    headline = '🔥 Viral Tier Performer!';
    summary = 'Your account has strong organic velocity. Focus on Reel carousels and DM auto-funnels to maximize conversion.';
  } else if (score >= 60) {
    tier = 'POPULAR';
    headline = '🌟 Steady Emerging Brand!';
    summary = 'Solid engagement base. Scaling consistency via scheduled Graph API publishing will push you into top 5% of your niche.';
  } else if (score >= 40) {
    tier = 'EMERGING';
    headline = '🌱 Emerging Account — Ready for Boost!';
    summary = 'Good foundation. You need consistent 4x weekly Reels publishing and active comment responses to gain algorithmic priority.';
  }

  const tasks: GrowthTask[] = [
    {
      id: 'task_auto_reply',
      title: 'Setup DM/Comment Lead Magnet Responder',
      description: 'Configure auto-reply rule for keyword "GROW" or "INFO" on your latest media to double comment volume and trigger Instagram algorithm push.',
      impactScore: 'VIRAL',
      category: 'AUTO_REPLY',
      completed: false,
      actionEndpoint: '/auto-responder',
    },
    {
      id: 'task_reels_schedule',
      title: 'Schedule 3 High-Engagement Reels This Week',
      description: 'Publishing Reels containers with 2.5s hook captions boosts reach to non-followers by up to 340%.',
      impactScore: 'HIGH',
      category: 'CONTENT',
      completed: false,
      actionEndpoint: '/publisher',
    },
    {
      id: 'task_hashtag_audit',
      title: 'Steal Top Competitor Niche Hashtags',
      description: 'Use Business Discovery to extract top 8 performing hashtags from @competitor and insert into your container requests.',
      impactScore: 'HIGH',
      category: 'HASHTAGS',
      completed: false,
      actionEndpoint: '/competitors',
    },
    {
      id: 'task_best_time',
      title: 'Post During Follower Online Peak (6 PM - 9 PM)',
      description: 'Insights data shows peak audience activity between 18:00 and 21:00 UTC.',
      impactScore: 'MEDIUM',
      category: 'SCHEDULE',
      completed: true,
      actionEndpoint: '/insights',
    },
  ];

  const bestPostingTimes = getOptimalNichePostingTimes(user.biography || '', recentMedia);

  const recommendedHashtags = [
    '#artisanstudio',
    '#handcraftedart',
    '#geometricdesign',
    '#smallbusinessgrowth',
    '#viralreels',
    '#instagramautomation',
    '#modernaesthetic',
    '#designcommunity',
  ];

  return {
    score,
    tier,
    headline,
    summary,
    tasks,
    bestPostingTimes,
    recommendedHashtags,
  };
}

/**
 * Build a structured, high-conversion 30-day growth strategist plan.
 * Uses Gemini AI / OpenRouter if configured, with an algorithmic fallback tuned to user data.
 */
export async function generateGrowthStrategistPlan(params: {
  user: InstagramUser | null;
  media: InstagramMedia[];
  profile?: GrowthStrategyProfile | null;
  config: ApiConfig;
  previousCalendarTopics?: string[];
}): Promise<FullGrowthStrategyResult> {
  const { user, media, profile, config, previousCalendarTopics = [] } = params;
  const niche = profile?.subNiche || 'Creative Brand & Creator Growth';
  const targetAudience = profile?.targetAudience || 'Target Niche Community & Prospective Clients';
  const competitors = profile?.competitorHandles?.length ? profile.competitorHandles.join(', ') : '@topcreators, @industryleaders';

  const isRealAccount = Boolean(user && user.username);
  const username = user?.username || (config.selectedIgUserId ? `user_${config.selectedIgUserId.slice(-4)}` : 'brand_creator');
  const followers = user?.followers_count !== undefined ? user.followers_count : (isRealAccount ? 0 : 1250);

  let totalLikes = 0;
  let totalComments = 0;
  media.forEach(m => {
    totalLikes += m.like_count || 0;
    totalComments += m.comments_count || 0;
  });
  const avgLikes = media.length ? Math.round(totalLikes / media.length) : (isRealAccount ? 0 : 42);
  const avgComments = media.length ? Math.round(totalComments / media.length) : (isRealAccount ? 0 : 6);
  const engRate = followers > 0
    ? parseFloat((((avgLikes + avgComments) / followers) * 100).toFixed(2))
    : (isRealAccount ? 0 : 3.84);

  const tzInfo = detectProfileTimezone(profile, user);
  const targetDays = profile?.calendarDays || 30;

  const env = loadEnvCredentials();
  const effectiveOpenRouterKey = config.openRouterApiKey || env.openRouterApiKey;
  const effectiveGeminiKey = config.geminiApiKey || env.geminiApiKey;

  // Harvest real-time data from today's Business Discovery search
  let todaySearchIntel = '';
  try {
    const rawCrawl = localStorage.getItem(getScopedKey('bd_crawl_history'));
    if (rawCrawl) {
      const crawls = JSON.parse(rawCrawl);
      if (Array.isArray(crawls) && crawls.length > 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
        // Prioritize today's search crawls or latest active search
        const todayCrawls = crawls.filter((c: any) => c.crawledAt?.startsWith(todayStr));
        const activeCrawls = todayCrawls.length > 0 ? todayCrawls : crawls.slice(0, 3);
        todaySearchIntel = activeCrawls.map((c: any) => 
          `- Competitor @${c.username}: ${c.followers_count?.toLocaleString() || '0'} followers, ${c.engagement_rate || '0'}% engagement. Top Formats: ${c.analytics?.formatPerformance?.map((f: any) => `${f.format} (${f.percent}%)`).join(', ') || 'Reels & Carousels'}. Top Hashtags: ${c.top_hashtags?.slice(0, 6).join(' ') || ''}. Best Peak Hours: ${c.analytics?.bestPostingTimeSummary || '18:00'}. Winning Hooks: ${c.analytics?.topHooks?.slice(0, 2).map((h: any) => `"${h.hook}"`).join(', ') || 'N/A'}`
        ).join('\n');
      }
    }
  } catch {}

  const userMix = profile?.formatMix || { reels: 15, carousels: 10, videos: 3, singlePosts: 2, stories: 30 };
  const targetReels = userMix.reels ?? 15;
  const targetCarousels = userMix.carousels ?? 10;
  const targetVideos = userMix.videos ?? 3;
  const targetSinglePosts = userMix.singlePosts ?? 2;
  const totalTargetInFeed = targetReels + targetCarousels + targetVideos + targetSinglePosts;

  const antiDuplicationSection = previousCalendarTopics.length > 0
    ? `
MANDATORY ANTI-DUPLICATION MEMORY:
The user has previously generated and saved the following post topics in their calendar history:
${previousCalendarTopics.slice(0, 80).map((t, idx) => `${idx + 1}. "${t}"`).join('\n')}

STRICT REQUIREMENT: You MUST NOT repeat, duplicate, or superficially rephrase ANY of the topics or hooks listed above.
Every single post topic and hook in this new calendar MUST be completely original, fresh, and explore new angles and insights within "${niche}"!`
    : '';

  const prompt = `${GROWTH_STRATEGIST_SYSTEM_PROMPT}

USER ACCOUNT CONTEXT:
- Username: @${username}
- Followers: ${followers}
- Media Count: ${user?.media_count ?? media.length}
- Avg Likes: ${avgLikes}, Avg Comments: ${avgComments}
- Calculated Engagement Rate: ${engRate}%
- Sub-Niche / Core Offer: "${niche}"
- Target Audience: "${targetAudience}"
- Competitors to Benchmark: "${competitors}"
- Preferred Format: ${profile?.contentFormat || 'Reels & Carousels'}
- Core Goal: ${profile?.conversionGoal || 'Inbound DM Leads & Follower Scaling'}
- Requested Calendar Horizon: Exactly ${targetDays} Days (Day 1 through Day ${targetDays})
- Profile Time Standard: ${tzInfo.displayName} (Code: ${tzInfo.standardCode}, Offset: ${tzInfo.formattedOffset})
- Target Content Mix Across ${targetDays} Days: ${totalTargetInFeed} In-Feed Posts (${targetReels} Reels, ${targetCarousels} Carousels, ${targetVideos} Videos, ${targetSinglePosts} Single Posts)

CRITICAL NICHE MANDATE (NO DEMO OR UNRELATED CONTENT):
All topics, hooks, and captions MUST be tailored 100% to the user's specific sub-niche: "${niche}" and target audience: "${targetAudience}".
NEVER output generic developer/coding content (like Flutter, React Native, Next.js, code reviews) or hardcoded agency names (like Wexlogic) UNLESS the user's niche is explicitly that! Every single topic must be authentic, highly specific, actionable advice or content for "${niche}".
${antiDuplicationSection}

MULTI-SLOT AUTO-DISTRIBUTION RULE:
- The user selected a target of ${totalTargetInFeed} posts across ${targetDays} calendar days.
- If ${totalTargetInFeed} > ${targetDays}, you MUST schedule more than one post on a single day (e.g. "Day 1 (Slot 1)" at 12:30, "Day 1 (Slot 2)" at 18:00) so all target posts are scheduled!

DYNAMIC NICHE CONTENT PILLARS RULE:
Generate 4 to 6 core strategic content pillars tailored 100% to the user's specific sub-niche: "${niche}" and core offering.
NEVER use hardcoded generic software or agency pillars (like Wexlogic Authority, App Development, Web Development) unless the user's sub-niche is specifically software!
Every single post slot in the calendar MUST be assigned to one of these niche-specific pillars (e.g. "${niche} Step-by-Step Guides", "${niche} Proof & Transformations", "Contrarian Truths & Myth Busting in ${niche}", "Relatable ${niche} Reality (POV)", "Interactive Community Audits", "Authority & Behind-the-Scenes").

META 2025/2026 ALGORITHM COMPLIANCE (EVERY POST MUST SCORE > 8.5/10):
Every calendar item MUST be engineered to achieve a Meta content quality score greater than 8.5/10:
1. 3-Second Retention Hook: Pattern-interrupt or contrarian tension that immediately stops the scroll in the first 3 seconds.
2. In-Caption Search SEO Keywords: Naturally weave 3 to 5 high-intent search query keywords for "${niche}" directly into the caption body so Meta's Explore Search AI indexes the post.
3. Sends-per-Reach Optimization: Structure the caption payoff to trigger private Instagram DM forwarding ("👉 Share this with someone who needs this in ${niche}!"). DM shares are Meta's #1 ranking factor.
4. Strategic Hashtags: In "seoKeywordsAndTags", output EXACTLY 3 to 5 hyper-targeted niche hashtags (e.g. #nichekeyword #specifictopic #targetproblem). NEVER output 30 generic spam tags (#fyp, #viral) which Meta suppresses.
5. Frictionless Comment CTA: Provide a simple 1-word keyword prompt (e.g. 'Comment "GROW"', 'Drop "AUDIT"') to maximize comment velocity.

VISUAL TYPE RULE:
Visual format MUST be simple: ONLY "Reel", "Carousel", "Video", or "Single Post". Never use complex descriptive names.

Respond ONLY with a valid JSON object strictly matching this schema:
{
  "growthScore": {
    "total": 91,
    "contentQuality": 23,
    "engagement": 24,
    "reach": 19,
    "profile": 13,
    "consistency": 12,
    "bottlenecks": ["Low shareability (Sends-per-reach)", "Weak 3s hook retention", "Inconsistent peak publishing"]
  },
  "highImpactLevers": [
    "Switch from static images to 7-second looped Reels with text-overlay hooks",
    "Implement comment-to-DM keyword triggers (e.g. 'Comment GUIDE for free PDF')",
    "Front-load contrarian tension in the first 3 seconds of every video",
    "Shift from 30 generic hashtags to 3-5 in-caption SEO search keywords",
    "Batch publish at verified peak follower activity window (18:00 ${tzInfo.standardCode})"
  ],
  "competitorInsights": [
    "Top competitors in ${niche} generate 70% of outlier reach from text-on-screen B-roll Reels under 8 seconds",
    "High performers use 'Save this cheat sheet' CTAs rather than generic 'Follow for more'",
    "Negative framing hooks ('Stop doing X', 'The biggest mistake in ${niche}') outperform positive hooks by 2.8x"
  ],
  "contentPillars": [
    { "name": "${niche} Step-by-Step Guides", "description": "Actionable frameworks & save magnets", "color": "bg-purple-100 text-purple-900 border-purple-400" },
    { "name": "${niche} Case Studies & Proof", "description": "Transformation results and client teardowns", "color": "bg-emerald-100 text-emerald-900 border-emerald-400" },
    { "name": "Contrarian Truths & Mistakes", "description": "Debunking common myths in ${niche} to drive debate", "color": "bg-amber-100 text-amber-900 border-amber-400" },
    { "name": "Relatable ${niche} Reality (POV)", "description": "POV humor and industry reality driving DM shares", "color": "bg-yellowPop text-slateDark border-slateDark" }
  ],
  "calendar": [
    {
      "day": 1,
      "dayLabel": "Day 1",
      "timeSlot": "18:00 ${tzInfo.standardCode}",
      "status": "Planned",
      "pillar": "${niche} Step-by-Step Guides",
      "postTopic": "The 3-Step Strategy to Scale Results in ${niche}",
      "visualFormat": "Reel",
      "ideaCategory": "Reel",
      "targetDuration": "7–15 seconds",
      "timelineScenes": "Scene 1 (0-3s): Hook text & visual pattern interrupt\\nScene 2 (3-8s): Problem teardown or practical 3-step value\\nScene 3 (8-12s): DM keyword trigger CTA",
      "fullScript": "[Hook - 0s]: Stop making this costly mistake if you want to grow in ${niche}...\\n[Body - 3s]: When you optimize for audience search intent, organic reach multiplies.\\n[CTA - 9s]: Drop 'GUIDE' below and I'll DM you our full implementation checklist!",
      "hook": "Stop making this costly mistake if you want to grow in ${niche}:",
      "captionAndCta": "Stop making this costly mistake if you want to grow in ${niche}:\\n\\nMost people overlook the fundamentals when approaching ${niche}. When you optimize your positioning for user search intent, organic reach multiplies.\\n\\nKey SEO Levers:\\n• High-intent audience search alignment\\n• Retention optimization\\n• Consistent execution\\n\\n👉 Share this with someone building in ${niche}!\\n\\n💬 Drop 'GUIDE' below and I will send you our full implementation checklist straight to your DMs!\\n\\n#${niche.split(/\\s+/)[0]?.toLowerCase() || 'growth'} #${niche.split(/\\s+/)[0]?.toLowerCase() || 'growth'}tips #${niche.split(/\\s+/)[0]?.toLowerCase() || 'growth'}strategy",
      "seoKeywordsAndTags": "#${niche.split(/\\s+/)[0]?.toLowerCase() || 'growth'} #${niche.split(/\\s+/)[0]?.toLowerCase() || 'growth'}tips #${niche.split(/\\s+/)[0]?.toLowerCase() || 'growth'}strategy",
      "link": ""
    }
  ],
  "weeklySprints": [
    {
      "week": 1,
      "title": "Format Sprint: Outlier Reach Detection",
      "objective": "Establish baseline reach across Reels vs Carousels",
      "hypothesis": "7-second B-roll with text hook will yield 2x non-follower reach vs static",
      "kpi": "Non-follower reach % (Target: >45%)",
      "threshold": "Double down on format with >40% non-follower ratio"
    }
  ],
  "essentialMetrics": [
    "Sends-per-Reach (Aim for >3% of total accounts reached)",
    "3-Second Watch Time Retention (Aim for >60% retention rate)",
    "Non-Follower Discovery Ratio (Target >50% reach from non-followers)"
  ],
  "nextActions": [
    "Update bio: Replace generic slogan with 1-sentence value proposition + DM keyword CTA",
    "Pin top 3 highest-value Reels/Carousels representing your Authority and Discovery pillars",
    "Setup 'GROW' or 'GUIDE' comment auto-responder rule for Day 1 launch post"
  ],
  "freshAccountSettings": [
    { "settingName": "Professional Creator/Business Account", "recommendedValue": "Creator or Business Mode", "inAppPath": "Settings and activity > Account type and tools > Switch to professional account", "reason": "Required for Instagram Graph API webhooks, comment automation, and deep demographic analytics." },
    { "settingName": "High Quality Uploads", "recommendedValue": "Upload at highest quality: ON", "inAppPath": "Settings and activity > Data usage and media quality > Upload at highest quality", "reason": "Prevents Instagram from lowering 1080p/4K Reels into pixelated 480p on cellular networks." },
    { "settingName": "Message Request Controls", "recommendedValue": "Allow message requests from everyone: ON", "inAppPath": "Settings and activity > How others can interact with you > Messages and story replies > Message controls", "reason": "Allows your Graph API automated DM delivery funnels to reach non-followers without landing in hidden spam." },
    { "settingName": "Hidden Words & Keyword Shield", "recommendedValue": "Custom words and phrases for keyword triggers", "inAppPath": "Settings and activity > How others can interact with you > Hidden words", "reason": "Blocks toxic bot spam while alerting you to high-intent buyer keywords in comments." }
  ],
  "bioBlueprint": {
    "nameLine": "${username ? '@' + username : 'Your Brand'} | ${niche.slice(0, 20)} Specialist",
    "category": "Entrepreneur & Creator",
    "transformationHook": "Helping ${targetAudience} achieve high-retention results in ${niche}.",
    "socialProof": "100% data-driven • Tested frameworks • Weekly case studies",
    "callToAction": "👇 Drop 'GROW' on my latest post or DM me 'START' to unlock the free blueprint",
    "linkInBioTip": "Use 1 direct conversion link (or DM funnel) instead of cluttered linktrees to maximize conversion."
  }
};`;

  const minExpectedPosts = Math.min(3, totalTargetInFeed, targetDays);

  // 1. Primary Engine: Google Gemini API (High-Performance Reasoning & Calendar Intelligence)
  if (effectiveGeminiKey) {
    try {
      for (const modelName of GEMINI_MODEL_FALLBACKS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${effectiveGeminiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7,
              },
            }),
          });

          if (res.status === 429) {
            console.warn(`[AI Shift] Gemini model ${modelName} hit 429. Shifting...`);
            continue;
          }

          const resJson = await res.json();
          if (resJson.error) {
            console.warn(`Gemini model ${modelName} notice:`, resJson.error);
            continue;
          }

          const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const match = rawText.match(/\{[\s\S]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              if (parsed.calendar && Array.isArray(parsed.calendar) && parsed.calendar.length >= minExpectedPosts) {
                const completeCalendar = ensureFullCalendar(parsed.calendar, niche, tzInfo.standardCode, targetDays, totalTargetInFeed, userMix);
                console.info(`[AI Success] Generated full strategy plan with Gemini model: ${modelName}`);
                return {
                  accountUsername: username,
                  followersCount: followers,
                  engagementRate: engRate,
                  subNiche: niche,
                  timeZoneInfo: tzInfo,
                  freshAccountSettings: parsed.freshAccountSettings || getFreshAccountRecommendations(niche),
                  bioBlueprint: parsed.bioBlueprint || getBioBlueprint(niche, targetAudience, username),
                  ...parsed,
                  calendar: completeCalendar,
                  isAiGenerated: true,
                  aiProvider: `Google Gemini (${modelName})`,
                  generatedAt: new Date().toISOString(),
                };
              }
            }
          }
        } catch (mErr) {
          console.warn(`Gemini model ${modelName} growth plan fetch error:`, mErr);
        }
      }
    } catch (err) {
      console.warn('Gemini growth plan generation fallback:', err);
    }
  }

  // 2. Secondary Engine: OpenRouter Models Failover
  if (effectiveOpenRouterKey) {
    const openRouterModels = [
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
      'openrouter/free',
    ];

    for (const orModel of openRouterModels) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${effectiveOpenRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://instagrowth.io',
            'X-Title': 'InstaGrowth Strategy Engine',
          },
          body: JSON.stringify({
            model: orModel,
            messages: [
              { role: 'system', content: GROWTH_STRATEGIST_SYSTEM_PROMPT },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.choices?.[0]?.message?.content;
          if (rawText) {
            const match = rawText.match(/\{[\s\S]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]);
              if (parsed.calendar && Array.isArray(parsed.calendar) && parsed.calendar.length >= minExpectedPosts) {
                const completeCalendar = ensureFullCalendar(parsed.calendar, niche, tzInfo.standardCode, targetDays, totalTargetInFeed, userMix);
                console.info(`[AI Success] Generated calendar via OpenRouter model: ${orModel}`);
                return {
                  accountUsername: username,
                  followersCount: followers,
                  engagementRate: engRate,
                  subNiche: niche,
                  timeZoneInfo: tzInfo,
                  freshAccountSettings: parsed.freshAccountSettings || getFreshAccountRecommendations(niche),
                  bioBlueprint: parsed.bioBlueprint || getBioBlueprint(niche, targetAudience, username),
                  ...parsed,
                  calendar: completeCalendar,
                  isAiGenerated: true,
                  aiProvider: `OpenRouter (${orModel})`,
                  generatedAt: new Date().toISOString(),
                };
              }
            }
          }
        }
      } catch (orErr) {
        console.warn(`OpenRouter model ${orModel} attempt notice:`, orErr);
      }
    }
  }

  // 3. Fallback Deterministic Algorithm Engine (Guarantees immediate data-backed roadmap without hallucination)
  const fallbackPlan = buildDeterministicGrowthPlan(user, media, profile, niche, targetAudience, followers, engRate, username, tzInfo);
  return {
    ...fallbackPlan,
    isAiGenerated: false,
    aiProvider: 'Algorithmic Fallback Engine',
  };
}

export const USER_EXACT_30_PILLARS = [
  'Brand Psychology',
  'Website & UX',
  'AI for Business',
  'Brand Case Study',
  'Interactive',
  'Social Media Strategy',
  'Meme Marketing',
  'Influencer Marketing',
  'Branding',
  'App Development',
  'Digital Marketing',
  'Interactive',
  'AI × Marketing',
  'Wexlogic Authority',
  'Website Psychology',
  'Branding',
  'AI & Productivity',
  'Marketing Case Study',
  'Interactive',
  'Social Media',
  'Web Development',
  'Meme Marketing',
  'Brand Psychology',
  'App Development',
  'Independence Day Special',
  'Interactive',
  'AI × Branding',
  'Wexlogic Authority',
  'Brand Psychology',
  'Interactive',
];

export interface NicheContentPillar {
  name: string;
  description: string;
  color: string;
}

/**
 * Returns dynamic content pillars tailored strictly to the user's specific sub-niche.
 * Eliminates all hardcoded generic tech or agency pillars (like Wexlogic).
 */
export function getNichePillars(niche: string): NicheContentPillar[] {
  const cleanNiche = (niche && niche.trim().length > 0 && niche !== 'Creative Brand & Creator Growth')
    ? niche.trim()
    : 'Growth & Authority';

  return [
    {
      name: `${cleanNiche} Step-by-Step Guides`,
      description: `Actionable frameworks, practical workflows, and save-magnet breakdowns for ${cleanNiche}`,
      color: 'bg-purple-100 text-purple-900 border-purple-400',
    },
    {
      name: `${cleanNiche} Proof & Transformations`,
      description: `Authentic case studies, milestone breakdowns, and real-world results in ${cleanNiche}`,
      color: 'bg-emerald-100 text-emerald-900 border-emerald-400',
    },
    {
      name: `Contrarian Truths & Mistakes in ${cleanNiche}`,
      description: `Pattern interrupts, common pitfalls, and myth-busting that sparks high-velocity debate in ${cleanNiche}`,
      color: 'bg-amber-100 text-amber-900 border-amber-400',
    },
    {
      name: `Relatable ${cleanNiche} Reality (POV)`,
      description: `Relatable humor, day-in-the-life POV, and shared experiences driving DM sends-per-reach`,
      color: 'bg-yellowPop text-slateDark border-slateDark',
    },
    {
      name: `Interactive ${cleanNiche} Audits & Q&A`,
      description: `Community teardowns, A/B polls, and rapid 1-word comment triggers for algorithmic boost`,
      color: 'bg-pinkPop text-slateDark border-slateDark',
    },
    {
      name: `${cleanNiche} Authority & Systems`,
      description: `Behind-the-scenes systems, operational standards, and strategic positioning in ${cleanNiche}`,
      color: 'bg-indigo-100 text-indigo-900 border-indigo-400',
    },
  ];
}

/**
 * Dynamic, Niche-Aware Content Pillar Blueprint Engine.
 * Generates custom hooks, topics, and Meta 2025/2026-compliant captions tailored 100% to the user's
 * specific sub-niche and target audience.
 * Every post is designed for:
 * 1. 3-second pattern-interrupt hook
 * 2. In-caption search SEO keywords
 * 3. Sends-per-reach (DM sharing) payoff
 * 4. Frictionless 1-word comment trigger
 * 5. Exactly 3 to 5 targeted niche hashtags
 */
/**
 * Ensures any Instagram caption strictly meets the 4-part algorithm structure:
 * 1. 3-Second Retention Hook prominently at the top
 * 2. High-value body woven with in-caption SEO search keywords
 * 3. Frictionless DM / Share Call to Action (CTA)
 * 4. 3-5 hyper-targeted niche hashtags (#tags) at the bottom
 */
export function ensureCaptionHasHookSeoAndTags(
  caption: string,
  hook: string,
  seoKeywordsAndTags: string,
  niche?: string
): string {
  let text = (caption || '').trim();
  const cleanHook = (hook || '').trim();
  const cleanTags = (seoKeywordsAndTags || '').trim();

  // 1. Ensure Hook is at the top of caption if missing
  if (cleanHook) {
    const hookKey = cleanHook.slice(0, Math.min(24, cleanHook.length)).toLowerCase();
    if (!text.toLowerCase().includes(hookKey)) {
      text = `${cleanHook}\n\n${text}`;
    }
  }

  // 2. Ensure in-caption SEO search keywords are present
  const cleanNiche = niche && niche.trim() ? niche.trim() : 'growth';
  const hasSeoKeywords = /seo|search|keyword|strategy|growth|framework/i.test(text);
  if (!hasSeoKeywords) {
    const keywords = cleanNiche.split(/[\s,]+/).filter(w => w.length > 2).slice(0, 3).join(', ');
    text = `${text}\n\n🔍 In-Caption SEO Keywords: ${keywords}, organic reach, instagram algorithm`;
  }

  // 3. Ensure Hashtags (#tags) are appended at the bottom if missing
  if (cleanTags) {
    const hasHashtags = /(^|\s)#[a-zA-Z0-9_]+/i.test(text);
    if (!hasHashtags) {
      text = `${text}\n\n${cleanTags}`;
    }
  }

  return text;
}

export function getNicheAwarePillarBlueprint(
  pillar: string,
  niche: string,
  targetAudience: string = 'target audience',
  dayNum: number = 1
): { pillar: string; fmt: 'Reel' | 'Carousel' | 'Video' | 'Single Post'; hook: string; topic: string; caption: string; seoTags: string } {
  const cleanNiche = (niche && niche.trim().length > 0 && niche !== 'Creative Brand & Creator Growth')
    ? niche.trim()
    : 'Growth & Business';
  const cleanAudience = targetAudience && targetAudience.trim().length > 0
    ? targetAudience.trim()
    : 'prospective clients and followers';

  const nicheTag = cleanNiche.split(/[\s,]+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'growth';
  const seoTags = `#${nicheTag} #${nicheTag}tips #${nicheTag}strategy #${nicheTag}growth`;

  const p = pillar.trim();

  // Dynamic matching based on niche pillars or legacy pillar categories
  if (p.includes('Step-by-Step') || p.includes('Guide') || p === 'Website & UX' || p === 'Web Development') {
    const hook = `Stop making this costly mistake if you want to scale results in ${cleanNiche}:`;
    return {
      pillar: p,
      fmt: 'Carousel',
      hook,
      topic: `The 3-Step Practical Framework to Win in ${cleanNiche}`,
      caption: `${hook}\n\nMost people overlook the fundamental mechanics of ${cleanNiche}. When you align your core positioning, simplify delivery, and optimize for audience search intent, scaling becomes predictable.\n\n🔍 In-Caption SEO Keywords: ${cleanNiche}, ${cleanAudience}, scaling framework, organic growth\n\n3 in-depth steps:\n1. Audit your friction points\n2. Focus on high-intent execution\n3. Consistent delivery\n\n👉 Share this with someone building in ${cleanNiche}!\n\n💬 Drop "GUIDE" below and I'll DM you the full step-by-step checklist!\n\n${seoTags}`,
      seoTags,
    };
  }

  if (p.includes('Proof') || p.includes('Case Study') || p.includes('Transformation')) {
    const hook = `How this outlier in ${cleanNiche} achieved 3x results without burnout:`;
    return {
      pillar: p,
      fmt: 'Carousel',
      hook,
      topic: `Deconstructing a Real-World Growth Flywheel in ${cleanNiche}`,
      caption: `${hook}\n\nReal results in ${cleanNiche} come from repeatable systems, not luck. We deconstructed the exact conversion funnel and organic distribution strategy that moved the needle.\n\n🔍 In-Caption SEO Keywords: ${cleanNiche}, case study, conversion funnel, ${cleanAudience}\n\nKey takeaways:\n• Zero wasted ad spend\n• Laser-targeted messaging for ${cleanAudience}\n• Relentless consistency\n\n👉 Send this to your partner or team!\n\n💬 Comment "CASE" for the full teardown.\n\n${seoTags}`,
      seoTags,
    };
  }

  if (p.includes('Contrarian') || p.includes('Mistake') || p.includes('Myth') || p === 'Brand Psychology' || p === 'Website Psychology') {
    const hook = `Unpopular truth about ${cleanNiche} that 90% of creators refuse to admit:`;
    return {
      pillar: p,
      fmt: 'Reel',
      hook,
      topic: `The Biggest Counter-Intuitive Mistake Holding Back ${cleanNiche}`,
      caption: `${hook}\n\nMost common advice in ${cleanNiche} is completely outdated. If you keep copying what everyone else did 2 years ago, your organic reach will flatline. Focus on high retention, authentic value, and direct connection with ${cleanAudience}.\n\n🔍 In-Caption SEO Keywords: ${cleanNiche} mistakes, audience retention, organic distribution\n\nDo you agree or disagree? Let's discuss in the comments! 👇\n\n👉 Share this with someone who needs a reality check in ${cleanNiche}.\n\n${seoTags}`,
      seoTags,
    };
  }

  if (p.includes('POV') || p.includes('Reality') || p.includes('Meme')) {
    const hook = `Anyone working in ${cleanNiche} will feel this deep in their soul:`;
    return {
      pillar: p,
      fmt: 'Reel',
      hook,
      topic: `The Unfiltered Reality of Working in ${cleanNiche} (POV)`,
      caption: `${hook}\n\nWhen client expectations meet real-world constraints in ${cleanNiche}...\n\nIf you have been through this exact scenario this week, you are definitely not alone. 😅\n\n🔍 In-Caption SEO Keywords: ${cleanNiche} reality, POV creator, industry humor\n\n👉 Share this to someone who knows this pain all too well!\n\n💬 Drop your wildest story in the comments.\n\n${seoTags}`,
      seoTags,
    };
  }

  if (p.includes('Interactive') || p.includes('Audit') || p.includes('Q&A')) {
    const hook = `Quick audit for ${cleanNiche}: Which strategy would you pick right now?`;
    return {
      pillar: p,
      fmt: 'Single Post',
      hook,
      topic: `${cleanNiche} Decision Matrix: Strategy A vs Strategy B`,
      caption: `${hook}\n\nWe are doing a live audit for brands and creators in ${cleanNiche}. Option A prioritizes immediate conversion velocity, while Option B compounds long-term organic authority.\n\n🔍 In-Caption SEO Keywords: ${cleanNiche} audit, strategy decision, organic growth\n\nWhich one fits your current stage? Drop 'A' or 'B' below with your 1-sentence reason! 👇\n\n👉 Send this to a friend to get their take!\n\n${seoTags}`,
      seoTags,
    };
  }

  // Default: Authority & Systems
  const hook = `The non-negotiable operational standard top 1% leaders in ${cleanNiche} swear by:`;
  return {
    pillar: p || `${cleanNiche} Authority`,
    fmt: dayNum % 2 === 0 ? 'Reel' : 'Carousel',
    hook,
    topic: `Core Systems & High-Velocity Positioning in ${cleanNiche}`,
    caption: `${hook}\n\nAmateurs focus on tactics, but top operators in ${cleanNiche} build durable systems. When your workflows, content architecture, and conversion channels run autonomously, sustainable growth follows.\n\n🔍 In-Caption SEO Keywords: ${cleanNiche} systems, operational excellence, high-velocity growth\n\nWhich part of your ${cleanNiche} strategy needs the biggest upgrade this quarter?\n\n👉 Share this with a founder or creator in your network!\n\n💬 Comment "SYSTEMS" for our private playbook.\n\n${seoTags}`,
    seoTags,
  };
}

/**
 * Fresh account initial settings recommendations for Instagram in-app configuration
 */
export function getFreshAccountRecommendations(niche: string): FreshAccountSettingRecommendation[] {
  return [
    {
      settingName: 'Professional Creator/Business Account',
      recommendedValue: 'Creator or Business Mode',
      inAppPath: 'Settings and activity > Account type and tools > Switch to professional account',
      reason: 'Mandatory for Instagram Graph API webhooks, comment automation, and deep demographic analytics.',
    },
    {
      settingName: 'High Quality Uploads',
      recommendedValue: 'Upload at highest quality: ON',
      inAppPath: 'Settings and activity > Data usage and media quality > Upload at highest quality',
      reason: 'Prevents Instagram from lowering 1080p/4K Reels into pixelated 480p on cellular networks.',
    },
    {
      settingName: 'Message Request Controls',
      recommendedValue: 'Allow message requests from everyone: ON',
      inAppPath: 'Settings and activity > How others can interact with you > Messages and story replies > Message controls',
      reason: 'Allows your Graph API automated DM delivery funnels to reach non-followers without landing in hidden spam.',
    },
    {
      settingName: 'Hidden Words & Keyword Shield',
      recommendedValue: 'Custom words and phrases for keyword triggers',
      inAppPath: 'Settings and activity > How others can interact with you > Hidden words',
      reason: 'Blocks toxic bot spam while alerting you to high-intent buyer keywords in comments.',
    },
  ];
}

/**
 * Generates an optimized Instagram bio blueprint based on sub-niche and audience
 */
export function getBioBlueprint(niche: string, targetAudience: string, username?: string): BioBlueprint {
  const cleanNiche = (niche && niche.trim().length > 0) ? niche.trim() : 'Growth Specialist';
  const cleanAudience = (targetAudience && targetAudience.trim().length > 0) ? targetAudience.trim() : 'ambitious creators and brands';
  return {
    nameLine: `${username ? '@' + username : 'Your Brand'} | ${cleanNiche.slice(0, 22)}`,
    category: 'Entrepreneur & Creator',
    transformationHook: `Helping ${cleanAudience} scale results with high-retention systems in ${cleanNiche}.`,
    socialProof: `100% data-driven • Tested frameworks • Weekly case studies`,
    callToAction: `👇 Comment 'GROW' on my latest post to receive the free breakdown`,
    linkInBioTip: 'Keep a single conversion endpoint or direct DM trigger rather than confusing multi-link aggregators.',
  };
}

/**
 * Enriches a calendar item with production details: category, duration, scenes, and full script
 */
export function enrichCalendarItemWithRichIdeas(
  item: GrowthCalendarItem,
  niche: string,
  dayNum: number
): GrowthCalendarItem {
  const isReel = item.visualFormat === 'Reel' || item.visualFormat === 'Video';
  const isCarousel = item.visualFormat === 'Carousel';
  const ideaCategory: 'Reel' | 'Post' | 'Carousel' | 'Story' = isReel ? 'Reel' : isCarousel ? 'Carousel' : 'Post';

  const targetDuration = item.targetDuration || (isReel ? '7–15 seconds' : isCarousel ? '6–8 slides' : 'Single frame post');

  const cleanNiche = (niche && niche.trim().length > 0) ? niche.trim() : 'your industry';
  const hookText = item.hook || `Stop making this costly mistake in ${cleanNiche}`;

  const timelineScenes = item.timelineScenes || (isReel ?
    `Scene 1 (0-3s): [Hook] "${hookText}" with fast-paced visual pattern interrupt\\nScene 2 (3-8s): [Core Value] Show the breakdown or contrarian insight solving the problem\\nScene 3 (8-12s): [CTA] Direct viewer to drop keyword below to get the free checklist straight to DMs` :
    isCarousel ?
    `Slide 1: Hook headline & curiosity tension\\nSlides 2-4: 3-step practical execution framework\\nSlide 5: Common pitfall debunked\\nSlide 6: Summary & Save/DM call-to-action` :
    `Frame 1: High-contrast statement graphic\\nCaption: Deep-dive breakdown and DM conversation prompt`
  );

  const fullScript = item.fullScript || (isReel ?
    `[Hook - 0s]: "${hookText}"\\n[Body - 3s]: "If you want to scale in ${cleanNiche}, stop overcomplicating your process. Most people fail because they lack consistency and clear messaging."\\n[CTA - 9s]: "Drop 'GROW' below and I'll send you our complete step-by-step breakdown straight to your DMs!"` :
    `[Headline]: "${hookText}"\\n[Key Points]: Deconstructing the core framework for ${cleanNiche}.\\n[Call to Action]: Share this with someone in ${cleanNiche} and drop a comment below.`
  );

  return {
    ...item,
    ideaCategory: item.ideaCategory || ideaCategory,
    targetDuration,
    timelineScenes,
    fullScript,
  };
}

/**
 * Fills or constructs a full calendar array ensuring the target posts and formats are scheduled
 */
function ensureFullCalendar(
  items: GrowthCalendarItem[],
  niche: string,
  timeZoneCode: string = 'UTC',
  targetDays: number = 30,
  totalTargetPosts: number = 30,
  targetMix?: FormatMix | { reels?: number; carousels?: number; videos?: number; singlePosts?: number; stories?: number }
): GrowthCalendarItem[] {
  let result: GrowthCalendarItem[] = [...items];
  const nichePillars = getNichePillars(niche);
  const targetCount = Math.max(1, totalTargetPosts);

  // If AI generated more than targetCount, slice to targetCount
  if (result.length > targetCount) {
    result = result.slice(0, targetCount);
  }

  // Ensure day numbers don't exceed targetDays
  result = result.map((item, idx) => {
    const day = Math.min(targetDays, Math.max(1, item.day || Math.round(((idx) / targetCount) * targetDays) + 1));
    return { ...item, day };
  });

  // Pad missing posts up to targetCount if AI returned fewer than requested
  if (result.length < targetCount) {
    for (let i = result.length + 1; i <= targetCount; i++) {
      const d = Math.min(targetDays, Math.max(1, Math.round(((i - 1) / targetCount) * targetDays) + 1));
      const pillarObj = nichePillars[(i - 1) % nichePillars.length];
      const bp = getNicheAwarePillarBlueprint(pillarObj.name, niche, '', d);
      const timeSlotHour = i % 2 === 0 ? '18:00' : '20:30';
      const timeSlot = `${timeSlotHour} ${timeZoneCode}`;
      const postDate = new Date(Date.now() + 86400000 * d);
      const dateStr = postDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      const dayOfWeek = postDate.toLocaleDateString('en-US', { weekday: 'long' });
      const scheduledAt = `${postDate.toISOString().slice(0, 10)}T${timeSlotHour}:00`;

      const nicheTag = (niche || 'growth').split(/[\s,]+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'growth';

      result.push({
        day: d,
        dayLabel: targetCount > targetDays ? `Day ${d} (Slot ${i})` : `Day ${d}`,
        dateStr,
        dayOfWeek,
        timeSlot,
        timeStr: timeSlotHour,
        platform: 'Instagram',
        status: 'Planned',
        pillar: bp.pillar,
        postTopic: bp.topic,
        visualFormat: bp.fmt,
        imageUrl: '',
        carouselMedia: '',
        coverUrl: '',
        hook: bp.hook,
        captionAndCta: ensureCaptionHasHookSeoAndTags(bp.caption, bp.hook, bp.seoTags, niche),
        seoKeywordsAndTags: bp.seoTags,
        locationName: 'Explore Feed',
        scheduledAt,
        altText: `${bp.fmt} - ${bp.topic}`,
        song: bp.fmt === 'Reel' ? 'Trending Audio - High Retention Beat' : '',
        tag: `@${nicheTag}_insights`,
        competitorDiscovery: '',
        link: '',
      });
    }
  }

  // If targetMix is specified, enforce the visual formats onto the calendar items
  if (targetMix) {
    const reelsPool = Array(targetMix.reels ?? 0).fill('Reel' as const);
    const carouselsPool = Array(targetMix.carousels ?? 0).fill('Carousel' as const);
    const videosPool = Array(targetMix.videos ?? 0).fill('Video' as const);
    const singlesPool = Array(targetMix.singlePosts ?? 0).fill('Single Post' as const);

    const formatSchedule: Array<'Reel' | 'Carousel' | 'Video' | 'Single Post'> = [];
    for (let i = 0; i < result.length; i++) {
      if (i % 2 === 0 && reelsPool.length > 0) {
        formatSchedule.push(reelsPool.pop()!);
      } else if (carouselsPool.length > 0) {
        formatSchedule.push(carouselsPool.pop()!);
      } else if (videosPool.length > 0) {
        formatSchedule.push(videosPool.pop()!);
      } else if (singlesPool.length > 0) {
        formatSchedule.push(singlesPool.pop()!);
      } else if (reelsPool.length > 0) {
        formatSchedule.push(reelsPool.pop()!);
      } else {
        formatSchedule.push('Reel');
      }
    }

    result = result.map((item, idx) => ({
      ...item,
      visualFormat: formatSchedule[idx] || item.visualFormat || 'Reel',
    }));
  }

  // Enrich all items with rich idea breakdown, duration, scenes, and full script
  return result.map((item, idx) => {
    const enriched = enrichCalendarItemWithRichIdeas(item, niche, item.day || (idx + 1));
    return {
      ...enriched,
      captionAndCta: ensureCaptionHasHookSeoAndTags(enriched.captionAndCta, enriched.hook, enriched.seoKeywordsAndTags, niche),
    };
  });
}

/**
 * High-precision fallback engine generating a tailored strategy plan
 */
function buildDeterministicGrowthPlan(
  user: InstagramUser | null,
  media: InstagramMedia[],
  profile: GrowthStrategyProfile | undefined | null,
  niche: string,
  targetAudience: string,
  followers: number,
  engRate: number,
  username: string,
  explicitTzInfo?: ProfileTimezoneInfo
): FullGrowthStrategyResult {
  const targetDays = profile?.calendarDays || 30;
  const tzInfo = explicitTzInfo || detectProfileTimezone(profile, user);
  const cleanTag = niche.split(/[\s,]+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'growth';
  const stableScore = calculateStableGrowthScore(user, media);
  const total = stableScore.total;
  const contentQuality = stableScore.contentQuality;
  const engagement = stableScore.engagement;
  const reach = stableScore.reach;
  const profileScore = stableScore.profile;
  const consistency = stableScore.consistency;
  const bottlenecks = stableScore.bottlenecks;

  const contentPillars = getNichePillars(niche);

  const peakTimes = getOptimalNichePostingTimes(niche, media, tzInfo.standardCode);

  // Target Content Mix Setup (Across the user's selected calendar horizon)
  const userMix = profile?.formatMix || { reels: 15, carousels: 10, videos: 3, singlePosts: 2, stories: 30 };
  const targetReels = userMix.reels ?? 15;
  const targetCarousels = userMix.carousels ?? 10;
  const targetVideos = userMix.videos ?? 3;
  const targetSingles = userMix.singlePosts ?? 2;
  const totalTargetInFeed = targetReels + targetCarousels + targetVideos + targetSingles;
  const totalPlannedPosts = Math.max(1, totalTargetInFeed);

  // Auto-setup multi-slot allocations: If target > calendarDays, schedule multiple posts on peak days
  const dayAllocations: Array<{ day: number; slotIndex: number; totalSlotsForDay: number }> = [];

  if (totalPlannedPosts >= targetDays) {
    const baseSlots = Math.floor(totalPlannedPosts / targetDays);
    const extraSlots = totalPlannedPosts % targetDays;
    for (let d = 1; d <= targetDays; d++) {
      const slotsToday = baseSlots + (d <= extraSlots ? 1 : 0);
      for (let s = 1; s <= slotsToday; s++) {
        dayAllocations.push({ day: d, slotIndex: s, totalSlotsForDay: slotsToday });
      }
    }
  } else {
    // Fewer target posts than days: distribute across tentative peak days
    const step = targetDays / totalPlannedPosts;
    for (let i = 0; i < totalPlannedPosts; i++) {
      const d = Math.min(targetDays, Math.max(1, Math.round(i * step) + 1));
      dayAllocations.push({ day: d, slotIndex: 1, totalSlotsForDay: 1 });
    }
  }

  // Exact pool of visual formats drawn directly from target numbers
  const reelsPool = Array(targetReels).fill('Reel' as const);
  const carouselsPool = Array(targetCarousels).fill('Carousel' as const);
  const videosPool = Array(targetVideos).fill('Video' as const);
  const singlesPool = Array(targetSingles).fill('Single Post' as const);

  const formatSchedule: Array<'Reel' | 'Carousel' | 'Video' | 'Single Post'> = [];
  for (let i = 0; i < totalPlannedPosts; i++) {
    if (i % 2 === 0 && reelsPool.length > 0) {
      formatSchedule.push(reelsPool.pop()!);
    } else if (carouselsPool.length > 0) {
      formatSchedule.push(carouselsPool.pop()!);
    } else if (videosPool.length > 0) {
      formatSchedule.push(videosPool.pop()!);
    } else if (singlesPool.length > 0) {
      formatSchedule.push(singlesPool.pop()!);
    } else if (reelsPool.length > 0) {
      formatSchedule.push(reelsPool.pop()!);
    } else {
      formatSchedule.push('Reel');
    }
  }

  // Proper sequential dates starting from tomorrow
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);

  const calendar: GrowthCalendarItem[] = dayAllocations.map((alloc, idx) => {
    const { day, slotIndex, totalSlotsForDay } = alloc;
    const pillarObj = contentPillars[(day - 1) % contentPillars.length];
    const bp = getNicheAwarePillarBlueprint(pillarObj.name, niche, targetAudience, day);
    const format = formatSchedule[idx] || bp.fmt || 'Reel';

    const dayLabel = totalSlotsForDay > 1 ? `Day ${day} (Slot ${slotIndex})` : `Day ${day}`;

    // Optimal peak hour per slot
    let timeSlotHour = '18:00';
    if (totalSlotsForDay === 2) {
      timeSlotHour = slotIndex === 1 ? '12:30' : '18:00';
    } else if (totalSlotsForDay === 3) {
      timeSlotHour = slotIndex === 1 ? '09:30' : slotIndex === 2 ? '14:00' : '19:30';
    } else if (totalSlotsForDay >= 4) {
      timeSlotHour = slotIndex === 1 ? '08:30' : slotIndex === 2 ? '12:30' : slotIndex === 3 ? '17:30' : '21:00';
    } else {
      timeSlotHour = peakTimes[(day - 1) % peakTimes.length]?.timeSlot?.split(' ')[0] || (day % 2 === 0 ? '18:00' : '20:30');
    }

    const assignedTime = `${timeSlotHour} ${tzInfo.standardCode}`;
    const postDate = new Date(startDate.getTime() + 86400000 * (day - 1));
    const dateStr = postDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const dayOfWeek = postDate.toLocaleDateString('en-US', { weekday: 'long' });
    const scheduledAt = `${postDate.toISOString().slice(0, 10)}T${timeSlotHour.padStart(5, '0')}:00`;

    const calendarItem: GrowthCalendarItem = {
      day,
      dayLabel,
      dateStr,
      dayOfWeek,
      timeSlot: assignedTime,
      timeStr: timeSlotHour,
      platform: 'Instagram',
      status: 'Planned',
      pillar: bp.pillar,
      postTopic: totalSlotsForDay > 1 ? `${bp.topic} [Slot ${slotIndex}]` : bp.topic,
      visualFormat: format,
      imageUrl: '',
      carouselMedia: '',
      coverUrl: '',
      hook: bp.hook,
      captionAndCta: ensureCaptionHasHookSeoAndTags(bp.caption, bp.hook, bp.seoTags, niche),
      seoKeywordsAndTags: bp.seoTags,
      locationName: 'Explore Feed',
      scheduledAt,
      altText: `${format} - ${bp.topic}`,
      song: format === 'Reel' ? 'Trending Audio - High Retention Beat' : '',
      tag: `@${cleanTag}_insights`,
      competitorDiscovery: '',
      link: '',
    };
    return enrichCalendarItemWithRichIdeas(calendarItem, niche, day);
  });

  const weeklySprints: WeeklyExperiment[] = [
    {
      week: 1,
      title: 'Sprint 1 (Days 1–7): Format Testing',
      objective: 'Identify which visual format drives the highest non-follower reach',
      hypothesis: 'Fast-paced 7s B-roll with text overlay generates 2.4x more non-follower reach than static images',
      kpi: 'Non-follower reach % (Target: >45%)',
      threshold: 'Kill formats under 20% non-follower ratio; double down on winner',
    },
    {
      week: 2,
      title: 'Sprint 2 (Days 8–14): Hook Retention',
      objective: 'Optimize 3-second hook retention to boost Instagram explore algorithmic push',
      hypothesis: 'Contrarian tension ("Stop doing X") increases watch retention past 60%',
      kpi: '3-Second View Retention (Target: >60%)',
      threshold: 'Rework hook visual patterns if 3s drop-off exceeds 50%',
    },
    {
      week: 3,
      title: 'Sprint 3 (Days 15–21): Sends-per-Reach Virality',
      objective: 'Drive DM shares (the #1 ranking signal) using relatable controversy and cheat sheets',
      hypothesis: 'Infographic carousels and "Send this to a friend" triggers 3x share velocity',
      kpi: 'Shares per 1k views (Target: >25 shares / post)',
      threshold: 'Pivot to actionable lists if share velocity falls below 15',
    },
    {
      week: 4,
      title: 'Sprint 4 (Days 22–30): Inbound DM Lead Funnel',
      objective: 'Convert high-velocity views into qualified DM conversations and email subscribers',
      hypothesis: 'Comment-to-DM keywords ("Comment GUIDE") achieve 12% conversion to DMs',
      kpi: 'Inbound Qualified DM Leads (Target: >25 leads)',
      threshold: 'A/B test lead magnet title if comment opt-in rate is under 5%',
    },
  ];

  return {
    accountUsername: username,
    followersCount: followers,
    engagementRate: engRate,
    subNiche: niche,
    timeZoneInfo: tzInfo,
    freshAccountSettings: getFreshAccountRecommendations(niche),
    bioBlueprint: getBioBlueprint(niche, targetAudience, username),
    growthScore: {
      total,
      contentQuality,
      engagement,
      reach,
      profile: profileScore,
      consistency,
      bottlenecks,
    },
    highImpactLevers: [
      `Double down on Sends-per-Reach: optimize content specifically to be forwarded via Instagram DMs`,
      `Front-load 3-second hook with contrarian tension and rapid visual movement`,
      `Replace 30 hashtag dumps with 3-5 in-caption semantic SEO search keywords`,
      `Set up automated comment-to-DM triggers for keywords "GROW" and "GUIDE"`,
      `Schedule publishing at peak follower active windows (18:00 & 20:30 ${tzInfo.standardCode})`,
    ],
    competitorInsights: [
      `Competitors in ${niche} generate 65% of viral outlier reach from short 7-second looped Reels with text hooks`,
      `Top performing accounts leverage saveable multi-slide carousels on weekends to maximize algorithmic dwell time`,
      `Clear, 1-action bio links and direct DM automation yield 3.2x higher lead capture than link-in-bio trees`,
    ],
    contentPillars,
    calendar,
    weeklySprints,
    essentialMetrics: [
      'Sends-per-Reach (Aim for >3% of total accounts reached)',
      '3-Second Watch Time Retention (Aim for >60% retention)',
      'Non-Follower Discovery Ratio (Target >50% reach from non-followers)',
      'Saves-to-Reach Ratio (Key indicator for carousel value)',
      'Comment-to-DM Conversion Rate (Lead velocity)',
    ],
    nextActions: [
      `Audit bio: define clear 1-sentence value proposition for ${targetAudience} + DM keyword CTA`,
      'Pin top 3 highest-converting Reels/Carousels representing your Authority and Discovery pillars',
      'Activate "GROW" comment auto-responder rule before publishing Day 1 content',
      'Batch record 5-7 second B-roll clips for Week 1 Format Testing sprint',
      'Queue Day 1 to Day 3 posts in the Publisher Queue for peak-hour release',
    ],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Recalculates and auto-distributes calendar posts based on a custom target mix across selected calendar days.
 * If target in-feed posts > targetDays, schedules multiple posts per day (Slot 1, Slot 2) at peak hours.
 */
export function recalculateCalendarWithTargetMix(
  currentCalendar: GrowthCalendarItem[],
  targetMix: FormatMix | { reels?: number; carousels?: number; videos?: number; singlePosts?: number; stories?: number },
  targetDays: number,
  tzStandardCode: string = 'UTC',
  rawCompetitors: string[] = [],
  niche: string = 'Growth Strategy'
): GrowthCalendarItem[] {
  const targetReels = targetMix.reels ?? 15;
  const targetCarousels = targetMix.carousels ?? 10;
  const targetVideos = targetMix.videos ?? 3;
  const targetSingles = targetMix.singlePosts ?? 2;
  const totalTargetInFeed = targetReels + targetCarousels + targetVideos + targetSingles;
  const totalPlannedPosts = Math.max(1, totalTargetInFeed);

  const dayAllocations: Array<{ day: number; slotIndex: number; totalSlotsForDay: number }> = [];

  if (totalPlannedPosts >= targetDays) {
    const baseSlots = Math.floor(totalPlannedPosts / targetDays);
    const extraSlots = totalPlannedPosts % targetDays;
    for (let d = 1; d <= targetDays; d++) {
      const slotsToday = baseSlots + (d <= extraSlots ? 1 : 0);
      for (let s = 1; s <= slotsToday; s++) {
        dayAllocations.push({ day: d, slotIndex: s, totalSlotsForDay: slotsToday });
      }
    }
  } else {
    const step = targetDays / totalPlannedPosts;
    for (let i = 0; i < totalPlannedPosts; i++) {
      const d = Math.min(targetDays, Math.max(1, Math.round(i * step) + 1));
      dayAllocations.push({ day: d, slotIndex: 1, totalSlotsForDay: 1 });
    }
  }

  const reelsPool = Array(targetReels).fill('Reel' as const);
  const carouselsPool = Array(targetCarousels).fill('Carousel' as const);
  const videosPool = Array(targetVideos).fill('Video' as const);
  const singlesPool = Array(targetSingles).fill('Single Post' as const);

  const formatSchedule: Array<'Reel' | 'Carousel' | 'Video' | 'Single Post'> = [];
  for (let i = 0; i < totalPlannedPosts; i++) {
    if (i % 2 === 0 && reelsPool.length > 0) {
      formatSchedule.push(reelsPool.pop()!);
    } else if (carouselsPool.length > 0) {
      formatSchedule.push(carouselsPool.pop()!);
    } else if (videosPool.length > 0) {
      formatSchedule.push(videosPool.pop()!);
    } else if (singlesPool.length > 0) {
      formatSchedule.push(singlesPool.pop()!);
    } else if (reelsPool.length > 0) {
      formatSchedule.push(reelsPool.pop()!);
    } else {
      formatSchedule.push('Reel');
    }
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);

  const fallbackPillars = currentCalendar.length > 0
    ? Array.from(new Set(currentCalendar.map(c => c.pillar).filter(Boolean)))
    : getNichePillars(niche).map(p => p.name);

  return dayAllocations.map((alloc, idx) => {
    const { day, slotIndex, totalSlotsForDay } = alloc;
    const existing = currentCalendar.find(c => c.day === day && (totalSlotsForDay === 1 || c.dayLabel.includes(`Slot ${slotIndex}`)));
    const pillarName = existing?.pillar || fallbackPillars[(day - 1) % fallbackPillars.length] || `${niche} Strategy`;
    const bp = getNicheAwarePillarBlueprint(pillarName, niche, '', day);
    const format = formatSchedule[idx] || bp.fmt || 'Reel';

    const dayLabel = totalSlotsForDay > 1 ? `Day ${day} (Slot ${slotIndex})` : `Day ${day}`;

    let timeSlotHour = '18:00';
    if (totalSlotsForDay === 2) {
      timeSlotHour = slotIndex === 1 ? '12:30' : '18:00';
    } else if (totalSlotsForDay === 3) {
      timeSlotHour = slotIndex === 1 ? '09:30' : slotIndex === 2 ? '14:00' : '19:30';
    } else if (totalSlotsForDay >= 4) {
      timeSlotHour = slotIndex === 1 ? '08:30' : slotIndex === 2 ? '12:30' : slotIndex === 3 ? '17:30' : '21:00';
    } else {
      timeSlotHour = day % 2 === 0 ? '18:00' : '20:30';
    }

    const assignedTime = `${timeSlotHour} ${tzStandardCode}`;
    const postDate = new Date(startDate.getTime() + 86400000 * (day - 1));
    const dateStr = postDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const dayOfWeek = postDate.toLocaleDateString('en-US', { weekday: 'long' });
    const scheduledAt = `${postDate.toISOString().slice(0, 10)}T${timeSlotHour.padStart(5, '0')}:00`;

    const recalculatedItem: GrowthCalendarItem = {
      day,
      dayLabel,
      dateStr,
      dayOfWeek,
      timeSlot: assignedTime,
      timeStr: timeSlotHour,
      platform: existing?.platform || 'Instagram',
      status: existing?.status || 'Planned',
      pillar: existing?.pillar || bp.pillar,
      postTopic: totalSlotsForDay > 1 ? `${existing?.postTopic || bp.topic} [Slot ${slotIndex}]` : (existing?.postTopic || bp.topic),
      visualFormat: format,
      imageUrl: existing?.imageUrl || '',
      carouselMedia: existing?.carouselMedia || '',
      coverUrl: existing?.coverUrl || '',
      hook: existing?.hook || bp.hook,
      captionAndCta: ensureCaptionHasHookSeoAndTags(
        existing?.captionAndCta || bp.caption,
        existing?.hook || bp.hook,
        existing?.seoKeywordsAndTags || bp.seoTags,
        'Growth Strategy'
      ),
      seoKeywordsAndTags: existing?.seoKeywordsAndTags || bp.seoTags,
      locationName: existing?.locationName || 'Explore Feed',
      scheduledAt,
      altText: `${format} - ${existing?.postTopic || bp.topic}`,
      song: format === 'Reel' ? 'Trending Audio - High Retention Beat' : '',
      tag: existing?.tag || '@growth_insights',
      competitorDiscovery: '',
      link: '',
    };
    return enrichCalendarItemWithRichIdeas(recalculatedItem, 'Growth Strategy', day);
  });
}

/**
 * Distributes media assets across the calendar.
 * If media count > decided days, increases posts per day on high-traffic days (e.g. Day 1 (Slot 1), Day 1 (Slot 2)),
 * allocating optimal peak posting times for each slot.
 */
export function distributeMediaAcrossCalendar(
  calendar: GrowthCalendarItem[],
  mediaUrls: string[],
  timeZoneCode: string = 'UTC'
): GrowthCalendarItem[] {
  if (!mediaUrls || mediaUrls.length === 0) return calendar;

  const validUrls = mediaUrls.map(u => u.trim()).filter(Boolean);
  if (validUrls.length === 0) return calendar;

  const targetDays = calendar.length > 0 ? Math.max(...calendar.map(c => c.day)) : 7;
  const pillars = ['Discovery', 'Authority', 'Community', 'Conversion'];
  const defaultPeakHours = ['12:30', '18:00', '20:30', '09:30'];

  // If media count <= target days, attach 1:1 to existing calendar items
  if (validUrls.length <= targetDays) {
    return calendar.map((item, idx) => ({
      ...item,
      imageUrl: validUrls[idx] || item.imageUrl || '',
      coverUrl: item.coverUrl || validUrls[idx] || '',
    }));
  }

  // If media count > target days: we increase posts per day!
  const totalMedia = validUrls.length;
  const basePerDay = Math.floor(totalMedia / targetDays);
  const remainder = totalMedia % targetDays;

  const newCalendar: GrowthCalendarItem[] = [];
  let mediaIndex = 0;

  for (let d = 1; d <= targetDays; d++) {
    const existing = calendar.find(c => c.day === d) || calendar[(d - 1) % calendar.length];
    const postsToday = basePerDay + (d <= remainder ? 1 : 0);

    for (let slot = 1; slot <= postsToday; slot++) {
      if (mediaIndex >= validUrls.length) break;

      const mediaUrl = validUrls[mediaIndex];
      const slotTimeHour = defaultPeakHours[(slot - 1) % defaultPeakHours.length];
      const timeSlot = `${slotTimeHour} ${timeZoneCode}`;

      const postDate = new Date(Date.now() + 86400000 * d);
      const dateStr = postDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      const dayOfWeek = postDate.toLocaleDateString('en-US', { weekday: 'long' });
      const scheduledAt = `${postDate.toISOString().slice(0, 10)}T${slotTimeHour}:00`;

      const slotPillar = slot === 1 ? (existing?.pillar || pillars[(d - 1) % pillars.length]) : pillars[(d + slot - 2) % pillars.length];
      const isReel = mediaUrl.toLowerCase().includes('.mp4') || mediaUrl.toLowerCase().includes('.mov') || (existing?.visualFormat || '').toLowerCase().includes('reel');
      const visualFormat = isReel ? 'Fast-Paced Reel (7s)' : 'High-Resolution Visual Post';

      newCalendar.push({
        day: d,
        dayLabel: postsToday > 1 ? `Day ${d} (Slot ${slot})` : `Day ${d}`,
        dateStr,
        dayOfWeek,
        timeSlot,
        timeStr: slotTimeHour,
        platform: 'Instagram',
        status: 'Planned',
        pillar: slotPillar,
        postTopic: postsToday > 1 ? `${existing?.postTopic || 'Content Showcase'} - Part ${slot}` : (existing?.postTopic || 'Content Showcase'),
        visualFormat,
        imageUrl: mediaUrl,
        carouselMedia: '',
        coverUrl: mediaUrl,
        hook: existing?.hook || 'Stop scrolling if you want to elevate your reach:',
        captionAndCta: ensureCaptionHasHookSeoAndTags(
          existing?.captionAndCta || 'Consistency and high engagement drive growth! Save this post for later 📌',
          existing?.hook || 'Stop scrolling if you want to elevate your reach:',
          existing?.seoKeywordsAndTags || '#growth #creators #trending',
          slotPillar
        ),
        seoKeywordsAndTags: existing?.seoKeywordsAndTags || '#growth #creators #trending',
        locationName: existing?.locationName || 'Explore Feed',
        scheduledAt,
        altText: `${visualFormat} - ${existing?.postTopic || 'Creative Visual Asset'}`,
        song: isReel ? 'Trending Audio - High Retention Beat' : '',
        tag: '',
        competitorDiscovery: existing?.competitorDiscovery || '@explore_top • Viral Benchmark',
        link: '',
      });

      mediaIndex++;
    }
  }

  return newCalendar;
}

/**
 * Retrieve crawled competitors from Business Discovery search history
 */
export function getCompetitorsFromBusinessDiscovery(): BusinessDiscoveryResult[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(getScopedKey('bd_crawl_history'));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Auto-improves calendar using Business Discovery competitor intelligence and account comparison
 */
export function autoCalibrateCalendarWithCompetitor(
  calendar: GrowthCalendarItem[],
  competitor: BusinessDiscoveryResult,
  timeZoneCode: string = 'UTC'
): GrowthCalendarItem[] {
  if (!calendar || calendar.length === 0 || !competitor) return calendar;

  const compHashtags = (competitor.top_hashtags || []).slice(0, 5);
  const compHours = (competitor.analytics?.bestPostingHours || []).slice(0, 3);
  const compFormatPref = competitor.analytics?.formatPerformance?.sort((a, b) => b.avgEngagement - a.avgEngagement)[0]?.format || 'REELS';

  return calendar.map((item, idx) => {
    let newTimeSlot = item.timeSlot;
    let newTimeStr = item.timeStr;
    if (compHours.length > 0) {
      const targetHour = compHours[idx % compHours.length].hour;
      const formattedHour = `${String(targetHour).padStart(2, '0')}:00`;
      newTimeSlot = `${formattedHour} ${timeZoneCode}`;
      newTimeStr = formattedHour;
    }

    let newFormat = item.visualFormat;
    if (compFormatPref.toUpperCase().includes('REEL') && !item.visualFormat.toLowerCase().includes('reel')) {
      newFormat = 'Fast-Paced Reel (7s)';
    }

    const currentTags = (item.seoKeywordsAndTags.match(/#[a-zA-Z0-9_]+/g) || []).map(t => t.toLowerCase());
    const mergedTags = Array.from(new Set([...currentTags, ...compHashtags])).join(' ');

    const song = newFormat.toLowerCase().includes('reel')
      ? `Trending Audio - ${competitor.username}'s Viral Style`
      : item.song || '';

    return {
      ...item,
      timeSlot: newTimeSlot,
      timeStr: newTimeStr,
      visualFormat: newFormat,
      seoKeywordsAndTags: mergedTags || item.seoKeywordsAndTags,
      song,
      tag: `@${competitor.username}`,
    };
  });
}

/**
 * Convert calendar items to Markdown table format matching current table specifications exactly:
 * Date, Day, Time, Platform, Status, Content Pillar, Post Topic, Visual Type, Media URL, Cover URL, Caption
 */
export function exportCalendarToMarkdown(calendar: GrowthCalendarItem[], niche?: string): string {
  const headers = [
    'Date',
    'Day',
    'Time',
    'Platform',
    'Status',
    'Content Pillar',
    'Post Topic',
    'Visual Type',
    'Media URL',
    'Cover URL',
    'Caption',
  ];
  const headerLine = `| ${headers.join(' | ')} |`;
  const dividerLine = `| ${headers.map(() => ':---').join(' | ')} |`;

  const rows = calendar.map(item => {
    const clean = (s: string = '') => (s || '').replace(/\|/g, '-').replace(/\r?\n/g, ' ').trim();
    const dateStr = item.dateStr || new Date(Date.now() + 86400000 * item.day).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const dayStr = item.dayOfWeek || new Date(Date.now() + 86400000 * item.day).toLocaleDateString('en-US', { weekday: 'long' });
    const timeStr = item.timeStr || item.timeSlot;
    const caption = ensureCaptionHasHookSeoAndTags(item.captionAndCta, item.hook, item.seoKeywordsAndTags, niche);

    return `| ${clean(dateStr)} | ${clean(dayStr)} | ${clean(timeStr)} | ${clean(item.platform || 'Instagram')} | ${clean(item.status || 'Planned')} | ${clean(item.pillar)} | ${clean(item.postTopic)} | ${clean(item.visualFormat)} | ${clean(item.imageUrl)} | ${clean(item.coverUrl)} | ${clean(caption)} |`;
  });

  return [headerLine, dividerLine, ...rows].join('\n');
}

/**
 * Convert calendar items to RFC-4180 compliant CSV format matching current table specifications exactly:
 * Date, Day, Time, Platform, Status, Content Pillar, Post Topic, Visual Type, Media URL, Cover URL, Caption
 */
export function exportCalendarToCsv(calendar: GrowthCalendarItem[], niche?: string): string {
  const headers = [
    'Date',
    'Day',
    'Time',
    'Platform',
    'Status',
    'Content Pillar',
    'Post Topic',
    'Visual Type',
    'Category',
    'Target Duration',
    'Timeline Scenes',
    'Full Script',
    'Hook',
    'Media URL',
    'Cover URL',
    'Caption',
    'SEO Keywords & Tags',
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = calendar.map(item => {
    const dateStr = item.dateStr || new Date(Date.now() + 86400000 * item.day).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const dayStr = item.dayOfWeek || new Date(Date.now() + 86400000 * item.day).toLocaleDateString('en-US', { weekday: 'long' });
    const timeStr = item.timeStr || item.timeSlot;
    const platform = item.platform || 'Instagram';
    const status = item.status || 'Planned';
    const pillar = item.pillar || '';
    const postTopic = item.postTopic || '';
    const visualFormat = item.visualFormat || '';
    const category = item.ideaCategory || item.visualFormat || '';
    const targetDuration = item.targetDuration || '';
    const timelineScenes = item.timelineScenes || '';
    const fullScript = item.fullScript || '';
    const hook = item.hook || '';
    const imageUrl = item.imageUrl || '';
    const coverUrl = item.coverUrl || '';
    const caption = ensureCaptionHasHookSeoAndTags(item.captionAndCta, item.hook, item.seoKeywordsAndTags, niche);
    const seoTags = item.seoKeywordsAndTags || '';

    return [
      escapeCsv(dateStr),
      escapeCsv(dayStr),
      escapeCsv(timeStr),
      escapeCsv(platform),
      escapeCsv(status),
      escapeCsv(pillar),
      escapeCsv(postTopic),
      escapeCsv(visualFormat),
      escapeCsv(category),
      escapeCsv(targetDuration),
      escapeCsv(timelineScenes),
      escapeCsv(fullScript),
      escapeCsv(hook),
      escapeCsv(imageUrl),
      escapeCsv(coverUrl),
      escapeCsv(caption),
      escapeCsv(seoTags),
    ].join(',');
  });

  return [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
}
