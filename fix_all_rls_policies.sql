-- ==============================================================================
-- RAIL SWAP - FIX ALL RLS POLICIES FOR DIRECT DATABASE AUTH
-- ==============================================================================
-- Copy and run this query in your Supabase SQL Editor (https://supabase.com/dashboard)
-- This removes legacy auth.uid() restrictions so matches, messages, requests, and notifications work 100%.

-- 1. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_all_access" ON public.profiles;
CREATE POLICY "profiles_all_access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 2. MATCHES RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches_participants_select" ON public.matches;
DROP POLICY IF EXISTS "matches_participants_insert" ON public.matches;
DROP POLICY IF EXISTS "matches_participants_update" ON public.matches;
DROP POLICY IF EXISTS "matches_all_access" ON public.matches;
CREATE POLICY "matches_all_access" ON public.matches FOR ALL USING (true) WITH CHECK (true);

-- 3. MESSAGES RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select_in_match" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_in_match" ON public.messages;
DROP POLICY IF EXISTS "messages_update_in_match" ON public.messages;
DROP POLICY IF EXISTS "messages_all_access" ON public.messages;
CREATE POLICY "messages_all_access" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- 4. EXCHANGE REQUESTS RLS
ALTER TABLE public.exchange_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "requests_select_all" ON public.exchange_requests;
DROP POLICY IF EXISTS "requests_insert_own" ON public.exchange_requests;
DROP POLICY IF EXISTS "requests_update_own" ON public.exchange_requests;
DROP POLICY IF EXISTS "requests_delete_own" ON public.exchange_requests;
DROP POLICY IF EXISTS "requests_all_access" ON public.exchange_requests;
CREATE POLICY "requests_all_access" ON public.exchange_requests FOR ALL USING (true) WITH CHECK (true);

-- 5. NOTIFICATIONS RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_any_auth" ON public.notifications;
DROP POLICY IF EXISTS "notifications_all_access" ON public.notifications;
CREATE POLICY "notifications_all_access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- 6. REPORTS RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
DROP POLICY IF EXISTS "reports_all_access" ON public.reports;
CREATE POLICY "reports_all_access" ON public.reports FOR ALL USING (true) WITH CHECK (true);

-- 7. REVIEWS RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
DROP POLICY IF EXISTS "reviews_all_access" ON public.reviews;
CREATE POLICY "reviews_all_access" ON public.reviews FOR ALL USING (true) WITH CHECK (true);

-- Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';
