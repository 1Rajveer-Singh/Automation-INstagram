import React, { useState, useEffect, useMemo } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { ApiConfig, InstagramUser, InstagramMedia, GrowthStrategyProfile } from './types/instagram';
import { loadEnvCredentials, saveEnvCredentials, setCurrentUserScope, syncCredentialsFromSupabase } from './services/security';
import { syncSupabaseUser } from './services/supabaseService';
import { getAccountInfo, getMediaPosts } from './services/instagramApi';
import { calculateStableGrowthScore } from './services/growthEngine';
import { setSchedulerUserScope } from './services/scheduler';
import { PatternBackground } from './components/common/PatternBackground';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Header } from './components/layout/Header';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { PublisherView } from './components/views/PublisherView';
import { AutoResponderView } from './components/views/AutoResponderView';
import { BusinessDiscoveryView } from './components/views/BusinessDiscoveryView';
import { HashtagHubView } from './components/views/HashtagHubView';
import { InsightsView } from './components/views/InsightsView';
import { GrowthAutomationView } from './components/views/GrowthAutomationView';
import { PluginsView } from './components/views/PluginsView';
import { GrowthStrategyModal } from './components/views/GrowthStrategyModal';
import { LandingPageView } from './components/views/LandingPageView';
import { useActivity } from './context/ActivityContext';
import { RefreshCw, Zap } from 'lucide-react';

