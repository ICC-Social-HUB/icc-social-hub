-- =========================================================================
-- SUPER ADMIN ROLE & USER DETAIL EDIT APPROVAL WORKFLOW
-- =========================================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

-- 1. Update profiles table constraint to allow 'super_admin' and 'superadmin' roles
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        JOIN pg_class cl ON cl.oid = c.conrelid
        WHERE n.nspname = 'public'
          AND cl.relname = 'profiles'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%role%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('member', 'lead', 'admin', 'super_admin', 'superadmin'));

-- 2. Create user_edit_requests table
CREATE TABLE IF NOT EXISTS public.user_edit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    requester_name TEXT,
    requester_email TEXT,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_name TEXT,
    target_user_email TEXT,
    proposed_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    original_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_edit_requests_status ON public.user_edit_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_edit_requests_target ON public.user_edit_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_edit_requests_created ON public.user_edit_requests(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.user_edit_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated Admins & Super Admins to select requests
DROP POLICY IF EXISTS "Admins can view edit requests" ON public.user_edit_requests;
CREATE POLICY "Admins can view edit requests"
    ON public.user_edit_requests
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- Allow authenticated Admins & Super Admins to insert requests
DROP POLICY IF EXISTS "Admins can create edit requests" ON public.user_edit_requests;
CREATE POLICY "Admins can create edit requests"
    ON public.user_edit_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- Allow Super Admins or Requesters to update requests (Super Admins approve/reject, requester can cancel)
DROP POLICY IF EXISTS "Super Admins can update edit requests" ON public.user_edit_requests;
CREATE POLICY "Super Admins can update edit requests"
    ON public.user_edit_requests
    FOR UPDATE
    TO authenticated
    USING (
        requester_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'superadmin')
        )
    )
    WITH CHECK (
        requester_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'superadmin')
        )
    );

-- Allow Super Admins or Requesters to delete/cancel requests
DROP POLICY IF EXISTS "Admins can delete/cancel edit requests" ON public.user_edit_requests;
CREATE POLICY "Admins can delete/cancel edit requests"
    ON public.user_edit_requests
    FOR DELETE
    TO authenticated
    USING (
        requester_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'superadmin')
        )
    );

-- 5. Enable Realtime updates (safe check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'user_edit_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_edit_requests;
    END IF;
END $$;

-- 6. Allow Admins and Super Admins to update user profiles (required for approving edits)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and Super Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins and Super Admins can update any profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'superadmin')
        )
    )
    WITH CHECK (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- =========================================================================
-- HOW TO ASSIGN A SUPER ADMIN IN SUPABASE:
-- =========================================================================
-- To assign the Super Admin role to any user, run:
--
-- UPDATE public.profiles
-- SET role = 'super_admin'
-- WHERE email = 'user_email_here@example.com';
-- =========================================================================
