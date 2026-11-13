-- =========================================================================
-- ICC INNOVATION HUB — MENTOR SUPPORT MIGRATION
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- 1. Ensure 'designation' and 'linkedin' columns exist on public.profiles
DO $$
BEGIN
    -- Add designation column if missing (for Mentor job titles / professional roles)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'designation'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN designation TEXT;
    END IF;

    -- Add linkedin column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'linkedin'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN linkedin TEXT;
    END IF;
END $$;

-- 2. Allow mentors to view and update their own profile (standard RLS verification)
-- (Users are already permitted to update their own profile record where auth.uid() = id)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Ensure role column index for fast mentor lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- =========================================================================
-- Verification query:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name IN ('designation', 'linkedin', 'role', 'bio');
-- =========================================================================

