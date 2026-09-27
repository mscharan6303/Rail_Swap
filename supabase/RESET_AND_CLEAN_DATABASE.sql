-- ==============================================================================
-- RAIL SWAP - DIRECT DATABASE AUTHENTICATION & FULL SCHEMA RESET
-- ==============================================================================
-- Copy and run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- This script completely creates the profiles table and all application tables.

-- 1. CLEANUP OLD TRIGGERS AND FUNCTIONS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.touch_updated_at() CASCADE;

-- 2. DROP EXISTING TABLES (IN CORRECT DEPENDENCY ORDER)
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.exchange_requests CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. CREATE TABLES

-- Profiles Table (Stores Direct Custom User Signups)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  password TEXT,
  name TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  avatar_url TEXT,
  bio TEXT,
  language TEXT DEFAULT 'en',
  rating NUMERIC(3,2) DEFAULT 0,
  exchanges_count INT DEFAULT 0,
  verified BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exchange Requests Table
CREATE TABLE public.exchange_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  train_number TEXT NOT NULL,
  train_name TEXT NOT NULL,
  journey_date DATE NOT NULL,
  boarding_station TEXT NOT NULL,
  destination_station TEXT NOT NULL,
  coach_number TEXT NOT NULL,
  seat_number TEXT NOT NULL,
  current_berth TEXT NOT NULL,
  desired_berth TEXT NOT NULL,
  gender_preference TEXT DEFAULT 'any' CHECK (gender_preference IN ('any', 'male', 'female')),
  notes TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'matched', 'pending', 'accepted', 'completed', 'cancelled')),
  verification_status TEXT,
  verification_hash TEXT,
  verified_at TIMESTAMPTZ,
  passenger_name TEXT,
  confirmed_by_a BOOLEAN NOT NULL DEFAULT false,
  confirmed_by_b BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches Table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_a UUID NOT NULL REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  request_b UUID NOT NULL REFERENCES public.exchange_requests(id) ON DELETE CASCADE,
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  compatibility INT DEFAULT 50,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages Table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports Table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews Table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewed_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREATE INDEXES
CREATE INDEX IF NOT EXISTS exchange_requests_train_date_idx
  ON public.exchange_requests (train_number, journey_date);

CREATE UNIQUE INDEX IF NOT EXISTS exchange_requests_user_hash_unique
  ON public.exchange_requests (user_id, verification_hash)
  WHERE verification_hash IS NOT NULL;

-- 5. TRIGGERS
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  new.updated_at = NOW();
  RETURN new;
END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER requests_touch BEFORE UPDATE ON public.exchange_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. ENABLE ROW LEVEL SECURITY (RLS) & OPEN ACCESS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_all_access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.exchange_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_all_access" ON public.exchange_requests FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_all_access" ON public.matches FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_all_access" ON public.messages FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_all_access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_all_access" ON public.reports FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_all_access" ON public.reviews FOR ALL USING (true) WITH CHECK (true);

-- 7. STORAGE BUCKET FOR AVATARS
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "avatars_public_access" ON storage.objects FOR ALL USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. ENABLE REALTIME ON MESSAGES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
