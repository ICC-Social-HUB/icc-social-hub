-- =========================================================================
-- FIX: SUPER ADMIN INVENTORY ORDER VISIBILITY & MANAGEMENT
-- =========================================================================
-- Issue: When users place component orders, Super Admins were not receiving
--        or seeing the orders because RLS policies only permitted role = 'admin'.
--
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/gryfobekzlmfonnrwbpg/sql
-- 2. Paste and run this script in SQL Editor.
-- =========================================================================

-- 1. Ensure profiles constraint permits 'super_admin' and 'superadmin'
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

-- 2. Drop existing restrictive policies on inventory_requests
DROP POLICY IF EXISTS "Admins can view all inventory requests" ON public.inventory_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.inventory_requests;
DROP POLICY IF EXISTS "Users can view their own inventory requests" ON public.inventory_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON public.inventory_requests;
DROP POLICY IF EXISTS "Users can create inventory requests" ON public.inventory_requests;
DROP POLICY IF EXISTS "Users can create requests" ON public.inventory_requests;
DROP POLICY IF EXISTS "Users can cancel their own pending requests" ON public.inventory_requests;
DROP POLICY IF EXISTS "Admins can update any inventory request" ON public.inventory_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.inventory_requests;

-- 3. Re-create inventory_requests policies supporting Admins AND Super Admins
CREATE POLICY "Users can view their own inventory requests"
    ON public.inventory_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins and Super Admins can view all inventory requests"
    ON public.inventory_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

CREATE POLICY "Users can create inventory requests"
    ON public.inventory_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel their own pending requests"
    ON public.inventory_requests FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (status = 'cancelled');

CREATE POLICY "Admins and Super Admins can update any inventory request"
    ON public.inventory_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- 4. Re-create public.inventory policies supporting Super Admins
DROP POLICY IF EXISTS "Only admins can manage inventory" ON public.inventory;
CREATE POLICY "Admins and Super Admins can manage inventory"
    ON public.inventory FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- 5. Storage policies for inventory bucket
DROP POLICY IF EXISTS "Admins can upload inventory images" ON storage.objects;
CREATE POLICY "Admins and Super Admins can upload inventory images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'inventory' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

DROP POLICY IF EXISTS "Admins can manage inventory images" ON storage.objects;
CREATE POLICY "Admins and Super Admins can manage inventory images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'inventory' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

DROP POLICY IF EXISTS "Admins can delete inventory images" ON storage.objects;
CREATE POLICY "Admins and Super Admins can delete inventory images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'inventory' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );
