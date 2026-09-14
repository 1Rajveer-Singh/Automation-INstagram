export interface ApiConfig {
  appId: string;
  appSecret: string;
  accessToken: string;
  selectedIgUserId: string;
  geminiApiKey?: string;
  openRouterApiKey?: string;
  rateLimitUsage: number; // percentage 0-100
  tokenExpiresInDays: number;
  cloudinaryUrl?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  cloudinaryUploadPreset?: string;
}

export interface TokenDebugInfo {
  app_id: string;
  type: string;
  application: string;
  data_access_expires_at: number;
  expires_at: number;
  is_valid: boolean;
  scopes: string[];
  user_id: string;
}

export interface InstagramUser {
  id: string;
  username: string;
  name: string;
  biography: string;
  profile_picture_url: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  website?: string;
  ig_id?: string;
  growthScore?: number;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  reach?: number;
  impressions?: number;
  saved?: number;
  shares?: number;
  is_comment_enabled?: boolean;
  children?: {
    data: Array<{
      id: string;
      media_type?: string;
      media_url?: string;
    }>;
  };
}

export interface InstagramComment {
  id: string;
  text: string;
  timestamp: string;
  username: string;
  like_count: number;
  hidden?: boolean;
  replied?: boolean;
  sentiment?: 'positive' | 'neutral' | 'spam';
  replies?: InstagramComment[];
}

export interface MediaContainerRequest {
  media_type: 'IMAGE' | 'VIDEO' | 'REELS' | 'CAROUSEL';
  image_url?: string;
  video_url?: string;
  caption: string;
  cover_url?: string;
  location_id?: string;
  user_tags?: string[];
  children?: string[];
  scheduled_publish_time?: string;
  audio_name?: string;
  song?: string;
}

export interface MediaContainerStatus {
  id: string;
  status_code: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';
  status?: string;
}

export interface ScheduledPost {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'REELS' | 'CAROUSEL';
  mediaUrl: string;
  caption: string;
  scheduledTime: string;
  status: 'QUEUED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'PLANNED';
  containerId?: string;
  createdAt: string;
  errorMessage?: string;

  // Spreadsheet Metadata Fields
  dateStr?: string;
  dayOfWeek?: string;
  timeStr?: string;
  platform?: string;
  contentPillar?: string;
  postTopic?: string;
  visualType?: string;
  thumbnailUrl?: string;
  finalContentLink?: string;
  designReference?: string;
  carouselMedia?: string;
  coverUrl?: string;
  hashtags?: string;
  locationName?: string;
  altText?: string;
  song?: string;
  tag?: string;
}

export interface InstagramInsight {
  name: string;
  period: string;
  title: string;
  description: string;
  id: string;
  values?: Array<{
    value: number | Record<string, number>;
    end_time?: string;
  }>;
  total_value?: {
    value: number;
  };
}

export interface CrawlAnalytics {
  bestPostingDays: Array<{ day: string; count: number; avgEngagement: number }>;
  bestPostingHours: Array<{ hour: number; label: string; count: number; avgEngagement: number }>;
  bestPostingTimeSummary: string;
  topKeywords: Array<{ word: string; count: number; avgEngagement: number; boostMultiplier: number }>;
  topHooks: Array<{ hook: string; likes: number; comments: number; engagement: number; mediaType: string }>;
  formatPerformance: Array<{ format: string; count: number; avgEngagement: number; percent: number }>;
  hashtagPerformance: Array<{ tag: string; count: number; avgEngagement: number }>;
  cadenceDaysAvg: number;
  engagementTier: 'Low' | 'Moderate' | 'High' | 'Viral';
  diagnosticBadges: Array<{ type: 'warning' | 'success' | 'info'; title: string; message: string }>;
}

export interface BusinessDiscoveryResult {
  id: string;
  username: string;
  name: string;
  profile_picture_url: string;
  followers_count: number;
  media_count: number;
  biography: string;
  website?: string;
  recent_media: InstagramMedia[];
  top_hashtags: string[];
  engagement_rate: number;
  crawledAt?: string;
  analytics?: CrawlAnalytics;
}

export interface PostMechanismsAnalysis {
  hook: string;
  hookType: string;
  hookScore: number;
  retentionBreakdown: string;
  copyFramework: string;
  contentPillar: string;
  detectedCta: string;
  visualFormatTip: string;
  hashtags: string[];
  mentions: string[];
  emotionalTriggers: string[];
  shareabilityFactor: string;
  saveabilityFactor: string;
  reusableTemplate: string;
}

export interface SinglePostDiscoveryResult {
  id: string;
  shortcode: string;
  permalink: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';
  media_url?: string;
  thumbnail_url?: string;
  caption: string;
  author_name?: string;
  author_url?: string;
  like_count?: number;
  comments_count?: number;
  timestamp?: string;
  children?: Array<{
    id: string;
    media_type?: string;
    media_url?: string;
  }>;
  mechanisms: PostMechanismsAnalysis;
  crawledAt: string;
}

