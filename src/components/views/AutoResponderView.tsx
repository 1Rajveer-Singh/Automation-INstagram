import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ApiConfig,
  InstagramComment,
  AutoReplyRule,
  InstagramMedia,
  InstagramUser,
  FollowGatedFunnelConfig,
  FollowFunnelLead,
  FollowFunnelLeadLog,
} from '../../types/instagram';
import {
  getMediaComments,
  replyToComment,
  toggleHideComment,
  deleteComment,
  sendPrivateReplyToComment,
  sendDirectMessageToUser,
  checkUserFollowsAccount,
} from '../../services/instagramApi';
import { generateAiCommentReply } from '../../services/aiService';
import { sanitizeString, getScopedKey } from '../../services/security';
import { fetchSupabaseAutoReplyRules, upsertSupabaseAutoReplyRule, logSupabaseCommentReply } from '../../services/supabaseService';
import { useActivity } from '../../context/ActivityContext';
import { StickerCard } from '../common/StickerCard';
import { HardInput } from '../common/HardInput';
import { CandyButton } from '../common/CandyButton';
import {
  MessageSquareCode,
  Zap,
  Eye,
  EyeOff,
  Trash2,
  Reply,
  Plus,
  Bot,
  Filter,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Sparkles,
  Activity,
  Layout,
  MessageCircle,
  Send,
  RefreshCw,
  UserCheck,
  Link2,
  ExternalLink,
  Check,
  AlertCircle,
  Users,
  CheckSquare,
  Square,
  ShieldCheck,
  MailCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AutoResponderViewProps {
  config: ApiConfig;
  mediaList: InstagramMedia[];
  user?: InstagramUser | null;
  userId?: string;
}

export type ResponderTab = 'agent' | 'rules' | 'threads';

export interface StoredCommentReply {
  id: string;
  text: string;
  timestamp: string;
  username?: string;
}

interface AgentLogEntry {
  id: string;
  timestamp: string;
  username: string;
  commentText: string;
  aiReply: string;
  status: 'success' | 'error';
}

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isStandaloneKeywordMatch = (commentText: string, keyword: string): boolean => {
  if (!keyword || !commentText) return false;
  const parts = keyword.split(/[,|]/).map(k => k.trim().replace(/^#/, '')).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.some(part => {
    const escaped = escapeRegExp(part);
    // Match word boundary or boundary surrounded by spaces, punctuation, or hashtags
    const regex = new RegExp(`(?:^|[\\s#.,!?¡¿"';:()[\\]{}<>/\\-])${escaped}(?=[\\s.,!?¡¿"';:()[\\]{}<>/\\-]|$)`, 'i');
    return regex.test(commentText);
  });
};

export const AutoResponderView: React.FC<AutoResponderViewProps> = ({ config, mediaList, user, userId }) => {
  const { addActivity } = useActivity();
  const [activeTab, setActiveTab] = useState<ResponderTab>('agent');
  const [selectedMediaId, setSelectedMediaId] = useState<string>('all');
  const [comments, setComments] = useState<InstagramComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [commentFilter, setCommentFilter] = useState<'unreplied' | 'all'>('unreplied');
  const [isGeneratingMap, setIsGeneratingMap] = useState<Record<string, boolean>>({});
  const [isScanningManual, setIsScanningManual] = useState<boolean>(false);

  // AI Agent Autonomous Engine State & Persistent Deduplication Ledger
  const [isAgentActive, setIsAgentActive] = useState<boolean>(true);
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('instagrowth_agent_logs', userId));
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [totalAutoReplied, setTotalAutoReplied] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('instagrowth_total_auto_replied', userId));
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const isProcessingRef = useRef<boolean>(false);
  const inFlightRef = useRef<Set<string>>(new Set());

  // Track replied comment IDs
  const [repliedCommentIds, setRepliedCommentIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('instagrowth_replied_comment_ids', userId));
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track sent reply message texts to ensure NO message is sent twice
  const [sentReplyTexts, setSentReplyTexts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('instagrowth_sent_reply_texts', userId));
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persistent map of comment replies: Record<commentId, StoredCommentReply[]>
  const [commentRepliesMap, setCommentRepliesMap] = useState<Record<string, StoredCommentReply[]>>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('instagrowth_comment_replies_map', userId));
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const isCommentAlreadyReplied = (c: InstagramComment): boolean => {
    if (c.replied) return true;
    if (repliedCommentIds.has(c.id)) return true;
    if (inFlightRef.current.has(c.id)) return true;
    if (commentRepliesMap[c.id]?.length > 0) return true;
    if (c.replies && c.replies.length > 0) return true;
    return false;
  };

  const makeReplyTextUnique = (rawText: string): string => {
    if (!sentReplyTexts.has(rawText)) return rawText;
    const variants = [' ✨', ' 🚀', ' 💫', ' 🙌', ' ❤️', ' 🔥', ' 🌟', ' 🎯'];
    for (const v of variants) {
      const candidate = `${rawText}${v}`;
      if (!sentReplyTexts.has(candidate)) return candidate;
    }
    return `${rawText} (${Date.now().toString().slice(-4)})`;
  };

  const markCommentAsReplied = (
    commentId: string,
    username: string,
    replyText: string,
    senderName: string = 'AI Agent'
  ) => {
    setRepliedCommentIds(prev => {
      const next = new Set(prev).add(commentId);
      localStorage.setItem(getScopedKey('instagrowth_replied_comment_ids', userId), JSON.stringify(Array.from(next)));
      return next;
    });

    if (replyText) {
      setSentReplyTexts(prev => {
        const next = new Set(prev).add(replyText);
        localStorage.setItem(getScopedKey('instagrowth_sent_reply_texts', userId), JSON.stringify(Array.from(next)));
        return next;
      });

      const newReplyItem: StoredCommentReply = {
        id: `reply_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: replyText,
        timestamp: new Date().toISOString(),
        username: senderName,
      };

      setCommentRepliesMap(prev => {
        const currentList = prev[commentId] || [];
        const nextList = [...currentList, newReplyItem];
        const nextMap = { ...prev, [commentId]: nextList };
        localStorage.setItem(getScopedKey('instagrowth_comment_replies_map', userId), JSON.stringify(nextMap));
        return nextMap;
      });

      setComments(prev =>
        prev.map(c => {
          if (c.id !== commentId) return c;
          const existingReplies = c.replies || [];
          return {
            ...c,
            replied: true,
            replies: [
              ...existingReplies,
              {
                id: newReplyItem.id,
                text: newReplyItem.text,
                username: newReplyItem.username || senderName,
                timestamp: newReplyItem.timestamp,
                like_count: 0,
                replied: true,
              },
            ],
          };
        })
      );
    } else {
      setComments(prev =>
        prev.map(c => (c.id === commentId ? { ...c, replied: true } : c))
      );
    }
  };

  // Rules Persistence in localStorage & Supabase DB (Strictly User Isolated)
  const [rules, setRules] = useState<AutoReplyRule[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('instagrowth_keyword_rules', userId));
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load rules:', e);
    }
    // Clean default for new accounts — no demo rules
    return [];
  });

  // Sync auto-reply rules with Supabase cloud DB per user
  useEffect(() => {
    if (!userId || userId === 'default') return;
    let isMounted = true;
    fetchSupabaseAutoReplyRules(userId).then(dbRules => {
      if (isMounted && Array.isArray(dbRules) && dbRules.length > 0) {
        const mapped: AutoReplyRule[] = dbRules.map(r => ({
          id: r.id,
          triggerKeyword: r.trigger_keyword,
          replyText: r.reply_text,
          action: r.action,
          triggerCount: r.trigger_count || 0,
          isActive: r.is_active ?? true,
          createdAt: r.created_at || new Date().toISOString(),
        }));
        setRules(mapped);
        localStorage.setItem(getScopedKey('instagrowth_keyword_rules', userId), JSON.stringify(mapped));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const saveRules = (newRules: AutoReplyRule[]) => {
    setRules(newRules);
    try {
      localStorage.setItem(getScopedKey('instagrowth_keyword_rules', userId), JSON.stringify(newRules));
      if (userId && userId !== 'default') {
        newRules.forEach(rule => {
          upsertSupabaseAutoReplyRule(userId, {
            id: rule.id,
            trigger_keyword: rule.triggerKeyword,
            reply_text: rule.replyText,
            action: rule.action,
            trigger_count: rule.triggerCount,
            is_active: rule.isActive,
          }).catch(console.warn);
        });
      }
    } catch (e) {
      console.warn('Failed to persist rules:', e);
    }
  };

  // Follow-to-Unlock Leads Tracking & Persistence (Strictly User Isolated)
  const [funnelLeads, setFunnelLeads] = useState<FollowFunnelLead[]>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('instagrowth_follow_funnel_leads', userId));
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const saveFunnelLeads = (leads: FollowFunnelLead[]) => {
    setFunnelLeads(leads);
    try {
      localStorage.setItem(getScopedKey('instagrowth_follow_funnel_leads', userId), JSON.stringify(leads));
    } catch (e) {}
  };

  const [newKeyword, setNewKeyword] = useState('');
  const [newReplyText, setNewReplyText] = useState('');

  // Follow-Gated Funnel Form State (Persistent toggle: click once for ON, click again for OFF)
  const [isFollowGated, setIsFollowGated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(getScopedKey('instagrowth_is_follow_gated', userId)) === 'true';
    } catch {
      return false;
    }
  });
  const [newResourceTitle, setNewResourceTitle] = useState('');
  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [newCommentReplyText, setNewCommentReplyText] = useState('');
  const [newInitialDmText, setNewInitialDmText] = useState('');
  const [newReminderDmText, setNewReminderDmText] = useState('');
  const [newDeliveryDmText, setNewDeliveryDmText] = useState('');
  const [newAlreadyFollowingCommentReplyText, setNewAlreadyFollowingCommentReplyText] = useState('');
  const [newAlreadyFollowingDmText, setNewAlreadyFollowingDmText] = useState('');
  const [newMaxReminders, setNewMaxReminders] = useState<number>(2);
  const [showAdvancedTemplates, setShowAdvancedTemplates] = useState(false);
  const [activeLeadFilter, setActiveLeadFilter] = useState<'all' | 'pending' | 'delivered'>('all');
  const [expandedLeadLogs, setExpandedLeadLogs] = useState<Record<string, boolean>>({});

  // Known Followers Tracking (for instant direct resource delivery to existing followers)
  const [knownFollowers, setKnownFollowers] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(getScopedKey('instagrowth_known_followers', userId));
      if (saved) return new Set(JSON.parse(saved).map((u: string) => u.toLowerCase().trim()));
    } catch {}
    return new Set<string>();
  });

  const [newFollowerInput, setNewFollowerInput] = useState('');

  const addKnownFollower = (username: string) => {
    if (!username.trim()) return;
    const clean = username.trim().replace(/^@/, '').toLowerCase();
    setKnownFollowers(prev => {
      const next = new Set(prev).add(clean);
      localStorage.setItem(getScopedKey('instagrowth_known_followers', userId), JSON.stringify(Array.from(next)));
      return next;
    });
    setNewFollowerInput('');
    addActivity(`Added @${clean} to Verified Followers list`, 'success');
  };

  const removeKnownFollower = (username: string) => {
    const clean = username.trim().replace(/^@/, '').toLowerCase();
    setKnownFollowers(prev => {
      const next = new Set(prev);
      next.delete(clean);
      localStorage.setItem(getScopedKey('instagrowth_known_followers', userId), JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleFollowGated = () => {
    const next = !isFollowGated;
    setIsFollowGated(next);
    try {
      localStorage.setItem(getScopedKey('instagrowth_is_follow_gated', userId), next ? 'true' : 'false');
    } catch {}

    if (next) {
      // Auto-fill fields immediately with sensible defaults upon activating
      if (!newKeyword.trim()) setNewKeyword('GROW');
      if (!newResourceTitle.trim()) setNewResourceTitle('Instagram Growth Blueprint 2026');
      if (!newResourceUrl.trim()) setNewResourceUrl('https://yourbrand.com/growth-playbook.pdf');
      if (!newCommentReplyText.trim()) setNewCommentReplyText("Hey @{username}! I've sent the {resource_title} to your DMs! Check your requests 📩");
      if (!newInitialDmText.trim()) setNewInitialDmText("Hey @{username}! 👋 Thanks for commenting! To unlock your free copy of {resource_title}, please make sure you follow our account @{our_username} first! Once followed, tap below 👇");
      if (!newReminderDmText.trim()) setNewReminderDmText("Hey @{username}! ⚠️ We couldn't verify that you're following @{our_username} yet. Please follow our account first so we can unlock {resource_title} for you! 🚀");
      if (!newDeliveryDmText.trim()) setNewDeliveryDmText("🎉 Follow verified! Here is your exclusive download link for {resource_title}: {resource_url}\nEnjoy and let us know your feedback!");
      if (!newAlreadyFollowingCommentReplyText.trim()) setNewAlreadyFollowingCommentReplyText("Hey @{username}! Thanks for following @{our_username}! 🎉 Sent your free copy of {resource_title} directly to your DMs!");
      if (!newAlreadyFollowingDmText.trim()) setNewAlreadyFollowingDmText("Hey @{username}! 🚀 Since you're already following @{our_username}, here is your instant access to {resource_title}: {resource_url}\nEnjoy!");
    }
  };

  // Auto-sync selectedMediaId when mediaList is loaded or updated
  useEffect(() => {
    if (mediaList.length > 0) {
      if (!selectedMediaId || (selectedMediaId !== 'all' && !mediaList.some(m => m.id === selectedMediaId))) {
        setSelectedMediaId('all');
      }
    }
  }, [mediaList, selectedMediaId]);

  const fetchComments = async (mediaId: string) => {
    if (!mediaId || !config.accessToken) {
      setComments([]);
      return;
    }
    setIsLoadingComments(true);
    try {
      let data: InstagramComment[] = [];
      if (mediaId === 'all') {
        const postsToScan = mediaList.length > 0 ? mediaList.slice(0, 15) : [];
        const results = await Promise.allSettled(
          postsToScan.map(m => getMediaComments(m.id, config.accessToken))
        );
        for (const res of results) {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            data.push(...res.value);
          }
        }
      } else {
        data = await getMediaComments(mediaId, config.accessToken);
      }

      let storedRepliesMap: Record<string, StoredCommentReply[]> = {};
      try {
        const saved = localStorage.getItem('instagrowth_comment_replies_map');
        if (saved) storedRepliesMap = JSON.parse(saved);
      } catch {}

      const merged = data.map(c => {
        const localReplies = storedRepliesMap[c.id] || [];
        const combinedReplies = [
          ...(c.replies || []),
          ...localReplies.map(r => ({
            id: r.id,
            text: r.text,
            username: r.username || 'You',
            timestamp: r.timestamp,
            like_count: 0,
            replied: true,
          })),
        ];

        return {
          ...c,
          replies: combinedReplies,
          replied: Boolean(c.replied || repliedCommentIds.has(c.id) || combinedReplies.length > 0),
        };
      });
      setComments(merged);
    } catch (err: any) {
      console.warn(`Failed to fetch comments for media ${mediaId}:`, err.message);
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  useEffect(() => {
    if (selectedMediaId) {
      setComments([]); // Immediately clear previous post's comments to prevent ghost messages
      fetchComments(selectedMediaId);
    } else {
      setComments([]);
    }
  }, [selectedMediaId, config.accessToken]);

  // Autonomous AI Comment Agent Background Polling & Auto-Reply Engine
  const runAgentCycle = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

      try {
        const mediaToScan = selectedMediaId === 'all'
          ? (mediaList.length > 0 ? mediaList : [])
          : mediaList.filter(m => m.id === selectedMediaId);
        for (const media of mediaToScan) {
          const freshComments = await getMediaComments(media.id, config.accessToken);
          const unreplied = freshComments.filter(c => !isCommentAlreadyReplied(c));

          for (const comment of unreplied) {
            if (isCommentAlreadyReplied(comment)) continue;
            inFlightRef.current.add(comment.id);

            try {
              // 1. Check Standalone Keyword Auto-Rules First
              let selectedReply = '';
              const matchedRule = rules.find(r => r.isActive && isStandaloneKeywordMatch(comment.text, r.triggerKeyword));

              if (matchedRule) {
                const ourHandle = user?.username || 'our page';

                if (matchedRule.followGated?.enabled) {
                  // Follow-to-Unlock Gated Resource Workflow
                  const fg = matchedRule.followGated;
                  const cleanCommenter = comment.username.replace(/^@/, '').toLowerCase();
                  const isSelfComment = Boolean(
                    user?.username && cleanCommenter === user.username.replace(/^@/, '').toLowerCase()
                  );
                  const isAlreadyFollowing =
                    knownFollowers.has(cleanCommenter) ||
                    funnelLeads.some(l => l.username.toLowerCase() === cleanCommenter && l.status === 'delivered');

                  if (isSelfComment) {
                    addActivity(
                      `⚠️ You commented from your own account (@${comment.username}). Meta Instagram API does NOT allow an account to DM itself! Please test by commenting from a 2nd Instagram account.`,
                      'info'
                    );
                  }

                  if (isAlreadyFollowing) {
                    // BRANCH A: USER ALREADY FOLLOWS — Direct Resource Delivery Flow
                    const commentReplyTemplate =
                      fg.alreadyFollowingCommentReplyText ||
                      `Hey @{username}! Thanks for following @{our_username}! 🎉 Sent your access to {resource_title} directly to your DMs!`;
                    selectedReply = commentReplyTemplate
                      .replace(/\{username\}/g, comment.username)
                      .replace(/\{resource_title\}/g, fg.resourceTitle)
                      .replace(/\{resource_url\}/g, fg.resourceUrl)
                      .replace(/\{our_username\}/g, ourHandle);

                    const finalUniqueReply = makeReplyTextUnique(selectedReply);
                    await replyToComment(comment.id, finalUniqueReply, config.accessToken);
                    markCommentAsReplied(comment.id, comment.username, finalUniqueReply, 'AI Agent');

                    // Send Direct Resource Delivery DM
                    const dmTemplate =
                      fg.alreadyFollowingDmText ||
                      `Hey @{username}! 🚀 Since you're already following @{our_username}, here is your instant access to {resource_title}: {resource_url}\nEnjoy!`;
                    const formattedDm = dmTemplate
                      .replace(/\{username\}/g, comment.username)
                      .replace(/\{resource_title\}/g, fg.resourceTitle)
                      .replace(/\{our_username\}/g, ourHandle)
                      .replace(/\{resource_url\}/g, fg.resourceUrl);
                    const finalUniqueDm = makeReplyTextUnique(formattedDm);

                    const dmRes = isSelfComment
                      ? { id: `dm_self_${Date.now()}`, simulated: true, message: 'Meta forbids self-DMs to own account' }
                      : await sendPrivateReplyToComment(
                          comment.id,
                          finalUniqueDm,
                          config.selectedIgUserId,
                          config.accessToken
                        );

                    // Register Lead as Delivered
                    const newLead: FollowFunnelLead = {
                      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      commentId: comment.id,
                      username: comment.username,
                      ruleId: matchedRule.id,
                      keyword: matchedRule.triggerKeyword,
                      resourceTitle: fg.resourceTitle,
                      resourceUrl: fg.resourceUrl,
                      status: 'delivered',
                      reminderCount: 0,
                      lastInteractionAt: new Date().toISOString(),
                      createdAt: new Date().toISOString(),
                      log: [
                        {
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          type: 'comment_reply',
                          message: `Public reply posted: "${finalUniqueReply.substring(0, 45)}..."`,
                        },
                        {
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          type: 'delivered',
                          message: isSelfComment
                            ? `Meta API Restriction: Cannot send DM to your own account (@${comment.username}). Test with a 2nd Instagram account to receive live DMs.`
                            : (dmRes.simulated
                                ? `DM Sent (Notice: Meta Live API returned simulated: "${dmRes.message || 'check token permissions'}").`
                                : `Live Private DM dispatched via Meta Graph API: "${finalUniqueDm.substring(0, 45)}..."`),
                        },
                      ],
                    };

                    saveFunnelLeads([newLead, ...funnelLeads.filter(l => l.commentId !== comment.id)]);
                    if (dmRes.simulated) {
                      addActivity(
                        `⚡ @${comment.username} already follows! Resource delivered (Notice: Meta DM in test fallback mode: ${dmRes.message || 'Check instagram_manage_messages'})`,
                        'info'
                      );
                    } else {
                      addActivity(
                        `⚡ @${comment.username} already follows! Resource "${fg.resourceTitle}" delivered directly to DMs! 🚀`,
                        'success'
                      );
                    }
                  } else {
                    // BRANCH B: USER DOES NOT FOLLOW — Procedural Follow-Gate Flow
                    const commentReplyTemplate = fg.commentReplyText || matchedRule.replyText;
                    selectedReply = commentReplyTemplate
                      .replace(/\{username\}/g, comment.username)
                      .replace(/\{resource_title\}/g, fg.resourceTitle)
                      .replace(/\{resource_url\}/g, fg.resourceUrl)
                      .replace(/\{our_username\}/g, ourHandle);

                    const finalUniqueReply = makeReplyTextUnique(selectedReply);
                    await replyToComment(comment.id, finalUniqueReply, config.accessToken);
                    markCommentAsReplied(comment.id, comment.username, finalUniqueReply, 'AI Agent');

                    // Send Initial Follow-Gate DM requesting follow
                    const dmTemplate = fg.initialDmText;
                    const formattedDm = dmTemplate
                      .replace(/\{username\}/g, comment.username)
                      .replace(/\{resource_title\}/g, fg.resourceTitle)
                      .replace(/\{our_username\}/g, ourHandle)
                      .replace(/\{resource_url\}/g, fg.resourceUrl);
                    const finalUniqueDm = makeReplyTextUnique(formattedDm);

                    const dmRes = isSelfComment
                      ? { id: `dm_self_${Date.now()}`, simulated: true, message: 'Meta forbids self-DMs to own account' }
                      : await sendPrivateReplyToComment(
                          comment.id,
                          finalUniqueDm,
                          config.selectedIgUserId,
                          config.accessToken
                        );

                    // Register Lead in Follow Funnel Ledger as Pending Follow
                    const newLead: FollowFunnelLead = {
                      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      commentId: comment.id,
                      username: comment.username,
                      ruleId: matchedRule.id,
                      keyword: matchedRule.triggerKeyword,
                      resourceTitle: fg.resourceTitle,
                      resourceUrl: fg.resourceUrl,
                      status: 'pending_follow',
                      reminderCount: 0,
                      lastInteractionAt: new Date().toISOString(),
                      createdAt: new Date().toISOString(),
                      log: [
                        {
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          type: 'comment_reply',
                          message: `Public reply posted: "${finalUniqueReply.substring(0, 45)}..."`,
                        },
                        {
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          type: 'dm_initial',
                          message: isSelfComment
                            ? `Meta API Restriction: Cannot send DM to your own account (@${comment.username}). Test with a 2nd Instagram account to receive live DMs.`
                            : (dmRes.simulated
                                ? `DM Sent (Notice: Meta Live API returned simulated: "${dmRes.message || 'check token permissions'}").`
                                : `Live Private DM dispatched via Meta Graph API: "${finalUniqueDm.substring(0, 45)}..."`),
                        },
                      ],
                    };

                    saveFunnelLeads([newLead, ...funnelLeads.filter(l => l.commentId !== comment.id)]);
                    if (isSelfComment) {
                      addActivity(
                        `⚡ Follow-Gated Funnel recorded for @${comment.username} (Public reply posted; DM to own account skipped by Meta API rules)`,
                        'info'
                      );
                    } else if (dmRes.simulated) {
                      addActivity(
                        `⚡ Follow-Gated Funnel started for @${comment.username} (Keyword: "${matchedRule.triggerKeyword}"). Notice: DM test fallback (${dmRes.message || 'Token permission needed'})`,
                        'info'
                      );
                    } else {
                      addActivity(
                        `⚡ Follow-Gated Funnel triggered for @${comment.username} (Keyword: "${matchedRule.triggerKeyword}")`,
                        'success'
                      );
                    }
                  }
                } else {
                  // Standard Keyword Reply
                  selectedReply = matchedRule.replyText.replace(/\{username\}/g, comment.username);
                  const finalUniqueReply = makeReplyTextUnique(selectedReply);
                  await replyToComment(comment.id, finalUniqueReply, config.accessToken);
                  markCommentAsReplied(comment.id, comment.username, finalUniqueReply, 'AI Agent');
                }

                // Increment trigger count
                saveRules(
                  rules.map(r => (r.id === matchedRule.id ? { ...r, triggerCount: r.triggerCount + 1 } : r))
                );
              } else {
                // 2. AI Context & Tone Reply (Instagram Manager AI)
                selectedReply = await generateAiCommentReply(
                  comment.text,
                  comment.username,
                  config.geminiApiKey,
                  config.openRouterApiKey,
                  userId,
                  user?.username
                );
                const finalUniqueReply = makeReplyTextUnique(selectedReply);
                await replyToComment(comment.id, finalUniqueReply, config.accessToken);
                markCommentAsReplied(comment.id, comment.username, finalUniqueReply, 'Instagram Manager AI');
              }

              setTotalAutoReplied(prev => {
                const next = prev + 1;
                localStorage.setItem(getScopedKey('instagrowth_total_auto_replied', userId), next.toString());
                return next;
              });

              addActivity(
                `Instagram Manager AI auto-replied to @${comment.username}: "${selectedReply.substring(0, 35)}..."`,
                'success'
              );

              const logEntry: AgentLogEntry = {
                id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                username: comment.username,
                commentText: comment.text,
                aiReply: selectedReply,
                status: 'success',
              };
              setAgentLogs(prev => {
                const updated = [logEntry, ...prev.slice(0, 29)];
                localStorage.setItem(getScopedKey('instagrowth_agent_logs', userId), JSON.stringify(updated));
                return updated;
              });
            } catch (replyErr: any) {
              console.warn(`Failed to auto-reply to ${comment.id}:`, replyErr.message);
            } finally {
              inFlightRef.current.delete(comment.id);
            }
          }
        }
      } catch (err: any) {
        console.warn('AI Agent background cycle note:', err.message);
      } finally {
        isProcessingRef.current = false;
      }
  }, [
    config.accessToken,
    config.selectedIgUserId,
    config.geminiApiKey,
    config.openRouterApiKey,
    mediaList,
    selectedMediaId,
    addActivity,
    rules,
    repliedCommentIds,
    sentReplyTexts,
    user,
    funnelLeads,
    knownFollowers,
  ]);

  useEffect(() => {
    if (!isAgentActive || !config.accessToken) return;

    runAgentCycle();
    const interval = setInterval(runAgentCycle, 12000);
    return () => clearInterval(interval);
  }, [isAgentActive, config.accessToken, runAgentCycle]);

  const triggerManualScan = async () => {
    if (isScanningManual) return;
    setIsScanningManual(true);
    addActivity('⚡ Scanning Instagram posts for new comments and keyword triggers...', 'info');
    try {
      await runAgentCycle();
      addActivity('✅ Scan cycle completed. Check Leads Monitor for latest activity.', 'info');
    } catch (e: any) {
      addActivity(`Scan notice: ${e.message}`, 'error');
    } finally {
      setIsScanningManual(false);
    }
  };

  const handleAddRule = () => {
    if (!newKeyword.trim()) return;
    const cleanKeyword = newKeyword.toUpperCase().trim();

    if (isFollowGated && (!newResourceTitle.trim() || !newResourceUrl.trim())) {
      addActivity('Resource Title and Resource URL are required when Follow-Gated Funnel is enabled', 'error');
      return;
    }

    const defaultReply = isFollowGated
      ? (newCommentReplyText.trim() || `Hey @{username}! I've sent the ${newResourceTitle || 'resource'} to your DMs! Check your requests 📩`)
      : (newReplyText.trim() || `Hey @{username}! Thanks for your interest!`);

    const newRule: AutoReplyRule = {
      id: `rule_${Date.now()}`,
      triggerKeyword: cleanKeyword,
      replyText: defaultReply,
      action: isFollowGated ? 'send_dm' : 'reply_comment',
      triggerCount: 0,
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
      followGated: isFollowGated
        ? {
            enabled: true,
            resourceTitle: newResourceTitle.trim(),
            resourceUrl: newResourceUrl.trim(),
            commentReplyText: defaultReply,
            initialDmText:
              newInitialDmText.trim() ||
              `Hey @{username}! 👋 Thanks for commenting "${cleanKeyword}"! To unlock your free copy of the {resource_title}, please make sure you follow our account @{our_username} first! Once followed, tap below 👇`,
            unfollowedReminderText:
              newReminderDmText.trim() ||
              `Hey @{username}! ⚠️ We couldn't verify that you're following @{our_username} yet. Please follow our page first so we can unlock the {resource_title} for you! 🚀`,
            verifiedDeliveryText:
              newDeliveryDmText.trim() ||
              `🎉 Follow verified! Here is your exclusive download link for {resource_title}: {resource_url}\nEnjoy and let us know what you think!`,
            alreadyFollowingCommentReplyText:
              newAlreadyFollowingCommentReplyText.trim() ||
              `Hey @{username}! Thanks for following @{our_username}! 🎉 Sent your free copy of {resource_title} directly to your DMs!`,
            alreadyFollowingDmText:
              newAlreadyFollowingDmText.trim() ||
              `Hey @{username}! 🚀 Since you're already following @{our_username}, here is your instant access to {resource_title}: {resource_url}\nEnjoy!`,
            maxReminders: newMaxReminders || 2,
          }
        : undefined,
    };

    saveRules([...rules, newRule]);
    addActivity(
      `Added ${isFollowGated ? 'Follow-Gated Funnel' : 'keyword'} rule for "${cleanKeyword}"`,
      'success'
    );

    // Reset keyword and custom text, but keep isFollowGated ON until explicitly toggled off by the user
    setNewKeyword('');
    setNewReplyText('');
  };

  const handleVerifyAndDeliver = async (lead: FollowFunnelLead) => {
    try {
      const ourHandle = user?.username || 'our page';
      const rule = rules.find(r => r.id === lead.ruleId);
      const deliveryTemplate =
        rule?.followGated?.verifiedDeliveryText ||
        `🎉 Follow verified! Here is your exclusive access to {resource_title}: {resource_url}`;

      const deliveryMessage = deliveryTemplate
        .replace(/\{username\}/g, lead.username)
        .replace(/\{resource_title\}/g, lead.resourceTitle)
        .replace(/\{our_username\}/g, ourHandle)
        .replace(/\{resource_url\}/g, lead.resourceUrl);

      const uniqueDelivery = makeReplyTextUnique(deliveryMessage);

      // Send delivery DM via Graph API
      const dmRes = await sendDirectMessageToUser(
        lead.commentId,
        uniqueDelivery,
        config.selectedIgUserId,
        config.accessToken
      );

      const updatedLead: FollowFunnelLead = {
        ...lead,
        status: 'delivered',
        lastInteractionAt: new Date().toISOString(),
        log: [
          ...lead.log,
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'verified',
            message: `Follower verified for @${lead.username}.`,
          },
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'delivered',
            message: dmRes.simulated
              ? `Resource sent via simulated fallback (Notice: ${dmRes.message || 'Check instagram_manage_messages'})`
              : `Resource delivered live via Meta Graph API: "${lead.resourceTitle}" (${lead.resourceUrl})`,
          },
        ],
      };

      saveFunnelLeads(funnelLeads.map(l => (l.id === lead.id ? updatedLead : l)));
      if (dmRes.simulated) {
        addActivity(`Delivered resource to @${lead.username} (Notice: ${dmRes.message || 'Meta DM simulated'})`, 'info');
      } else {
        addActivity(`🎉 Follow verified & resource delivered to @${lead.username}!`, 'success');
      }
    } catch (err: any) {
      addActivity(`Verification delivery notice: ${err.message}`, 'error');
    }
  };

  const handleDeliverDirectly = async (lead: FollowFunnelLead) => {
    addKnownFollower(lead.username);
    await handleVerifyAndDeliver(lead);
  };

  const handleSendReminder = async (lead: FollowFunnelLead) => {
    try {
      const ourHandle = user?.username || 'our page';
      const rule = rules.find(r => r.id === lead.ruleId);
      const maxReminders = rule?.followGated?.maxReminders || 2;

      if (lead.reminderCount >= maxReminders) {
        addActivity(`Max reminder limit (${maxReminders}) reached for @${lead.username} to protect spam rating.`, 'info');
        return;
      }

      const reminderTemplate =
        rule?.followGated?.unfollowedReminderText ||
        `Hey @{username}! ⚠️ We couldn't verify that you're following @{our_username} yet. Please follow our page first so we can unlock the {resource_title} for you! 🚀`;

      const reminderMessage = reminderTemplate
        .replace(/\{username\}/g, lead.username)
        .replace(/\{resource_title\}/g, lead.resourceTitle)
        .replace(/\{our_username\}/g, ourHandle)
        .replace(/\{resource_url\}/g, lead.resourceUrl);

      const uniqueReminder = makeReplyTextUnique(reminderMessage);

      // Send reminder DM
      await sendDirectMessageToUser(
        lead.commentId,
        uniqueReminder,
        config.selectedIgUserId,
        config.accessToken
      );

      const newReminderCount = lead.reminderCount + 1;
      const updatedLead: FollowFunnelLead = {
        ...lead,
        reminderCount: newReminderCount,
        status: newReminderCount >= maxReminders ? 'unresponsive' : 'pending_follow',
        lastInteractionAt: new Date().toISOString(),
        log: [
          ...lead.log,
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'reminder',
            message: `Reminder #${newReminderCount} sent: Follow check reminder dispatched.`,
          },
        ],
      };

      saveFunnelLeads(funnelLeads.map(l => (l.id === lead.id ? updatedLead : l)));
      addActivity(`Follow reminder #${newReminderCount} sent to @${lead.username}`, 'info');
    } catch (err: any) {
      addActivity(`Failed to send reminder: ${err.message}`, 'error');
    }
  };

  const toggleLeadLog = (leadId: string) => {
    setExpandedLeadLogs(prev => ({ ...prev, [leadId]: !prev[leadId] }));
  };

  const handleDeleteLead = (leadId: string) => {
    const nextLeads = funnelLeads.filter(l => l.id !== leadId);
    saveFunnelLeads(nextLeads);
    addActivity('Deleted lead record from funnel ledger', 'info');
  };


  const handleGenerateAiReply = async (commentId: string, commentText: string, username: string) => {
    setIsGeneratingMap(prev => ({ ...prev, [commentId]: true }));
    try {
      // 1. Check if any active keyword rule matches this comment first!
      const matchedRule = rules.find(r => r.isActive && isStandaloneKeywordMatch(commentText, r.triggerKeyword));
      let replyText = '';
      if (matchedRule && matchedRule.replyText) {
        replyText = matchedRule.replyText.replace(/\{username\}/g, username);
        addActivity(`Matched keyword rule "${matchedRule.triggerKeyword}" for @${username}`, 'success');
      } else {
        replyText = await generateAiCommentReply(
          commentText,
          username,
          config.geminiApiKey,
          config.openRouterApiKey,
          userId,
          user?.username
        );
        addActivity(`Instagram Manager AI generated response for @${username}`, 'info');
      }
      const uniqueText = makeReplyTextUnique(replyText);
      setReplyTextMap(prev => ({ ...prev, [commentId]: uniqueText }));
    } catch (e: any) {
      addActivity(`AI generation error: ${e.message}`, 'error');
    } finally {
      setIsGeneratingMap(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const handleSendReply = async (commentId: string, username: string, customText?: string) => {
    const rawText = customText || replyTextMap[commentId];
    if (!rawText || !config.accessToken) return;

    const uniqueText = makeReplyTextUnique(rawText);
    inFlightRef.current.add(commentId);
    try {
      await replyToComment(commentId, uniqueText, config.accessToken);
      addActivity(`Reply posted via Graph API to @${username}!`, 'success');
      setReplyTextMap(prev => ({ ...prev, [commentId]: '' }));
      markCommentAsReplied(commentId, username, uniqueText, 'You');
    } catch (err: any) {
      addActivity(`Failed to reply: ${err.message}`, 'error');
    } finally {
      inFlightRef.current.delete(commentId);
    }
  };

  const handleToggleHide = async (commentId: string, currentHide: boolean) => {
    if (!config.accessToken) return;
    try {
      await toggleHideComment(commentId, !currentHide, config.accessToken);
      setComments(
        comments.map(c => (c.id === commentId ? { ...c, hidden: !currentHide } : c))
      );
      addActivity(`Comment ${!currentHide ? 'hidden' : 'unhidden'} via Graph API`, 'info');
    } catch (err: any) {
      addActivity(`Failed to toggle hide: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!config.accessToken) return;
    try {
      await deleteComment(commentId, config.accessToken);
      setComments(comments.filter(c => c.id !== commentId));
      addActivity('Comment deleted via Graph API', 'success');
    } catch (err: any) {
      addActivity(`Failed to delete comment: ${err.message}`, 'error');
    }
  };

  const unrepliedComments = comments.filter(c => !isCommentAlreadyReplied(c));
  const displayedComments = commentFilter === 'unreplied' ? unrepliedComments : comments;

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b-2 border-slateDark/10">
        <div>
          <h1 className="font-heading text-2xl font-black text-slateDark flex items-center gap-2">
            <MessageSquareCode className="text-pinkPop fill-slateDark shrink-0" /> Comment Automation & AI Agent
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-1">
            Autonomous AI agent instant comment detection, context & tone analysis, and Graph API auto-reply
          </p>
        </div>

        {/* 3 Sub-Tabs (Strictly <= 2 Words per Tab) */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border-2 border-slateDark shadow-pop-sm flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('agent')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'agent'
                ? 'bg-yellowPop text-slateDark shadow-pop-sm border-2 border-slateDark'
                : 'text-slate-600 hover:text-slateDark'
            }`}
          >
            <Bot size={15} />
            <span>AI Agent</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'rules'
                ? 'bg-pinkPop text-slateDark shadow-pop-sm border-2 border-slateDark'
                : 'text-slate-600 hover:text-slateDark'
            }`}
          >
            <Zap size={15} />
            <span>Auto Rules</span>
          </button>

          <button
            onClick={() => setActiveTab('threads')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'threads'
                ? 'bg-mintPop text-slateDark shadow-pop-sm border-2 border-slateDark'
                : 'text-slate-600 hover:text-slateDark'
            }`}
          >
            <Layout size={15} />
            <span>Post Threads</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: Autonomous AI Comment Agent */}
      {activeTab === 'agent' && (
        <StickerCard
          title="Autonomous AI Comment Agent"
          subtitle="Instant comment auto-catching, context & sender tone/gender analysis, and zero-touch auto-replying"
          icon={Bot}
          iconBgColor="bg-yellowPop text-slateDark"
          shadowColor="yellow"
        >
          <div className="space-y-6">
            {/* Agent Control & Status Dashboard */}
            <div className="bg-white border-2 border-slateDark rounded-2xl p-5 shadow-pop-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border-2 border-slateDark ${isAgentActive ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-500'}`}>
                  <Bot size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-lg font-black text-slateDark">
                      AI Autonomous Agent
                    </h3>
                    {isAgentActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active & Catching
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-400">
                        Agent Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    AI scans posts, detects new unreplied comments, and posts respectful, 100% gender-neutral replies.
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                      🛡️ Gender-Neutral Guardrails Active
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      (Zero assumptions; avoids "bro", "sis", or gendered slang)
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons & Agent Counters */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                <div className="text-right px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Auto-Replied</div>
                  <div className="font-heading font-black text-base text-slateDark">{totalAutoReplied}</div>
                </div>

                <CandyButton
                  variant={isAgentActive ? 'pink' : 'yellow'}
                  size="md"
                  onClick={() => {
                    setIsAgentActive(!isAgentActive);
                    addActivity(
                      isAgentActive ? 'AI Comment Agent paused by user' : 'AI Comment Agent activated — live auto-replying enabled',
                      isAgentActive ? 'info' : 'success'
                    );
                  }}
                  icon={isAgentActive ? Pause : Play}
                >
                  {isAgentActive ? 'Pause Agent' : 'Activate AI Agent'}
                </CandyButton>
              </div>
            </div>

            {/* AI Agent Real-Time Live Activity Stream */}
            <div className="bg-slate-900 text-white border-2 border-slateDark rounded-2xl p-4 space-y-3 shadow-pop-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-yellowPop" />
                  <h4 className="font-heading text-xs font-black uppercase tracking-wider text-yellowPop">
                    Live AI Agent Execution Stream
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {isAgentActive ? '⚡ Gemini Auto-Catching Active' : '⏸️ Stream Paused'}
                </span>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-2 text-xs font-mono pr-1 scrollbar-thin">
                {agentLogs.length === 0 ? (
                  <div className="text-slate-500 py-3 text-center text-xs">
                    {isAgentActive
                      ? 'Waiting for incoming post comments... Agent is active and listening.'
                      : 'Agent is paused. Activate agent to start live comment auto-reply stream.'}
                  </div>
                ) : (
                  agentLogs.map(log => (
                    <div key={log.id} className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="text-yellowPop font-bold">@{log.username}</span>
                        <span>{log.timestamp}</span>
                      </div>
                      <p className="text-slate-300 text-[11px] truncate">
                        💬 "<span className="text-slate-200">{log.commentText}</span>"
                      </p>
                      <p className="text-emerald-400 font-sans text-xs font-semibold flex items-center gap-1.5 pt-0.5">
                        <Sparkles size={12} className="shrink-0" />
                        <span>{log.aiReply}</span>
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Live Posts & Manual Comment Inspector */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 border-2 border-slateDark p-3 rounded-2xl">
                {/* Post Selector */}
                <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
                  <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark shrink-0">
                    Select Post:
                  </label>
                  <select
                    value={selectedMediaId}
                    onChange={e => setSelectedMediaId(e.target.value)}
                    className="hard-input py-1.5 text-xs font-semibold cursor-pointer w-full"
                  >
                    <option value="all">
                      ⚡ All Posts (Global Auto-Reply Mode) — {mediaList.length} posts
                    </option>
                    {mediaList.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.caption ? m.caption.substring(0, 45) + '...' : `Media ID ${m.id}`} ({m.comments_count} comments)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 bg-white p-1 border-2 border-slateDark rounded-xl shrink-0">
                  <button
                    onClick={() => setCommentFilter('unreplied')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      commentFilter === 'unreplied'
                        ? 'bg-rose-500 text-white shadow-pop-sm'
                        : 'text-slate-600 hover:text-slateDark'
                    }`}
                  >
                    <Clock size={13} />
                    <span>Unreplied ({unrepliedComments.length})</span>
                  </button>
                  <button
                    onClick={() => setCommentFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      commentFilter === 'all'
                        ? 'bg-slateDark text-white shadow-pop-sm'
                        : 'text-slate-600 hover:text-slateDark'
                    }`}
                  >
                    <Filter size={13} />
                    <span>All ({comments.length})</span>
                  </button>
                </div>
              </div>

              {/* Comments Feed */}
              {isLoadingComments ? (
                <div className="p-8 text-center text-slate-500 font-bold bg-white border-2 border-slateDark rounded-2xl">
                  Fetching comments via Meta Graph API...
                </div>
              ) : displayedComments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-bold bg-white border-2 border-dashed border-slate-300 rounded-2xl">
                  {commentFilter === 'unreplied'
                    ? '🎉 All comments on this post are replied to or processed by AI Agent.'
                    : 'No live comments found on this post.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedComments.map(c => {
                    const isGenerating = isGeneratingMap[c.id];
                    const isReplied = isCommentAlreadyReplied(c);

                    return (
                      <div
                        key={c.id}
                        className={`bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm transition-all ${
                          c.hidden ? 'opacity-60 bg-slate-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-sm font-black text-slateDark">@{c.username}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}
                            </span>

                            {isReplied ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-400 text-[10px] font-bold flex items-center gap-1">
                                <CheckCircle2 size={11} /> Auto-Replied
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-400 text-[10px] font-extrabold uppercase tracking-wide">
                                Pending AI
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleHide(c.id, !!c.hidden)}
                              className="px-2.5 py-1 text-xs font-bold border border-slateDark rounded-lg hover:bg-slate-100 flex items-center gap-1"
                            >
                              {c.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                              <span>{c.hidden ? 'Unhide' : 'Hide'}</span>
                            </button>

                            <button
                              onClick={() => handleDelete(c.id)}
                              className="px-2.5 py-1 text-xs font-bold border border-slateDark rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center gap-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Comment text */}
                        <p className="text-xs font-medium text-slate-800 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                          {sanitizeString(c.text)}
                        </p>

                        {/* Existing Sent Replies (Live Graph API & Persisted) */}
                        {c.replies && c.replies.length > 0 && (
                          <div className="mt-2.5 pl-3 border-l-2 border-emerald-500 space-y-1.5">
                            {c.replies.map((r, rIdx) => (
                              <div key={r.id || rIdx} className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-950">
                                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 pb-0.5">
                                  <span className="flex items-center gap-1">
                                    <Sparkles size={11} className="text-emerald-600" />
                                    <span>↳ {r.username || 'AI Agent'}</span>
                                  </span>
                                  <span className="text-[10px] text-emerald-600 font-mono">
                                    {r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sent'}
                                  </span>
                                </div>
                                <p className="text-emerald-900 font-medium whitespace-pre-wrap">{r.text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Manual / Inspector AI Reply Input Bar */}
                        <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            placeholder={`Type reply to @${c.username} or click 'AI Write'...`}
                            value={replyTextMap[c.id] || ''}
                            onChange={e => setReplyTextMap({ ...replyTextMap, [c.id]: e.target.value })}
                            className="hard-input py-2 text-xs flex-1"
                          />

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleGenerateAiReply(c.id, c.text, c.username)}
                              disabled={isGenerating}
                              className="px-3.5 py-2 bg-violet-100 text-violet-900 border-2 border-slateDark rounded-xl text-xs font-heading font-black hover:bg-violet-200 flex items-center gap-1.5 shadow-pop-sm shrink-0"
                            >
                              <Bot size={14} className="text-violetBrand" />
                              <span>{isGenerating ? 'AI Writing...' : 'AI Write'}</span>
                            </button>

                            <CandyButton
                              variant="yellow"
                              size="sm"
                              onClick={() => handleSendReply(c.id, c.username)}
                              icon={Reply}
                              className="shrink-0"
                            >
                              Post Reply
                            </CandyButton>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </StickerCard>
      )}

      {/* SUB-TAB 2: Rule-Based Auto Responder */}
      {activeTab === 'rules' && (
        <StickerCard
          title="Standalone Keyword Auto-Responder"
          subtitle="Strict standalone word matching to trigger Graph API comment replies"
          icon={MessageSquareCode}
          iconBgColor="bg-pinkPop text-slateDark"
          shadowColor="pink"
          headerAction={
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={triggerManualScan}
                disabled={isScanningManual}
                className="px-3 py-1.5 rounded-xl border-2 border-slateDark bg-white hover:bg-slate-100 font-heading text-xs font-black flex items-center gap-1.5 shadow-pop-sm cursor-pointer transition-all disabled:opacity-50 shrink-0"
                title="Immediately query Meta Graph API for new comments across all posts"
              >
                <RefreshCw size={13} className={isScanningManual ? "animate-spin text-emerald-600" : "text-slateDark"} />
                <span>{isScanningManual ? "Scanning..." : "⚡ Scan Comments Now"}</span>
              </button>

              <button
                type="button"
                onClick={toggleFollowGated}
                className={`px-3.5 py-1.5 rounded-xl border-2 border-slateDark font-heading text-xs font-black flex items-center gap-2 transition-all shadow-pop-sm cursor-pointer select-none shrink-0 ${
                  isFollowGated
                    ? 'bg-violetBrand text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-700'
                }`}
                title="First click turns ON, second click turns OFF. Stays on until clicked again."
              >
                <Sparkles size={14} className={isFollowGated ? 'text-yellowPop' : 'text-slate-400'} />
                <span>Follow-to-Unlock Funnel</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                    isFollowGated
                      ? 'bg-yellowPop text-slateDark'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isFollowGated ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          }
        >
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Rule Creator */}
              <div className="lg:col-span-1 bg-white border-2 border-slateDark rounded-2xl p-5 space-y-4 shadow-pop-sm">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-slateDark/10">
                  <Bot size={20} className="text-violetBrand" />
                  <h3 className="font-heading text-base font-black text-slateDark">Add Keyword Rule</h3>
                </div>

                <HardInput
                  label="Trigger Keyword"
                  placeholder="e.g. GROW or PRICE"
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  badge="Standalone Word Match"
                  helperText="Matches standalone words & hashtags (e.g. 'GROW', '#grow', 'GROW!'). Does not match 'growing'."
                />

                {!isFollowGated ? (
                  <div>
                    <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark block mb-1">
                      Reply Template (Public Comment)
                    </label>
                    <textarea
                      rows={3}
                      value={newReplyText}
                      onChange={e => setNewReplyText(e.target.value)}
                      placeholder="Hey @{username}! Check your DMs right now..."
                      className="hard-input text-xs"
                    />
                  </div>
                ) : (
                  /* Combined & Auto-Filled Follow-Gated Funnel Fields */
                  <div className="space-y-3 pt-1 border-t border-slate-200">
                    <div className="space-y-3 bg-violet-50/50 p-3.5 rounded-xl border border-violet-200">
                      <div className="font-heading text-xs font-black text-violet-900 flex items-center gap-1.5">
                        <Link2 size={13} className="text-violetBrand" />
                        <span>Gated Resource Details</span>
                      </div>

                      <HardInput
                        label="Resource Name"
                        placeholder="e.g. Instagram Growth Blueprint 2026"
                        value={newResourceTitle}
                        onChange={e => setNewResourceTitle(e.target.value)}
                        badge="Auto-Filled"
                      />

                      <HardInput
                        label="Download Link / URL"
                        placeholder="e.g. https://yourbrand.com/growth-playbook.pdf"
                        value={newResourceUrl}
                        onChange={e => setNewResourceUrl(e.target.value)}
                        badge="Delivery URL"
                      />
                    </div>

                    {/* Compact Automated Workflow Preview */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-heading font-black text-slateDark flex items-center gap-1.5">
                          <Sparkles size={12} className="text-amber-500" />
                          <span>Automated Funnel Messages</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAdvancedTemplates(!showAdvancedTemplates)}
                          className="text-[11px] font-bold text-violetBrand hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{showAdvancedTemplates ? 'Hide Messages' : 'Customize'}</span>
                          {showAdvancedTemplates ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-1.5 font-medium leading-relaxed">
                        <div className="bg-emerald-50 text-emerald-900 p-2 rounded-lg border border-emerald-200">
                          <strong>⭐ If user already follows:</strong> Direct delivery (Public reply + Instant Resource DM with download link).
                        </div>
                        <div className="bg-amber-50 text-amber-900 p-2 rounded-lg border border-amber-200">
                          <strong>🛡️ If user does not follow:</strong> Follow-gate flow (Public reply ➔ DM asking to follow @{user?.username || 'our account'} ➔ Deliver once followed).
                        </div>
                      </div>
                    </div>

                    {/* Optional Custom Templates Accordion */}
                    {showAdvancedTemplates && (
                      <div className="space-y-3 pt-2 border-t border-slate-200">
                        {/* Branch A: Already Follows */}
                        <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200 space-y-2.5">
                          <span className="font-heading text-[11px] font-bold uppercase text-emerald-800 flex items-center gap-1">
                            <span>⭐ Branch A: When User Already Follows</span>
                          </span>
                          <div>
                            <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-slateDark block mb-1">
                              Comment Reply (Already Following)
                            </label>
                            <textarea
                              rows={2}
                              value={newAlreadyFollowingCommentReplyText}
                              onChange={e => setNewAlreadyFollowingCommentReplyText(e.target.value)}
                              placeholder="Hey @{username}! Thanks for following @{our_username}! 🎉 Sent your free copy of {resource_title} directly to your DMs!"
                              className="hard-input text-xs"
                            />
                          </div>
                          <div>
                            <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-slateDark block mb-1">
                              Direct Resource DM (Already Following)
                            </label>
                            <textarea
                              rows={2}
                              value={newAlreadyFollowingDmText}
                              onChange={e => setNewAlreadyFollowingDmText(e.target.value)}
                              placeholder="Hey @{username}! 🚀 Since you're already following @{our_username}, here is your instant access to {resource_title}: {resource_url}&#10;Enjoy!"
                              className="hard-input text-xs"
                            />
                          </div>
                        </div>

                        {/* Branch B: Procedural Follow-Gate */}
                        <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-200 space-y-2.5">
                          <span className="font-heading text-[11px] font-bold uppercase text-amber-900 flex items-center gap-1">
                            <span>🛡️ Branch B: When User Does Not Follow Yet</span>
                          </span>
                          <div>
                            <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-slateDark block mb-1">
                              Public Comment Reply (Ask to check DMs)
                            </label>
                            <textarea
                              rows={2}
                              value={newCommentReplyText}
                              onChange={e => setNewCommentReplyText(e.target.value)}
                              placeholder="Hey @{username}! I've sent the {resource_title} to your DMs! Check your requests 📩"
                              className="hard-input text-xs"
                            />
                          </div>

                          <div>
                            <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-slateDark block mb-1">
                              Initial DM: Request to Follow
                            </label>
                            <textarea
                              rows={2}
                              value={newInitialDmText}
                              onChange={e => setNewInitialDmText(e.target.value)}
                              placeholder="Hey @{username}! 👋 Thanks for commenting! To unlock your free copy of {resource_title}, please make sure you follow our account @{our_username} first! Once followed, tap below 👇"
                              className="hard-input text-xs"
                            />
                          </div>

                          <div>
                            <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-slateDark block mb-1">
                              Unfollowed Reminder DM
                            </label>
                            <textarea
                              rows={2}
                              value={newReminderDmText}
                              onChange={e => setNewReminderDmText(e.target.value)}
                              placeholder="Hey @{username}! ⚠️ We couldn't verify that you're following @{our_username} yet. Please follow our page first so we can unlock {resource_title} for you! 🚀"
                              className="hard-input text-xs"
                            />
                          </div>

                          <div>
                            <label className="font-heading text-[10px] font-bold uppercase tracking-wider text-slateDark block mb-1">
                              Follow-Verified Delivery DM
                            </label>
                            <textarea
                              rows={2}
                              value={newDeliveryDmText}
                              onChange={e => setNewDeliveryDmText(e.target.value)}
                              placeholder="🎉 Follow verified! Here is your exclusive download link for {resource_title}: {resource_url}&#10;Enjoy and let us know your feedback!"
                              className="hard-input text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-xl">
                          <span className="font-heading text-xs font-bold text-slateDark">Max Reminders</span>
                          <select
                            value={newMaxReminders}
                            onChange={e => setNewMaxReminders(parseInt(e.target.value, 10))}
                            className="hard-input py-1 px-2 text-xs font-bold cursor-pointer"
                          >
                            <option value={1}>1 Reminder Max</option>
                            <option value={2}>2 Reminders (Default)</option>
                            <option value={3}>3 Reminders Max</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <CandyButton variant="pink" size="sm" onClick={handleAddRule} icon={Plus} className="w-full">
                  Save Keyword Rule
                </CandyButton>
              </div>

              {/* Active Rules List */}
              <div className="lg:col-span-2 space-y-3">
                <h3 className="font-heading text-base font-black text-slateDark flex items-center justify-between">
                  <span>Active Standalone Keyword Rules ({rules.length})</span>
                  <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-400">
                    Strict Boundary Matching
                  </span>
                </h3>

                <div className="space-y-3">
                  {rules.map(r => {
                    const isGated = Boolean(r.followGated?.enabled);
                    return (
                      <div
                        key={r.id}
                        className={`bg-white border-2 border-slateDark rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-pop-sm transition-all ${
                          isGated ? 'border-l-8 border-l-violetBrand' : ''
                        }`}
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full bg-yellowPop border border-slateDark font-heading font-black text-xs">
                              KEYWORD: "\b{r.triggerKeyword}\b"
                            </span>
                            {isGated ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-900 border border-violet-400 font-heading font-black text-[10px] flex items-center gap-1">
                                <Sparkles size={11} className="text-violetBrand" />
                                Follow-to-Unlock DM Funnel
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-mono text-[10px]">
                                Comment Reply Only
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-slate-400 font-mono">
                              Triggers: {r.triggerCount}
                            </span>
                          </div>

                          {isGated && r.followGated ? (
                            <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <div className="flex items-center gap-1.5 text-violetBrand font-bold text-[11px]">
                                <Link2 size={13} />
                                <span>Gated Resource: <strong>{r.followGated.resourceTitle}</strong></span>
                                <a
                                  href={r.followGated.resourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-500 hover:text-slate-800 ml-1 inline-flex items-center gap-0.5"
                                >
                                  <ExternalLink size={10} />
                                </a>
                              </div>
                              <div className="text-[11px] text-slate-700">
                                <span className="font-bold text-slate-900">1. Public Reply:</span> {r.followGated.commentReplyText || r.replyText}
                              </div>
                              <div className="text-[11px] text-slate-700">
                                <span className="font-bold text-slate-900">2. Initial DM:</span> {r.followGated.initialDmText}
                              </div>
                              <div className="text-[11px] text-slate-500 italic">
                                <span className="font-bold text-slate-700 not-italic">3. Verified Delivery:</span> {r.followGated.verifiedDeliveryText}
                              </div>
                              {r.followGated.alreadyFollowingDmText && (
                                <div className="text-[11px] text-emerald-800 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                                  <span className="font-bold text-emerald-950">⭐ If Already Follows:</span> {r.followGated.alreadyFollowingDmText}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs font-semibold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                              {r.replyText}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => saveRules(rules.filter(x => x.id !== r.id))}
                          className="p-2 rounded-xl border-2 border-slateDark text-rose-600 hover:bg-rose-50 shadow-pop-sm shrink-0 self-end sm:self-center"
                          title="Delete Rule"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* LIVE FOLLOW-GATED FUNNEL LEADS MONITOR */}
            <div className="bg-slate-50 border-2 border-slateDark rounded-2xl p-5 space-y-5 shadow-pop-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-slateDark/10 pb-4">
                <div>
                  <h3 className="font-heading text-base font-black text-slateDark flex items-center gap-2">
                    <Users size={20} className="text-violetBrand" />
                    <span>Live Follow-Gated Funnel Leads Monitor</span>
                  </h3>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    Real-time tracker of commenters going through the Follow-to-Unlock verification & resource delivery flow
                  </p>
                </div>

                {/* Metrics Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="bg-white border border-slateDark/20 rounded-xl px-2.5 py-1 text-center shadow-sm">
                    <div className="text-[10px] uppercase font-mono font-bold text-slate-500">Total Leads</div>
                    <div className="font-heading font-black text-sm text-slateDark">{funnelLeads.length}</div>
                  </div>
                  <div className="bg-amber-100/70 border border-amber-300 rounded-xl px-2.5 py-1 text-center shadow-sm">
                    <div className="text-[10px] uppercase font-mono font-bold text-amber-800">Pending Follow</div>
                    <div className="font-heading font-black text-sm text-amber-900">
                      {funnelLeads.filter(l => l.status === 'pending_follow').length}
                    </div>
                  </div>
                  <div className="bg-emerald-100/70 border border-emerald-300 rounded-xl px-2.5 py-1 text-center shadow-sm">
                    <div className="text-[10px] uppercase font-mono font-bold text-emerald-800">Delivered</div>
                    <div className="font-heading font-black text-sm text-emerald-900">
                      {funnelLeads.filter(l => l.status === 'delivered').length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white p-1 border-2 border-slateDark rounded-xl">
                  <button
                    onClick={() => setActiveLeadFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeLeadFilter === 'all'
                        ? 'bg-slateDark text-white shadow-pop-sm'
                        : 'text-slate-600 hover:text-slateDark'
                    }`}
                  >
                    All Leads ({funnelLeads.length})
                  </button>
                  <button
                    onClick={() => setActiveLeadFilter('pending')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeLeadFilter === 'pending'
                        ? 'bg-amber-500 text-white shadow-pop-sm'
                        : 'text-slate-600 hover:text-slateDark'
                    }`}
                  >
                    Awaiting Follow ({funnelLeads.filter(l => l.status === 'pending_follow').length})
                  </button>
                  <button
                    onClick={() => setActiveLeadFilter('delivered')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeLeadFilter === 'delivered'
                        ? 'bg-emerald-600 text-white shadow-pop-sm'
                        : 'text-slate-600 hover:text-slateDark'
                    }`}
                  >
                    Delivered ({funnelLeads.filter(l => l.status === 'delivered').length})
                  </button>
                </div>

                <span className="text-[11px] text-slate-500 font-mono">
                  Meta Graph API Follower Funnel • Automatic Retry Throttling Active
                </span>
              </div>



              {/* Verified Followers Management Bar (Instant Direct Delivery Bypass) */}
              <div className="bg-white border-2 border-slateDark/20 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 font-heading text-xs font-black text-slateDark">
                    <UserCheck size={15} className="text-emerald-600" />
                    <span>Verified Followers (Auto-Bypass Gate & Direct Deliver)</span>
                    <span className="text-[10px] text-slate-500 font-mono font-normal">
                      ({knownFollowers.size} active)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Add @username..."
                      value={newFollowerInput}
                      onChange={e => setNewFollowerInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addKnownFollower(newFollowerInput);
                        }
                      }}
                      className="px-2.5 py-1 text-xs border border-slateDark rounded-lg font-mono w-44 focus:outline-none focus:ring-1 focus:ring-violetBrand"
                    />
                    <button
                      type="button"
                      onClick={() => addKnownFollower(newFollowerInput)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Array.from(knownFollowers).map(handle => (
                    <span
                      key={handle}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 font-mono text-xs font-medium"
                    >
                      <span>@{handle}</span>
                      <button
                        type="button"
                        onClick={() => removeKnownFollower(handle)}
                        className="text-slate-400 hover:text-rose-600 font-bold ml-0.5 leading-none cursor-pointer"
                        title="Remove follower"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Leads Card List */}
              <div className="space-y-3">
                {funnelLeads
                  .filter(l => {
                    if (activeLeadFilter === 'pending') return l.status === 'pending_follow';
                    if (activeLeadFilter === 'delivered') return l.status === 'delivered';
                    return true;
                  })
                  .map(lead => {
                    const isExpanded = Boolean(expandedLeadLogs[lead.id]);
                    const cleanUsername = lead.username.toLowerCase().replace(/^@/, '');
                    const isKnown = knownFollowers.has(cleanUsername);

                    return (
                      <div
                        key={lead.id}
                        className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-pop-sm space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          {/* User & Keyword */}
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-violet-100 border-2 border-slateDark text-violet-900 font-heading font-black text-xs flex items-center justify-center shrink-0">
                              {lead.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-heading font-black text-sm text-slateDark">
                                  @{lead.username}
                                </span>
                                {isKnown && (
                                  <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-300 font-bold text-[10px]">
                                    ⭐ Verified Follower
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full bg-yellowPop border border-slateDark font-mono font-bold text-[10px]">
                                  Keyword: "{lead.keyword}"
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                <Link2 size={12} className="text-violetBrand" />
                                <span>{lead.resourceTitle}</span>
                              </div>
                            </div>
                          </div>

                          {/* Status & Action Buttons */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {lead.status === 'pending_follow' && (
                              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-400 font-bold text-xs flex items-center gap-1.5">
                                <Clock size={12} />
                                Awaiting Follow (DM 1 Sent)
                              </span>
                            )}
                            {lead.status === 'delivered' && (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-400 font-bold text-xs flex items-center gap-1.5">
                                <CheckCircle2 size={12} />
                                Follow Verified & Delivered
                              </span>
                            )}
                            {lead.status === 'unresponsive' && (
                              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center gap-1.5">
                                <AlertCircle size={12} />
                                Max Reminders Sent
                              </span>
                            )}

                            {lead.status === 'pending_follow' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDeliverDirectly(lead)}
                                  className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-heading font-black flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                  title="User already follows! Direct deliver the resource without gating"
                                >
                                  <Sparkles size={13} className="text-yellowPop" />
                                  <span>⭐ Already Follows? Direct Deliver</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleVerifyAndDeliver(lead)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-heading font-black flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                  title="Verify follow and immediately dispatch resource delivery DM"
                                >
                                  <UserCheck size={13} />
                                  <span>Verify & Deliver</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendReminder(lead)}
                                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-400 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                  title="Send polite reminder DM to follow our account"
                                >
                                  <span>Send Reminder ({lead.reminderCount}/2)</span>
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => toggleLeadLog(lead.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <span>Audit Log</span>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                              title="Delete this lead entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Expandable Audit Log */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5 bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px]">
                            <div className="text-[10px] text-yellowPop font-bold uppercase tracking-wider pb-1 border-b border-slate-800">
                              Step-by-Step Funnel Audit Trail for @{lead.username}
                            </div>
                            {lead.log.map((entry, idx) => (
                              <div key={idx} className="flex items-start justify-between gap-3 text-slate-300">
                                <div className="flex items-center gap-2">
                                  <span className="text-emerald-400 font-bold">[{entry.type.toUpperCase()}]</span>
                                  <span>{entry.message}</span>
                                </div>
                                <span className="text-slate-500 text-[10px] shrink-0">{entry.timestamp}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </StickerCard>
      )}

      {/* SUB-TAB 3: Post Titles & Message Chat Window Studio */}
      {activeTab === 'threads' && (
        <StickerCard
          title="Post Titles & Message Chat Window Studio"
          subtitle="Select post by title to inspect incoming comments & AI replies in a chat window"
          icon={Layout}
          iconBgColor="bg-mintPop text-slateDark"
          shadowColor="mint"
        >
          <div className="space-y-6">
            {/* Top Post Title Selector */}
            <div className="bg-slate-50 border-2 border-slateDark p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="font-heading text-xs font-bold uppercase tracking-wider text-slateDark flex items-center gap-2">
                  <span>Select Instagram Post:</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({mediaList.length} posts loaded)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => selectedMediaId && fetchComments(selectedMediaId)}
                  disabled={isLoadingComments || !selectedMediaId}
                  className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 border border-slateDark rounded-lg text-slate-700 flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
                  title="Re-query Meta Graph API for new comments and replies on this post"
                >
                  <RefreshCw size={13} className={isLoadingComments ? "animate-spin text-emerald-600" : "text-slate-600"} />
                  <span>{isLoadingComments ? 'Refreshing Graph API...' : 'Sync Comments & Replies'}</span>
                </button>
              </div>

              <select
                value={selectedMediaId}
                onChange={e => setSelectedMediaId(e.target.value)}
                className="hard-input py-2 text-xs font-bold text-slateDark bg-white cursor-pointer w-full"
              >
                <option value="all">
                  ⚡ All Posts (Global Auto-Reply Mode) — ({mediaList.length} posts)
                </option>
                {mediaList.map(m => {
                  const titleSnippet = m.caption ? m.caption.substring(0, 70).replace(/\n/g, ' ') + '...' : `Media ID ${m.id}`;
                  return (
                    <option key={m.id} value={m.id}>
                      📌 {titleSnippet} — ({m.comments_count || 0} comments, ID: {m.id})
                    </option>
                  );
                })}
              </select>

              {/* Selected Post Meta Badge & Visual Preview */}
              {selectedMediaId === 'all' ? (
                <div className="flex items-center gap-3 w-full p-3 bg-yellowPop/20 border-2 border-slateDark rounded-xl text-xs font-semibold text-slate-800">
                  <div className="p-2 bg-yellowPop border-2 border-slateDark rounded-lg shrink-0">
                    <Zap size={16} className="text-slateDark" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-black text-slateDark">Global Autonomous Mode Active</div>
                    <div className="text-[11px] text-slate-600 truncate">
                      Monitoring all {mediaList.length} published posts. AI detects comments and responds automatically across every post.
                    </div>
                  </div>
                </div>
              ) : selectedMediaId ? (
                <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200 text-xs font-semibold text-slate-700">
                  {(() => {
                    const currentPost = mediaList.find(m => m.id === selectedMediaId);
                    if (!currentPost) return null;
                    const previewImg = currentPost.thumbnail_url || currentPost.media_url;
                    return (
                      <div className="flex items-center gap-3 w-full flex-wrap">
                        {previewImg && (
                          <img
                            src={previewImg}
                            alt="Post thumbnail"
                            className="w-12 h-12 object-cover rounded-xl border-2 border-slateDark shadow-pop-sm shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <p className="text-xs text-slate-900 font-bold line-clamp-1">
                            {currentPost.caption ? currentPost.caption.substring(0, 90) : `Post ${currentPost.id}`}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-slateDark text-white font-mono text-[10px]">
                              ID: {currentPost.id}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-900 border border-violet-300 text-[10px] font-bold">
                              {currentPost.media_type}
                            </span>
                            <span className="text-[11px] text-slate-600">❤️ {currentPost.like_count || 0} Likes</span>
                            <span className="text-[11px] text-emerald-700 font-bold">💬 {comments.length} Loaded Thread(s)</span>
                          </div>
                        </div>

                        {currentPost.permalink && (
                          <a
                            href={currentPost.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violetBrand hover:underline text-xs font-bold shrink-0 ml-auto"
                          >
                            View Post on Instagram 🔗
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>

            {/* Chat Window Inspector Card */}
            <div className="bg-slate-950 border-2 border-slateDark rounded-2xl overflow-hidden shadow-pop-lg">
              {/* Chat Window Header Bar */}
              <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 inline-block border border-slate-900"></span>
                    <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block border border-slate-900"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block border border-slate-900"></span>
                  </div>
                  <span className="font-heading text-xs font-black text-slate-200 tracking-wide uppercase flex items-center gap-1.5">
                    <MessageCircle size={15} className="text-emerald-400" />
                    <span>Live Post Comment Thread Stream</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    ● Graph API Synced ({comments.length} Comments)
                  </span>
                </div>
              </div>

              {/* Chat Thread Area with Vertical Scrollbar */}
              <div className="p-4 sm:p-6 max-h-[500px] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-700 bg-slate-950/90">
                {isLoadingComments ? (
                  <div className="p-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center justify-center gap-2">
                    <RefreshCw size={20} className="animate-spin text-emerald-400" />
                    <span>Fetching live comments and replies from Meta Graph API for selected post...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-800 rounded-2xl space-y-2">
                    <p className="font-bold text-slate-300">No comments found on this post yet.</p>
                    <p className="text-[11px] text-slate-500">
                      When users comment on this specific Instagram post, their messages and any existing replies will appear here live.
                    </p>
                    <button
                      type="button"
                      onClick={() => selectedMediaId && fetchComments(selectedMediaId)}
                      className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-700/50 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <RefreshCw size={12} /> Check Again
                    </button>
                  </div>
                ) : (
                  comments.map(c => {
                    // Strictly retrieve actual replies for this comment (no random username cross-matching)
                    const localReplies = commentRepliesMap[c.id] || [];
                    const activeReplies = (c.replies && c.replies.length > 0)
                      ? c.replies
                      : localReplies.map(lr => ({
                          id: lr.id,
                          text: lr.text,
                          username: lr.username || 'You',
                          timestamp: lr.timestamp,
                          like_count: 0,
                          replied: true,
                        }));

                    const hasReplies = activeReplies.length > 0;

                    return (
                      <div key={c.id} className="space-y-3 pb-4 border-b border-slate-800/80 last:border-0">
                        {/* 1. Left-aligned User Comment Bubble */}
                        <div className="flex items-start gap-2.5 max-w-[88%] sm:max-w-[75%]">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-yellowPop font-heading font-black text-xs flex items-center justify-center shrink-0">
                            {c.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm space-y-1">
                            <div className="flex items-center justify-between gap-3 text-[11px]">
                              <span className="font-bold text-yellowPop">@{c.username}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {c.timestamp ? new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-xs text-slate-200 font-medium whitespace-pre-wrap">{c.text}</p>
                            {!hasReplies && (
                              <div className="text-[10px] font-mono text-amber-400/90 pt-0.5 flex items-center gap-1">
                                <span>● Awaiting Reply</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 2. Right-aligned Existing Replies Bubbles (Exact Details From Instagram) */}
                        {hasReplies ? (
                          activeReplies.map((r, rIdx) => (
                            <div key={r.id || rIdx} className="flex items-start gap-2.5 max-w-[88%] sm:max-w-[75%] ml-auto justify-end">
                              <div className="bg-gradient-to-br from-emerald-950 to-teal-950 border border-emerald-500/40 text-emerald-100 p-3 rounded-2xl rounded-tr-none shadow-sm space-y-1 text-right">
                                <div className="flex items-center justify-end gap-2 text-[11px]">
                                  <span className="text-[10px] text-emerald-400/80 font-mono">
                                    {r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sent'}
                                  </span>
                                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                                    <Sparkles size={12} /> {r.username || 'You'}
                                  </span>
                                </div>
                                <p className="text-xs text-emerald-50 font-medium whitespace-pre-wrap text-left">
                                  {r.text}
                                </p>
                                <div className="text-[9px] text-emerald-400/70 font-mono pt-0.5">
                                  ✓ Instagram Graph API Synced
                                </div>
                              </div>

                              <div className="w-8 h-8 rounded-full bg-emerald-900 border border-emerald-400 text-yellowPop font-heading font-black text-xs flex items-center justify-center shrink-0">
                                <Bot size={16} className="text-emerald-300" />
                              </div>
                            </div>
                          ))
                        ) : null}

                        {/* 3. Follow-Gated DM Funnel Inline Status & Actions */}
                        {(() => {
                          const lead = funnelLeads.find(l => l.commentId === c.id || l.username === c.username);
                          if (!lead) return null;
                          return (
                            <div className="ml-4 sm:ml-10 bg-gradient-to-r from-slate-900 to-violet-950/60 border border-violet-500/40 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Sparkles size={13} className="text-violet-400 shrink-0" />
                                <span className="font-heading font-bold text-violet-200">
                                  Follow Funnel: "{lead.resourceTitle}"
                                </span>
                                {lead.status === 'pending_follow' && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                                    ● Awaiting Follow ({lead.reminderCount}/2 Reminders)
                                  </span>
                                )}
                                {lead.status === 'delivered' && (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Resource Delivered
                                  </span>
                                )}
                                {lead.status === 'unresponsive' && (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600 text-[10px] font-bold">
                                    Max Retries Reached
                                  </span>
                                )}
                              </div>

                              {lead.status === 'pending_follow' && (
                                <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleDeliverDirectly(lead)}
                                    className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                    title="Already follows! Bypass follow gate and deliver resource DM now"
                                  >
                                    <Sparkles size={11} className="text-yellowPop" /> Already Follows
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyAndDeliver(lead)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                    title="Verify follow and dispatch resource delivery DM"
                                  >
                                    <UserCheck size={12} /> Verify & Deliver
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSendReminder(lead)}
                                    className="px-2 py-1 bg-amber-900/60 hover:bg-amber-800/80 text-amber-200 border border-amber-600/50 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    title="Send follow check reminder DM"
                                  >
                                    <span>Send Reminder</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {!hasReplies && (
                          /* Unreplied: Inline Quick Reply in Thread Stream */
                          <div className="flex items-center gap-2 pl-4 sm:pl-10 pt-1">
                            <input
                              type="text"
                              placeholder={`Reply to @${c.username}...`}
                              value={replyTextMap[c.id] || ''}
                              onChange={e => setReplyTextMap({ ...replyTextMap, [c.id]: e.target.value })}
                              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs px-3 py-2 rounded-xl flex-1 focus:border-emerald-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleGenerateAiReply(c.id, c.text, c.username)}
                              disabled={isGeneratingMap[c.id]}
                              className="px-2.5 py-2 bg-violet-900/60 text-violet-300 border border-violet-700 hover:bg-violet-800/80 rounded-xl text-xs font-heading font-bold flex items-center gap-1 shrink-0"
                              title="Generate brand-safe, universal AI reply tailored to this comment"
                            >
                              <Sparkles size={12} className="text-violet-300" />
                              <span className="hidden sm:inline">{isGeneratingMap[c.id] ? 'Writing...' : 'AI Suggest'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendReply(c.id, c.username)}
                              disabled={!replyTextMap[c.id]?.trim()}
                              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-40 shrink-0"
                            >
                              <Send size={12} />
                              <span>Send</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </StickerCard>
      )}
    </div>
  );
};

