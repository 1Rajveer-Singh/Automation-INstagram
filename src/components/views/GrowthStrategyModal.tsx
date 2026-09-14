import React, { useState } from 'react';
import { GrowthStrategyProfile, FormatMix } from '../../types/instagram';
import { HardInput } from '../common/HardInput';
import { CandyButton } from '../common/CandyButton';
import {
  Sparkles,
  Target,
  Search,
  Hash,
  CheckCircle2,
  X,
  ChevronRight,
  Users,
  Calendar,
  Layers,
  Film,
  Clock,
} from 'lucide-react';

interface GrowthStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveStrategy: (profile: GrowthStrategyProfile, targetTab?: 'competitors' | 'hashtag-generator' | 'hashtags') => void;
  initialProfile?: GrowthStrategyProfile | null;
}

const CONVERSION_GOAL_OPTIONS = [
  { id: 'leads', icon: '💬', label: 'Inbound DM Leads & Consultations', desc: 'Optimizes auto-responder and viral keyword triggers' },
  { id: 'sales', icon: '🛒', label: 'Direct Website Sales & Bio Clicks', desc: 'Drives high-intent buyer traffic to your store and offers' },
  { id: 'growth', icon: '🚀', label: 'Rapid Follower Growth & Explore Reach', desc: 'Targets viral broad-to-niche hashtag clusters' },
  { id: 'community', icon: '🤝', label: 'Community Retention & Comment Velocity', desc: 'Builds loyal brand fans and high replay dwell time' },
];

const CALENDAR_DAYS_OPTIONS = [
  { days: 7, label: '7-Day Sprint', desc: 'Fast weekly testing & quick validation' },
  { days: 14, label: '14-Day Pilot', desc: 'Bi-weekly momentum & iteration' },
  { days: 30, label: '30-Day Master', desc: 'Comprehensive month-long content engine' },
  { days: 60, label: '60-Day Scaling', desc: 'Extended growth runway & deep reach' },
];

