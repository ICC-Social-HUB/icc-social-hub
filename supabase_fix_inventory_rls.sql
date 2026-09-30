-- =========================================================================
-- FIX: Update RLS policies for inventory_requests, inventory, & storage
-- Allows BOTH Admins AND Super Admins to view, receive, and manage component orders
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- 1. Allow any authenticated user to VIEW their own requests
DROP POLICY IF EXISTS "Users can view their own inventory requests" ON public.inventory_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON public.inventory_requests;
CREATE POLICY "Users can view their own inventory requests"
    ON public.inventory_requests FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Allow Admins and Super Admins to view ALL requests (fixes super admin not getting orders)
DROP POLICY IF EXISTS "Admins can view all inventory requests" ON public.inventory_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.inventory_requests;
CREATE POLICY "Admins can view all inventory requests"
    ON public.inventory_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- 3. Allow authenticated users to CREATE their own requests
DROP POLICY IF EXISTS "Users can create inventory requests" ON public.inventory_requests;
DROP POLICY IF EXISTS "Users can create requests" ON public.inventory_requests;
CREATE POLICY "Users can create inventory requests"
    ON public.inventory_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 4. Allow users to cancel ONLY their OWN PENDING requests
DROP POLICY IF EXISTS "Users can cancel their own pending requests" ON public.inventory_requests;
CREATE POLICY "Users can cancel their own pending requests"
    ON public.inventory_requests FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (status = 'cancelled');

-- 5. Allow Admins and Super Admins to update ANY request (approve, reject, mark taken, completed)
DROP POLICY IF EXISTS "Admins can update any inventory request" ON public.inventory_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.inventory_requests;
CREATE POLICY "Admins can update any inventory request"
    ON public.inventory_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- 6. Allow Admins and Super Admins to manage inventory components (add, edit, delete)
DROP POLICY IF EXISTS "Only admins can manage inventory" ON public.inventory;
CREATE POLICY "Only admins can manage inventory"
    ON public.inventory FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- 7. Allow Admins and Super Admins to upload & manage images in the inventory storage bucket
DROP POLICY IF EXISTS "Admins can upload inventory images" ON storage.objects;
CREATE POLICY "Admins can upload inventory images"
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
CREATE POLICY "Admins can manage inventory images"
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
CREATE POLICY "Admins can delete inventory images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'inventory' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );
