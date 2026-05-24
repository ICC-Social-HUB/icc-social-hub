-- ==========================================
-- EVENTS SYSTEM SCHEMA (ISOLATED)
-- RUN THIS IN SUPABASE SQL EDITOR
-- ==========================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'past')),
    banner_url TEXT,
    gallery_urls TEXT[] DEFAULT '{}',
    action_buttons JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies (so you can run this script multiple times safely)
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Only admins can manage events" ON public.events;

-- 4. Create Policies
CREATE POLICY "Events are viewable by everyone"
    ON public.events FOR SELECT
    USING (true);

CREATE POLICY "Only admins can manage events"
    ON public.events FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 5. Storage setup (Create 'events' bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Event images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage event images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete event images" ON storage.objects;

CREATE POLICY "Event images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'events');

CREATE POLICY "Admins can upload event images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'events' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage event images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'events' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete event images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'events' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

