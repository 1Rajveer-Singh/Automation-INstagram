import React, { useState } from 'react';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import {
  Zap, Sparkles, ShieldCheck, MessageSquareCode, TrendingUp, Lock,
  CheckCircle2, ArrowRight, CalendarCheck2, Hash, Search, Check, X,
  ChevronDown, ChevronUp, Play, Flame, Layers, HelpCircle, ShieldAlert,
  Instagram, Star, ExternalLink,
} from 'lucide-react';
import { InstagramBrandIcon, GeminiIcon } from '../common/BrandIcons';
import { PatternBackground } from '../common/PatternBackground';

// ─── Section Separator ────────────────────────────────────────────────────────
interface DividerProps {
  label: string;
  icon: React.ReactNode;
  accent?: string;
}
const SectionDivider: React.FC<DividerProps> = ({ label, icon, accent = 'bg-white' }) => (
  <div className="w-full py-0">
    <div className="relative flex items-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <hr className="flex-1 border-t-[3px] border-slateDark" />
      <div className={`mx-4 shrink-0 flex items-center gap-2 px-4 py-1.5 text-[11px] font-heading font-black uppercase tracking-wider text-slateDark ${accent} border-2 border-slateDark rounded-full shadow-[3px_3px_0px_0px_#1E293B]`}>
        {icon}
        <span>{label}</span>
      </div>
      <hr className="flex-1 border-t-[3px] border-slateDark" />
    </div>
  </div>
);

