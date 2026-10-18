-- =========================================================================
-- ICC SOCIAL HUB — ENSURE LINKEDIN COLUMN ON PROFILES TABLE
-- =========================================================================
-- Run this in your Supabase SQL Editor if not already present:
-- https://supabase.com/dashboard/project/gryfobekzlmfonnrwbpg/sql
-- =========================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'linkedin'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN linkedin TEXT;
    END IF;
END $$;
