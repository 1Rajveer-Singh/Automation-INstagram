import React, { useState, useEffect } from 'react';
import { HashtagSet, GrowthStrategyProfile } from '../../types/instagram';
import { StickerCard } from '../common/StickerCard';
import { HardInput } from '../common/HardInput';
import { CandyButton } from '../common/CandyButton';
import { Hash, Sparkles, Copy, Check, TrendingUp, Flame, ShieldCheck, Target } from 'lucide-react';

interface HashtagGeneratorViewProps {
  profile?: GrowthStrategyProfile | null;
  onOpenStrategyModal?: () => void;
  userId?: string;
}

export const HashtagGeneratorView: React.FC<HashtagGeneratorViewProps> = ({
  profile,
  onOpenStrategyModal,
  userId,
}) => {
  const getCleanTopic = (prof?: GrowthStrategyProfile | null) => {
    if (!prof?.subNiche) return 'artisan';
    const words = prof.subNiche.split(/[\s,]+/).map(w => w.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean);
    return words[0]?.toLowerCase() || 'artisan';
  };

  const [topic, setTopic] = useState(() => getCleanTopic(profile));
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.subNiche) {
      setTopic(getCleanTopic(profile));
    }
  }, [profile]);

  const hashtagSets: Record<string, HashtagSet> = {
    artisan: {
      niche: 'Artisan & Handcrafted Studio',
      lowCompetition: ['#artisanpottery', '#handcraftedceramics', '#studiopotter', '#modernceramic', '#ceramicartisan'],
      mediumReach: ['#ceramicstudio', '#handmadepottery', '#claywork', '#potterylife', '#stonewareceramics'],
      highReach: ['#ceramicart', '#functionalpottery', '#wheelthrown', '#clayartist', '#contemporaryceramics'],
    },
    fitness: {
      niche: 'Fitness & Health Growth',
      lowCompetition: ['#homefitnesstips', '#dailyworkoutroutine', '#beginnerfitnessjourney', '#strengthform'],
      mediumReach: ['#strengthtrainingtips', '#fitnesstipsdaily', '#hypertrophytraining', '#functionalstrength'],
      highReach: ['#workoutprogramming', '#exerciseform', '#fitnesstraining', '#strengthandconditioning', '#mindmuscleconnection'],
    },
    fashion: {
      niche: 'Aesthetic Fashion & Style',
      lowCompetition: ['#minimalistoutfitinspo', '#streetwearaesthetic', '#capsulewardrobe', '#dailyoutfitideas'],
      mediumReach: ['#sustainablewardrobe', '#transitionaloutfits', '#minimalistfashioninspo', '#smartcasualstyle'],
      highReach: ['#capsulestyle', '#outfitinspoideas', '#streetwearculture', '#classicmenswear', '#timelesswardrobe'],
    },
  };

  const clean = topic.toLowerCase().replace(/[^a-z0-9]/g, '') || 'niche';

  const currentSet = hashtagSets[clean] || {
    niche: profile?.subNiche || `${topic} Growth Matrix`,
    lowCompetition: [
      `#${clean}niche`,
      `#${clean}daily`,
      `#${clean}community`,
      `#${clean}tips`,
      `#${clean}hub`,
    ],
    mediumReach: [
      `#${clean}creator`,
      `#${clean}strategy`,
      `#${clean}insights`,
      `#${clean}content`,
      `#${clean}studio`,
    ],
    highReach: [
      `#${clean}industry`,
      `#${clean}business`,
      `#${clean}growth`,
      `#${clean}mastery`,
      `#${clean}method`,
    ],
  };

  // Meta 2025/2026 standard: Best 3-5 hyper-targeted tags
  const recommendedMetaTags = [
    currentSet.lowCompetition[0],
    currentSet.lowCompetition[1] || currentSet.lowCompetition[0],
    currentSet.mediumReach[0],
    currentSet.mediumReach[1] || currentSet.mediumReach[0],
    currentSet.highReach[0],
  ].filter(Boolean).slice(0, 5);

  const handleCopySet = (tags: string[], label: string) => {
    navigator.clipboard.writeText(tags.join(' '));
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyRecommendedMetaTags = () => {
    navigator.clipboard.writeText(recommendedMetaTags.join(' '));
    setCopiedSection('META');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyAllCombined = () => {
    const all = [...currentSet.lowCompetition, ...currentSet.mediumReach, ...currentSet.highReach];
    navigator.clipboard.writeText(all.join(' '));
    setCopiedSection('ALL');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Meta 2025/2026 Policy Notice */}
      <div className="p-3.5 bg-gradient-to-r from-violet-50 to-blue-50 border-2 border-violet-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white font-extrabold text-[10px] uppercase tracking-wider shrink-0">
            Meta 2025/2026 Standard
          </span>
          <p className="font-medium text-slate-700">
            Instagram algorithm prioritizes <strong>3–5 hyper-relevant niche tags</strong> + descriptive in-caption SEO. Generic tags (<code className="text-rose-600">#viral</code>, <code className="text-rose-600">#fyp</code>) are penalized as low-quality spam.
          </p>
        </div>
        <CandyButton variant="pink" size="sm" onClick={copyRecommendedMetaTags} icon={Copy} className="shrink-0 text-xs">
          {copiedSection === 'META' ? 'Copied 3–5 Meta Tags!' : 'Copy 3–5 Meta Tags'}
        </CandyButton>
      </div>

      {/* Header */}
      <StickerCard
        title="High-Reach Niche Hashtag Generator & Ranker"
        subtitle="Optimized 3-Tier Hashtag Matrix strictly aligned with Meta Search & Explore indexing"
        icon={Hash}
        iconBgColor="bg-yellowPop text-slateDark"
        shadowColor="yellow"
        headerAction={
          <div className="flex items-center gap-2">
            <CandyButton variant="yellow" size="sm" onClick={copyRecommendedMetaTags} icon={Copy}>
              {copiedSection === 'META' ? 'Copied Meta Tags!' : 'Copy 3-5 Best Tags'}
            </CandyButton>
          </div>
        }
      >
        <div className="flex flex-col sm:flex-row items-end gap-3 max-w-xl">
          <HardInput
            label="Enter Business Niche or Topic"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. artisan, fitness, fashion, coffee"
          />
          <CandyButton variant="yellow" size="md" icon={Sparkles} className="shrink-0 mb-0.5">
            Generate Hashtag Matrix
          </CandyButton>
        </div>

        {profile?.subNiche && (
          <div className="mt-4 pt-3 border-t-2 border-slateDark/10 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-heading font-black text-slateDark">
              <Target size={14} className="text-amber-600" />
              <span>Auto-Configured for: <strong className="text-violetBrand font-bold">{profile.subNiche}</strong></span>
            </span>
            {onOpenStrategyModal && (
              <button
                type="button"
                onClick={onOpenStrategyModal}
                className="text-[11px] text-amber-700 font-bold hover:underline"
              >
                Change Strategy Niche
              </button>
            )}
          </div>
        )}
      </StickerCard>

      {/* 3-Tier Hashtag Matrix Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Competition (Best for smaller accounts) */}
        <StickerCard
          title="Tier 1: Low Competition"
          subtitle="10k - 100k posts • High probability to rank top 9 on hashtag search"
          icon={ShieldCheck}
          iconBgColor="bg-mintPop text-slateDark"
          shadowColor="mint"
          headerAction={
            <button
              onClick={() => handleCopySet(currentSet.lowCompetition, 'Tier 1')}
              className="p-1.5 rounded-lg border border-slateDark bg-white hover:bg-slate-100 font-bold text-xs"
            >
              {copiedSection === 'Tier 1' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          }
        >
          <div className="space-y-2">
            {currentSet.lowCompetition.map(tag => (
              <div
                key={tag}
                className="p-2.5 bg-cream border-2 border-slateDark rounded-xl text-xs font-mono font-bold text-slateDark flex items-center justify-between"
              >
                <span>{tag}</span>
                <span className="text-[10px] text-emerald-700 font-sans font-extrabold bg-emerald-100 px-2 py-0.5 rounded-full">
                  Low Comp
                </span>
              </div>
            ))}
          </div>
        </StickerCard>

        {/* Medium Reach */}
        <StickerCard
          title="Tier 2: Medium Reach"
          subtitle="100k - 1M posts • Steady organic push"
          icon={TrendingUp}
          iconBgColor="bg-yellowPop text-slateDark"
          shadowColor="yellow"
          headerAction={
            <button
              onClick={() => handleCopySet(currentSet.mediumReach, 'Tier 2')}
              className="p-1.5 rounded-lg border border-slateDark bg-white hover:bg-slate-100 font-bold text-xs"
            >
              {copiedSection === 'Tier 2' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          }
        >
          <div className="space-y-2">
            {currentSet.mediumReach.map(tag => (
              <div
                key={tag}
                className="p-2.5 bg-cream border-2 border-slateDark rounded-xl text-xs font-mono font-bold text-slateDark flex items-center justify-between"
              >
                <span>{tag}</span>
                <span className="text-[10px] text-yellow-800 font-sans font-extrabold bg-yellow-100 px-2 py-0.5 rounded-full">
                  Mid Reach
                </span>
              </div>
            ))}
          </div>
        </StickerCard>

        {/* High Reach */}
        <StickerCard
          title="Tier 3: High Reach"
          subtitle="1M+ posts • Maximum impression volume"
          icon={Flame}
          iconBgColor="bg-rose-500 text-white"
          shadowColor="pink"
          headerAction={
            <button
              onClick={() => handleCopySet(currentSet.highReach, 'Tier 3')}
              className="p-1.5 rounded-lg border border-slateDark bg-white hover:bg-slate-100 font-bold text-xs"
            >
              {copiedSection === 'Tier 3' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          }
        >
          <div className="space-y-2">
            {currentSet.highReach.map(tag => (
              <div
                key={tag}
                className="p-2.5 bg-cream border-2 border-slateDark rounded-xl text-xs font-mono font-bold text-slateDark flex items-center justify-between"
              >
                <span>{tag}</span>
                <span className="text-[10px] text-rose-800 font-sans font-extrabold bg-rose-100 px-2 py-0.5 rounded-full">
                  High Volume
                </span>
              </div>
            ))}
          </div>
        </StickerCard>
      </div>
    </div>
  );
};