// ─── Landing Page ─────────────────────────────────────────────────────────────
export const LandingPageView: React.FC = () => {
  const [activePreviewTab, setActivePreviewTab] = useState<'funnel' | 'growth' | 'publisher'>('funnel');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const toggleFaq = (i: number) => setOpenFaqIndex(p => p === i ? null : i);

  return (
    <PatternBackground className="min-h-screen w-full overflow-y-auto overflow-x-hidden">
      <div className="w-full flex flex-col">

        {/* ── NAV ──────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b-[3px] border-slateDark shadow-[0_3px_0_#1E293B]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-violetBrand border-2 border-slateDark flex items-center justify-center shadow-[2px_2px_0_#1E293B] rotate-[-3deg] text-white shrink-0">
                <Zap size={19} strokeWidth={3} />
              </div>
              <span className="font-heading text-xl font-black text-slateDark tracking-tight">
                InstaGrowth<span className="text-violetBrand">.io</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-heading font-black bg-yellowPop text-slateDark border border-slateDark rounded-full uppercase">
                <Sparkles size={9} />Meta v22.0
              </span>
            </div>

            {/* Nav links */}
            <nav className="hidden lg:flex items-center gap-6 text-[11px] font-heading font-black uppercase tracking-wider text-slateDark">
              {['features','preview','how-it-works','comparison','faq'].map(s => (
                <a key={s} href={`#${s}`} className="hover:text-violetBrand transition-colors">{s.replace('-',' ')}</a>
              ))}
            </nav>

            {/* Auth CTAs */}
            <div className="flex items-center gap-2 shrink-0">
              <SignInButton mode="modal">
                <button type="button" className="px-3.5 py-2 bg-white text-slateDark font-heading text-xs font-black rounded-xl border-2 border-slateDark shadow-[2px_2px_0_#1E293B] hover:-translate-y-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5">
                  <Lock size={13} /><span>Log In</span>
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button type="button" className="px-4 py-2 bg-violetBrand text-white font-heading text-xs font-black rounded-xl border-2 border-slateDark shadow-[2px_2px_0_#1E293B] hover:-translate-y-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5">
                  <span>Get Started</span><ArrowRight size={13} />
                </button>
              </SignUpButton>
            </div>
          </div>
        </header>

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 text-center flex flex-col items-center gap-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellowPop border-2 border-slateDark shadow-[2px_2px_0_#1E293B] text-xs font-heading font-black text-slateDark animate-wiggle">
            <InstagramBrandIcon size={15} className="shrink-0" />
            <span>Official Meta Graph API v22.0</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          </div>

          {/* Headline */}
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black text-slateDark tracking-tight leading-[1.1] max-w-4xl">
            Automate Instagram Growth, DMs & Publishing{' '}
            <span className="text-violetBrand underline decoration-pinkPop decoration-wavy decoration-[3px] underline-offset-8">
              Without Account Risk
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 font-semibold max-w-2xl leading-relaxed">
            Convert viral reel comments into qualified DMs with <strong className="text-slateDark">Follow-to-Unlock</strong>, schedule posts via Meta Media Containers, and unlock <strong className="text-slateDark">AI-driven 30-day growth roadmaps</strong>.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
            <SignUpButton mode="modal">
              <button type="button" className="w-full sm:flex-1 px-7 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl border-[3px] border-slateDark font-heading text-base font-black flex items-center justify-center gap-2 shadow-[5px_5px_0_#1E293B] hover:-translate-y-0.5 active:translate-y-1 transition-all cursor-pointer">
                Start Growing Free<ArrowRight size={18} />
              </button>
            </SignUpButton>
            <a href="#preview" className="w-full sm:flex-1 px-5 py-4 bg-white text-slateDark rounded-2xl border-[3px] border-slateDark font-heading text-base font-black flex items-center justify-center gap-2 shadow-[3px_3px_0_#1E293B] hover:-translate-y-0.5 active:translate-y-1 transition-all cursor-pointer">
              <Play size={16} className="text-violetBrand fill-violetBrand" />Live Preview
            </a>
          </div>

          {/* Trust pills */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs font-heading font-black text-slate-600">
            {[
              { icon: <ShieldCheck size={14} className="text-emerald-600" />, label: '100% Graph API Compliant' },
              { icon: <CheckCircle2 size={14} className="text-violetBrand" />, label: 'Zero Password Sharing' },
              { icon: <GeminiIcon size={14} />, label: 'Gemini & OpenRouter AI' },
              { icon: <Lock size={14} className="text-pinkPop" />, label: 'Isolated Clerk Workspaces' },
            ].map(p => (
              <div key={p.label} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border-2 border-slateDark shadow-[2px_2px_0_#1E293B]">
                {p.icon}<span>{p.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── DIVIDER 1 ────────────────────────────────────────────────────── */}
        <SectionDivider label="Interactive Demo" icon={<Play size={11} className="text-violetBrand fill-violetBrand" />} accent="bg-violet-50" />

        {/* ── DASHBOARD PREVIEW ─────────────────────────────────────────────── */}
        <section id="preview" className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white border-4 border-slateDark rounded-3xl shadow-[8px_8px_0_#1E293B] overflow-hidden">
            {/* Window chrome */}
            <div className="bg-slate-100 border-b-[3px] border-slateDark px-5 py-3 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {['bg-rose-400','bg-yellowPop','bg-emerald-400'].map(c => <span key={c} className={`w-3.5 h-3.5 rounded-full ${c} border-2 border-slateDark`} />)}
                <code className="ml-2 text-[11px] font-mono font-bold text-slate-500">instagrowth / meta-v22.0</code>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border-2 border-slateDark shadow-[2px_2px_0_#1E293B]">
                {([['funnel','⚡ DM Funnel','bg-violetBrand','text-white'],['growth','📈 30-Day Growth','bg-pinkPop','text-slateDark'],['publisher','📅 Publisher','bg-yellowPop','text-slateDark']] as const).map(([id,label,active,activeText]) => (
                  <button key={id} type="button" onClick={() => setActivePreviewTab(id as any)}
                    className={`px-3 py-1 text-xs font-heading font-black rounded-lg transition-all ${activePreviewTab === id ? `${active} ${activeText} shadow-[1px_1px_0_#1E293B]` : 'text-slateDark hover:bg-slate-100'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 sm:p-8 bg-[#FAFAF8] space-y-5">
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:'Growth Score', value:'89', sub:'/ 100', badge:'Elite', color:'text-violetBrand' },
                  { label:'DM Leads', value:'4,821', sub:'+38%', badge:'', color:'text-slateDark' },
                  { label:'Unlock Rate', value:'54.2%', sub:'', badge:'', color:'text-pinkPop' },
                  { label:'API Health', value:'Active', sub:'', badge:'●', color:'text-emerald-600' },
                ].map(s => (
                  <div key={s.label} className="bg-white border-2 border-slateDark rounded-2xl p-3.5 shadow-[2px_2px_0_#1E293B]">
                    <div className="text-[10px] font-heading font-black text-slate-500 uppercase">{s.label}</div>
                    <div className={`text-xl font-heading font-black ${s.color} mt-0.5 flex items-center gap-1`}>
                      <span>{s.value}</span>
                      {s.sub && <span className="text-xs text-slate-500">{s.sub}</span>}
                      {s.badge === 'Elite' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-300 font-bold">{s.badge}</span>}
                      {s.badge === '●' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tab: DM Funnel */}
              {activePreviewTab === 'funnel' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-pinkPop/20 border-2 border-slateDark rounded-xl text-pinkPop"><MessageSquareCode size={20} /></div>
                      <div>
                        <h4 className="font-heading font-black text-sm text-slateDark">Keyword DM Auto-Responder Pipeline</h4>
                        <p className="text-[11px] text-slate-500 font-semibold">
                          Trigger: <code className="bg-yellowPop/50 px-1.5 py-0.5 rounded font-bold text-slateDark">GROW</code> • Follower gate: <span className="text-emerald-600 font-bold">On</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono bg-violet-50 text-violetBrand px-2.5 py-1 rounded-full border border-violet-200 font-bold">⚡ 1.1s avg</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { step:'1', label:'COMMENT', color:'bg-slate-100', content:'"Send me the GROW guide!"', note:'Meta Webhook captured' },
                      { step:'2', label:'VERIFY', color:'bg-yellowPop', content:'Checking follow status on Graph API', note:'✓ Verified Follower' },
                      { step:'3', label:'PUBLIC REPLY', color:'bg-mintPop', content:'"Check your DMs! Blueprint sent 🚀"', note:'Boosts reel reach' },
                      { step:'4', label:'INSTANT DM', color:'bg-pinkPop', content:'Personalized resource link dispatched privately', note:'Conversion complete' },
                    ].map(s => (
                      <div key={s.step} className="bg-white border-2 border-slateDark rounded-2xl p-3.5 shadow-[2px_2px_0_#1E293B] space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-heading font-black text-slate-500">
                          <span>STEP {s.step}: {s.label}</span>
                          <span className={`w-5 h-5 rounded-full ${s.color} border border-slateDark flex items-center justify-center font-bold text-[10px]`}>{s.step}</span>
                        </div>
                        <p className="text-xs font-semibold text-slateDark bg-slate-50 p-2 rounded-xl border border-slate-200">{s.content}</p>
                        <div className="text-[10px] text-slate-400 font-mono">{s.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Growth */}
              {activePreviewTab === 'growth' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-yellowPop/30 border-2 border-slateDark rounded-xl"><TrendingUp size={20} /></div>
                    <div>
                      <h4 className="font-heading font-black text-sm text-slateDark">AI Growth Strategy & Bottleneck Diagnosis</h4>
                      <p className="text-[11px] text-slate-500 font-semibold">Profile: Creator & SaaS • Target: <span className="text-violetBrand font-bold">+25,000 Followers</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { icon:<Flame size={15} className="text-rose-500"/>, title:'Bottleneck Solved', body:'Low comment-to-follower conversion fixed via Follower Gate.', badge:'+42% lift', bc:'text-emerald-600 bg-emerald-50 border-emerald-200' },
                      { icon:<CalendarCheck2 size={15} className="text-violetBrand"/>, title:"Today's AI Mission", body:'Publish 1 Hook-first Reel at 6:45 PM peak hour.', badge:'AI Hook Generator ready', bc:'text-violetBrand bg-violet-50 border-violet-200' },
                      { icon:<Hash size={15} className="text-pinkPop"/>, title:'Hashtag Matrix', body:'Low-competition, high-reach tag set with zero banned terms.', badge:'Graph Scanner ✓ Clean', bc:'text-pinkPop bg-pink-50 border-pink-200' },
                    ].map(c => (
                      <div key={c.title} className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-[2px_2px_0_#1E293B] space-y-2">
                        <div className="text-xs font-heading font-black text-slateDark flex items-center gap-1.5">{c.icon}<span>{c.title}</span></div>
                        <p className="text-xs text-slate-600 font-medium">{c.body}</p>
                        <div className={`text-[11px] font-bold ${c.bc} p-1.5 rounded-lg border`}>{c.badge}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Publisher */}
              {activePreviewTab === 'publisher' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-mintPop/30 border-2 border-slateDark rounded-xl"><CalendarCheck2 size={20} /></div>
                    <div>
                      <h4 className="font-heading font-black text-sm text-slateDark">Meta Media Container Direct Scheduler</h4>
                      <p className="text-[11px] text-slate-500 font-semibold">No phone push notifications • No third-party workarounds</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { type:'Reel', color:'text-violetBrand', time:'Today, 6:45 PM', title:'"3 Automation Flows Every Creator Needs 🚀"', note:'AI caption + trigger CTA + verified tags' },
                      { type:'Carousel', color:'text-pinkPop', time:'Tomorrow, 11:30 AM', title:'"Meta Graph API v22.0 Architecture Breakdown 📊"', note:'Multi-slide container ready for direct publish' },
                    ].map(p => (
                      <div key={p.type} className="bg-white border-2 border-slateDark rounded-2xl p-4 shadow-[2px_2px_0_#1E293B] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-heading font-black ${p.color} uppercase`}>{p.type}</span>
                          <code className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded font-bold">{p.time}</code>
                        </div>
                        <p className="text-xs font-bold text-slateDark">{p.title}</p>
                        <p className="text-[11px] text-slate-500">{p.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── DIVIDER 2 ────────────────────────────────────────────────────── */}
        <SectionDivider label="Platform Metrics" icon={<TrendingUp size={11} className="text-yellow-700" />} accent="bg-yellowPop" />

        {/* ── METRICS BANNER ────────────────────────────────────────────────── */}
        <section className="w-full bg-yellowPop border-y-[3px] border-slateDark py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {[
              { value:'10M+', label:'Automated Interactions' },
              { value:'100%', label:'Official Graph API (No Ban Risk)' },
              { value:'4.2×', label:'Faster Follower Growth' },
              { value:'<1.2s', label:'Real-Time DM Latency' },
            ].map(m => (
              <div key={m.label} className="space-y-1">
                <div className="font-heading text-4xl font-black text-slateDark">{m.value}</div>
                <div className="text-[11px] font-heading font-black text-slateDark/70 uppercase tracking-wide">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── DIVIDER 3 ────────────────────────────────────────────────────── */}
        <SectionDivider label="Feature Matrix" icon={<Layers size={11} className="text-violetBrand" />} accent="bg-violet-50" />

        {/* ── FEATURES GRID ─────────────────────────────────────────────────── */}
        <section id="features" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-slateDark tracking-tight">
              Engineered for Creators, Agencies & Brands
            </h2>
            <p className="text-sm text-slate-600 font-semibold">
              Everything you need to automate Instagram engagement, publishing, and analytics in one verified suite.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon:<MessageSquareCode size={24}/>, bg:'bg-pinkPop/20', tc:'text-pinkPop', title:'Comment Auto-Responder & DM Funnels', body:'Trigger autonomous public replies and private DMs via keyword detection. Distribute lead magnets while boosting post engagement algorithmically.', badge:'✨ Follow-to-Unlock built in', bc:'text-violetBrand bg-violet-50 border-violet-200' },
              { icon:<CalendarCheck2 size={24}/>, bg:'bg-yellowPop/40', tc:'text-slateDark', title:'Direct Publisher & Queue Scheduler', body:'Publish photos, reels, carousels, and stories directly via Meta Media Containers. No phone push notifications or third-party tools required.', badge:'📅 Peak-hour scheduling engine', bc:'text-yellow-800 bg-yellow-50 border-yellow-200' },
              { icon:<TrendingUp size={24}/>, bg:'bg-mintPop/30', tc:'text-emerald-800', title:'AI 30-Day Growth Strategy Engine', body:'Diagnose bottlenecks with custom growth scoring. Receive personalized daily missions, optimal posting times, and AI-generated caption hooks.', badge:'🚀 Actionable 30-day roadmap', bc:'text-emerald-800 bg-emerald-50 border-emerald-200' },
              { icon:<Search size={24}/>, bg:'bg-violet-100', tc:'text-violetBrand', title:'Competitor Business Discovery', body:"Inspect competitor public accounts via Meta's Business Discovery API. Unpack their top content, caption formats, and real engagement metrics.", badge:'🔍 Reverse-engineer viral posts', bc:'text-violetBrand bg-violet-50 border-violet-200' },
              { icon:<Hash size={24}/>, bg:'bg-rose-100', tc:'text-rose-600', title:'Hashtag Hub & Banned Tag Scanner', body:'Discover niche-specific tags with high reach. Automatically scan for blacklisted or shadowbanned tags before you post, keeping reach clean.', badge:'🛡️ Prevent shadowbans', bc:'text-rose-800 bg-rose-50 border-rose-200' },
              { icon:<ShieldCheck size={24}/>, bg:'bg-blue-100', tc:'text-blue-600', title:'Multi-Tenant Scoped Storage', body:'Clerk authentication isolates credentials, tokens, rules, and lead lists per user account. Switching accounts auto-loads that workspace cleanly.', badge:'🔒 Enterprise data isolation', bc:'text-blue-800 bg-blue-50 border-blue-200' },
            ].map(f => (
              <div key={f.title} className="bg-white border-[3px] border-slateDark rounded-3xl p-6 shadow-[5px_5px_0_#1E293B] space-y-4 hover:-translate-y-1 transition-transform">
                <div className={`w-12 h-12 rounded-2xl ${f.bg} border-2 border-slateDark flex items-center justify-center ${f.tc} shadow-[2px_2px_0_#1E293B]`}>{f.icon}</div>
                <h3 className="font-heading text-lg font-black text-slateDark leading-snug">{f.title}</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{f.body}</p>
                <div className={`text-[11px] font-bold ${f.bc} px-2.5 py-1.5 rounded-xl border`}>{f.badge}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── DIVIDER 4 ────────────────────────────────────────────────────── */}
        <SectionDivider label="How It Works" icon={<Sparkles size={11} className="text-pinkPop" />} accent="bg-pink-50" />

        {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
        <section id="how-it-works" className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-slateDark tracking-tight">Get Running in Under 2 Minutes</h2>
            <p className="text-sm text-slate-600 font-semibold">No developer setup. Connect via Meta's official OAuth and start automating.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n:'1', bg:'bg-yellowPop', title:'Connect Meta Account', body:'Paste your official Instagram Business / Creator API credentials. Tokens are scoped to your Clerk profile.' },
              { n:'2', bg:'bg-pinkPop', title:'Configure Triggers & Funnels', body:'Set trigger keywords, customize reply templates, and enable follow-to-unlock DM delivery flows.' },
              { n:'3', bg:'bg-violetBrand text-white', title:'Scale 24/7 Autonomously', body:'Your account converts comments to DMs, schedules content at peak hours, and grows — all automatically.' },
            ].map(s => (
              <div key={s.n} className="bg-white border-[3px] border-slateDark rounded-3xl p-6 shadow-[5px_5px_0_#1E293B] space-y-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} border-2 border-slateDark flex items-center justify-center font-heading font-black text-xl shadow-[2px_2px_0_#1E293B]`}>{s.n}</div>
                <h4 className="font-heading text-lg font-black text-slateDark">{s.title}</h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── DIVIDER 5 ────────────────────────────────────────────────────── */}
        <SectionDivider label="Safety Comparison" icon={<ShieldAlert size={11} className="text-rose-600" />} accent="bg-rose-50" />

        {/* ── COMPARISON TABLE ──────────────────────────────────────────────── */}
        <section id="comparison" className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-slateDark tracking-tight">Why Official Graph API Matters</h2>
            <p className="text-sm text-slate-600 font-semibold">Don't risk years of hard work. See how InstaGrowth protects your account.</p>
          </div>
          <div className="bg-white border-[3px] border-slateDark rounded-3xl shadow-[5px_5px_0_#1E293B] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm min-w-[480px]">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slateDark text-[11px] font-heading font-black uppercase">
                    <th className="p-4 text-slateDark">Criteria</th>
                    <th className="p-4 bg-violet-50 text-violetBrand border-x-2 border-slateDark">InstaGrowth.io ✓</th>
                    <th className="p-4 text-slate-500">Third-Party Bots ✗</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-200">
                  {[
                    ['API Architecture','Official Meta Graph v22.0','Web scraping / reverse-engineered'],
                    ['Password Sharing','NEVER — Token OAuth only','Requires your raw IG password'],
                    ['Ban / Shadowban Risk','0% — Compliant with Meta TOS','Extreme risk of permanent disable'],
                    ['Follow-to-Unlock DM','Built-in verification engine','Not supported / unreliable'],
                    ['AI Integration','Gemini 3.5 & OpenRouter BYOK','Generic static spintax only'],
                  ].map(([label,good,bad]) => (
                    <tr key={label}>
                      <td className="p-4 font-bold text-slateDark">{label}</td>
                      <td className="p-4 bg-violet-50/50 border-x-2 border-slateDark text-emerald-700 font-bold">
                        <span className="flex items-center gap-1.5"><Check size={15} className="text-emerald-600 shrink-0" />{good}</span>
                      </td>
                      <td className="p-4 text-rose-600 font-semibold">
                        <span className="flex items-center gap-1.5"><X size={15} className="text-rose-500 shrink-0" />{bad}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── DIVIDER 6 ────────────────────────────────────────────────────── */}
        <SectionDivider label="FAQ" icon={<HelpCircle size={11} className="text-yellow-700" />} accent="bg-yellowPop/50" />

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <section id="faq" className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="font-heading text-3xl sm:text-4xl font-black text-slateDark tracking-tight">Frequently Asked Questions</h2>
            <p className="text-sm text-slate-500 font-semibold">Everything you need to know before connecting your account.</p>
          </div>
          <div className="space-y-3">
            {[
              { q:'Will my account get flagged, blocked, or shadowbanned?', a:'No. InstaGrowth.io runs 100% on the official Meta Graph API v22.0. We never ask for your Instagram password, never simulate a mobile device, and use verified Meta webhooks and endpoints only.' },
              { q:'Do I need a Creator or Business Instagram account?', a:'Yes. The Meta Graph API is exclusively available to Professional accounts (Creator or Business) connected to a Facebook Page. Personal accounts cannot access the API per Meta\'s policies.' },
              { q:'How does the Follow-to-Unlock feature work?', a:'When a user comments your keyword, our engine calls the Graph API to check their relationship status. If they\'re not following yet, it sends a reply encouraging them to follow, then dispatches the DM once verified.' },
              { q:'Can I use my own Gemini or OpenRouter keys?', a:'Yes — full BYOK (Bring Your Own Key) support for Google Gemini 3.5 and OpenRouter models. Keys are stored client-side and scoped to your Clerk user session.' },
              { q:'Can I schedule Reels without a third-party mobile app?', a:'Yes. InstaGrowth uses the Meta Media Container API to stage and directly publish video reels, photos, and carousels at designated peak-hour times without any mobile app.' },
            ].map((f, i) => (
              <div key={i} className="bg-white border-2 border-slateDark rounded-2xl shadow-[2px_2px_0_#1E293B] overflow-hidden">
                <button type="button" onClick={() => toggleFaq(i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 font-heading font-black text-sm text-slateDark cursor-pointer hover:bg-slate-50 transition-colors">
                  <span>{f.q}</span>
                  <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slateDark flex items-center justify-center shrink-0">
                    {openFaqIndex === i ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </button>
                {openFaqIndex === i && (
                  <div className="px-5 pb-5 pt-0 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed border-t-2 border-slate-100 pt-3">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── DIVIDER 7 ────────────────────────────────────────────────────── */}
        <SectionDivider label="Get Started Today" icon={<Zap size={11} className="text-violetBrand" />} accent="bg-violet-50" />

        {/* ── BOTTOM CTA ────────────────────────────────────────────────────── */}
        <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="relative bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 border-4 border-slateDark rounded-3xl p-8 sm:p-14 text-center text-white shadow-[8px_8px_0_#1E293B] space-y-6 overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-pinkPop/20 blur-3xl pointer-events-none" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-xs font-heading font-black uppercase">
              <Star size={12} className="fill-yellowPop text-yellowPop" />Ready to grow?
            </div>
            <h2 className="font-heading text-3xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto">
              Start Automating Instagram Growth with Zero Account Risk
            </h2>
            <p className="text-sm sm:text-base text-violet-100 font-medium max-w-xl mx-auto">
              Create your account in seconds. Connect Meta Graph API v22.0 and unlock autonomous keyword DM funnels instantly.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <SignUpButton mode="modal">
                <button type="button" className="w-full sm:w-auto px-8 py-4 bg-yellowPop hover:bg-yellow-300 text-slateDark rounded-2xl border-[3px] border-slateDark font-heading text-base font-black flex items-center justify-center gap-2 shadow-[5px_5px_0_#1E293B] hover:-translate-y-0.5 active:translate-y-1 transition-all cursor-pointer">
                  Claim Your Free Account<ArrowRight size={18} />
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button type="button" className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl border-2 border-white/40 font-heading text-base font-black flex items-center justify-center gap-2 backdrop-blur transition-all cursor-pointer">
                  <Lock size={16} />Sign In to Dashboard
                </button>
              </SignInButton>
            </div>
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <footer className="w-full border-t-[3px] border-slateDark bg-slateDark text-white">
          {/* Main footer grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="space-y-4 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violetBrand border-2 border-white/30 flex items-center justify-center rotate-[-3deg] text-white">
                  <Zap size={18} strokeWidth={3} />
                </div>
                <span className="font-heading font-black text-xl tracking-tight">
                  InstaGrowth<span className="text-violetBrand">.io</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                The only Instagram automation suite built entirely on the official Meta Graph API v22.0 — zero scraping, zero password sharing, zero ban risk.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-400 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  All Systems Operational
                </div>
              </div>
            </div>

            {/* Product links */}
            <div className="space-y-4">
              <h4 className="font-heading font-black text-sm uppercase tracking-wider text-slate-300">Product</h4>
              <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
                {['Comment Auto-Responder','Direct Publisher','30-Day Growth Engine','Hashtag Hub','Business Discovery','Audience Insights'].map(l => (
                  <li key={l} className="hover:text-white transition-colors cursor-pointer">{l}</li>
                ))}
              </ul>
            </div>

            {/* Tech stack */}
            <div className="space-y-4">
              <h4 className="font-heading font-black text-sm uppercase tracking-wider text-slate-300">Built With</h4>
              <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
                {[
                  'Meta Graph API v22.0',
                  'Google Gemini 3.5 Flash',
                  'OpenRouter (BYOK)',
                  'Clerk Authentication',
                  'Supabase Storage',
                  'Vite + React + TypeScript',
                ].map(t => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />{t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal / compliance */}
            <div className="space-y-4">
              <h4 className="font-heading font-black text-sm uppercase tracking-wider text-slate-300">Compliance</h4>
              <ul className="space-y-2.5 text-xs font-semibold text-slate-400">
                {['Meta Platform Terms','Graph API Usage Policies','Data Privacy (ISO-compliant)','Client Workspace Isolation','BYOK Encryption Policy'].map(l => (
                  <li key={l} className="hover:text-white transition-colors cursor-pointer">{l}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer bottom bar */}
          <div className="border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
              <span>© {new Date().getFullYear()} InstaGrowth.io — All rights reserved.</span>
              <div className="flex items-center gap-4">
                <span className="hover:text-slate-300 cursor-pointer transition-colors">Privacy Policy</span>
                <span className="hover:text-slate-300 cursor-pointer transition-colors">Terms of Service</span>
                <span className="hover:text-slate-300 cursor-pointer transition-colors">Support</span>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </PatternBackground>
  );
};
