-- ==============================================================================
-- RAIL SWAP - ADD EMAIL & PASSWORD COLUMNS & RELOAD SCHEMA CACHE
-- ==============================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- This adds the missing email and password columns and reloads PostgREST schema cache.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;

-- Drop foreign key to auth.users if it exists so direct database signup works
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Set default id generator
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles(email) WHERE email IS NOT NULL;

-- Enable RLS and open access policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_all_access" ON public.profiles;
CREATE POLICY "profiles_all_access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- CRITICAL: Instantly reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
