import { InstagramMedia, CrawlAnalytics, BusinessDiscoveryResult, PostMechanismsAnalysis } from '../types/instagram';

const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
  'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
  'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some',
  'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
  'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'us', 'are', 'is', 'was', 'were', 'been', 'has', 'had', 'more', 'very', 'here', 'much', 'too',
  'really', 'drop', 'link', 'bio', 'check', 'comment', 'share', 'follow', 'post', 'today', 'instagram'
]);

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function analyzeMediaCrawl(media: InstagramMedia[], followersCount: number = 1): CrawlAnalytics {
  if (!media || media.length === 0) {
    return {
      bestPostingDays: [],
      bestPostingHours: [],
      bestPostingTimeSummary: 'Insufficient post history to determine peak hours.',
      topKeywords: [],
      topHooks: [],
      formatPerformance: [],
      hashtagPerformance: [],
      cadenceDaysAvg: 0,
      engagementTier: 'Low',
      diagnosticBadges: [],
    };
  }

  // 1. Overall Interactions & Engagement Baseline
  let totalInteractions = 0;
  media.forEach(m => {
    totalInteractions += (m.like_count || 0) + (m.comments_count || 0);
  });
  const overallAvgEngagement = totalInteractions / media.length;
  const rawEngagementRate = followersCount > 0 ? (overallAvgEngagement / followersCount) * 100 : 0;

  let engagementTier: 'Low' | 'Moderate' | 'High' | 'Viral' = 'Low';
  if (rawEngagementRate >= 5.0) engagementTier = 'Viral';
  else if (rawEngagementRate >= 2.8) engagementTier = 'High';
  else if (rawEngagementRate >= 1.2) engagementTier = 'Moderate';

  // 2. Post Time & Day Heatmap
  const dayBuckets: Record<string, { count: number; totalInteractions: number }> = {};
  const hourBuckets: Record<number, { count: number; totalInteractions: number }> = {};
  DAYS_OF_WEEK.forEach(d => { dayBuckets[d] = { count: 0, totalInteractions: 0 }; });
  for (let h = 0; h < 24; h++) { hourBuckets[h] = { count: 0, totalInteractions: 0 }; }

  // Sort chronological for cadence calculation
  const sortedByTime = [...media].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let cadenceDaysSum = 0;
  let cadenceCount = 0;

  for (let i = 1; i < sortedByTime.length; i++) {
    const diffMs = new Date(sortedByTime[i].timestamp).getTime() - new Date(sortedByTime[i - 1].timestamp).getTime();
    if (diffMs > 0) {
      cadenceDaysSum += diffMs / (1000 * 60 * 60 * 24);
      cadenceCount++;
    }
  }
  const cadenceDaysAvg = cadenceCount > 0 ? parseFloat((cadenceDaysSum / cadenceCount).toFixed(1)) : 1;

  media.forEach(m => {
    if (!m.timestamp) return;
    const date = new Date(m.timestamp);
    const dayName = DAYS_OF_WEEK[date.getDay()];
    const hour = date.getHours();
    const interactions = (m.like_count || 0) + (m.comments_count || 0);

    if (dayBuckets[dayName]) {
      dayBuckets[dayName].count++;
      dayBuckets[dayName].totalInteractions += interactions;
    }
    if (hourBuckets[hour]) {
      hourBuckets[hour].count++;
      hourBuckets[hour].totalInteractions += interactions;
    }
  });

  const bestPostingDays = DAYS_OF_WEEK.map(day => {
    const b = dayBuckets[day];
    return {
      day,
      count: b.count,
      avgEngagement: b.count ? Math.round(b.totalInteractions / b.count) : 0,
    };
  }).sort((a, b) => b.avgEngagement - a.avgEngagement);

  const bestPostingHours = Object.entries(hourBuckets).map(([hrStr, b]) => {
    const hr = parseInt(hrStr, 10);
    const period = hr >= 12 ? 'PM' : 'AM';
    const displayHr = hr % 12 === 0 ? 12 : hr % 12;
    return {
      hour: hr,
      label: `${displayHr}:00 ${period}`,
      count: b.count,
      avgEngagement: b.count ? Math.round(b.totalInteractions / b.count) : 0,
    };
  }).sort((a, b) => b.avgEngagement - a.avgEngagement);

  const topDay = bestPostingDays.find(d => d.count > 0)?.day || bestPostingDays[0]?.day || 'Midweek';
  const topHour = bestPostingHours.find(h => h.count > 0)?.label || '6:00 PM';
  const bestPostingTimeSummary = `${topDay} around ${topHour}`;

  // 3. Format Breakdown (Carousel vs Video/Reel vs Single Image)
  const formatMap: Record<string, { count: number; totalInteractions: number }> = {};
  media.forEach(m => {
    const fmt = m.media_type || 'IMAGE';
    if (!formatMap[fmt]) formatMap[fmt] = { count: 0, totalInteractions: 0 };
    formatMap[fmt].count++;
    formatMap[fmt].totalInteractions += (m.like_count || 0) + (m.comments_count || 0);
  });

  const formatPerformance = Object.entries(formatMap).map(([fmt, data]) => {
    let cleanFmt = fmt;
    if (fmt === 'CAROUSEL_ALBUM') cleanFmt = 'Carousel (Multi-Slide)';
    else if (fmt === 'VIDEO') cleanFmt = 'Reel / Video';
    else if (fmt === 'IMAGE') cleanFmt = 'Single Image';

    return {
      format: cleanFmt,
      count: data.count,
      avgEngagement: Math.round(data.totalInteractions / data.count),
      percent: Math.round((data.count / media.length) * 100),
    };
  }).sort((a, b) => b.avgEngagement - a.avgEngagement);

  // 4. Content Keyword & Hook Extraction
  const keywordMap: Record<string, { count: number; totalInteractions: number }> = {};
  const hooksList: Array<{ hook: string; likes: number; comments: number; engagement: number; mediaType: string }> = [];
  const hashtagMap: Record<string, { count: number; totalInteractions: number }> = {};

  media.forEach(m => {
    const cap = m.caption || '';
    const interactions = (m.like_count || 0) + (m.comments_count || 0);

    // Extract Hook (First line or up to first sentence)
    if (cap.trim()) {
      const cleanFirstLine = cap.split('\n')[0].replace(/[#@]\S+/g, '').trim();
      const hookSnippet = cleanFirstLine.length > 80 ? `${cleanFirstLine.slice(0, 80)}...` : cleanFirstLine;
      if (hookSnippet.length > 12) {
        hooksList.push({
          hook: hookSnippet,
          likes: m.like_count || 0,
          comments: m.comments_count || 0,
          engagement: interactions,
          mediaType: m.media_type,
        });
      }
    }

    // Extract Hashtags
    const tags = cap.match(/#[a-zA-Z0-9_]+/g);
    if (tags) {
      tags.forEach(t => {
        const lower = t.toLowerCase();
        if (!hashtagMap[lower]) hashtagMap[lower] = { count: 0, totalInteractions: 0 };
        hashtagMap[lower].count++;
        hashtagMap[lower].totalInteractions += interactions;
      });
    }

    // Extract Keywords (strip tags & mentions)
    const cleanedText = cap
      .replace(/[#@][a-zA-Z0-9_]+/g, '')
      .replace(/[^\w\s]/gi, ' ')
      .toLowerCase();

    const words = cleanedText.split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w) && isNaN(Number(w)));
    const uniqueInPost = new Set(words);

    uniqueInPost.forEach(word => {
      if (!keywordMap[word]) keywordMap[word] = { count: 0, totalInteractions: 0 };
      keywordMap[word].count++;
      keywordMap[word].totalInteractions += interactions;
    });
  });

  // Sort top hooks by interactions
  const topHooks = hooksList.sort((a, b) => b.engagement - a.engagement).slice(0, 3);

  // Filter & rank top keywords
  const topKeywords = Object.entries(keywordMap)
    .filter(([, data]) => data.count >= 2 || media.length <= 5)
    .map(([word, data]) => {
      const kwAvg = data.totalInteractions / data.count;
      const boostMultiplier = overallAvgEngagement > 0 ? parseFloat((kwAvg / overallAvgEngagement).toFixed(2)) : 1;
      return {
        word,
        count: data.count,
        avgEngagement: Math.round(kwAvg),
        boostMultiplier,
      };
    })
    .sort((a, b) => b.boostMultiplier - a.boostMultiplier)
    .slice(0, 10);

  // Hashtag performance
  const hashtagPerformance = Object.entries(hashtagMap)
    .map(([tag, data]) => ({
      tag,
      count: data.count,
      avgEngagement: Math.round(data.totalInteractions / data.count),
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 15);

  // 5. Diagnostic Badges & Health Alerts
  const diagnosticBadges: Array<{ type: 'warning' | 'success' | 'info'; title: string; message: string }> = [];

  const imageFormat = formatPerformance.find(f => f.format === 'Single Image');
  const carouselFormat = formatPerformance.find(f => f.format.includes('Carousel'));
  const reelFormat = formatPerformance.find(f => f.format.includes('Reel'));

  if (imageFormat && imageFormat.percent > 70 && (carouselFormat || reelFormat)) {
    const higherFormat = (carouselFormat?.avgEngagement || 0) > (imageFormat.avgEngagement || 1) ? 'Carousels' : 'Reels';
    diagnosticBadges.push({
      type: 'warning',
      title: 'Visual Format Imbalance',
      message: `${imageFormat.percent}% of posts are static images, while ${higherFormat} generated higher average interactions.`,
    });
  }

  if (cadenceDaysAvg > 4) {
    diagnosticBadges.push({
      type: 'warning',
      title: 'Cadence Gap',
      message: `Average posting interval is ${cadenceDaysAvg} days. Algorithm penalizes long gaps between uploads.`,
    });
  } else if (cadenceDaysAvg <= 1.5) {
    diagnosticBadges.push({
      type: 'success',
      title: 'Optimal Cadence',
      message: `Consistent daily cadence maintained (~${cadenceDaysAvg} day interval).`,
    });
  }

  if (hashtagPerformance.length < 3) {
    diagnosticBadges.push({
      type: 'info',
      title: 'Low Hashtag Reach',
      message: 'Under-utilizing discoverability hashtags. Recommended: 5-8 targeted niche tags.',
    });
  }

  return {
    bestPostingDays,
    bestPostingHours,
    bestPostingTimeSummary,
    topKeywords,
    topHooks,
    formatPerformance,
    hashtagPerformance,
    cadenceDaysAvg,
    engagementTier,
    diagnosticBadges,
  };
}

export interface GrowthPrescription {
  title: string;
  verdict: string;
  benchmarkProfile?: string;
  benchmarkRate?: number;
  recommendations: Array<{
    category: 'Timing' | 'Format' | 'Hooks' | 'Hashtags' | 'Cadence';
    action: string;
    rationale: string;
    impact: 'High' | 'Medium' | 'Critical';
  }>;
  contentBlueprint: {
    hookPrompt: string;
    recommendedFormat: string;
    bestPostingSlot: string;
    suggestedKeywords: string[];
    hashtagSet: string[];
  };
}

export function generateGrowthPrescription(
  current: BusinessDiscoveryResult,
  crawlHistory: BusinessDiscoveryResult[]
): GrowthPrescription | null {
  const currentAnalytics = current.analytics || analyzeMediaCrawl(current.recent_media, current.followers_count);
  
  // Find top benchmark in crawl history (other than current profile)
  const previousCompetitors = crawlHistory.filter(c => c.username.toLowerCase() !== current.username.toLowerCase());
  const topBenchmark = previousCompetitors.sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))[0];

  const recommendations: GrowthPrescription['recommendations'] = [];

  // Recommendation 1: Optimal Timing
  recommendations.push({
    category: 'Timing',
    action: `Schedule upcoming releases on ${currentAnalytics.bestPostingTimeSummary}.`,
    rationale: `Historical interactions spike during this specific window for @${current.username}'s audience.`,
    impact: 'High',
  });

  // Recommendation 2: Visual Format
  const topFormat = currentAnalytics.formatPerformance[0];
  if (topFormat && topFormat.percent < 60) {
    recommendations.push({
      category: 'Format',
      action: `Prioritize ${topFormat.format} (currently only ${topFormat.percent}% of uploads).`,
      rationale: `${topFormat.format} produces an average of ${topFormat.avgEngagement.toLocaleString()} interactions vs lower engagement on static posts.`,
      impact: 'Critical',
    });
  } else if (topBenchmark?.analytics?.formatPerformance?.[0]) {
    const compFormat = topBenchmark.analytics.formatPerformance[0];
    recommendations.push({
      category: 'Format',
      action: `Adopt ${compFormat.format} modeled after top benchmark @${topBenchmark.username}.`,
      rationale: `@${topBenchmark.username} achieved ${topBenchmark.engagement_rate}% engagement leveraging multi-slide carousels.`,
      impact: 'High',
    });
  }

  // Recommendation 3: Hooks & Keywords
  const topKws = currentAnalytics.topKeywords.slice(0, 4).map(k => k.word);
  if (topKws.length > 0) {
    recommendations.push({
      category: 'Hooks',
      action: `Feature high-converting keywords in the first 90 characters: "${topKws.join('", "')}".`,
      rationale: `Posts containing these terms yielded up to a ${currentAnalytics.topKeywords[0]?.boostMultiplier || 1.8}x engagement boost.`,
      impact: 'High',
    });
  }

  // Recommendation 4: Hashtags
  const winningTags = currentAnalytics.hashtagPerformance.slice(0, 6).map(h => h.tag);
  const benchmarkTags = topBenchmark?.top_hashtags?.slice(0, 5) || [];
  const combinedTags = Array.from(new Set([...winningTags, ...benchmarkTags])).slice(0, 8);

  recommendations.push({
    category: 'Hashtags',
    action: `Deploy high-retention hashtag cluster: ${combinedTags.join(' ')}.`,
    rationale: `Derived from highest interaction content across @${current.username} and top benchmark @${topBenchmark?.username || 'competitors'}.`,
    impact: 'Medium',
  });

  // Verdict & Comparison Summary
  let verdict = `Profile demonstrates ${currentAnalytics.engagementTier.toLowerCase()} engagement (${current.engagement_rate}%).`;
  if (topBenchmark) {
    const diff = current.engagement_rate - topBenchmark.engagement_rate;
    if (diff < 0) {
      verdict += ` Lagging ${Math.abs(diff).toFixed(1)}% behind benchmark @${topBenchmark.username} (${topBenchmark.engagement_rate}%). Follow prescription below to close the gap.`;
    } else {
      verdict += ` Outperforming benchmark @${topBenchmark.username} by +${diff.toFixed(1)}%. Accelerate lead with optimized format shifts.`;
    }
  }

  const hookTemplate = currentAnalytics.topHooks[0]?.hook || `How to achieve top results with ${topKws[0] || 'proven methods'} (Step-by-Step)`;

  return {
    title: `Algorithmic Engagement Prescription for @${current.username}`,
    verdict,
    benchmarkProfile: topBenchmark?.username,
    benchmarkRate: topBenchmark?.engagement_rate,
    recommendations,
    contentBlueprint: {
      hookPrompt: hookTemplate,
      recommendedFormat: topFormat?.format || 'Carousel (Multi-Slide)',
      bestPostingSlot: currentAnalytics.bestPostingTimeSummary,
      suggestedKeywords: topKws,
      hashtagSet: combinedTags,
    },
  };
}

/**
 * Single Post & Reel Mechanism Extractor
 * Extracts hook type, copywriting structure, CTAs, psychological retention triggers,
 * and builds a reusable swipe template for any Instagram post/reel URL.
 */
export function analyzeSinglePostMechanisms(
  caption: string = '',
  mediaType: string = 'IMAGE',
  likes: number = 0,
  comments: number = 0
): PostMechanismsAnalysis {
  const cleanCaption = (caption || '').trim();
  const lines = cleanCaption.split('\n').map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] || 'Visual content showcase';

  // 1. Hook Extraction & Categorization
  const hookClean = firstLine.replace(/^[^\w\s]+/, '').trim();
  const lowerHook = hookClean.toLowerCase();
  
  let hookType = 'Direct Value Hook';
  let hookScore = 75;
  let retentionReason = 'Delivers clear, immediate context to stop user scrolling in the feed.';

  if (/\?|^(why|how|what if|are you|did you know|can you)/i.test(lowerHook)) {
    hookType = 'Question Hook (Curiosity Gap)';
    hookScore = 88;
    retentionReason = 'Opens an open loop in the viewer’s mind, prompting them to keep reading or watch till the end for the resolution.';
  } else if (/^(stop|never|don't|the biggest mistake|unpopular opinion|the lie|nobody talks about)/i.test(lowerHook)) {
    hookType = 'Contrarian / Pattern Interrupt';
    hookScore = 95;
    retentionReason = 'Challenges common knowledge or status quo, triggering immediate cognitive dissonance and high attention retention.';
  } else if (/^\d+\s+(ways|steps|tools|tips|secrets|mistakes|reasons|lessons|rules)/i.test(lowerHook)) {
    hookType = 'Listicle / Actionable Framework';
    hookScore = 92;
    retentionReason = 'Quantifiable number gives predictable value structure, triggering high bookmark and save intent.';
  } else if (/case study|how we|from \$?0 to|client result|revenue|my journey/i.test(lowerHook)) {
    hookType = 'Social Proof / Authority Hook';
    hookScore = 90;
    retentionReason = 'Leverages concrete proof and relatable transformation, instantly building trust and algorithmic dwell time.';
  } else if (/story time|last week|years ago|when i started|i used to/i.test(lowerHook)) {
    hookType = 'Storytelling / Narrative Hook';
    hookScore = 85;
    retentionReason = 'Draws the audience into an empathetic narrative, maximizing watch time and comment dialogue.';
  }

  // Adjust score based on length and punctuation
  if (hookClean.split(/\s+/).length <= 10) hookScore = Math.min(99, hookScore + 4); // punchy
  if (likes > 500 || comments > 30) hookScore = Math.min(100, hookScore + 5);

  // 2. Extract Hashtags & Mentions
  const hashtags = (cleanCaption.match(/#[a-zA-Z0-9_]+/g) || []).map(t => t.toLowerCase());
  const mentions = (cleanCaption.match(/@[a-zA-Z0-9_.]+/g) || []).map(m => m.toLowerCase());

  // 3. CTA Detection
  let detectedCta = 'No explicit CTA (Passive Consumption)';
  const lowerCaption = cleanCaption.toLowerCase();

  if (/link in (bio|profile)|tap the link|link's in/i.test(lowerCaption)) {
    detectedCta = '🔗 Bio Link Click (Traffic Conversion)';
  } else if (/comment ['"]?([a-zA-Z0-9]+)['"]?|drop a comment|tell me in the comments|leave a comment/i.test(lowerCaption)) {
    const match = lowerCaption.match(/comment ['"]?([a-zA-Z0-9_-]+)['"]?/i);
    detectedCta = match ? `💬 Comment "${match[1]}" Trigger (Chatbot / DM Automation)` : '💬 Comment Engagement Trigger';
  } else if (/save (this|for later)|bookmark this|hit save/i.test(lowerCaption)) {
    detectedCta = '📌 Save For Later (Algorithmic Save Signal)';
  } else if (/share (this|with)|send this to|tag someone/i.test(lowerCaption)) {
    detectedCta = '🚀 Share & Tag (Virality & Network Expansion)';
  } else if (/follow @|follow for more|hit follow/i.test(lowerCaption)) {
    detectedCta = '➕ Profile Follow Prompt (Audience Growth)';
  } else if (/dm me|send a message|inbox/i.test(lowerCaption)) {
    detectedCta = '✉️ Direct Message (Inbound Lead Gen)';
  }

  // 4. Copywriting Framework
  let copyFramework = 'Value Delivery + Call To Action';
  if (/problem|struggle|tired of|frustrated/i.test(lowerCaption) && /solution|here's how|instead/i.test(lowerCaption)) {
    copyFramework = 'PAS (Problem, Agitate, Solution)';
  } else if (/before|used to/i.test(lowerCaption) && /after|now|today/i.test(lowerCaption)) {
    copyFramework = 'BAB (Before, After, Bridge)';
  } else if (lines.length > 5 && (lowerCaption.includes('1.') || lowerCaption.includes('step 1') || lowerCaption.includes('👉'))) {
    copyFramework = 'AIDA (Attention, Interest, Desire, Action Listicle)';
  }

  // 5. Content Pillar
  let contentPillar = 'Authority & Thought Leadership';
  if (/tutorial|how to|guide|tips|steps|framework|strategy/i.test(lowerCaption)) {
    contentPillar = 'Actionable Education & How-To';
  } else if (/mindset|motivation|discipline|believe|inspire/i.test(lowerCaption)) {
    contentPillar = 'Inspiration & Mindset Shift';
  } else if (/behind the scenes|day in the life|team|bts|culture/i.test(lowerCaption)) {
    contentPillar = 'Community & Relatability (BTS)';
  } else if (/offer|discount|launch|order|buy|shop|sale/i.test(lowerCaption)) {
    contentPillar = 'Direct Response & Offer Conversion';
  }

  // 6. Visual Format Mechanics
  const normType = (mediaType || '').toUpperCase();
  let visualFormatTip = '';
  if (normType === 'REELS' || normType === 'VIDEO') {
    visualFormatTip = 'High-retention Reel: 0-3s visual motion hook, high-contrast dynamic captions, and audio sync maximize 100% video completion rates.';
  } else if (normType === 'CAROUSEL' || normType === 'CAROUSEL_ALBUM') {
    visualFormatTip = 'Multi-slide Carousel: Slide 1 provides curiosity/problem, slides 2-5 deliver bite-sized insights, and the final slide drives saves & shares.';
  } else {
    visualFormatTip = 'Static Visual / Infographic: Uses strong focal imagery and high-contrast headlines to stop the fast mobile feed thumb.';
  }

  // 7. Emotional Triggers & Share/Save Factors
  const emotionalTriggers: string[] = [];
  if (hookType.includes('Contrarian') || lowerCaption.includes('mistake')) emotionalTriggers.push('Loss Aversion (Avoiding costly mistakes)');
  if (hookType.includes('Curiosity') || lowerCaption.includes('secret')) emotionalTriggers.push('Curiosity Gap (Craving insider information)');
  if (contentPillar.includes('Education')) emotionalTriggers.push('Utility (Immediate practical empowerment)');
  if (contentPillar.includes('Authority')) emotionalTriggers.push('Status Elevation (Aligning with expert mastery)');
  if (emotionalTriggers.length === 0) emotionalTriggers.push('Relatability & Connection');

  const shareabilityFactor = detectedCta.includes('Share') || lowerCaption.includes('share')
    ? 'High Shareability: Viewers share this post to DMs or Stories because it expresses an identity or sends practical value to colleagues.'
    : 'Moderate Shareability: Content is primarily consumed on-feed, with sharing driven by personal resonance.';

  const saveabilityFactor = (contentPillar.includes('Education') || hookType.includes('Listicle') || detectedCta.includes('Save'))
    ? 'High Saveability: Structured insights make viewers bookmark this post into collections to execute later, sending the highest algorithmic signal to Meta.'
    : 'Standard Dwell-Time: Engagement is front-loaded on initial view; add a summary carousel or checklist to boost bookmark rates.';

  // 8. Reusable Swipe Template
  const reusableTemplate = `[HOOK]: ${hookClean.length > 20 ? hookClean : 'Why most [Niche] professionals get [Outcome] wrong:'}

Here is the exact framework to fix this:

1. [Key Insight 1]: The fundamental shift in your approach.
2. [Key Insight 2]: The practical daily habit or system.
3. [Key Insight 3]: The common pitfall to avoid at all costs.

💡 Quick Tip: Remember that [Core Value takeaway].

👉 ${detectedCta.includes('Comment') ? 'Comment "[KEYWORD]" below and I will DM you the step-by-step checklist!' : detectedCta.includes('Save') ? 'Save this post so you have it ready when you need it next.' : 'Share this with someone on your team who needs this today!'}`;

  return {
    hook: hookClean || 'Visual Focus Post',
    hookType,
    hookScore,
    retentionBreakdown: retentionReason,
    copyFramework,
    contentPillar,
    detectedCta,
    visualFormatTip,
    hashtags,
    mentions,
    emotionalTriggers,
    shareabilityFactor,
    saveabilityFactor,
    reusableTemplate,
  };
}