export interface HashtagSearchResult {
  id: string;
  name: string;
  media_count?: number;
}

export interface HashtagSet {
  niche: string;
  highReach: string[];
  mediumReach: string[];
  lowCompetition: string[];
}

export interface FormatMix {
  reels: number; // e.g. 4
  carousels: number; // e.g. 2
  singlePosts: number; // e.g. 1
  stories: number; // e.g. 7
  videos?: number; // e.g. 1 (In-depth Video / Tutorial / Long-form Reel)
}

export interface ProfileTimezoneInfo {
  timeZone: string; // e.g. 'Asia/Kolkata', 'America/New_York'
  standardCode: string; // e.g. 'IST', 'EST', 'GMT'
  formattedOffset: string; // e.g. 'UTC+5:30', 'UTC-4:00'
  source: 'profile_detected' | 'system_detected' | 'user_override';
  displayName: string; // e.g. 'Asia/Kolkata (IST • UTC+5:30)'
}

export interface GrowthStrategyProfile {
  subNiche: string;
  targetAudience: string;
  competitorHandles: string[];
  contentFormat: string;
  conversionGoal: string;
  formatMix?: FormatMix;
  timeZone?: string;
  configuredAt?: string;
  calendarDays?: number;
}

export interface FollowGatedFunnelConfig {
  enabled: boolean;
  resourceTitle: string;
  resourceUrl: string;
  commentReplyText?: string;
  initialDmText: string;
  unfollowedReminderText: string;
  verifiedDeliveryText: string;
  alreadyFollowingCommentReplyText?: string;
  alreadyFollowingDmText?: string;
  maxReminders: number; // default: 2
}

export interface FollowFunnelLeadLog {
  timestamp: string;
  type: 'comment_reply' | 'dm_initial' | 'reminder' | 'verified' | 'delivered' | 'simulated' | 'error';
  message: string;
}

export interface FollowFunnelLead {
  id: string;
  commentId: string;
  username: string;
  ruleId: string;
  keyword: string;
  resourceTitle: string;
  resourceUrl: string;
  status: 'pending_follow' | 'verified' | 'delivered' | 'unresponsive';
  reminderCount: number;
  lastInteractionAt: string;
  createdAt: string;
  log: FollowFunnelLeadLog[];
}

export interface AutoReplyRule {
  id: string;
  triggerKeyword: string;
  replyText: string;
  action: 'reply_comment' | 'hide_comment' | 'flag_lead' | 'send_dm';
  triggerCount: number;
  isActive: boolean;
  createdAt: string;
  followGated?: FollowGatedFunnelConfig;
}

export interface GrowthTask {
  id: string;
  title: string;
  description: string;
  impactScore: 'HIGH' | 'MEDIUM' | 'VIRAL';
  category: 'CONTENT' | 'HASHTAGS' | 'AUTO_REPLY' | 'SCHEDULE';
  completed: boolean;
  actionEndpoint: string;
}

export interface ApiSandboxResponse {
  status: number;
  statusText: string;
  data: any;
  durationMs: number;
  timestamp: string;
  url: string;
}

export interface GrowthCalendarItem {
  day: number;
  dayLabel: string;
  timeSlot: string;
  status: 'Planned' | 'Ready' | 'Queued' | 'Scheduled' | 'Published';
  pillar: string;
  postTopic: string;
  visualFormat: string;
  hook: string;
  captionAndCta: string;
  seoKeywordsAndTags: string;
  imageUrl?: string;
  link: string;

  // 18 Standardized Calendar Table & Export Fields
  dateStr?: string;
  dayOfWeek?: string;
  timeStr?: string;
  platform?: string;
  carouselMedia?: string;
  coverUrl?: string;
  locationName?: string;
  scheduledAt?: string;
  altText?: string;
  song?: string;
  tag?: string;
  competitorDiscovery?: string;
}

export interface WeeklyExperiment {
  week: number;
  title: string;
  objective: string;
  hypothesis: string;
  kpi: string;
  threshold: string;
}

export interface FullGrowthStrategyResult {
  accountUsername?: string;
  followersCount?: number;
  engagementRate?: number;
  subNiche?: string;
  growthScore: {
    total: number;
    contentQuality: number;
    engagement: number;
    reach: number;
    profile: number;
    consistency: number;
    bottlenecks: string[];
  };
  highImpactLevers: string[];
  competitorInsights: string[];
  contentPillars: Array<{ name: string; description: string; color: string }>;
  calendar: GrowthCalendarItem[];
  weeklySprints: WeeklyExperiment[];
  essentialMetrics: string[];
  nextActions: string[];
  timeZoneInfo?: ProfileTimezoneInfo;
  isAiGenerated?: boolean;
  aiProvider?: string;
  generatedAt: string;
}
