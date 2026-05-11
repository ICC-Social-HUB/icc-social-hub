-- ==========================================
-- ATTENDANCE TABLE & POLICIES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES public.core_leads(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Attendance is viewable by the user" ON public.attendance;
CREATE POLICY "Attendance is viewable by the user"
    ON public.attendance FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Leads can view their team attendance" ON public.attendance;
CREATE POLICY "Leads can view their team attendance"
    ON public.attendance FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'lead' AND team_id = attendance.team_id
        )
    );

DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
CREATE POLICY "Admins can view all attendance"
    ON public.attendance FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Leads can submit attendance" ON public.attendance;
CREATE POLICY "Leads can submit attendance"
    ON public.attendance FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'lead' OR role = 'admin')
        )
    );

DROP POLICY IF EXISTS "Leads can update attendance" ON public.attendance;
CREATE POLICY "Leads can update attendance"
    ON public.attendance FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'lead' OR role = 'admin')
        )
    );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
