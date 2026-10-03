import React, { useState, useEffect, useMemo } from 'react';
import {
  ApiConfig,
  InstagramUser,
  InstagramMedia,
  GrowthStrategyProfile,
  FullGrowthStrategyResult,
  GrowthCalendarItem,
  ProfileTimezoneInfo,
  BusinessDiscoveryResult,
} from '../../types/instagram';
import {
  GROWTH_STRATEGIST_SYSTEM_PROMPT,
  generateGrowthStrategistPlan,
  getOptimalNichePostingTimes,
  detectProfileTimezone,
  buildTimezoneInfo,
  exportCalendarToMarkdown,
  exportCalendarToCsv,
  distributeMediaAcrossCalendar,
  getCompetitorsFromBusinessDiscovery,
  autoCalibrateCalendarWithCompetitor,
  recalculateCalendarWithTargetMix,
  ensureCaptionHasHookSeoAndTags,
  getFreshAccountRecommendations,
  getBioBlueprint,
} from '../../services/growthEngine';
import {
  normalizePillarName,
} from '../../services/competitorDiscoveryEngine';
import { saveScheduledPost } from '../../services/scheduler';
import { loadEnvCredentials } from '../../services/security';
import {
  fetchSupabaseSavedCalendars,
  upsertSupabaseSavedCalendar,
  deleteSupabaseSavedCalendar,
} from '../../services/supabaseService';
import { StickerCard } from '../common/StickerCard';
import { CandyButton } from '../common/CandyButton';
import { HardInput } from '../common/HardInput';
import { useActivity } from '../../context/ActivityContext';
import {
  Rocket,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  Zap,
  Sparkles,
  Calendar,
  Layers,
  Copy,
  Download,
  Target,
  Search,
  Flame,
  Send,
  SlidersHorizontal,
  Code2,
  X,
  TrendingUp,
  AlertTriangle,
  LayoutGrid,
  Table as TableIcon,
  CheckSquare,
  Square,
  Edit3,
  Clock,
  Image as ImageIcon,
  Compass,
  Save,
  Plus,
  Trash2,
  Upload,
  ExternalLink,
  Music,
  Tag,
  Users,
  Folder,
  Check,
  Settings,
  BookOpen,
  Film,
} from 'lucide-react';

export const SAVED_CALENDARS_STORAGE_KEY = 'instagrowth_saved_calendars_history_v1';

export interface SavedCalendarEntry {
  id: string;
  savedAt: string;
  title: string;
  subNiche: string;
  calendarDays: number;
  totalPosts: number;
  plan: FullGrowthStrategyResult;
}

interface GrowthAutomationViewProps {
  config: ApiConfig;
  user?: InstagramUser | null;
  media?: InstagramMedia[];
  profile?: GrowthStrategyProfile | null;
  onNavigate?: (tab: any) => void;
  onOpenStrategyModal?: () => void;
  userId?: string;
  activeSubTab?: GrowthSubTab;
  onSubTabChange?: (tab: GrowthSubTab) => void;
}

const STRATEGY_STORAGE_KEY = 'instagrowth_active_30day_strategy_v3';

export type GrowthSubTab = 'diagnosis' | 'calendar' | 'actions';

