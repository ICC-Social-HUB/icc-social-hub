-- ============================================
-- FIX: Add missing RLS policies for inventory_requests
-- Run this in Supabase SQL Editor → New Query
-- ============================================

-- Allow any authenticated user to VIEW their own requests
DROP POLICY IF EXISTS "Users can view their own inventory requests" ON public.inventory_requests;
CREATE POLICY "Users can view their own inventory requests"
    ON public.inventory_requests FOR SELECT
    USING (auth.uid() = user_id);

-- Allow admins to view ALL requests
DROP POLICY IF EXISTS "Admins can view all inventory requests" ON public.inventory_requests;
CREATE POLICY "Admins can view all inventory requests"
    ON public.inventory_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Allow authenticated users to CREATE their own requests
DROP POLICY IF EXISTS "Users can create inventory requests" ON public.inventory_requests;
CREATE POLICY "Users can create inventory requests"
    ON public.inventory_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- *** THE MISSING POLICY — THIS IS WHY CANCEL WAS SILENTLY FAILING ***
-- Allow users to cancel ONLY their OWN PENDING requests
DROP POLICY IF EXISTS "Users can cancel their own pending requests" ON public.inventory_requests;
CREATE POLICY "Users can cancel their own pending requests"
    ON public.inventory_requests FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (status = 'cancelled');

-- Allow admins to update ANY request (approve, reject, mark taken, completed)
DROP POLICY IF EXISTS "Admins can update any inventory request" ON public.inventory_requests;
CREATE POLICY "Admins can update any inventory request"
    ON public.inventory_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
