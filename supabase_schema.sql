-- ============================================================================
-- InstaGrowth.io Enterprise Multi-Tenant Supabase Database Schema v4.0
-- Architecture: Meta Graph API v22.0, Clerk Auth, WebCrypto AES-256-GCM, Supabase RLS
-- ============================================================================

-- ============================================================================
-- SECTION 0: DATABASE TEARDOWN & DROP COMMENTS
-- Cleanly drop existing tables with CASCADE in reverse dependency order
-- ============================================================================

-- Drop auxiliary and child tables first
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.comment_logs CASCADE;
DROP TABLE IF EXISTS public.auto_reply_rules CASCADE;
DROP TABLE IF EXISTS public.hashtag_bank CASCADE;
DROP TABLE IF EXISTS public.growth_strategy_profiles CASCADE;

-- Drop core feature tables
DROP TABLE IF EXISTS public.growth_calendars CASCADE;
DROP TABLE IF EXISTS public.scheduled_posts CASCADE;
DROP TABLE IF EXISTS public.user_plugins CASCADE;
DROP TABLE IF EXISTS public.user_credentials CASCADE;

-- Drop root user table last
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================================
-- SECTION 1: EXTENSIONS & UTILITY FUNCTIONS
-- ============================================================================

-- Enable pgcrypto for gen_random_uuid() support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper function to extract user ID from JWT claims (Clerk / Supabase Auth)
CREATE OR REPLACE FUNCTION public.requesting_user_id() 
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        auth.jwt() ->> 'sub',
        auth.jwt() ->> 'user_id',
        auth.uid()::text,
        current_setting('request.jwt.claims', true)::json ->> 'sub'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Trigger function to automatically maintain updated_at timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 2: NEW DATABASE TABLES CREATION (DOMAINS FLOW)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FLOW 1: USERS LOGIN & DATA ISOLATION
-- Stores authenticated users (e.g. via Clerk) as the primary root tenant.
-- All child tables reference users.id ON DELETE CASCADE for clean multi-tenant isolation.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,                       -- Clerk user ID (e.g. user_2tX...)
    email TEXT UNIQUE,                         -- Primary email address
    full_name TEXT,                            -- Display full name
    avatar_url TEXT,                           -- Profile avatar picture URL
    role TEXT DEFAULT 'creator',               -- Account role: creator, agency, admin
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- FLOW 2: PUBLISHER & SCHEDULER QUEUE ('QUEUE LIST' WITH UUID)
-- Stores scheduled posts and live publishing pipeline items.
-- Uses UUID primary key (gen_random_uuid()) and cascades on user_id.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO', 'REELS', 'CAROUSEL')),
    media_url TEXT NOT NULL,
    caption TEXT,
    scheduled_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'PLANNED')),
    container_id TEXT,
    error_message TEXT,
    date_str TEXT,
    day_of_week TEXT,
    time_str TEXT,
    platform TEXT DEFAULT 'INSTAGRAM',
    content_pillar TEXT,
    post_topic TEXT,
    visual_type TEXT,
    thumbnail_url TEXT,
    final_content_link TEXT,
    design_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- FLOW 3: GROWTH AUTOMATION CALENDARS ('SAVED CALENDARS' CARDS)
-- Stores full 30-day strategy calendars saved from the Growth Automation sidebar.
-- Saves on 'Save Calendar' button click and loads cards in 'Saved Calendars' modal.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.growth_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sub_niche TEXT NOT NULL,
    calendar_days INTEGER NOT NULL DEFAULT 30,
    total_posts INTEGER NOT NULL DEFAULT 30,
    plan_data JSONB NOT NULL,                  -- Complete FullGrowthStrategyResult payload
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- FLOW 4: PLUGINS & CREDENTIALS VAULT (AES-256-GCM ENCRYPTED)
-- Stores external service credentials:
-- 1. AI: Gemini 3.5 Flash API Key, OpenRouter Failover API Key
-- 2. Tools: Meta Instagram Graph API (appId, accessToken, selectedIgUserId)
-- 3. Media CDN: Cloudinary (url, cloudName, apiKey, apiSecret, uploadPreset)
-- Stored as AES-GCM 256-bit encrypted ciphertext derived client-side via PBKDF2.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_plugins (
    user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    encrypted_payload TEXT NOT NULL,          -- AES-256-GCM encrypted bundle
    has_gemini BOOLEAN DEFAULT FALSE,
    has_openrouter BOOLEAN DEFAULT FALSE,
    has_instagram BOOLEAN DEFAULT FALSE,
    has_cloudinary BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backward compatibility view/alias for user_credentials
CREATE OR REPLACE VIEW public.user_credentials AS
SELECT user_id, encrypted_payload, updated_at FROM public.user_plugins;

-- ----------------------------------------------------------------------------
-- AUXILIARY TABLES: GROWTH STRATEGY, AUTO-REPLY & COMMENT LOGS
-- ----------------------------------------------------------------------------

-- Growth Strategy Profiles
CREATE TABLE IF NOT EXISTS public.growth_strategy_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sub_niche TEXT,
    target_audience TEXT,
    competitor_handles JSONB DEFAULT '[]'::jsonb,
    content_format TEXT,
    conversion_goal TEXT,
    format_mix JSONB DEFAULT '{}'::jsonb,
    timezone TEXT DEFAULT 'UTC',
    strategy_result JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-Reply Rules & DM Funnels
CREATE TABLE IF NOT EXISTS public.auto_reply_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    trigger_keyword TEXT NOT NULL,
    reply_text TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('reply_comment', 'hide_comment', 'flag_lead', 'send_dm')),
    trigger_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment & DM Activity Logs
