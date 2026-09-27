-- ==============================================================================
-- RAIL SWAP - FIX FOREIGN KEY CONSTRAINTS FOR DIRECT DATABASE AUTH
-- ==============================================================================
-- Copy and run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- This updates messages, requests, and notifications to reference public.profiles(id).

-- 1. MESSAGES SENDER_ID
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey 
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. EXCHANGE_REQUESTS USER_ID
ALTER TABLE public.exchange_requests DROP CONSTRAINT IF EXISTS exchange_requests_user_id_fkey;
ALTER TABLE public.exchange_requests ADD CONSTRAINT exchange_requests_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. NOTIFICATIONS USER_ID
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. REPORTS FOREIGN KEYS
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_id_fkey;
ALTER TABLE public.reports ADD CONSTRAINT reports_reporter_id_fkey 
  FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD CONSTRAINT reports_reported_id_fkey 
  FOREIGN KEY (reported_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 5. REVIEWS FOREIGN KEYS
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_reviewer_id_fkey;
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_reviewed_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewer_id_fkey 
  FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewed_id_fkey 
  FOREIGN KEY (reviewed_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