export const GrowthAutomationView: React.FC<GrowthAutomationViewProps> = ({
  config,
  user = null,
  media = [],
  profile = null,
  onNavigate,
  onOpenStrategyModal,
  userId = 'default',
  activeSubTab: controlledSubTab,
  onSubTabChange,
}) => {
  // User-scoped storage keys — each Clerk account gets isolated growth data
  const strategyKey = userId === 'default' ? STRATEGY_STORAGE_KEY : `${STRATEGY_STORAGE_KEY}_user_${userId}`;
  const calendarsKey = userId === 'default' ? SAVED_CALENDARS_STORAGE_KEY : `${SAVED_CALENDARS_STORAGE_KEY}_user_${userId}`;
  const completedActionsKey = userId === 'default' ? 'instagrowth_completed_actions' : `instagrowth_completed_actions_user_${userId}`;
  const timezoneKey = userId === 'default' ? 'instagrowth_profile_timezone' : `instagrowth_profile_timezone_user_${userId}`;

  const { addActivity } = useActivity();
  const [internalSubTab, setInternalSubTab] = useState<GrowthSubTab>('diagnosis');
  const activeSubTab = controlledSubTab ?? internalSubTab;
  const setActiveSubTab = (tab: GrowthSubTab) => {
    if (onSubTabChange) {
      onSubTabChange(tab);
    } else {
      setInternalSubTab(tab);
    }
  };

  // Real Account Stats computed directly from props
  const realUsername = user?.username || (config.selectedIgUserId ? `user_${config.selectedIgUserId.slice(-4)}` : '');
  const realFollowers = user?.followers_count ?? 0;
  const isAccountConnected = Boolean(user && user.username);

  const realEngRate = useMemo(() => {
    if (!realFollowers || media.length === 0) return 0;
    const totalLikes = media.reduce((acc, m) => acc + (m.like_count || 0), 0);
    const totalComments = media.reduce((acc, m) => acc + (m.comments_count || 0), 0);
    return parseFloat((((totalLikes + totalComments) / media.length / realFollowers) * 100).toFixed(2));
  }, [media, realFollowers]);

  // Auto-identified timezone based on profile & system
  const [overrideTz, setOverrideTz] = useState<string | null>(() => {
    return localStorage.getItem(timezoneKey) || null;
  });

  const profileTimezone: ProfileTimezoneInfo = useMemo(() => {
    if (overrideTz) {
      return buildTimezoneInfo(overrideTz, 'user_override');
    }
    return detectProfileTimezone(profile, user);
  }, [profile, user, overrideTz]);

  // Optimal posting times derived through niche crawling & analysis
  const nichePeakTimes = useMemo(() => {
    return getOptimalNichePostingTimes(profile?.subNiche || '', media, profileTimezone.standardCode);
  }, [profile?.subNiche, media, profileTimezone.standardCode]);

  // AI Strategist State
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategyResult, setStrategyResult] = useState<FullGrowthStrategyResult | null>(() => {
    try {
      const saved = localStorage.getItem(strategyKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Calendar editing state
  const [editingItem, setEditingItem] = useState<GrowthCalendarItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isTimezoneModalOpen, setIsTimezoneModalOpen] = useState(false);

  // Checklist of completed immediate actions
  const [completedActions, setCompletedActions] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem(completedActionsKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleActionCompleted = (index: number) => {
    const updated = { ...completedActions, [index]: !completedActions[index] };
    setCompletedActions(updated);
    localStorage.setItem(completedActionsKey, JSON.stringify(updated));
  };

  // Calendar display state
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [pillarFilter, setPillarFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);
  const [scheduledDayId, setScheduledDayId] = useState<number | null>(null);

  // Target Content Mix state (Configurable target across calendar days)
  const [targetMix, setTargetMix] = useState<{
    reels: number;
    carousels: number;
    videos: number;
    singlePosts: number;
    stories: number;
  }>(() => {
    if (profile?.formatMix) {
      return {
        reels: profile.formatMix.reels ?? 15,
        carousels: profile.formatMix.carousels ?? 10,
        videos: profile.formatMix.videos ?? 3,
        singlePosts: profile.formatMix.singlePosts ?? 2,
        stories: profile.formatMix.stories ?? 30,
      };
    }
    return { reels: 15, carousels: 10, videos: 3, singlePosts: 2, stories: 30 };
  });

  useEffect(() => {
    if (profile?.formatMix) {
      setTargetMix({
        reels: profile.formatMix.reels ?? 15,
        carousels: profile.formatMix.carousels ?? 10,
        videos: profile.formatMix.videos ?? 3,
        singlePosts: profile.formatMix.singlePosts ?? 2,
        stories: profile.formatMix.stories ?? 30,
      });
    }
  }, [profile?.formatMix]);

  // Saved Calendars History & Anti-Duplication Memorization State
  const [savedCalendars, setSavedCalendars] = useState<SavedCalendarEntry[]>(() => {
    try {
      const saved = localStorage.getItem(calendarsKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSavedCalendarsModalOpen, setIsSavedCalendarsModalOpen] = useState(false);
  const [copiedBio, setCopiedBio] = useState(false);

  // Cloud sync: fetch saved calendars from Supabase on mount / account switch
  useEffect(() => {
    if (!userId || userId === 'default') return;
    let isMounted = true;
    fetchSupabaseSavedCalendars(userId)
      .then(remoteCalendars => {
        if (isMounted && Array.isArray(remoteCalendars) && remoteCalendars.length > 0) {
          setSavedCalendars(prev => {
            const map = new Map<string, SavedCalendarEntry>();
            prev.forEach(c => map.set(c.id, c));
            remoteCalendars.forEach(c => map.set(c.id, c));
            const merged = Array.from(map.values());
            localStorage.setItem(calendarsKey, JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch(console.warn);

    return () => {
      isMounted = false;
    };
  }, [userId, calendarsKey]);

  // Media distribution state
  const [isMediaDistributeModalOpen, setIsMediaDistributeModalOpen] = useState(false);
  const [rawMediaUrlsInput, setRawMediaUrlsInput] = useState('');

  // Business Discovery Competitor Comparison State
  const [competitorsList, setCompetitorsList] = useState<BusinessDiscoveryResult[]>(() => {
    return getCompetitorsFromBusinessDiscovery();
  });
  const [selectedCompetitorUsername, setSelectedCompetitorUsername] = useState<string>(() => {
    const list = getCompetitorsFromBusinessDiscovery();
    return list[0]?.username || '';
  });

  useEffect(() => {
    const list = getCompetitorsFromBusinessDiscovery();
    setCompetitorsList(list);
    if (!selectedCompetitorUsername && list.length > 0) {
      setSelectedCompetitorUsername(list[0].username);
    }
  }, [activeSubTab]);

  // Graph API Automation Rules State
  const [automations, setAutomations] = useState([
    {
      id: 'auto_peak_post',
      name: 'Peak Time Reels Auto-Publisher',
      description: `Automatically releases queued Reel containers at 18:00 ${profileTimezone.standardCode} peak follower activity window.`,
      status: 'active',
      runCount: 14,
      lastRun: `Today, 18:00 ${profileTimezone.standardCode}`,
      tag: 'CONTENT SCHEDULER',
      color: 'bg-yellowPop text-slateDark',
    },
    {
      id: 'auto_comment_lead',
      name: 'Keyword "GROW" / "GUIDE" Comment Magnet Funnel',
      description: 'Replies to post comments containing keyword "GROW" or "GUIDE" with DM resource funnel within 30 seconds.',
      status: 'active',
      runCount: 89,
      lastRun: '12 mins ago',
      tag: 'LEAD CAPTURE',
      color: 'bg-pinkPop text-slateDark',
    },
    {
      id: 'auto_hashtag_rotator',
      name: 'Sends-per-Reach & SEO Keyword Rotator',
      description: 'Swaps out saturated tags for high-intent 3-5 search keywords per post to maximize Explore recommendations.',
      status: 'active',
      runCount: 22,
      lastRun: '2 hours ago',
      tag: 'REACH BOOSTER',
      color: 'bg-mintPop text-slateDark',
    },
    {
      id: 'auto_spam_shield',
      name: 'Anti-Spam & Sentiment Shield',
      description: 'Hides toxic, promo, and crypto spam comments automatically using sentiment analysis.',
      status: 'active',
      runCount: 45,
      lastRun: '5 mins ago',
      tag: 'SECURITY',
      color: 'bg-violetBrand text-white',
    },
  ]);

  const toggleAutomation = (id: string) => {
    setAutomations(prev =>
      prev.map(a => (a.id === id ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } : a))
    );
  };

  // Sync peak post automation with detected profile timezone
  useEffect(() => {
    setAutomations(prev =>
      prev.map(a =>
        a.id === 'auto_peak_post'
          ? {
              ...a,
              description: `Automatically releases queued Reel containers at 18:00 ${profileTimezone.standardCode} peak follower activity window.`,
              lastRun: `Today, 18:00 ${profileTimezone.standardCode}`,
            }
          : a
      )
    );
  }, [profileTimezone.standardCode]);

  // Handle switching/overriding time standard
  const handleChangeTimezone = (newTz: string | null) => {
    if (newTz === null) {
      localStorage.removeItem(timezoneKey);
      setOverrideTz(null);
      const autoInfo = detectProfileTimezone(profile, user);
      if (strategyResult?.calendar) {
        const updatedCalendar = strategyResult.calendar.map(item => ({
          ...item,
          timeSlot: item.timeSlot.replace(/\s[A-Z0-9+-:]+$/, ` ${autoInfo.standardCode}`),
        }));
        const updatedPlan: FullGrowthStrategyResult = {
          ...strategyResult,
          calendar: updatedCalendar,
          timeZoneInfo: autoInfo,
        };
        setStrategyResult(updatedPlan);
        localStorage.setItem(strategyKey, JSON.stringify(updatedPlan));
      }
      addActivity(`Time standard reset to auto-detected (${autoInfo.displayName})!`, 'info');
    } else {
      localStorage.setItem(timezoneKey, newTz);
      setOverrideTz(newTz);
      const newInfo = buildTimezoneInfo(newTz, 'user_override');
      if (strategyResult?.calendar) {
        const updatedCalendar = strategyResult.calendar.map(item => ({
          ...item,
          timeSlot: item.timeSlot.replace(/\s[A-Z0-9+-:]+$/, ` ${newInfo.standardCode}`),
        }));
        const updatedPlan: FullGrowthStrategyResult = {
          ...strategyResult,
          calendar: updatedCalendar,
          timeZoneInfo: newInfo,
        };
        setStrategyResult(updatedPlan);
        localStorage.setItem(strategyKey, JSON.stringify(updatedPlan));
      }
      addActivity(`Time standard set to ${newInfo.displayName}!`, 'success');
    }
    setIsTimezoneModalOpen(false);
  };

  // Generate strategy plan using real user data & live LLM with Anti-Duplication Memory
  const handleGenerateStrategy = async () => {
    setIsGenerating(true);
    try {
      // Harvest previous post topics across all saved calendars + currently active calendar
      const pastTopicsSet = new Set<string>();
      savedCalendars.forEach(entry => {
        entry.plan?.calendar?.forEach(item => {
          if (item.postTopic && item.postTopic.trim()) {
            pastTopicsSet.add(item.postTopic.trim());
          }
        });
      });
      if (strategyResult?.calendar) {
        strategyResult.calendar.forEach(item => {
          if (item.postTopic && item.postTopic.trim()) {
            pastTopicsSet.add(item.postTopic.trim());
          }
        });
      }
      const previousCalendarTopics = Array.from(pastTopicsSet);

      const plan = await generateGrowthStrategistPlan({
        user,
        media,
        profile,
        config,
        previousCalendarTopics,
      });

      setStrategyResult(plan);
      localStorage.setItem(strategyKey, JSON.stringify(plan));
      addActivity(
        `Growth Strategy generated via ${plan.aiProvider || 'LLM'} for @${plan.accountUsername || 'account'} (Score: ${plan.growthScore.total}/100)!`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to generate growth strategy:', err);
      addActivity('Error generating growth strategy. Please try again.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const prevProfileConfigRef = React.useRef(profile ? `${profile.configuredAt || ''}_${profile.calendarDays || 30}_${JSON.stringify(profile.formatMix || {})}` : '');

  // Account switch listener: reload strategyResult scoped to this user
  useEffect(() => {
    try {
      const saved = localStorage.getItem(strategyKey);
      setStrategyResult(saved ? JSON.parse(saved) : null);
    } catch {
      setStrategyResult(null);
    }
  }, [strategyKey]);

  // Auto-synchronize when user or profile data is intentionally updated
  useEffect(() => {
    if (!profile) return;

    const currentConfigKey = `${profile.configuredAt || ''}_${profile.calendarDays || 30}_${JSON.stringify(profile.formatMix || {})}`;
    const hasConfigChanged = Boolean(currentConfigKey && currentConfigKey !== prevProfileConfigRef.current);
    prevProfileConfigRef.current = currentConfigKey;

    if (hasConfigChanged) {
      const targetDays = profile.calendarDays || 30;
      const effectiveMix = profile.formatMix || { reels: 15, carousels: 10, videos: 3, singlePosts: 2, stories: 30 };

      if (strategyResult?.calendar && strategyResult.calendar.length > 0) {
        // Fast deterministic synchronization with user's target content mix & horizon
        const updatedCalendar = recalculateCalendarWithTargetMix(
          strategyResult.calendar,
          effectiveMix,
          targetDays,
          profileTimezone.standardCode,
          profile.competitorHandles || [],
          profile.subNiche || 'Growth Strategy'
        );
        const updatedPlan: FullGrowthStrategyResult = {
          ...strategyResult,
          targetDays,
          targetMix: effectiveMix,
          calendar: updatedCalendar,
        };
        setStrategyResult(updatedPlan);
        localStorage.setItem(strategyKey, JSON.stringify(updatedPlan));
        addActivity(
          `Calendar updated to ${targetDays} days with Target Content Mix (${effectiveMix.reels} Reels, ${effectiveMix.carousels} Carousels, ${effectiveMix.videos} Videos, ${effectiveMix.singlePosts} Singles)!`,
          'success'
        );
      } else {
        handleGenerateStrategy();
      }
      return;
    }

    // Auto-refresh only when real connected account username changes
    if (user && user.username && strategyResult?.accountUsername && strategyResult.accountUsername !== user.username) {
      handleGenerateStrategy();
    }
  }, [user?.username, profile?.subNiche, profile?.calendarDays, profile?.configuredAt, profile?.formatMix]);

  // Filtered calendar items
  const filteredCalendar = useMemo(() => {
    if (!strategyResult?.calendar) return [];
    return strategyResult.calendar.filter(item => {
      // Dynamic week filter supporting any number of weeks (7, 14, 30, 60 days)
      if (weekFilter.startsWith('w')) {
        const weekNum = parseInt(weekFilter.slice(1), 10);
        if (!isNaN(weekNum)) {
          const startDay = (weekNum - 1) * 7 + 1;
          const endDay = weekNum * 7;
          if (item.day < startDay || item.day > endDay) return false;
        }
      }

      // Pillar filter
      if (pillarFilter !== 'all' && item.pillar.toLowerCase() !== pillarFilter.toLowerCase()) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDay = item.dayLabel.toLowerCase().includes(q) || `day ${item.day}`.toLowerCase().includes(q);
        const matchesTopic = item.postTopic.toLowerCase().includes(q);
        const matchesHook = item.hook.toLowerCase().includes(q);
        const matchesCaption = item.captionAndCta.toLowerCase().includes(q);
        const matchesTags = item.seoKeywordsAndTags.toLowerCase().includes(q);
        if (!matchesDay && !matchesTopic && !matchesHook && !matchesCaption && !matchesTags) return false;
      }

      return true;
    });
  }, [strategyResult, weekFilter, pillarFilter, searchQuery]);

  // Live tally of actual format counts in current calendar
  const actualFormatCounts = useMemo(() => {
    if (!strategyResult?.calendar) return { reels: 0, carousels: 0, videos: 0, singlePosts: 0, stories: 0, total: 0 };
    let reels = 0;
    let carousels = 0;
    let videos = 0;
    let singlePosts = 0;
    strategyResult.calendar.forEach(c => {
      const fmt = (c.visualFormat || '').toLowerCase();
      if (fmt.includes('carousel')) carousels++;
      else if (fmt.includes('video')) videos++;
      else if (fmt.includes('single') || fmt.includes('photo') || fmt.includes('image')) singlePosts++;
      else reels++;
    });
    return {
      reels,
      carousels,
      videos,
      singlePosts,
      stories: profile?.formatMix?.stories ?? 30,
      total: strategyResult.calendar.length,
    };
  }, [strategyResult?.calendar, profile?.formatMix?.stories]);

  // Precompute day counts for multi-post day grouping in table
  const dayGroupMap = useMemo(() => {
    const map: Record<number, number> = {};
    filteredCalendar.forEach(item => {
      map[item.day] = (map[item.day] || 0) + 1;
    });
    return map;
  }, [filteredCalendar]);

  // Open Edit Modal with exact item & index
  const handleStartEdit = (item: GrowthCalendarItem, explicitIndex?: number) => {
    const idx = explicitIndex !== undefined && explicitIndex >= 0
      ? explicitIndex
      : (strategyResult?.calendar.indexOf(item) ?? null);
    setEditingItem({ ...item });
    setEditingIndex(idx);
  };

  // Save edited calendar item
  const handleSaveEditedPost = (updatedItem: GrowthCalendarItem) => {
    if (!strategyResult) return;
    const updatedCalendar = strategyResult.calendar.map((item, idx) =>
      idx === editingIndex || (editingIndex === null && item.day === updatedItem.day)
        ? updatedItem
        : item
    );
    const updatedPlan: FullGrowthStrategyResult = {
      ...strategyResult,
      calendar: updatedCalendar,
    };
    setStrategyResult(updatedPlan);
    localStorage.setItem(strategyKey, JSON.stringify(updatedPlan));
    setEditingItem(null);
    setEditingIndex(null);
    addActivity(`Saved updates for ${updatedItem.dayLabel}: "${updatedItem.postTopic}"!`, 'success');
  };

  // Delete post slot
  const handleDeletePost = (indexToDelete: number) => {
    if (!strategyResult) return;
    const target = strategyResult.calendar[indexToDelete];
    const updatedCalendar = strategyResult.calendar.filter((_, idx) => idx !== indexToDelete);
    const updatedPlan: FullGrowthStrategyResult = {
      ...strategyResult,
      calendar: updatedCalendar,
    };
    setStrategyResult(updatedPlan);
    localStorage.setItem(strategyKey, JSON.stringify(updatedPlan));
    setEditingItem(null);
    setEditingIndex(null);
    addActivity(`Removed ${target ? target.dayLabel : 'post'} from calendar`, 'info');
  };

  // Add new post or custom day slot
  const handleAddNewPostSlot = () => {
    if (!strategyResult) return;
    const count = strategyResult.calendar.length;
    const lastDay = count > 0 ? strategyResult.calendar[count - 1].day : 1;
    const nextSlotLabel = `Day ${lastDay} (Slot 2)`;
    const newItem: GrowthCalendarItem = {
      day: lastDay,
      dayLabel: nextSlotLabel,
      timeSlot: `20:30 ${profileTimezone.standardCode}`,
      status: 'Planned',
      pillar: 'Discovery',
      visualFormat: 'Fast-Paced Reel (7s)',
      postTopic: 'High-Impact Niche Reel',
      hook: 'Stop scrolling if you want to scale on Instagram...',
      captionAndCta: 'Double tap if this resonated! Drop a comment with your thoughts 💬👇',
      seoKeywordsAndTags: '#growth #creators #instagramtips',
      link: '',
      imageUrl: '',
    };
    const updatedCalendar = [...strategyResult.calendar, newItem];
    const updatedPlan: FullGrowthStrategyResult = {
      ...strategyResult,
      calendar: updatedCalendar,
    };
    setStrategyResult(updatedPlan);
    localStorage.setItem(strategyKey, JSON.stringify(updatedPlan));
    handleStartEdit(newItem, updatedCalendar.length - 1);
    addActivity(`Added flexible post slot (${nextSlotLabel})!`, 'success');
  };

  // Copy prompt to clipboard
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(GROWTH_STRATEGIST_SYSTEM_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
    addActivity('Growth Strategist System Prompt copied to clipboard!', 'info');
  };

  // Copy Markdown Table
  const handleCopyMarkdown = () => {
    const calendarToExport = filteredCalendar.length > 0 ? filteredCalendar : (strategyResult?.calendar || []);
    if (calendarToExport.length === 0) return;
    const md = exportCalendarToMarkdown(calendarToExport, profile?.subNiche);
    navigator.clipboard.writeText(md);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2500);
    addActivity(`Copied ${calendarToExport.length} posts as Markdown table!`, 'info');
  };

  // Download CSV
  const handleDownloadCsv = () => {
    const calendarToExport = filteredCalendar.length > 0 ? filteredCalendar : (strategyResult?.calendar || []);
    if (calendarToExport.length === 0) return;
    const csv = exportCalendarToCsv(calendarToExport, profile?.subNiche);
    // Add UTF-8 BOM (\uFEFF) so Excel and Google Sheets open with full emoji and UTF-8 formatting support
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const subNicheTag = (profile?.subNiche || 'growth').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);
    const count = calendarToExport.length;
    a.download = `instagram-${count}posts-${subNicheTag}-calendar-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addActivity(`Exported ${calendarToExport.length} calendar posts to CSV!`, 'success');
  };

  // Distribute uploaded/pasted media assets across calendar slots
  const handleDistributeMediaSubmit = () => {
    if (!strategyResult?.calendar || !rawMediaUrlsInput.trim()) return;
    const urls = rawMediaUrlsInput.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) return;

    const updatedCalendar = distributeMediaAcrossCalendar(
      strategyResult.calendar,
      urls,
      profileTimezone.standardCode
    );

    const updatedPlan: FullGrowthStrategyResult = {
      ...strategyResult,
      calendar: updatedCalendar,
    };
    setStrategyResult(updatedPlan);
    localStorage.setItem(strategyKey, JSON.stringify(updatedPlan));
    setIsMediaDistributeModalOpen(false);
    setRawMediaUrlsInput('');
    addActivity(`Successfully distributed ${urls.length} media assets across ${updatedCalendar.length} calendar slots (increased posts per day on high-traffic days)!`, 'success');
  };

  // Competitor Auto-Calibration from Business Discovery
  const selectedCompetitor = useMemo(() => {
    return competitorsList.find(c => c.username.toLowerCase() === selectedCompetitorUsername.toLowerCase()) || competitorsList[0] || null;
  }, [competitorsList, selectedCompetitorUsername]);

  const handleAutoCalibrateWithCompetitor = () => {
    if (!strategyResult?.calendar || !selectedCompetitor) {
      addActivity('Please search for a competitor in Business Discovery first to calibrate.', 'info');
      return;
    }

    const updatedCalendar = autoCalibrateCalendarWithCompetitor(
      strategyResult.calendar,
      selectedCompetitor,
      profileTimezone.standardCode
    );

    const updatedPlan: FullGrowthStrategyResult = {
      ...strategyResult,
      calendar: updatedCalendar,
    };
    setStrategyResult(updatedPlan);
    localStorage.setItem(strategyKey, JSON.stringify(updatedPlan));
    addActivity(`Calendar auto-improved with @${selectedCompetitor.username}'s winning formats, peak hours, and hashtags!`, 'success');
  };

  // Helper for pillar badge color (supports dynamic niche pillars and legacy pillars)
  const getPillarBadgeColor = (pillar: string): string => {
    const p = (pillar || '').toLowerCase();
    if (p.includes('guide') || p.includes('step') || p.includes('psychology')) return 'bg-purple-100 text-purple-900 border-purple-400';
    if (p.includes('ux') || p.includes('website') || p.includes('tech') || p.includes('web')) return 'bg-blue-100 text-blue-900 border-blue-400';
    if (p.includes('proof') || p.includes('case') || p.includes('result') || p.includes('ai')) return 'bg-emerald-100 text-emerald-900 border-emerald-400';
    if (p.includes('contrarian') || p.includes('mistake') || p.includes('myth')) return 'bg-amber-100 text-amber-900 border-amber-400';
    if (p.includes('interactive') || p.includes('audit') || p.includes('poll') || p.includes('q&a')) return 'bg-pinkPop text-slateDark border-slateDark';
    if (p.includes('reality') || p.includes('pov') || p.includes('meme')) return 'bg-yellowPop text-slateDark border-slateDark';
    if (p.includes('authority') || p.includes('systems') || p.includes('strategy')) return 'bg-indigo-100 text-indigo-900 border-indigo-400';
    if (p.includes('brand') || p.includes('design')) return 'bg-violetBrand text-white border-slateDark';
    return 'bg-yellowPop text-slateDark border-slateDark';
  };

  // Auto-setup & re-distribute calendar to match Target Content Mix across calendar days
  const handleApplyTargetMix = () => {
    if (!strategyResult?.calendar) return;
    const targetDays = profile?.calendarDays || 30;
    const updatedCal = recalculateCalendarWithTargetMix(
      strategyResult.calendar,
      targetMix,
      targetDays,
      profileTimezone.standardCode,
      profile?.competitorHandles || [],
      profile?.subNiche || 'Growth Strategy'
    );
    const updatedPlan: FullGrowthStrategyResult = {
      ...strategyResult,
      targetDays,
      targetMix,
      calendar: updatedCal,
    };
    setStrategyResult(updatedPlan);
    localStorage.setItem(strategyKey, JSON.stringify(updatedPlan));
    addActivity(`Auto-setup calendar: ${updatedCal.length} total post slots across ${targetDays} days matching your target mix!`, 'success');
  };

  // Save current active calendar to history collection & Supabase cloud database
  const handleSaveCurrentCalendar = () => {
    if (!strategyResult?.calendar || strategyResult.calendar.length === 0) {
      addActivity('No active calendar to save yet. Generate a strategy first!', 'info');
      return;
    }
    const currentNiche = profile?.subNiche || strategyResult.subNiche || 'Custom Niche';
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

    const newEntry: SavedCalendarEntry = {
      id: uuid,
      savedAt: new Date().toISOString(),
      title: `${currentNiche} Plan`,
      subNiche: currentNiche,
      calendarDays: strategyResult.calendar.length,
      totalPosts: strategyResult.calendar.length,
      plan: strategyResult,
    };
    const updated = [newEntry, ...savedCalendars.filter(c => c.id !== newEntry.id)];
    setSavedCalendars(updated);
    localStorage.setItem(calendarsKey, JSON.stringify(updated));

    // Save directly to Supabase cloud database
    if (userId && userId !== 'default') {
      upsertSupabaseSavedCalendar(userId, newEntry).catch(console.warn);
    }

    addActivity(`Saved calendar to cloud database & history: "${newEntry.title}" (${newEntry.totalPosts} posts)!`, 'success');
  };

  // Load a previously saved calendar from history
  const handleLoadSavedCalendar = (entry: SavedCalendarEntry) => {
    setStrategyResult(entry.plan);
    localStorage.setItem(strategyKey, JSON.stringify(entry.plan));
    setIsSavedCalendarsModalOpen(false);
    addActivity(`Loaded saved calendar: "${entry.title}" (${entry.totalPosts} posts)!`, 'success');
  };

  // Delete a saved calendar from history & Supabase cloud database
  const handleDeleteSavedCalendar = (id: string, title: string) => {
    const updated = savedCalendars.filter(c => c.id !== id);
    setSavedCalendars(updated);
    localStorage.setItem(calendarsKey, JSON.stringify(updated));

    if (userId && userId !== 'default') {
      deleteSupabaseSavedCalendar(userId, id).catch(console.warn);
    }

    addActivity(`Removed "${title}" from saved calendars database.`, 'info');
  };

  // Send a calendar entry to Publisher Queue with all 18 fields
  const handlePushToPublisher = (item: GrowthCalendarItem) => {
    const isReel = item.visualFormat.toLowerCase().includes('reel');
    const isCarousel = item.visualFormat.toLowerCase().includes('carousel') || Boolean(item.carouselMedia);
    saveScheduledPost({
      mediaType: isCarousel ? 'CAROUSEL' : isReel ? 'REELS' : 'IMAGE',
      mediaUrl: item.imageUrl || '',
      caption: `${item.captionAndCta}\n\n${item.seoKeywordsAndTags}`,
      scheduledTime: item.scheduledAt || new Date(Date.now() + 86400000 * item.day).toISOString().slice(0, 16),
      contentPillar: item.pillar,
      postTopic: item.postTopic,
      visualType: item.visualFormat,
      status: 'QUEUED',
      dateStr: item.dateStr,
      dayOfWeek: item.dayOfWeek,
      timeStr: item.timeStr,
      platform: item.platform || 'Instagram',
      carouselMedia: item.carouselMedia,
      coverUrl: item.coverUrl,
      hashtags: item.seoKeywordsAndTags,
      locationName: item.locationName,
      altText: item.altText,
      song: item.song,
      tag: item.tag,
    }, userId);

    setScheduledDayId(item.day);
    setTimeout(() => setScheduledDayId(null), 3000);
    addActivity(`Queued ${item.dayLabel} ("${item.postTopic}") into Publisher Queue with all metadata!`, 'success');

    if (onNavigate) {
      setTimeout(() => onNavigate('publisher'), 800);
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 pb-12 overflow-x-hidden">
      {/* Top Banner / Header Card */}
      <div className="bg-white border-3 sm:border-4 border-slateDark rounded-3xl p-5 shadow-pop space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pinkPop text-slateDark border-2 border-slateDark flex items-center justify-center shadow-pop-sm flex-shrink-0">
              <Rocket size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-heading font-black text-slateDark text-lg sm:text-xl md:text-2xl tracking-tight leading-tight">
                  AI Instagram Growth Automation & Strategy Engine
                </h2>
                {strategyResult?.isAiGenerated ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-heading font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                    <Sparkles size={11} className="text-emerald-600" />
                    <span>Live LLM Active ({strategyResult.aiProvider})</span>
                  </span>
                ) : strategyResult ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-heading font-bold text-slate-600 bg-slate-100 border border-slate-300 shadow-xs">
                    <Zap size={11} className="text-amber-500" />
                    <span>Algorithmic Baseline (Click to Run LLM)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-heading font-bold text-slate-500 bg-slate-100 border border-slate-300 shadow-xs">
                    <Zap size={11} className="text-slate-400" />
                    <span>Zero Data / Fresh Account</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Multi-tab intelligence: Diagnosis, Content Pillars, Execution Calendar, and Action Sprints.
              </p>
            </div>
          </div>

          <CandyButton
            variant="yellow"
            size="sm"
            icon={Sparkles}
            onClick={handleGenerateStrategy}
            disabled={isGenerating}
          >
            {isGenerating ? 'AI Generating Plan...' : '⚡ Run Full AI Strategy (LLM)'}
          </CandyButton>
        </div>

        {isGenerating && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-violet-100 via-pink-100 to-yellow-100 border-2 border-slateDark flex items-center gap-3 animate-pulse">
            <RefreshCw size={16} className="animate-spin text-violetBrand shrink-0" />
            <div className="text-xs font-heading font-black text-slateDark">
              Generating 30-day growth strategy & execution plan...
            </div>
          </div>
        )}

        {/* Responsive Tabs with No Numbering */}
        <div className="pt-3 border-t-2 border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none w-full">
          <button
            onClick={() => setActiveSubTab('diagnosis')}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-heading font-black border-2 transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'diagnosis'
                ? 'bg-yellowPop text-slateDark border-slateDark shadow-pop-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slateDark hover:bg-slate-50'
            }`}
          >
            <Target size={14} />
            <span>Bottlenecks & Solutions</span>
          </button>

          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-heading font-black border-2 transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'calendar'
                ? 'bg-pinkPop text-slateDark border-slateDark shadow-pop-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slateDark hover:bg-slate-50'
            }`}
          >
            <Calendar size={14} />
            <span>Calendar ({filteredCalendar.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('actions')}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-heading font-black border-2 transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'actions'
                ? 'bg-mintPop text-slateDark border-slateDark shadow-pop-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slateDark hover:bg-slate-50'
            }`}
          >
            <CheckSquare size={14} />
            <span>Immediate Actions & Sprints</span>
          </button>
        </div>
      </div>

      {/* ZERO DATA / FRESH ACCOUNT STATE */}
      {!strategyResult && (
        <div className="w-full bg-white p-8 sm:p-12 rounded-3xl border-3 border-slateDark shadow-pop text-center space-y-4 my-4">
          <div className="w-16 h-16 rounded-2xl bg-yellowPop border-2 border-slateDark flex items-center justify-center mx-auto shadow-pop-sm">
            <Sparkles size={32} className="text-slateDark" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="font-heading font-black text-slateDark text-xl">
              {isAccountConnected ? 'No Growth Strategy Generated Yet' : 'No Account Data Connected Yet'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isAccountConnected
                ? `Account @${user?.username} is ready! Click "Run Full AI Strategy" to analyze your real account metrics and generate your custom 30-day calendar.`
                : 'Each new account starts fresh with zero data. Connect your Meta Instagram Graph API in the Plugins section, or click "Run Full AI Strategy" to create your roadmap.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {!isAccountConnected && onNavigate && (
              <CandyButton
                variant="secondary"
                size="sm"
                onClick={() => onNavigate('plugins')}
                icon={Rocket}
              >
                Setup Plugins & API
              </CandyButton>
            )}
            <CandyButton
              variant="yellow"
              size="sm"
              onClick={handleGenerateStrategy}
              disabled={isGenerating}
              icon={Sparkles}
            >
              {isGenerating ? 'AI Generating Plan...' : 'Run Full AI Strategy (LLM)'}
            </CandyButton>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BOTTLENECKS & SOLUTIONS                                            */}
      {/* ========================================================================= */}
      {activeSubTab === 'diagnosis' && strategyResult && (
        <div className="w-full space-y-6">
          {/* Growth Score & Rubric Dimensions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full">
            {/* Scorecard Dial */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 text-xs font-black uppercase tracking-wider bg-yellowPop border border-slateDark rounded-full">
                    Account Growth Score
                  </span>
                  <span className="text-xs font-bold text-slate-500">Benchmark /100</span>
                </div>

                <div className="flex items-baseline gap-2 my-2">
                  <span className="text-5xl sm:text-6xl font-heading font-black text-slateDark">
                    {strategyResult.growthScore.total}
                  </span>
                  <span className="text-xl font-heading font-bold text-slate-400">/ 100</span>
                </div>

                <p className="text-xs font-semibold text-slate-600 mt-2 leading-relaxed">
                  Evaluated on 5 Meta Algorithm signals: sends-per-reach, retention rate, discovery ratio, bio conversion, and publishing cadence.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t-2 border-slate-100 flex items-center justify-between text-xs">
                <span className="font-black uppercase text-slateDark flex items-center gap-1">
                  <TrendingUp size={14} className="text-emerald-600" />
                  Velocity: Scaling
                </span>
                <span className="text-slate-500 font-bold">
                  Target: 85+
                </span>
              </div>
            </div>

            {/* Score Rubric Bars */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop lg:col-span-2 flex flex-col justify-between">
              <h4 className="font-heading font-black text-slateDark text-base mb-3 flex items-center gap-2">
                <Target size={18} className="text-violetBrand" />
                Growth Dimension Breakdown
              </h4>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">1. Content Quality & 3s Hook Retention</span>
                    <span className="text-slateDark font-mono">{strategyResult.growthScore.contentQuality}/25</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full border border-slateDark overflow-hidden">
                    <div
                      className="h-full bg-yellowPop"
                      style={{ width: `${(strategyResult.growthScore.contentQuality / 25) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">2. Engagement & Virality Ratio (Sends/DMs)</span>
                    <span className="text-slateDark font-mono">{strategyResult.growthScore.engagement}/25</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full border border-slateDark overflow-hidden">
                    <div
                      className="h-full bg-mintPop"
                      style={{ width: `${(strategyResult.growthScore.engagement / 25) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">3. Reach & Discovery Engine (Non-Followers)</span>
                    <span className="text-slateDark font-mono">{strategyResult.growthScore.reach}/20</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full border border-slateDark overflow-hidden">
                    <div
                      className="h-full bg-pinkPop"
                      style={{ width: `${(strategyResult.growthScore.reach / 20) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">4. Profile & Funnel Architecture</span>
                    <span className="text-slateDark font-mono">{strategyResult.growthScore.profile}/15</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full border border-slateDark overflow-hidden">
                    <div
                      className="h-full bg-violetBrand"
                      style={{ width: `${(strategyResult.growthScore.profile / 15) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">5. Publishing Consistency & Velocity</span>
                    <span className="text-slateDark font-mono">{strategyResult.growthScore.consistency}/15</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full border border-slateDark overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${(strategyResult.growthScore.consistency / 15) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Niche Optimal Posting Windows Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border-3 border-slateDark shadow-pop flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellowPop text-slateDark border-2 border-slateDark flex items-center justify-center font-heading font-black shadow-pop-sm flex-shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm text-slateDark">
                  Crawled Niche Peak Activity Windows
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Derived from niche follower online traffic and engagement velocity:
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {nichePeakTimes.map((item, idx) => (
                <div key={idx} className="px-3 py-1.5 rounded-xl border border-slateDark bg-slate-50 flex items-center gap-2 text-xs font-heading font-bold text-slateDark shadow-pop-sm">
                  <span>{item.day}:</span>
                  <span className="font-mono text-violetBrand">{item.timeSlot}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-mintPop text-[10px] font-black">
                    {item.audienceActivityPct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Side-by-Side: Bottlenecks vs High-Impact Solutions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
            {/* Identified Bottlenecks */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3 text-red-600">
                  <AlertTriangle size={20} />
                  <h4 className="font-heading font-black text-slateDark text-lg">Identified Bottlenecks & Weaknesses</h4>
                </div>
                <p className="text-xs text-slate-500 font-semibold mb-4">
                  These algorithmic speed bumps restrict your account from entering wide Reels and Explore distribution:
                </p>

                <div className="space-y-3">
                  {strategyResult.growthScore.bottlenecks.map((bottleneck, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl border-2 border-slateDark bg-red-50/70 flex items-start gap-3 shadow-pop-sm"
                    >
                      <span className="w-6 h-6 rounded-xl bg-red-200 text-red-800 border border-slateDark flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                        ✕
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slateDark leading-relaxed">{bottleneck}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t-2 border-slate-100 text-[11px] font-bold text-slate-500">
                💡 Root cause fix: Shift from generic aesthetic posts to problem-agitate reels with comment DM lead magnets.
              </div>
            </div>

            {/* High-Impact Solutions & Levers */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3 text-orange-500">
                  <Flame size={20} />
                  <h4 className="font-heading font-black text-slateDark text-lg">Top 5 High-Impact Levers & Solutions</h4>
                </div>
                <p className="text-xs text-slate-500 font-semibold mb-4">
                  Ranked by ROI: Highest organic reach per minute of creation effort:
                </p>

                <div className="space-y-3">
                  {strategyResult.highImpactLevers.map((lever, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl border-2 border-slateDark bg-slate-50 flex items-start gap-3 shadow-pop-sm"
                    >
                      <span className="w-6 h-6 rounded-xl bg-yellowPop text-slateDark border border-slateDark flex items-center justify-center font-heading font-black text-xs flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-xs font-semibold text-slateDark leading-relaxed">{lever}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t-2 border-slate-100 text-[11px] font-bold text-slate-500">
                🚀 Execution rule: Combine Lever #1 (Sends) with Lever #4 (Auto DM trigger) on every Day 1–7 post.
              </div>
            </div>
          </div>

          {/* Competitor Benchmarks & 4 Pillars Architecture */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
            {/* Competitor Insights */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop">
              <div className="flex items-center gap-2 mb-3">
                <Search size={20} className="text-violetBrand" />
                <h4 className="font-heading font-black text-slateDark text-lg">Competitor Benchmarks & Hook Patterns</h4>
              </div>
              <p className="text-xs text-slate-500 font-semibold mb-4">
                Observations reverse-engineered from top-performing creators in your niche:
              </p>
              <div className="space-y-3">
                {strategyResult.competitorInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border-2 border-slateDark bg-slate-50 flex items-start gap-3 shadow-pop-sm"
                  >
                    <span className="w-6 h-6 rounded-xl bg-mintPop text-slateDark border border-slateDark flex items-center justify-center font-heading font-black text-xs flex-shrink-0 mt-0.5">
                      ✓
                    </span>
                    <p className="text-xs font-semibold text-slateDark leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 Content Pillars */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Compass size={20} className="text-pinkPop" />
                  <h4 className="font-heading font-black text-slateDark text-lg">4 Core Content Pillars Architecture</h4>
                </div>
                <p className="text-xs text-slate-500 font-semibold mb-4">
                  Balanced funnel across discovery, authority, community retention, and conversion:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {strategyResult.contentPillars.map((p, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl border-2 border-slateDark bg-white shadow-pop-sm flex flex-col justify-between">
                      <div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-heading font-black border border-slateDark inline-block ${p.color}`}>
                          {p.name}
                        </span>
                        <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">{p.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 30-DAY CALENDAR                                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'calendar' && strategyResult && (
        <div className="w-full space-y-4">
          <div className="bg-white p-4 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop space-y-4">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b-2 border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Calendar size={20} className="text-pinkPop" />
                  <h3 className="font-heading font-black text-slateDark text-xl">
                    {profile?.calendarDays || 30}-Day Execution Calendar
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-heading font-black bg-yellowPop text-slateDark border border-slateDark">
                    {filteredCalendar.length} Posts • {profile?.calendarDays || 30} Days
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Click <strong className="text-slateDark">Edit</strong> on any post to adjust hook, caption, image, or timing.
                </p>
              </div>

              {/* Export Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSaveCurrentCalendar}
                  className="px-3 py-1.5 rounded-xl border-2 border-slateDark bg-yellowPop hover:bg-yellow-300 text-xs font-heading font-black text-slateDark shadow-pop-sm flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
                  title="Save this generated calendar into your personal history for memorization and future access"
                >
                  <Save size={13} className="text-slateDark" />
                  <span>💾 Save Calendar</span>
                </button>
                <button
                  onClick={() => setIsSavedCalendarsModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-50 text-xs font-heading font-black text-slateDark shadow-pop-sm flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
                  title="View cards of previously saved calendars and load or delete them"
                >
                  <Folder size={13} className="text-violetBrand" />
                  <span>📁 Saved Calendars ({savedCalendars.length})</span>
                </button>
                <button
                  onClick={handleCopyMarkdown}
                  className="px-3 py-1.5 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-50 text-xs font-heading font-bold text-slateDark shadow-pop-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Copy size={13} />
                  <span>{copiedTable ? 'Copied MD!' : 'Copy Table'}</span>
                </button>
                <button
                  onClick={handleDownloadCsv}
                  className="px-3 py-1.5 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-50 text-xs font-heading font-bold text-slateDark shadow-pop-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Target Content Mix Alignment Banner */}
            <div className="bg-gradient-to-r from-violet-50 to-pink-50 p-3.5 sm:p-4 rounded-2xl border-2 border-slateDark flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-pop-sm">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-heading font-black text-xs text-slateDark tracking-wide uppercase">
                    Target Content Mix Alignment ({profile?.calendarDays || 30}-Day Planning Horizon)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
                  <span className="px-2.5 py-1 rounded-xl bg-pink-100 border border-pink-300 font-heading font-bold text-pink-900 shadow-xs">
                    🎬 Reels: <strong className="font-mono">{actualFormatCounts.reels}</strong> / {targetMix.reels}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-yellow-100 border border-yellow-300 font-heading font-bold text-yellow-900 shadow-xs">
                    🎠 Carousels: <strong className="font-mono">{actualFormatCounts.carousels}</strong> / {targetMix.carousels}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-blue-100 border border-blue-300 font-heading font-bold text-blue-900 shadow-xs">
                    🎥 Videos: <strong className="font-mono">{actualFormatCounts.videos}</strong> / {targetMix.videos}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-100 border border-emerald-300 font-heading font-bold text-emerald-900 shadow-xs">
                    📸 Singles: <strong className="font-mono">{actualFormatCounts.singlePosts}</strong> / {targetMix.singlePosts}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-purple-100 border border-purple-300 font-heading font-bold text-purple-900 shadow-xs">
                    📱 Stories: <strong className="font-mono">{targetMix.stories}</strong>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-stretch md:self-auto justify-end flex-wrap">
                <button
                  onClick={handleApplyTargetMix}
                  className="px-3 py-1.5 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-50 text-[11px] font-heading font-black text-slateDark shadow-pop-sm flex items-center gap-1.5 cursor-pointer active:translate-y-0.5"
                  title="Re-balance calendar slots to strictly match Target Content Mix"
                >
                  <RefreshCw size={12} className="text-violetBrand" />
                  <span>Re-Sync Mix</span>
                </button>
                {onOpenStrategyModal && (
                  <button
                    onClick={onOpenStrategyModal}
                    className="px-3 py-1.5 rounded-xl border-2 border-slateDark bg-violetBrand text-white hover:bg-violet-600 text-[11px] font-heading font-black shadow-pop-sm flex items-center gap-1.5 cursor-pointer active:translate-y-0.5"
                  >
                    <SlidersHorizontal size={12} />
                    <span>Edit Strategy Form</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Week filter pills */}
              {(() => {
                const actualDays = profile?.calendarDays || (strategyResult?.calendar ? Math.max(...strategyResult.calendar.map(c => c.day), 7) : 7);
                const numWeeks = Math.max(1, Math.ceil(actualDays / 7));
                return (
                  <div className="flex items-center p-1 bg-slate-100 border-2 border-slateDark rounded-xl gap-1 overflow-x-auto scrollbar-none">
                    <button
                      onClick={() => setWeekFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-heading font-black whitespace-nowrap transition-all cursor-pointer ${
                        weekFilter === 'all' ? 'bg-yellowPop text-slateDark border border-slateDark' : 'text-slate-600 hover:text-slateDark'
                      }`}
                    >
                      All ({actualDays} Days)
                    </button>
                    {Array.from({ length: numWeeks }).map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setWeekFilter(`w${i + 1}` as any)}
                        className={`px-3 py-1 rounded-lg text-xs font-heading font-black whitespace-nowrap transition-all cursor-pointer ${
                          weekFilter === `w${i + 1}` ? 'bg-yellowPop text-slateDark border border-slateDark' : 'text-slate-600 hover:text-slateDark'
                        }`}
                      >
                        Week {i + 1}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Dynamic Niche Pillar Filter */}
              {(() => {
                const dynamicPillars = Array.from(new Set([
                  ...(strategyResult?.contentPillars?.map(p => p.name) || []),
                  ...(strategyResult?.calendar?.map(c => c.pillar).filter(Boolean) || []),
                  ...(profile?.subNiche ? [`${profile.subNiche} Guides`, `${profile.subNiche} Case Studies`] : [])
                ]));
                return (
                  <select
                    value={pillarFilter}
                    onChange={e => setPillarFilter(e.target.value)}
                    className="p-1.5 px-3 rounded-xl border-2 border-slateDark bg-white text-xs font-heading font-bold text-slateDark shadow-pop-sm focus:outline-none max-w-[240px]"
                  >
                    <option value="all">All Content Pillars</option>
                    {dynamicPillars.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                );
              })()}

              {/* Search */}
              <div className="flex-1 min-w-[160px] relative">
                <input
                  type="text"
                  placeholder="Search date, day, topic, pillar, competitor..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full py-1.5 px-3 pr-8 rounded-xl border-2 border-slateDark bg-white text-xs font-bold text-slateDark shadow-pop-sm focus:outline-none"
                />
                <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* DETAILED SPREADSHEET TABLE VIEW (Exact Field Ordering: Date, Day, Time, Platform, Status, Content Pillar, Post Topic, Visual Type, Media URL, Cover URL, Caption, Discovery Competitor, Actions) */}
            <div className="overflow-x-auto rounded-2xl border-2 border-slateDark">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slateDark font-heading font-black text-slateDark uppercase text-[11px]">
                    <th className="p-3 min-w-[100px] text-center">Date</th>
                    <th className="p-3 min-w-[95px]">Day</th>
                    <th className="p-3 min-w-[85px]">Time</th>
                    <th className="p-3 min-w-[85px]">Platform</th>
                    <th className="p-3 min-w-[80px]">Status</th>
                    <th className="p-3 min-w-[130px]">Content Pillar</th>
                    <th className="p-3 min-w-[220px]">Post Topic & Production Idea</th>
                    <th className="p-3 min-w-[95px]">Visual Type</th>
                    <th className="p-3 min-w-[100px] text-center">Media URL</th>
                    <th className="p-3 min-w-[100px]">Cover URL</th>
                    <th className="p-3 min-w-[240px]">Caption</th>
                    <th className="p-3 w-28 text-center bg-slate-100 border-l border-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCalendar.map((item, idx) => {
                    const fullIndex = strategyResult?.calendar.indexOf(item) ?? idx;
                    const isScheduled = scheduledDayId === item.day;
                    const pillarColor = getPillarBadgeColor(item.pillar);

                    const isFirstSlotOfDay = idx === 0 || filteredCalendar[idx - 1].day !== item.day;
                    const dayRowSpan = isFirstSlotOfDay ? (dayGroupMap[item.day] || 1) : 0;

                    return (
                      <tr key={`${item.day}_${item.dayLabel}_${idx}`} className="hover:bg-slate-50 transition-colors group">
                        {/* 1. Date (Grouped once for multi-post day) */}
                        {isFirstSlotOfDay && (
                          <td
                            rowSpan={dayRowSpan}
                            className="p-3 text-center align-top bg-white border-r border-slate-200"
                          >
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item, fullIndex)}
                              className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-yellowPop/40 border border-slateDark text-xs font-mono font-bold text-slateDark cursor-pointer whitespace-nowrap shadow-xs"
                              title="Click to edit post"
                            >
                              {item.dateStr || new Date(Date.now() + 86400000 * item.day).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </button>
                          </td>
                        )}

                        {/* 2. Day (Weekday Name, e.g. Monday, Tuesday, Sunday) */}
                        {isFirstSlotOfDay && (
                          <td
                            rowSpan={dayRowSpan}
                            className="p-3 font-semibold text-slate-700 whitespace-nowrap align-top bg-white border-r border-slate-200"
                          >
                            <div className="font-heading font-black text-xs text-slateDark">
                              {item.dayOfWeek || new Date(Date.now() + 86400000 * item.day).toLocaleDateString('en-US', { weekday: 'long' })}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">Day {item.day}</div>
                            {dayRowSpan > 1 && (
                              <span className="inline-block text-[10px] font-bold text-violet-700 bg-violet-50 rounded px-1.5 py-0.5 mt-1 border border-violet-200">
                                {dayRowSpan} Posts
                              </span>
                            )}
                          </td>
                        )}

                        {/* 3. Time */}
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                          {item.timeStr || item.timeSlot}
                        </td>

                        {/* 4. Platform */}
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 font-bold text-[10px] text-slate-700">
                            {item.platform || 'Instagram'}
                          </span>
                        </td>

                        {/* 5. Status */}
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-heading font-black border border-slateDark ${
                            isScheduled || item.status === 'Scheduled' ? 'bg-emerald-300 text-slateDark' : 'bg-yellowPop text-slateDark'
                          }`}>
                            {isScheduled ? 'Queued' : (item.status || 'Planned')}
                          </span>
                        </td>

                        {/* 6. Content Pillar */}
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-heading font-black border whitespace-nowrap ${pillarColor}`}>
                            {item.pillar}
                          </span>
                        </td>

                        {/* 7. Post Topic & Production Blueprint */}
                        <td className="p-3 font-bold text-slateDark min-w-[220px]">
                          <div className="space-y-1.5">
                            <div className="line-clamp-2 max-w-[210px] text-xs leading-snug" title={item.postTopic}>
                              {item.postTopic}
                            </div>
                            
                            {/* Rich Category & Duration Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-800 text-[10px] font-black border border-violet-200">
                                {item.ideaCategory || item.visualFormat}
                              </span>
                              {item.targetDuration && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-mono font-bold border border-amber-200">
                                  ⏱ {item.targetDuration}
                                </span>
                              )}
                            </div>

                            {/* Timeline scenes preview if available */}
                            {item.timelineScenes && (
                              <details className="text-[10px] text-slate-500 font-normal cursor-pointer group/details">
                                <summary className="font-heading font-bold text-violet-700 hover:text-violet-900 list-none flex items-center gap-1">
                                  <span>🎬 Production Blueprint</span>
                                </summary>
                                <div className="mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 whitespace-pre-line font-sans text-[10px] leading-tight space-y-1">
                                  <div><strong className="text-slateDark font-bold">Scenes:</strong>\n{item.timelineScenes}</div>
                                  {item.fullScript && (
                                    <div className="pt-1 border-t border-slate-200"><strong className="text-slateDark font-bold">Script:</strong>\n{item.fullScript}</div>
                                  )}
                                </div>
                              </details>
                            )}
                          </div>
                        </td>

                        {/* 8. Visual Type (Simple: Reel, Carousel, Video, Single Post) */}
                        <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-[10px] font-bold text-slateDark">
                            {item.visualFormat}
                          </span>
                        </td>

                        {/* 9. Media URL */}
                        <td className="p-3 text-center">
                          {item.imageUrl ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <img src={item.imageUrl} alt="preview" className="w-8 h-8 rounded-lg border border-slateDark object-cover" />
                              <a
                                href={item.imageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slateDark border border-slate-300 text-[10px]"
                                title="Open media in new tab"
                              >
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400 italic">None</span>
                          )}
                        </td>

                        {/* 10. Cover URL */}
                        <td className="p-3 text-xs text-slate-600 font-mono">
                          {item.coverUrl ? (
                            <a
                              href={item.coverUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate max-w-[100px] block hover:text-violetBrand hover:underline"
                              title={item.coverUrl}
                            >
                              {item.coverUrl}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* 11. Caption (Hook + SEO Keywords + CTA + #Tags) */}
                        <td className="p-3 text-slate-600 font-normal leading-relaxed min-w-[260px]">
                          {(() => {
                            const fullCaption = ensureCaptionHasHookSeoAndTags(
                              item.captionAndCta,
                              item.hook,
                              item.seoKeywordsAndTags,
                              profile?.subNiche
                            );
                            return (
                              <div className="space-y-1">
                                {item.hook && (
                                  <div
                                    className="text-[10px] font-bold text-violet-900 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 inline-flex items-center gap-1 max-w-[250px] truncate"
                                    title={`3-Second Hook: ${item.hook}`}
                                  >
                                    <span className="text-[9px] uppercase tracking-wider text-violet-600 font-black">🪝 Hook:</span>
                                    <span className="truncate">{item.hook}</span>
                                  </div>
                                )}
                                <div className="line-clamp-3 text-xs text-slate-700 font-normal leading-relaxed" title={fullCaption}>
                                  {fullCaption}
                                </div>
                                {item.seoKeywordsAndTags && (
                                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                    {item.seoKeywordsAndTags.split(/\s+/).filter(t => t.startsWith('#')).slice(0, 3).map((tag, tIdx) => (
                                      <span key={tIdx} className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center justify-between pt-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(fullCaption);
                                      addActivity(`Copied full Day ${item.day} caption to clipboard`, 'info');
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slateDark transition-colors cursor-pointer"
                                    title="Copy complete caption & #tags"
                                  >
                                    <Copy size={10} />
                                    <span>Copy</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* 12. Actions */}
                        <td className="p-3 text-center bg-white group-hover:bg-slate-50 border-l border-slate-200">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleStartEdit(item, fullIndex)}
                              className="p-1 px-1.5 rounded-lg border border-slateDark bg-white hover:bg-slate-100 text-slateDark text-[11px] font-bold shadow-xs flex items-center gap-0.5 cursor-pointer"
                              title="Edit Post"
                            >
                              <Edit3 size={11} />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => handlePushToPublisher(item)}
                              disabled={isScheduled}
                              className={`px-1.5 py-1 rounded-lg border border-slateDark text-[11px] font-heading font-bold shadow-xs transition-all flex items-center justify-center gap-0.5 cursor-pointer ${
                                isScheduled
                                  ? 'bg-emerald-400 text-slateDark'
                                  : 'bg-yellowPop hover:bg-yellow-300 text-slateDark'
                              }`}
                            >
                              <Send size={10} />
                              <span>{isScheduled ? 'Queued' : 'Schedule'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: IMMEDIATE ACTIONS & SPRINTS                                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'actions' && strategyResult && (
        <div className="w-full space-y-6">
          {/* Fresh Account In-App Setup Recommendations */}
          {(() => {
            const freshSettings = strategyResult.freshAccountSettings || getFreshAccountRecommendations(profile?.subNiche || strategyResult.subNiche || '');
            return (
              <div className="bg-white p-5 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Settings size={20} className="text-violetBrand" />
                    <h4 className="font-heading font-black text-slateDark text-lg">
                      Fresh Account Instagram In-App Settings Blueprint
                    </h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-black bg-amber-100 text-amber-900 border border-amber-300 self-start sm:self-auto">
                    Meta Algorithm Prerequisite
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold">
                  Before launching calendar content, configure these mandatory settings inside your native Instagram app to unlock full Graph API DM funnels and avoid 480p mobile compression:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {freshSettings.map((s, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border-2 border-slateDark bg-slate-50 space-y-2 shadow-pop-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-heading font-black text-xs text-slateDark flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          {s.settingName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                          {s.recommendedValue}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-violet-800 bg-violet-50 p-1.5 rounded-lg border border-violet-200">
                        📍 {s.inAppPath}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        {s.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* SEO Bio Blueprint Card */}
          {(() => {
            const bio = strategyResult.bioBlueprint || getBioBlueprint(profile?.subNiche || strategyResult.subNiche || '', profile?.targetAudience || '', strategyResult.accountUsername);
            const fullBioText = `${bio.nameLine}\n${bio.category}\n${bio.transformationHook}\n${bio.socialProof}\n${bio.callToAction}`;
            return (
              <div className="bg-white p-5 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={20} className="text-pinkPop" />
                    <h4 className="font-heading font-black text-slateDark text-lg">
                      Optimized Profile & Bio Blueprint (High-Converting Funnel)
                    </h4>
                  </div>
                  <CandyButton
                    variant="yellow"
                    size="sm"
                    icon={Copy}
                    onClick={() => {
                      navigator.clipboard.writeText(fullBioText);
                      setCopiedBio(true);
                      setTimeout(() => setCopiedBio(false), 2000);
                      addActivity('Copied complete Bio Blueprint to clipboard!', 'success');
                    }}
                  >
                    {copiedBio ? 'Copied Full Bio!' : 'Copy Bio Text'}
                  </CandyButton>
                </div>
                <p className="text-xs text-slate-500 font-semibold">
                  Tailored to rank top of Instagram Search for <strong>{profile?.subNiche || strategyResult.subNiche}</strong> and turn profile visits into DM leads:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="p-4 bg-cream border-2 border-slateDark rounded-2xl space-y-2 font-mono text-xs text-slateDark shadow-pop-sm">
                    <div className="text-[10px] font-heading font-black text-slate-400 uppercase">Live Bio Preview</div>
                    <div className="font-bold text-violetBrand">{bio.nameLine}</div>
                    <div className="text-slate-500 text-[11px]">{bio.category}</div>
                    <div>{bio.transformationHook}</div>
                    <div className="text-slate-600">{bio.socialProof}</div>
                    <div className="text-amber-800 font-semibold">{bio.callToAction}</div>
                  </div>

                  <div className="p-4 bg-slate-50 border-2 border-slateDark rounded-2xl space-y-2.5 text-xs text-slate-700 shadow-pop-sm">
                    <div className="text-[10px] font-heading font-black text-slate-400 uppercase">Conversion Breakdown</div>
                    <div><strong>Name Line:</strong> Weaves the primary search query keyword directly into your display name.</div>
                    <div><strong>Transformation Hook:</strong> Passes the 5-second clarity test for {profile?.targetAudience || 'your target audience'}.</div>
                    <div><strong>DM Call to Action:</strong> Triggers frictionless automated lead deliveries without losing traffic to external linktrees.</div>
                    <div className="p-2 bg-yellowPop/40 rounded-lg border border-slateDark/30 text-[11px] font-medium">
                      💡 <strong>Link in Bio Tip:</strong> {bio.linkInBioTip}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Next 5 Immediate Actions with Checkbox Completion Tracking */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                  <h4 className="font-heading font-black text-slateDark text-lg">
                    Next 5 Immediate Actions (Next 24–48 Hours)
                  </h4>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Execute these 5 steps first to prepare your account before releasing calendar posts:
                </p>
              </div>

              {/* Progress counter */}
              <span className="px-3 py-1 rounded-full text-xs font-heading font-black bg-mintPop text-slateDark border border-slateDark self-start sm:self-auto">
                {Object.values(completedActions).filter(Boolean).length} / {strategyResult.nextActions.length} Done
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {strategyResult.nextActions.map((action, idx) => {
                const isChecked = Boolean(completedActions[idx]);
                return (
                  <div
                    key={idx}
                    onClick={() => toggleActionCompleted(idx)}
                    className={`p-4 rounded-2xl border-2 border-slateDark flex items-start gap-3 shadow-pop-sm cursor-pointer transition-all ${
                      isChecked ? 'bg-emerald-50 border-emerald-600' : 'bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isChecked ? (
                        <CheckSquare size={18} className="text-emerald-600" />
                      ) : (
                        <Square size={18} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-[11px] font-heading font-black text-slate-400 uppercase tracking-wider block mb-0.5">
                        Action #{idx + 1}
                      </span>
                      <p className={`text-xs font-bold leading-snug ${isChecked ? 'line-through text-slate-500' : 'text-slateDark'}`}>
                        {action}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly Sprint Experiments */}
          {strategyResult.weeklySprints && strategyResult.weeklySprints.length > 0 && (
            <div className="bg-white p-5 sm:p-6 rounded-3xl border-3 border-slateDark shadow-pop space-y-4">
              <div className="flex items-center gap-2">
                <Rocket size={20} className="text-amber-600" />
                <h4 className="font-heading font-black text-slateDark text-lg">
                  Weekly Scientific Growth Experiments & Hypotheses
                </h4>
              </div>
              <p className="text-xs text-slate-500 font-semibold">
                Run one controlled content experiment per week to scientifically validate audience reach levers:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {strategyResult.weeklySprints.map((sprint, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border-2 border-slateDark bg-slate-50 space-y-2 shadow-pop-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-black text-xs text-slateDark">
                        {sprint.title}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-heading font-black bg-yellowPop text-slateDark border border-slateDark">
                        Week {sprint.week}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-violetBrand">{sprint.objective}</p>
                    <p className="text-xs text-slate-600"><strong className="text-slateDark">Hypothesis:</strong> {sprint.hypothesis}</p>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200">
                      <span className="font-medium text-slate-500"><strong>KPI:</strong> {sprint.kpi}</span>
                      <span className="font-medium text-emerald-700"><strong>Threshold:</strong> {sprint.threshold}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* EDIT CALENDAR POST MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slateDark/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white border-4 border-slateDark rounded-3xl shadow-pop p-4 sm:p-6 flex flex-col animate-in fade-in zoom-in duration-200 max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-slateDark">
              <div className="flex items-center gap-2">
                <Edit3 size={20} className="text-pinkPop" />
                <h3 className="font-heading font-black text-slateDark text-lg sm:text-xl">
                  Edit {editingItem.dayLabel} Post
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setEditingIndex(null);
                }}
                className="p-1.5 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-100 text-slateDark shadow-pop-sm transition-all cursor-pointer"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Modal Body Form */}
            <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1">
              {/* Flexible Date, Day & Schedule Setup Section */}
              <div className="p-3.5 bg-slate-50 border-2 border-slateDark rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-xs uppercase tracking-wider text-slateDark flex items-center gap-1.5">
                    <Calendar size={13} className="text-violetBrand" />
                    Date, Day & Timing Setup
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Exact date, weekday name, and status
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark block mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={editingItem.dateStr || ''}
                      onChange={e => {
                        const newDate = e.target.value;
                        const d = new Date(newDate + 'T00:00:00');
                        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        const dayOfWeek = !isNaN(d.getTime()) ? dayNames[d.getDay()] : editingItem.dayOfWeek;
                        setEditingItem({
                          ...editingItem,
                          dateStr: newDate,
                          dayOfWeek: dayOfWeek || editingItem.dayOfWeek,
                          dayLabel: editingItem.dayLabel.startsWith('Day ') ? editingItem.dayLabel : `${dayOfWeek?.slice(0, 3)} ${newDate.slice(5)}`,
                        });
                      }}
                      className="w-full p-2 rounded-xl border-2 border-slateDark bg-white text-xs font-mono font-bold text-slateDark shadow-pop-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark block mb-1">
                      Day (Weekday)
                    </label>
                    <select
                      value={editingItem.dayOfWeek || 'Monday'}
                      onChange={e => setEditingItem({ ...editingItem, dayOfWeek: e.target.value })}
                      className="w-full p-2 rounded-xl border-2 border-slateDark bg-white text-xs font-bold text-slateDark shadow-pop-sm focus:outline-none"
                    >
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <HardInput
                      label="Day Sequence (#)"
                      type="number"
                      value={editingItem.day}
                      onChange={e => setEditingItem({ ...editingItem, day: parseInt(e.target.value) || 1 })}
                      placeholder="1-30"
                    />
                  </div>

                  <div>
                    <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark block mb-1">
                      Status
                    </label>
                    <select
                      value={editingItem.status || 'Planned'}
                      onChange={e => setEditingItem({ ...editingItem, status: e.target.value as GrowthCalendarItem['status'] })}
                      className="w-full p-2 rounded-xl border-2 border-slateDark bg-white text-xs font-bold text-slateDark shadow-pop-sm focus:outline-none"
                    >
                      <option value="Planned">Planned</option>
                      <option value="Ready">Ready</option>
                      <option value="Queued">Queued</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Published">Published</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <HardInput
                      label="Day Label (Display Header)"
                      value={editingItem.dayLabel}
                      onChange={e => setEditingItem({ ...editingItem, dayLabel: e.target.value })}
                      placeholder="e.g. Day 1, Monday Sep 15, Launch Drop"
                    />
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-500">Quick Insert:</span>
                      {[
                        `Day ${editingItem.day}`,
                        `${editingItem.dayOfWeek || 'Day'} ${editingItem.day}`,
                        `Day ${editingItem.day} (AM)`,
                        `Day ${editingItem.day} (PM)`,
                        'Bonus Reel',
                      ].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEditingItem({ ...editingItem, dayLabel: preset })}
                          className="px-2 py-0.5 rounded-lg bg-white hover:bg-yellowPop/40 border border-slateDark text-[10px] font-mono font-bold text-slateDark cursor-pointer shadow-pop-sm transition-all"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark block mb-1.5">
                      Platform
                    </label>
                    <select
                      value={editingItem.platform || 'Instagram'}
                      onChange={e => setEditingItem({ ...editingItem, platform: e.target.value })}
                      className="w-full p-2.5 rounded-xl border-2 border-slateDark bg-white text-xs font-bold text-slateDark shadow-pop-sm focus:outline-none"
                    >
                      <option value="Instagram">Instagram</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Threads">Threads</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Timing & Content Pillar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <HardInput
                    label={`Posting Time Slot (${profileTimezone.standardCode})`}
                    value={editingItem.timeSlot}
                    onChange={e => setEditingItem({ ...editingItem, timeSlot: e.target.value, timeStr: e.target.value })}
                    placeholder={`e.g. 18:00 ${profileTimezone.standardCode}, 08:30 PM`}
                  />
                  {/* Quick Time Presets in Detected Time Standard */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-500">Peak Windows:</span>
                    {[
                      `09:30 ${profileTimezone.standardCode}`,
                      `12:30 ${profileTimezone.standardCode}`,
                      `18:00 ${profileTimezone.standardCode}`,
                      `20:30 ${profileTimezone.standardCode}`,
                    ].map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, timeSlot: slot, timeStr: slot })}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-yellowPop/40 border border-slateDark text-[10px] font-mono font-bold text-slateDark cursor-pointer shadow-pop-sm transition-all"
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark block mb-1.5">
                    Content Pillar (Target 20 Pillars)
                  </label>
                  <select
                    value={editingItem.pillar}
                    onChange={e => setEditingItem({ ...editingItem, pillar: e.target.value })}
                    className="w-full p-2.5 rounded-xl border-2 border-slateDark bg-white text-xs font-bold text-slateDark shadow-pop-sm focus:outline-none"
                  >
                    {(() => {
                      const dynamicPillars = Array.from(new Set([
                        ...(strategyResult?.contentPillars?.map(p => p.name) || []),
                        ...(strategyResult?.calendar?.map(c => c.pillar).filter(Boolean) || []),
                        ...(profile?.subNiche ? [`${profile.subNiche} Guides`, `${profile.subNiche} Proof & Case Studies`, `Contrarian ${profile.subNiche} Insights`] : []),
                        editingItem.pillar
                      ])).filter(Boolean);

                      return dynamicPillars.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ));
                    })()}
                  </select>
                </div>
              </div>

              {/* Visual Format (Simple Visual Types) & Post Media URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <HardInput
                    label="Visual Type"
                    value={editingItem.visualFormat}
                    onChange={e => setEditingItem({ ...editingItem, visualFormat: e.target.value })}
                    placeholder="e.g. Reel, Carousel, Video, Single Post"
                  />
                  {/* Simple Visual Type Presets */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-500">Presets:</span>
                    {['Reel', 'Carousel', 'Video', 'Single Post', 'Infographic', 'Story'].map(format => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, visualFormat: format })}
                        className={`px-2 py-0.5 rounded-lg border border-slateDark text-[10px] font-bold cursor-pointer transition-all shadow-pop-sm ${
                          editingItem.visualFormat.toLowerCase().includes(format.toLowerCase())
                            ? 'bg-yellowPop text-slateDark font-black'
                            : 'bg-white hover:bg-slate-100 text-slateDark'
                        }`}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>

                <HardInput
                  label="Post Image / Media URL (Optional)"
                  value={editingItem.imageUrl || ''}
                  onChange={e => setEditingItem({ ...editingItem, imageUrl: e.target.value })}
                  placeholder="Leave empty or paste image URL"
                />
              </div>

              {/* Post Topic & 3-Second Retention Hook */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <HardInput
                  label="Post Topic & Angle"
                  value={editingItem.postTopic}
                  onChange={e => setEditingItem({ ...editingItem, postTopic: e.target.value })}
                  placeholder="Specific topic and tension angle"
                />
                <HardInput
                  label="3-Second Retention Hook"
                  value={editingItem.hook}
                  onChange={e => setEditingItem({ ...editingItem, hook: e.target.value })}
                  placeholder="First text-overlay or first spoken sentence"
                />
              </div>

              {/* Rich Creative Production Blueprint: Category, Target Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-violet-50/60 border-2 border-violet-200 rounded-2xl">
                <div>
                  <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark block mb-1">
                    Idea Category
                  </label>
                  <select
                    value={editingItem.ideaCategory || editingItem.visualFormat || 'Reel'}
                    onChange={e => setEditingItem({ ...editingItem, ideaCategory: e.target.value as any })}
                    className="w-full p-2 rounded-xl border-2 border-slateDark bg-white text-xs font-bold text-slateDark shadow-pop-sm focus:outline-none"
                  >
                    <option value="Reel">Reel (Short-form)</option>
                    <option value="Post">Single Post</option>
                    <option value="Carousel">Carousel (Multi-slide)</option>
                    <option value="Story">Story / Highlight</option>
                  </select>
                </div>
                <HardInput
                  label="Target Duration"
                  value={editingItem.targetDuration || ''}
                  onChange={e => setEditingItem({ ...editingItem, targetDuration: e.target.value })}
                  placeholder="e.g. 7–15 seconds or 6–8 slides"
                />
              </div>

              {/* Timeline Scenes (Scene 1: Hook, Scene 2: Value, Scene 3: CTA) */}
              <div>
                <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark block mb-1.5 flex items-center gap-1.5">
                  <Film size={13} className="text-violetBrand" />
                  Timeline Scenes (Scene 1: Hook, Scene 2: Value, Scene 3: CTA)
                </label>
                <textarea
                  value={editingItem.timelineScenes || ''}
                  onChange={e => setEditingItem({ ...editingItem, timelineScenes: e.target.value })}
                  rows={3}
                  className="w-full p-3 rounded-xl border-2 border-slateDark bg-white text-xs font-medium text-slateDark shadow-pop-sm focus:outline-none font-mono"
                  placeholder="Scene 1 (0-3s): [Hook] Fast-paced visual hook&#10;Scene 2 (3-8s): [Core Value] The contrarian solution&#10;Scene 3 (8-12s): [CTA] Comment 'GROW' to receive blueprint"
                />
              </div>

              {/* Full Voiceover / Slide Script */}
              <div>
                <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark block mb-1.5 flex items-center gap-1.5">
                  <BookOpen size={13} className="text-pinkPop" />
                  Full Spoken Voiceover / Slide Script
                </label>
                <textarea
                  value={editingItem.fullScript || ''}
                  onChange={e => setEditingItem({ ...editingItem, fullScript: e.target.value })}
                  rows={3}
                  className="w-full p-3 rounded-xl border-2 border-slateDark bg-white text-xs font-medium text-slateDark shadow-pop-sm focus:outline-none font-mono"
                  placeholder="[Spoken audio]: Stop making this costly mistake if you want to scale...&#10;[Spoken audio]: Most people overlook positioning...&#10;[Spoken audio]: Drop 'GROW' below and I'll send you our checklist!"
                />
              </div>

              {/* Caption & CTA (Hook + SEO Keywords + CTA + #Tags) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark">
                    Caption & Call to Action (Hook + SEO Keywords + CTA + #Tags)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const formatted = ensureCaptionHasHookSeoAndTags(
                        editingItem.captionAndCta,
                        editingItem.hook,
                        editingItem.seoKeywordsAndTags,
                        profile?.subNiche
                      );
                      setEditingItem({ ...editingItem, captionAndCta: formatted });
                      addActivity('Formatted caption with Hook, SEO keywords, and #tags', 'info');
                    }}
                    className="px-2 py-0.5 rounded-lg border border-slateDark bg-yellowPop hover:bg-yellow-300 text-[10px] font-bold text-slateDark cursor-pointer shadow-xs flex items-center gap-1 transition-all"
                    title="Auto-format caption with hook on top, SEO body, and #tags at bottom"
                  >
                    <Sparkles size={11} />
                    <span>Auto-Format Hook & #Tags</span>
                  </button>
                </div>
                <textarea
                  value={editingItem.captionAndCta}
                  onChange={e => setEditingItem({ ...editingItem, captionAndCta: e.target.value })}
                  rows={5}
                  className="w-full p-3 rounded-xl border-2 border-slateDark bg-white text-xs font-medium text-slateDark shadow-pop-sm focus:outline-none font-mono"
                  placeholder="[3-second hook]&#10;&#10;[Value body copy with SEO keywords]&#10;&#10;👉 Share this with someone...&#10;💬 Comment 'GUIDE' to receive...&#10;&#10;#tag1 #tag2 #tag3"
                />
              </div>

              <HardInput
                label="Target SEO Keywords & Hashtags"
                value={editingItem.seoKeywordsAndTags}
                onChange={e => setEditingItem({ ...editingItem, seoKeywordsAndTags: e.target.value })}
                placeholder="#niche #keyword1 #keyword2"
              />

              {/* Cover URL & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <HardInput
                  label="Cover URL (Optional)"
                  value={editingItem.coverUrl || ''}
                  onChange={e => setEditingItem({ ...editingItem, coverUrl: e.target.value })}
                  placeholder="https://... custom video cover"
                />
                <HardInput
                  label="Location Name"
                  value={editingItem.locationName || ''}
                  onChange={e => setEditingItem({ ...editingItem, locationName: e.target.value })}
                  placeholder="e.g. New York, NY / Local Geo Tag"
                />
              </div>

              {/* Scheduled At & Audio / Song & Collaborators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <HardInput
                  label="Scheduled At (ISO Date/Time)"
                  value={editingItem.scheduledAt || ''}
                  onChange={e => setEditingItem({ ...editingItem, scheduledAt: e.target.value })}
                  placeholder="YYYY-MM-DDTHH:mm"
                />
                <HardInput
                  label="Trending Audio / Song"
                  value={editingItem.song || ''}
                  onChange={e => setEditingItem({ ...editingItem, song: e.target.value })}
                  placeholder="e.g. Synthwave Dreams"
                />
                <HardInput
                  label="Account / Collaborator Tags"
                  value={editingItem.tag || ''}
                  onChange={e => setEditingItem({ ...editingItem, tag: e.target.value })}
                  placeholder="e.g. @creators @partnerbrand"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-between gap-2">
              {editingIndex !== null ? (
                <CandyButton
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => handleDeletePost(editingIndex)}
                >
                  Delete Post
                </CandyButton>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <CandyButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingItem(null);
                    setEditingIndex(null);
                  }}
                >
                  Cancel
                </CandyButton>
                <CandyButton
                  variant="yellow"
                  size="sm"
                  icon={Save}
                  onClick={() => handleSaveEditedPost(editingItem)}
                >
                  Save Changes
                </CandyButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEDIA ASSET DISTRIBUTION MODAL */}
      {isMediaDistributeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slateDark/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white border-4 border-slateDark rounded-3xl shadow-pop p-5 sm:p-6 flex flex-col space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slateDark">
              <div className="flex items-center gap-2">
                <Upload size={20} className="text-pinkPop" />
                <h3 className="font-heading font-black text-slateDark text-lg">
                  Distribute Media Across Calendar
                </h3>
              </div>
              <button
                onClick={() => setIsMediaDistributeModalOpen(false)}
                className="p-1.5 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-100 text-slateDark shadow-pop-sm cursor-pointer"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              If your media asset count is higher than your calendar days (e.g. 14 media assets for 7 calendar days), this engine automatically scales up posts per day (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Day 1 (Slot 1)</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Day 1 (Slot 2)</code>, etc.) at peak engagement hours (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">12:30, 18:00, 20:30, 09:30</code>) so no media is wasted.
            </p>

            <div>
              <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark block mb-1.5">
                Paste Media URLs (Images / Reels / Carousels)
              </label>
              <textarea
                value={rawMediaUrlsInput}
                onChange={e => setRawMediaUrlsInput(e.target.value)}
                placeholder={"https://images.unsplash.com/photo-1...\nhttps://images.unsplash.com/photo-2...\n(paste one URL per line or comma-separated)"}
                rows={6}
                className="w-full p-3 rounded-xl border-2 border-slateDark bg-white text-xs font-mono text-slateDark shadow-pop-sm focus:outline-none"
              />
              <div className="flex items-center justify-between mt-2 text-[11px] font-bold text-slate-500">
                <span>
                  Detected Media Assets: <strong className="text-slateDark">{rawMediaUrlsInput.split(/[\n,]+/).map(u => u.trim()).filter(Boolean).length}</strong>
                </span>
                <span>
                  Base Calendar Days: <strong className="text-slateDark">{strategyResult?.calendar.length || 0}</strong>
                </span>
              </div>
            </div>

            <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-end gap-2">
              <CandyButton
                variant="secondary"
                size="sm"
                onClick={() => setIsMediaDistributeModalOpen(false)}
              >
                Cancel
              </CandyButton>
              <CandyButton
                variant="yellow"
                size="sm"
                icon={Sparkles}
                onClick={handleDistributeMediaSubmit}
                disabled={!rawMediaUrlsInput.trim()}
              >
                Auto-Distribute & Fill Slots
              </CandyButton>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM PROMPT INSPECTOR MODAL */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slateDark/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[85vh] bg-white border-4 border-slateDark rounded-3xl shadow-pop p-4 sm:p-6 flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-slateDark">
              <div className="flex items-center gap-2">
                <Code2 size={22} className="text-violetBrand" />
                <h3 className="font-heading font-black text-slateDark text-lg sm:text-xl">
                  AI Instagram Growth Strategist System Prompt
                </h3>
              </div>
              <button
                onClick={() => setIsPromptModalOpen(false)}
                className="p-1.5 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-100 text-slateDark shadow-pop-sm transition-all cursor-pointer"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Prompt Content */}
            <div className="flex-1 overflow-y-auto my-4 p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs leading-relaxed border-2 border-slateDark whitespace-pre-wrap selection:bg-yellowPop selection:text-slateDark break-words">
              {GROWTH_STRATEGIST_SYSTEM_PROMPT}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t-2 border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-500">
                Optimized for 2025/2026 Meta Algorithm (Sends-per-Reach, Retention, In-App SEO)
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <CandyButton
                  variant="yellow"
                  size="sm"
                  icon={Copy}
                  onClick={handleCopyPrompt}
                >
                  {copiedPrompt ? 'Copied Prompt!' : 'Copy System Prompt'}
                </CandyButton>
                <CandyButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsPromptModalOpen(false)}
                >
                  Close
                </CandyButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TIMEZONE STANDARD SELECTOR MODAL */}
      {isTimezoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slateDark/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md bg-white border-4 border-slateDark rounded-3xl shadow-pop p-4 sm:p-6 flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-slateDark">
              <div className="flex items-center gap-2">
                <Clock size={20} className="text-violetBrand" />
                <h3 className="font-heading font-black text-slateDark text-lg">
                  Profile Time Standard
                </h3>
              </div>
              <button
                onClick={() => setIsTimezoneModalOpen(false)}
                className="p-1.5 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-100 text-slateDark shadow-pop-sm transition-all cursor-pointer"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="my-4 space-y-3">
              <div className="p-3 bg-slate-50 border-2 border-slateDark rounded-2xl">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Active Standard
                </div>
                <div className="font-heading font-black text-slateDark text-sm sm:text-base flex items-center justify-between">
                  <span>{profileTimezone.displayName}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-heading font-black bg-emerald-100 text-emerald-800 uppercase">
                    {profileTimezone.source === 'user_override' ? 'Manual Override' : 'Auto-Identified'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  All 30-day calendar slots, peak audience active windows, and auto-publishing rules align with this standard.
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-heading font-black text-slateDark uppercase tracking-wider">
                  Select Timezone / Region
                </div>
                <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto pr-1">
                  <button
                    onClick={() => handleChangeTimezone(null)}
                    className={`p-2.5 rounded-xl border-2 text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      overrideTz === null
                        ? 'border-slateDark bg-yellowPop text-slateDark shadow-pop-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>⚡ Reset to Profile & System Auto-Detect</span>
                    <span className="text-[10px] font-mono">Recommended</span>
                  </button>

                  {[
                    { tz: 'Asia/Kolkata', label: 'India Standard Time (IST • UTC+5:30)' },
                    { tz: 'America/New_York', label: 'US Eastern Time (EST/EDT • UTC-5:00)' },
                    { tz: 'America/Chicago', label: 'US Central Time (CST/CDT • UTC-6:00)' },
                    { tz: 'America/Los_Angeles', label: 'US Pacific Time (PST/PDT • UTC-8:00)' },
                    { tz: 'Europe/London', label: 'UK & London (GMT/BST • UTC+0:00)' },
                    { tz: 'Europe/Paris', label: 'Central Europe (CET/CEST • UTC+1:00)' },
                    { tz: 'Asia/Dubai', label: 'Gulf Standard Time (GST • UTC+4:00)' },
                    { tz: 'Asia/Singapore', label: 'Singapore & Malaysia (SGT • UTC+8:00)' },
                    { tz: 'Asia/Tokyo', label: 'Japan Standard Time (JST • UTC+9:00)' },
                    { tz: 'Australia/Sydney', label: 'Australian Eastern (AEST • UTC+10:00)' },
                    { tz: 'UTC', label: 'Coordinated Universal Time (UTC+0:00)' },
                  ].map(item => (
                    <button
                      key={item.tz}
                      onClick={() => handleChangeTimezone(item.tz)}
                      className={`p-2.5 rounded-xl border-2 text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        overrideTz === item.tz || (overrideTz === null && profileTimezone.timeZone === item.tz)
                          ? 'border-slateDark bg-yellowPop text-slateDark shadow-pop-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] font-mono opacity-70">{item.tz}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-end">
              <CandyButton
                variant="secondary"
                size="sm"
                onClick={() => setIsTimezoneModalOpen(false)}
              >
                Close
              </CandyButton>
            </div>
          </div>
        </div>
      )}

      {/* SAVED CALENDARS HISTORY MODAL (Card View, Load & Delete Actions, Anti-Duplication Memory Bank) */}
      {isSavedCalendarsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slateDark/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white border-4 border-slateDark rounded-3xl shadow-pop p-4 sm:p-6 flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-slateDark">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-yellowPop border-2 border-slateDark flex items-center justify-center text-slateDark shadow-xs font-black text-base">
                  <Folder size={18} />
                </div>
                <div>
                  <h3 className="font-heading font-black text-slateDark text-lg flex items-center gap-2">
                    <span>Saved Calendars Collection</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Cloud DB Synced
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Past generated strategies persisted in Supabase database & active memory bank
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSavedCalendarsModalOpen(false)}
                className="p-1.5 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-100 text-slateDark shadow-pop-sm transition-all cursor-pointer"
                title="Close modal"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="my-4 flex-1 overflow-y-auto pr-1 space-y-3">
              {savedCalendars.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl space-y-2">
                  <div className="text-3xl flex justify-center"><Folder size={36} className="text-slate-400" /></div>
                  <h4 className="font-heading font-black text-slateDark text-sm">
                    No Saved Calendars Yet
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    When you generate a calendar you like, click <strong>"Save Calendar"</strong> in the action bar above the calendar table to save it to your Supabase database. The LLM will remember its topics and avoid repeating them!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedCalendars.map(item => {
                    const previewTopics = item.plan.calendar?.slice(0, 3) || [];
                    const savedDateFormatted = new Date(item.savedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl border-2 border-slateDark bg-white shadow-pop-sm hover:shadow-pop transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-heading font-black bg-violet-100 text-violetBrand border border-violet-300 truncate max-w-[170px]">
                              {item.subNiche || 'Custom Niche'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {savedDateFormatted}
                            </span>
                          </div>

                          <h5 className="font-heading font-black text-slateDark text-sm line-clamp-1" title={item.title}>
                            {item.title}
                          </h5>

                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <span className="px-2 py-0.5 rounded-md bg-yellowPop/40 border border-slate-300 text-[10px] flex items-center gap-1">
                              <Calendar size={11} /> {item.calendarDays} Days
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-[10px] flex items-center gap-1">
                              <Layers size={11} /> {item.totalPosts} Posts
                            </span>
                          </div>

                          {/* Preview Topics */}
                          <div className="pt-1 text-[11px] text-slate-600 space-y-1">
                            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 block">
                              Sample Topics:
                            </span>
                            {previewTopics.map((t, tidx) => (
                              <div key={tidx} className="line-clamp-1 text-slate-700 italic">
                                • {t.postTopic}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleLoadSavedCalendar(item)}
                            className="flex-1 py-1.5 px-3 rounded-xl border-2 border-slateDark bg-yellowPop hover:bg-yellow-300 text-slateDark font-heading font-black text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-y-0.5"
                          >
                            <span>Load Calendar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSavedCalendar(item.id, item.title)}
                            className="p-1.5 rounded-xl border border-slate-300 hover:border-red-400 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Delete saved calendar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold">
                {savedCalendars.length} {savedCalendars.length === 1 ? 'calendar' : 'calendars'} in memory
              </span>
              <CandyButton
                variant="secondary"
                size="sm"
                onClick={() => setIsSavedCalendarsModalOpen(false)}
              >
                Close
              </CandyButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
