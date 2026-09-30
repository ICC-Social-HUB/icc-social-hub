-- ==========================================
-- 16. INVENTORY TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    total_stock INTEGER DEFAULT 0,
    available_stock INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Anyone can view inventory
CREATE POLICY "Inventory is viewable by everyone"
    ON public.inventory FOR SELECT
    USING (true);

-- Only admins can manage inventory
CREATE POLICY "Only admins can manage inventory"
    ON public.inventory FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- ==========================================
-- 17. INVENTORY REQUESTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.inventory_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    project_name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'completed', 'cancelled')),
    requested_at TIMESTAMPTZ DEFAULT now(),
    collected_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.inventory_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own requests"
    ON public.inventory_requests FOR SELECT
    USING (auth.uid() = user_id);

-- Admins & Super Admins can view all requests
CREATE POLICY "Admins can view all requests"
    ON public.inventory_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- Users can create requests
CREATE POLICY "Users can create requests"
    ON public.inventory_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins & Super Admins can update requests
CREATE POLICY "Admins can update requests"
    ON public.inventory_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_requests;

-- ==========================================
-- 18. STORAGE SETUP (Run in SQL Editor)
-- ==========================================
-- Create inventory bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory', 'inventory', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to inventory
CREATE POLICY "Inventory images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'inventory');

-- Allow authenticated admins & super admins to upload to inventory
CREATE POLICY "Admins can upload inventory images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'inventory' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- Allow admins & super admins to update/delete inventory images
CREATE POLICY "Admins can manage inventory images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'inventory' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

CREATE POLICY "Admins can delete inventory images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'inventory' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );
