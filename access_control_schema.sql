-- =========================================================================
-- ICC SOCIAL HUB — ACCESS CONTROL & ADMIN PERMISSIONS SCHEMA
-- =========================================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gryfobekzlmfonnrwbpg/sql
--
-- This script adds granular feature access control for Super Admins:
-- - broadcast: Permission to send push & banner broadcasts
-- - moderate: Permission to delete posts and moderate content
-- - events: Permission to create, edit, and delete events
-- - leads: Permission to manage core team leads
-- - users_edit: Permission to edit user profiles and approve user change requests (accessible to all granted admins)
-- - users_export: Permission to view user roster table and export/download member Excel (.xlsx)
-- - users: Legacy backward compatibility flag (true if either users_edit or users_export is true)
-- =========================================================================

-- 1. Ensure profiles constraint permits 'super_admin' and 'superadmin' roles
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
    CHECK (role IN ('member', 'student', 'lead', 'admin', 'super_admin', 'superadmin'));

-- 2. Add admin_permissions JSONB column to profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'admin_permissions'
    ) THEN
        ALTER TABLE public.profiles 
            ADD COLUMN admin_permissions JSONB DEFAULT '{"broadcast": true, "moderate": true, "events": true, "leads": true, "users_edit": true, "users_export": true, "users": true}'::jsonb;
    END IF;
END $$;

-- 3. Set default permissions for existing admins who don't have it set
UPDATE public.profiles
SET admin_permissions = '{"broadcast": true, "moderate": true, "events": true, "leads": true, "users_edit": true, "users_export": true, "users": true}'::jsonb
WHERE role IN ('admin', 'super_admin', 'superadmin') AND (admin_permissions IS NULL OR admin_permissions = '{}'::jsonb);

-- 4. Ensure RLS Policy allows Admins and Super Admins to update profiles
DROP POLICY IF EXISTS "Admins and Super Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins and Super Admins can update profiles"
    ON public.profiles FOR UPDATE
    USING (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 FROM public.profiles p2
            WHERE p2.id = auth.uid() 
              AND p2.role IN ('admin', 'super_admin', 'superadmin')
        )
    )
    WITH CHECK (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 FROM public.profiles p2
            WHERE p2.id = auth.uid() 
              AND p2.role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- 5. Add index on role for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- =========================================================================
-- Verification query (Optional: run to check your admins & their permissions)
-- SELECT id, full_name, email, role, admin_permissions FROM public.profiles WHERE role IN ('admin', 'super_admin', 'superadmin');
-- =========================================================================
