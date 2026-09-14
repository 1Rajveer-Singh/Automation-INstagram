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
      mediumReach: ['#artisan', '#handcrafted', '#potterystudio', '#ceramicart', '#studioart'],
      highReach: ['#art', '#design', '#handmade', '#homedecor', '#artist'],
    },
    fitness: {
      niche: 'Fitness & Health Growth',
      lowCompetition: ['#homefitnesstips', '#dailyworkoutroutine', '#beginnerfitnessjourney', '#fitspirationdaily'],
      mediumReach: ['#fitnessgoals', '#workoutmotivation', '#gymlife', '#fitnesstips'],
      highReach: ['#fitness', '#gym', '#workout', '#health', '#fit'],
    },
    fashion: {
      niche: 'Aesthetic Fashion & Style',
      lowCompetition: ['#minimalistoutfitinspo', '#streetwearaesthetic', '#capsulewardrobe', '#dailyoutfitideas'],
      mediumReach: ['#fashioninspo', '#stylegram', '#outfitoftheday', '#streetstyle'],
      highReach: ['#fashion', '#style', '#ootd', '#love', '#model'],
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
      `#${clean}`,
      `#${clean}life`,
      `#${clean}inspo`,
      `#${clean}creator`,
      `#${clean}style`,
    ],
    highReach: ['#viral', '#trending', '#explore', '#reels', '#growth'],
  };

  const handleCopySet = (tags: string[], label: string) => {
    navigator.clipboard.writeText(tags.join(' '));
    setCopiedSection(label);
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
      {/* Header */}
      <StickerCard
        title="High-Reach Niche Hashtag Generator & Ranker"
        subtitle="Optimized 3-Tier Hashtag Matrix designed to rank lower-popularity accounts on Instagram Explore"
        icon={Hash}
        iconBgColor="bg-yellowPop text-slateDark"
        shadowColor="yellow"
        headerAction={
          <CandyButton variant="pink" size="sm" onClick={copyAllCombined} icon={Copy}>
            {copiedSection === 'ALL' ? 'Copied 15 Tags!' : 'Copy 15-Tag Mix'}
          </CandyButton>
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