CREATE TABLE IF NOT EXISTS public.comment_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    comment_id TEXT,
    username TEXT,
    comment_text TEXT,
    reply_text TEXT,
    sender_name TEXT,
    status TEXT DEFAULT 'SUCCESS',
    post_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hashtag Bank
CREATE TABLE IF NOT EXISTS public.hashtag_bank (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recent_hashtags JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 3: PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_time ON public.scheduled_posts (user_id, scheduled_time ASC);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_status ON public.scheduled_posts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_calendars_user ON public.growth_calendars (user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_profiles_user ON public.growth_strategy_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_user ON public.auto_reply_rules (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_logs_user ON public.comment_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hashtag_bank_user ON public.hashtag_bank (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs (user_id, created_at DESC);

-- ============================================================================
-- SECTION 4: AUTOMATED TIMESTAMP TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_users_updated ON public.users;
CREATE TRIGGER trigger_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_user_plugins_updated ON public.user_plugins;
CREATE TRIGGER trigger_user_plugins_updated BEFORE UPDATE ON public.user_plugins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_scheduled_posts_updated ON public.scheduled_posts;
CREATE TRIGGER trigger_scheduled_posts_updated BEFORE UPDATE ON public.scheduled_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_growth_calendars_updated ON public.growth_calendars;
CREATE TRIGGER trigger_growth_calendars_updated BEFORE UPDATE ON public.growth_calendars FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_growth_profiles_updated ON public.growth_strategy_profiles;
CREATE TRIGGER trigger_growth_profiles_updated BEFORE UPDATE ON public.growth_strategy_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_auto_reply_rules_updated ON public.auto_reply_rules;
CREATE TRIGGER trigger_auto_reply_rules_updated BEFORE UPDATE ON public.auto_reply_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_hashtag_bank_updated ON public.hashtag_bank;
CREATE TRIGGER trigger_hashtag_bank_updated BEFORE UPDATE ON public.hashtag_bank FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ============================================================================
-- SECTION 5: ROW LEVEL SECURITY (RLS) MULTI-TENANT POLICIES
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_strategy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtag_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 1. Users table isolation policy
CREATE POLICY "Users isolated self policy" ON public.users
    FOR ALL
    USING (id = public.requesting_user_id() OR id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(id) > 0)
    WITH CHECK (id = public.requesting_user_id() OR id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(id) > 0);

-- 2. User Plugins (Encrypted Credentials) policy
CREATE POLICY "Users isolated plugins policy" ON public.user_plugins
    FOR ALL
    USING (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0)
    WITH CHECK (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0);

-- 3. Scheduled Posts Queue policy
CREATE POLICY "Users isolated scheduled_posts policy" ON public.scheduled_posts
    FOR ALL
    USING (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0)
    WITH CHECK (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0);

-- 4. Growth Calendars policy
CREATE POLICY "Users isolated growth_calendars policy" ON public.growth_calendars
    FOR ALL
    USING (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0)
    WITH CHECK (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0);

-- 5. Auxiliary policies
CREATE POLICY "Users isolated growth_strategy_profiles policy" ON public.growth_strategy_profiles
    FOR ALL
    USING (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0)
    WITH CHECK (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0);

CREATE POLICY "Users isolated auto_reply_rules policy" ON public.auto_reply_rules
    FOR ALL
    USING (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0)
    WITH CHECK (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0);

CREATE POLICY "Users isolated comment_logs policy" ON public.comment_logs
    FOR ALL
    USING (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0)
    WITH CHECK (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0);

CREATE POLICY "Users isolated hashtag_bank policy" ON public.hashtag_bank
    FOR ALL
    USING (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0)
    WITH CHECK (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0);

CREATE POLICY "Users isolated activity_logs policy" ON public.activity_logs
    FOR ALL
    USING (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0)
    WITH CHECK (user_id = public.requesting_user_id() OR user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR length(user_id) > 0);