export function App() {
  const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const activeUserId = clerkUser?.id || clerkUser?.primaryEmailAddress?.emailAddress || 'default';

  const { addActivity, setUserScope } = useActivity();

  const [config, setConfig] = useState<ApiConfig>({
    appId: '',
    appSecret: '',
    accessToken: '',
    selectedIgUserId: '',
    geminiApiKey: '',
    openRouterApiKey: '',
    rateLimitUsage: 12,
    tokenExpiresInDays: 60,
    cloudinaryUrl: '',
    cloudinaryCloudName: '',
    cloudinaryApiKey: '',
    cloudinaryApiSecret: '',
    cloudinaryUploadPreset: '',
  });

  // Load credentials scoped to this Clerk user — syncs from encrypted Supabase DB
  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn || !activeUserId || activeUserId === 'default') return;
    setCurrentUserScope(activeUserId);
    setSchedulerUserScope(activeUserId);
    setUserScope(activeUserId);

    // Sync authenticated user to Supabase public.users table for strict data isolation
    syncSupabaseUser({
      id: activeUserId,
      email: clerkUser?.primaryEmailAddress?.emailAddress,
      full_name: clerkUser?.fullName || '',
      avatar_url: clerkUser?.imageUrl || '',
      role: 'creator',
    }).catch(console.warn);

    let isMounted = true;

    async function hydrateUserConfig() {
      // 1. First sync from Supabase DB encrypted storage
      const userEnv = await syncCredentialsFromSupabase(activeUserId);
      if (isMounted) {
        setConfig(prev => ({
          ...prev,
          appId: userEnv.appId || '',
          appSecret: '',
          accessToken: userEnv.accessToken || '',
          selectedIgUserId: userEnv.selectedIgUserId || '',
          geminiApiKey: userEnv.geminiApiKey || '',
          openRouterApiKey: userEnv.openRouterApiKey || '',
          cloudinaryUrl: userEnv.cloudinaryUrl || '',
          cloudinaryCloudName: userEnv.cloudinaryCloudName || '',
          cloudinaryApiKey: userEnv.cloudinaryApiKey || '',
          cloudinaryApiSecret: userEnv.cloudinaryApiSecret || '',
          cloudinaryUploadPreset: userEnv.cloudinaryUploadPreset || '',
        }));
      }
    }

    hydrateUserConfig();

    // Load this user's strategy profile from scoped key
    try {
      const savedStrategy = localStorage.getItem(`instagrowth_strategy_profile_${activeUserId}`);
      if (savedStrategy) {
        setStrategyProfile(JSON.parse(savedStrategy));
        setIsStrategyModalOpen(false);
      } else {
        setStrategyProfile(null);
        setIsStrategyModalOpen(true);
      }
    } catch {
      setStrategyProfile(null);
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthLoaded, isSignedIn, activeUserId]);


  // Scoped localStorage key — always includes the real Clerk user ID
  const strategyKey = `instagrowth_strategy_profile_${activeUserId}`;
  const hashtagKey = `instagrowth_recent_hashtags_${activeUserId}`;

  const [strategyProfile, setStrategyProfile] = useState<GrowthStrategyProfile | null>(null);

  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [hashtagSubTab, setHashtagSubTab] = useState<'generator' | 'scanner'>('generator');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<InstagramUser | null>(null);
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(() => Boolean(config.accessToken && config.selectedIgUserId));

  const handleNavigate = (tab: NavTab) => {
    if (tab === 'hashtag-generator') {
      setActiveTab('hashtags');
      setHashtagSubTab('generator');
    } else if (tab === 'hashtags') {
      setActiveTab('hashtags');
    } else {
      setActiveTab(tab);
    }
  };

  const handleSaveStrategy = (
    profile: GrowthStrategyProfile,
    targetTab?: 'competitors' | 'hashtag-generator' | 'hashtags'
  ) => {
    setStrategyProfile(profile);
    localStorage.setItem(strategyKey, JSON.stringify(profile));

    // Seed niche hashtags for Hashtag Search
    const cleanWord = profile.subNiche.split(/[\s,]+/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'niche';
    const nicheTags = [
      `#${cleanWord}`,
      `#${cleanWord}tips`,
      `#${cleanWord}community`,
      `#${cleanWord}life`,
      `#${cleanWord}daily`,
      '#explorepage',
      '#reelsgrowth'
    ];
    localStorage.setItem(hashtagKey, JSON.stringify(nicheTags));

    addActivity(`Growth Strategy profile activated for "${profile.subNiche}"! Configured Discovery, Hashtags & Search.`, 'success');

    if (targetTab === 'hashtag-generator') {
      setActiveTab('hashtags');
      setHashtagSubTab('generator');
    } else if (targetTab === 'hashtags') {
      setActiveTab('hashtags');
      setHashtagSubTab('scanner');
    } else if (targetTab) {
      setActiveTab(targetTab);
    }
  };

  const loadData = async () => {
    if (!config.accessToken || !config.selectedIgUserId) {
      setUser(null);
      setMedia([]);
      setIsInitialLoading(false);
      return;
    }

    setIsRefreshing(true);
    try {
      const userInfo = await getAccountInfo(config.selectedIgUserId, config.accessToken);
      if (userInfo) {
        const mediaItems = await getMediaPosts(config.selectedIgUserId, config.accessToken);
        // Recalculate deterministic growth score with media posts to ensure 100% synchronization everywhere
        const { total: accurateScore } = calculateStableGrowthScore(userInfo, mediaItems);
        setUser({ ...userInfo, growthScore: accurateScore });
        setMedia(mediaItems);
      }
    } catch {
      // API errors are handled silently — no console leakage
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [config.selectedIgUserId, config.accessToken]);

  // Synchronized growth score that matches Bottlenecks & Solutions (69) everywhere
  const currentGrowthScore = useMemo(() => {
    try {
      const saved = localStorage.getItem(`instagrowth_active_30day_strategy_v3_${activeUserId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.growthScore?.total) return parsed.growthScore.total;
      }
    } catch {}
    if (user) {
      return calculateStableGrowthScore(user, media).total;
    }
    return 0;
  }, [user, media, activeUserId]);

  const handleUpdateConfig = (newPartial: Partial<ApiConfig>) => {
    saveEnvCredentials(newPartial as any, activeUserId);
    setConfig(prev => ({
      ...prev,
      ...newPartial,
    }));
  };

  // 1. Clerk is still initialising — show centered full-screen auth loader
  if (!isAuthLoaded) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#FFFDF8]" style={{ backgroundImage: 'radial-gradient(#1E293B 1px, transparent 1px)', backgroundSize: '24px 24px', backgroundRepeat: 'repeat' }}>
        <div className="bg-white border-4 border-slateDark rounded-3xl px-10 py-10 max-w-sm w-full mx-4 text-center shadow-[8px_8px_0px_0px_#1E293B] space-y-5">
          {/* Animated logo mark */}
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-2xl bg-violetBrand/20 border-2 border-violetBrand/30 animate-ping" />
            <div className="relative w-20 h-20 rounded-2xl bg-violetBrand border-3 border-slateDark flex items-center justify-center shadow-[4px_4px_0px_0px_#1E293B] text-white rotate-[-4deg]">
              <Zap size={32} strokeWidth={2.5} />
            </div>
          </div>

          {/* Brand */}
          <div>
            <p className="font-heading font-black text-2xl text-slateDark tracking-tight">
              InstaGrowth<span className="text-violetBrand">.io</span>
            </p>
            <p className="text-xs text-slate-500 font-semibold mt-1">Verifying your session...</p>
          </div>

          {/* Divider */}
          <hr className="border-t-2 border-slate-200" />

          {/* Spinner row */}
          <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold text-violetBrand bg-violet-50 py-2.5 px-4 rounded-xl border-2 border-violet-200">
            <RefreshCw size={14} className="animate-spin" />
            <span>Connecting to Clerk Auth</span>
          </div>

          {/* Dots progress */}
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-violetBrand animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated — show public landing page
  if (!isSignedIn) {
    return <LandingPageView />;
  }

  // 3. Authenticated — render full app wrapped in error boundary
  return (
    <ErrorBoundary>
    <PatternBackground>
      <div className="h-screen w-screen flex flex-col overflow-hidden">
        {/* Header Bar */}
        <Header
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenStrategyModal={() => setIsStrategyModalOpen(true)}
          isStrategyConfigured={Boolean(strategyProfile)}
        />


        {/* Main Workspace Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={handleNavigate}
            growthScore={currentGrowthScore || user?.growthScore || 0}
            isMobileOpen={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />

          <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden w-full space-y-6">
            {isInitialLoading ? (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8">
                <div className="bg-white border-4 border-slateDark rounded-3xl p-8 max-w-md shadow-pop space-y-4 animate-in fade-in zoom-in-95">
                  <div className="w-16 h-16 rounded-2xl bg-yellowPop border-3 border-slateDark mx-auto flex items-center justify-center shadow-pop-sm">
                    <RefreshCw size={28} className="animate-spin text-slateDark" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-xl text-slateDark">
                      Connecting to Meta Graph API v22.0
                    </h3>
                    <p className="text-xs text-slate-600 font-semibold mt-1">
                      Fetching live Instagram profile, published media posts & audience insights...
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-violetBrand bg-violet-50 py-1.5 px-3 rounded-xl border border-violet-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Syncing authentic account data</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                  <DashboardView
                    config={config}
                    user={user}
                    media={media}
                    onNavigate={handleNavigate}
                    onOpenTokenModal={() => setActiveTab('plugins')}
                    profile={strategyProfile}
                    onOpenStrategyModal={() => setIsStrategyModalOpen(true)}
                  />
                </div>

                <div className={activeTab === 'publisher' ? 'block' : 'hidden'}>
                  <PublisherView config={config} onPostPublished={loadData} userId={activeUserId} onNavigate={handleNavigate} />
                </div>

                <div className={activeTab === 'auto-responder' ? 'block' : 'hidden'}>
                  <AutoResponderView config={config} mediaList={media} user={user} userId={activeUserId} />
                </div>

                <div className={activeTab === 'competitors' ? 'block' : 'hidden'}>
                  <BusinessDiscoveryView
                    config={config}
                    profile={strategyProfile}
                    onOpenStrategyModal={() => setIsStrategyModalOpen(true)}
                    userId={activeUserId}
                  />
                </div>

                <div className={activeTab === 'hashtags' || activeTab === 'hashtag-generator' ? 'block' : 'hidden'}>
                  <HashtagHubView
                    config={config}
                    profile={strategyProfile}
                    onOpenStrategyModal={() => setIsStrategyModalOpen(true)}
                    activeSubTab={hashtagSubTab}
                    onSubTabChange={setHashtagSubTab}
                    userId={activeUserId}
                  />
                </div>

                <div className={activeTab === 'insights' ? 'block' : 'hidden'}>
                  <InsightsView config={config} />
                </div>

                <div className={activeTab === 'growth-rules' ? 'block' : 'hidden'}>
                  <GrowthAutomationView
                    config={config}
                    user={user}
                    media={media}
                    profile={strategyProfile}
                    onNavigate={handleNavigate}
                    onOpenStrategyModal={() => setIsStrategyModalOpen(true)}
                    userId={activeUserId}
                  />
                </div>

                <div className={activeTab === 'plugins' ? 'block' : 'hidden'}>
                  <PluginsView config={config} onSaveConfig={handleUpdateConfig} userId={activeUserId} />
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* Growth Strategy Questionnaire Window / Modal */}
      <GrowthStrategyModal
        isOpen={isStrategyModalOpen}
        onClose={() => setIsStrategyModalOpen(false)}
        onSaveStrategy={handleSaveStrategy}
        initialProfile={strategyProfile}
      />
    </PatternBackground>
    </ErrorBoundary>
  );
}

export default App;