export const GrowthStrategyModal: React.FC<GrowthStrategyModalProps> = ({
  isOpen,
  onClose,
  onSaveStrategy,
  initialProfile,
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [subNiche, setSubNiche] = useState(initialProfile?.subNiche || '');
  const [targetAudience, setTargetAudience] = useState(initialProfile?.targetAudience || '');
  const [competitorInput, setCompetitorInput] = useState(
    initialProfile?.competitorHandles?.join(', ') || ''
  );
  const [contentFormat, setContentFormat] = useState(
    initialProfile?.contentFormat || 'Dynamic Multi-Format Engine'
  );
  const [formatMix, setFormatMix] = useState<FormatMix>(
    initialProfile?.formatMix || { reels: 15, carousels: 10, videos: 3, singlePosts: 2, stories: 30 }
  );
  const [conversionGoal, setConversionGoal] = useState(
    initialProfile?.conversionGoal || CONVERSION_GOAL_OPTIONS[0].label
  );
  const [calendarDays, setCalendarDays] = useState<number>(
    initialProfile?.calendarDays || 30
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [savedProfile, setSavedProfile] = useState<GrowthStrategyProfile | null>(null);

  // Directly open form for editing whenever modal is opened
  React.useEffect(() => {
    if (isOpen) {
      setIsCompleted(false);
      setActiveStep(1);
      if (initialProfile) {
        setSubNiche(initialProfile.subNiche || '');
        setTargetAudience(initialProfile.targetAudience || '');
        setCompetitorInput(initialProfile.competitorHandles?.join(', ') || '');
        setContentFormat(initialProfile.contentFormat || 'Dynamic Multi-Format Engine');
        setFormatMix(initialProfile.formatMix || { reels: 4, carousels: 2, videos: 1, singlePosts: 1, stories: 7 });
        setConversionGoal(initialProfile.conversionGoal || CONVERSION_GOAL_OPTIONS[0].label);
        setCalendarDays(initialProfile.calendarDays || 30);
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialProfile]);

  if (!isOpen) return null;

  const handleSave = (jumpTo?: 'competitors' | 'hashtag-generator' | 'hashtags') => {
    if (!subNiche.trim()) {
      setActiveStep(1);
      setErrorMsg('Please enter your specific sub-niche or core offer.');
      return;
    }

    // Parse competitor handles cleanly
    const handles = competitorInput
      .split(/[\s,]+/)
      .map(h => h.replace(/[@#]/g, '').trim())
      .filter(Boolean);

    const profile: GrowthStrategyProfile = {
      subNiche: subNiche.trim(),
      targetAudience: targetAudience.trim() || 'General Niche Audience',
      competitorHandles: handles.length > 0 ? handles : ['instagram'],
      contentFormat,
      conversionGoal,
      formatMix,
      calendarDays: calendarDays || 30,
      configuredAt: new Date().toISOString(),
    };

    setSavedProfile(profile);
    onSaveStrategy(profile, jumpTo);
    onClose();
  };

  const totalInFeedTarget =
    (formatMix.reels ?? 0) +
    (formatMix.carousels ?? 0) +
    (formatMix.videos ?? 0) +
    (formatMix.singlePosts ?? 0);
  const totalCalculatedPosts = totalInFeedTarget > 0 ? totalInFeedTarget : calendarDays;
  const postsPerDayRatio = (totalCalculatedPosts / (calendarDays || 30)).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-auto bg-white border-2 border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all z-10 cursor-pointer"
          aria-label="Close setup window"
        >
          <X size={18} />
        </button>

        {isCompleted ? (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300 mx-auto flex items-center justify-center shadow-sm">
              <CheckCircle2 size={34} strokeWidth={2.2} />
            </div>

            <div>
              <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full">
                Configuration Activated
              </span>
              <h2 className="text-2xl sm:text-3xl font-heading font-black text-slate-900 mt-2">
                Your Growth Strategy Is Live!
              </h2>
              <p className="text-xs font-medium text-slate-600 max-w-md mx-auto mt-1.5 leading-relaxed">
                Configured <strong className="text-slate-900">Business Discovery</strong>, <strong className="text-slate-900">Hashtag Matrix</strong>, and <strong className="text-slate-900">{calendarDays}-Day Execution Calendar</strong> for <span className="text-violet-700 font-bold">"{savedProfile?.subNiche}"</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
              <div
                onClick={() => { onClose(); onSaveStrategy(savedProfile!, 'competitors'); }}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-violet-50 hover:border-violet-300 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2 text-violet-700 font-bold text-xs mb-1">
                  <Search size={15} />
                  <span>Competitor Discovery</span>
                </div>
                <p className="text-[11px] text-slate-500">Benchmark competitor hooks & reels frequency.</p>
              </div>

              <div
                onClick={() => { onClose(); onSaveStrategy(savedProfile!, 'hashtag-generator'); }}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2 text-amber-700 font-bold text-xs mb-1">
                  <Hash size={15} />
                  <span>Hashtag Matrix</span>
                </div>
                <p className="text-[11px] text-slate-500">Targeted low, medium & high reach buckets.</p>
              </div>

              <div
                onClick={() => { onClose(); onSaveStrategy(savedProfile!, 'hashtags'); }}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs mb-1">
                  <Target size={15} />
                  <span>Hashtag Search</span>
                </div>
                <p className="text-[11px] text-slate-500">Inspect viral top posts and audio trends.</p>
              </div>
            </div>

            <div className="pt-3 flex justify-center">
              <CandyButton variant="primary" size="md" onClick={onClose}>
                Done & Open Workspace
              </CandyButton>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header with Title & Step Bar */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm shrink-0">
                    <Target size={18} strokeWidth={2.4} />
                  </div>
                  <div>
                    <h2 className="font-heading text-lg sm:text-xl font-black text-slate-900 leading-tight">
                      Instagram Growth Strategy Setup
                    </h2>
                    <p className="text-[11px] font-medium text-slate-500">
                      Configure your niche, content targets & algorithm distribution engine.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3-Step Category Pill Bar */}
              <div className="grid grid-cols-3 gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className={`py-2 px-3 rounded-xl border text-left transition-all cursor-pointer ${
                    activeStep === 1
                      ? 'border-violet-600 bg-violet-50/80 text-violet-900 shadow-sm ring-1 ring-violet-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-700">
                    <Target size={12} /> Category 1
                  </div>
                  <div className="text-xs font-bold text-slate-900 truncate">Brand & Goal</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className={`py-2 px-3 rounded-xl border text-left transition-all cursor-pointer ${
                    activeStep === 2
                      ? 'border-violet-600 bg-violet-50/80 text-violet-900 shadow-sm ring-1 ring-violet-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-700">
                    <Users size={12} /> Category 2
                  </div>
                  <div className="text-xs font-bold text-slate-900 truncate">Audience & Competitors</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className={`py-2 px-3 rounded-xl border text-left transition-all cursor-pointer ${
                    activeStep === 3
                      ? 'border-violet-600 bg-violet-50/80 text-violet-900 shadow-sm ring-1 ring-violet-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-700">
                    <Calendar size={12} /> Category 3
                  </div>
                  <div className="text-xs font-bold text-slate-900 truncate">Schedule & Horizon</div>
                </button>
              </div>

              {errorMsg && (
                <div className="mt-3 p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs font-bold">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Step Body Content */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {/* CATEGORY 1: Brand Foundation & Conversion Goal */}
              {activeStep === 1 && (
                <div className="space-y-3.5">
                  <div className="px-1 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-violet-700 uppercase tracking-wider">Set 1 of 3</span>
                      <h3 className="text-xs font-heading font-black text-slate-900">Brand Identity & Business Objective</h3>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500">2 Related Questions</span>
                  </div>

                  {/* Q1 */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-heading font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                        What is your specific sub-niche & core product / service?
                      </label>
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                        Hashtag Seed
                      </span>
                    </div>
                    <HardInput
                      placeholder="e.g. Handcrafted Ceramic Tableware, Boutique Coffee Roaster, AI Productivity Tools"
                      value={subNiche}
                      onChange={e => setSubNiche(e.target.value)}
                    />
                    <p className="text-[10px] text-slate-500">
                      Creates the keyword seeds for your 3-tier hashtag matrix and targeted explorer search.
                    </p>
                  </div>

                  {/* Q2 */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-heading font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                        Primary Conversion Objective for this Offer
                      </label>
                      <span className="text-[10px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full">
                        Growth Target
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CONVERSION_GOAL_OPTIONS.map(opt => {
                        const isSelected = conversionGoal === opt.label;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setConversionGoal(opt.label)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'border-violet-600 bg-violet-50 text-slate-900 ring-1 ring-violet-600 shadow-sm'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="text-xs font-heading font-bold flex items-center gap-1.5">
                              <span>{opt.icon}</span> {opt.label}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 leading-snug">{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* CATEGORY 2: Audience & Market Benchmarks */}
              {activeStep === 2 && (
                <div className="space-y-3.5">
                  <div className="px-1 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-violet-700 uppercase tracking-wider">Set 2 of 3</span>
                      <h3 className="text-xs font-heading font-black text-slate-900">Audience & Market Benchmarks</h3>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500">2 Related Questions</span>
                  </div>

                  {/* Q3 */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-heading font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                        Who is your ideal follower & their geographic location?
                      </label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Audience Filter
                      </span>
                    </div>
                    <HardInput
                      placeholder="e.g. Eco-conscious interior designers, US/UK/Canada, ages 25-45"
                      value={targetAudience}
                      onChange={e => setTargetAudience(e.target.value)}
                    />
                    <p className="text-[10px] text-slate-500">
                      Aligns discovery away from low-value traffic directly toward prospective buyers.
                    </p>
                  </div>

                  {/* Q4 */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-heading font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">4</span>
                        Competitor or benchmark Instagram handles (@usernames):
                      </label>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        Business Discovery
                      </span>
                    </div>
                    <HardInput
                      placeholder="e.g. @eastforkpottery, @tortus, @ceramicmag (comma or space separated)"
                      value={competitorInput}
                      onChange={e => setCompetitorInput(e.target.value)}
                    />
                    <p className="text-[10px] text-slate-500">
                      Feeds into Meta Graph API Business Discovery to monitor competitor velocity and hooks.
                    </p>
                  </div>
                </div>
              )}

              {/* CATEGORY 3: Content Schedule & Calendar Horizon */}
              {activeStep === 3 && (
                <div className="space-y-3.5">
                  <div className="px-1 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-violet-700 uppercase tracking-wider">Set 3 of 3</span>
                      <h3 className="text-xs font-heading font-black text-slate-900">Post Volume & Calendar Duration</h3>
                    </div>
                    <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                      ~{totalCalculatedPosts} Total Posts
                    </span>
                  </div>

                  {/* Q5: Target Content Mix */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="font-heading font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">5</span>
                        Target Content Mix (For Selected {calendarDays} Calendar Days)
                      </label>
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                        {totalInFeedTarget} total in-feed targets
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Set target volume across {calendarDays} days. If total targets exceed {calendarDays} days, peak days automatically receive multiple timed slots!
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">🎬 Reels</span>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={formatMix.reels}
                          onChange={e => setFormatMix({ ...formatMix, reels: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full text-center font-heading font-black text-base text-slateDark border border-slate-200 rounded-lg p-1 bg-slate-50"
                        />
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">🎠 Carousels</span>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={formatMix.carousels}
                          onChange={e => setFormatMix({ ...formatMix, carousels: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full text-center font-heading font-black text-base text-slateDark border border-slate-200 rounded-lg p-1 bg-slate-50"
                        />
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">🎥 In-Depth</span>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={formatMix.videos ?? 1}
                          onChange={e => setFormatMix({ ...formatMix, videos: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full text-center font-heading font-black text-base text-slateDark border border-slate-200 rounded-lg p-1 bg-slate-50"
                        />
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">📸 Single Posts</span>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={formatMix.singlePosts}
                          onChange={e => setFormatMix({ ...formatMix, singlePosts: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full text-center font-heading font-black text-base text-slateDark border border-slate-200 rounded-lg p-1 bg-slate-50"
                        />
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center space-y-1 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">⚡ Stories</span>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={formatMix.stories}
                          onChange={e => setFormatMix({ ...formatMix, stories: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full text-center font-heading font-black text-base text-slateDark border border-slate-200 rounded-lg p-1 bg-slate-50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Q6: Calendar Horizon Selection */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-heading font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">6</span>
                        Calendar Planning Horizon
                      </label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {calendarDays} Days Planned
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CALENDAR_DAYS_OPTIONS.map(opt => {
                        const isSelected = calendarDays === opt.days;
                        return (
                          <button
                            key={opt.days}
                            type="button"
                            onClick={() => setCalendarDays(opt.days)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'border-violet-600 bg-violet-50 text-slate-900 ring-1 ring-violet-600 shadow-sm'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="text-xs font-heading font-black text-slate-900">{opt.label}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Summary Preview Banner */}
                    <div className="mt-2 p-2.5 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-between text-xs text-violet-900">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Calendar size={13} className="text-violet-700" />
                        <span>Duration: <strong>{calendarDays} Days</strong> • Generates <strong>~{totalCalculatedPosts} post slots</strong></span>
                      </span>
                      <span className="font-mono font-bold text-[11px] bg-white px-2 py-0.5 rounded border border-violet-300">
                        ~{postsPerDayRatio} posts / day
                      </span>
                    </div>

                    {/* Active 20 Content Pillars Blueprint Preview */}
                    <div className="mt-2 p-2.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-heading font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <Layers size={13} className="text-violet-600" />
                          Dynamic Niche Content Pillars
                        </label>
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                          Tailored to Your Niche
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-0.5">
                        {(() => {
                          const n = subNiche || 'Your Sub-Niche';
                          return [
                            `${n} Step-by-Step Guides`,
                            `${n} Proof & Transformations`,
                            `Contrarian Truths & Mistakes in ${n}`,
                            `Relatable ${n} Reality (POV)`,
                            `Interactive ${n} Audits & Q&A`,
                            `${n} Authority & Systems`,
                          ].map(p => (
                            <span key={p} className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-700 shadow-xs">
                              {p}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions & Navigation Controls */}
            <div className="pt-3 flex items-center justify-between border-t border-slate-200">
              <div>
                {activeStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveStep(prev => (prev - 1) as 1 | 2 | 3)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
                  >
                    ← Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600 hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeStep < 3 ? (
                  <CandyButton
                    variant="yellow"
                    size="sm"
                    onClick={() => setActiveStep(prev => (prev + 1) as 1 | 2 | 3)}
                  >
                    <span>Next Step</span> <ChevronRight size={14} />
                  </CandyButton>
                ) : (
                  <CandyButton
                    variant="primary"
                    size="md"
                    onClick={() => handleSave()}
                    icon={Sparkles}
                  >
                    Save & Activate Strategy
                  </CandyButton>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
