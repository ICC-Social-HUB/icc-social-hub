-- =====================================================
-- ICC SOCIAL HUB: CORE SPACE & MINUTES OF MEETING (MoM)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.minutes_of_meeting (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meeting_time TEXT DEFAULT '',
    content TEXT NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name TEXT DEFAULT '',
    attendees TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.minutes_of_meeting ENABLE ROW LEVEL SECURITY;

-- 1. View policy: Admins, Super Admins, and Mentors can view all Minutes of Meeting
DROP POLICY IF EXISTS "Admins and Mentors can view MoM" ON public.minutes_of_meeting;
CREATE POLICY "Admins and Mentors can view MoM"
    ON public.minutes_of_meeting FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin', 'mentor')
        )
    );

-- 2. Insert policy: Admins, Super Admins, and Mentors can create MoM
DROP POLICY IF EXISTS "Admins and Mentors can insert MoM" ON public.minutes_of_meeting;
CREATE POLICY "Admins and Mentors can insert MoM"
    ON public.minutes_of_meeting FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin', 'mentor')
        )
    );

-- 3. Update policy: Admins, Super Admins, and Mentors can update MoM
DROP POLICY IF EXISTS "Admins and Mentors can update MoM" ON public.minutes_of_meeting;
CREATE POLICY "Admins and Mentors can update MoM"
    ON public.minutes_of_meeting FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin', 'mentor')
        )
    );

-- 4. Delete policy: Admins, Super Admins, and Mentors can delete MoM
DROP POLICY IF EXISTS "Admins and Mentors can delete MoM" ON public.minutes_of_meeting;
CREATE POLICY "Admins and Mentors can delete MoM"
    ON public.minutes_of_meeting FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin', 'superadmin', 'mentor')
        )
    );
