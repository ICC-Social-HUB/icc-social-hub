-- ========================================================
-- ICC SOCIAL HUB — EVENTS MODULE SCHEMA
-- Add support for dynamic event cards, image storage,
-- and customizable action buttons (label + url + type).
-- ========================================================

-- 1. Create the events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL, -- Supports rich text/markdown
    event_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('upcoming', 'past')),
    banner_url TEXT, -- Primary display image
    gallery_urls TEXT[] DEFAULT '{}', -- Secondary images for detailed view
    action_buttons JSONB DEFAULT '[]', -- Array of { label: string, url: string, style: 'primary' | 'secondary' | 'danger' }
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Policy 3.1: Public viewability (unauthenticated/everyone can read)
DROP POLICY IF EXISTS "Events are publicly viewable by everyone" ON public.events;
CREATE POLICY "Events are publicly viewable by everyone"
    ON public.events FOR SELECT
    USING (true);

-- Policy 3.2: Only admins can insert events
DROP POLICY IF EXISTS "Only admins can insert events" ON public.events;
CREATE POLICY "Only admins can insert events"
    ON public.events FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Policy 3.3: Only admins can update events
DROP POLICY IF EXISTS "Only admins can update events" ON public.events;
CREATE POLICY "Only admins can update events"
    ON public.events FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Policy 3.4: Only admins can delete events
DROP POLICY IF EXISTS "Only admins can delete events" ON public.events;
CREATE POLICY "Only admins can delete events"
    ON public.events FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_events_status_date ON public.events(status, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);

-- 5. Storage Buckets for Events Images
-- Creates an 'events' bucket for banner and gallery storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'events' Bucket
-- Policy 5.1: Public read access for event images
DROP POLICY IF EXISTS "Event images are publicly accessible" ON storage.objects;
CREATE POLICY "Event images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'events');

-- Policy 5.2: Admin-only upload access
DROP POLICY IF EXISTS "Only admins can upload event images" ON storage.objects;
CREATE POLICY "Only admins can upload event images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'events' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Policy 5.3: Admin-only deletion access
DROP POLICY IF EXISTS "Only admins can delete event images" ON storage.objects;
CREATE POLICY "Only admins can delete event images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'events' AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );
