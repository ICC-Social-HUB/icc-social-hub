-- =========================================================================
-- RUN THIS IN SUPABASE SQL EDITOR TO CREATE PROJECT MENTOR MESSAGES TABLE
-- =========================================================================

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.project_mentor_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id BIGINT NOT NULL REFERENCES public.core_leads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    reply_to_id UUID REFERENCES public.project_mentor_messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.project_mentor_messages ENABLE ROW LEVEL SECURITY;

-- 3. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pmm_project_id ON public.project_mentor_messages(project_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_pmm_sender_id ON public.project_mentor_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_pmm_reply_to ON public.project_mentor_messages(reply_to_id);

-- 4. Enable Supabase Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'project_mentor_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.project_mentor_messages;
    END IF;
END $$;

-- 5. Policies
-- SELECT: Only verified mentors, admins, project leads, and approved team members can view
DROP POLICY IF EXISTS "Team members and mentors can view project mentor messages" ON public.project_mentor_messages;
CREATE POLICY "Team members and mentors can view project mentor messages"
    ON public.project_mentor_messages FOR SELECT
    TO authenticated
    USING (
        public.is_mentor_or_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.core_leads l
            WHERE l.id = project_mentor_messages.project_id
              AND (
                  l.lead_user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.team_memberships tm
                      WHERE tm.team_id = l.id AND tm.user_id = auth.uid()
                  )
                  OR EXISTS (
                      SELECT 1 FROM public.profiles p
                      WHERE p.id = auth.uid() AND p.team_id = l.id
                  )
              )
        )
    );

-- INSERT: Mentors, Admins, Project Leaders, and approved Team Members can send messages
DROP POLICY IF EXISTS "Team members and mentors can insert project mentor messages" ON public.project_mentor_messages;
CREATE POLICY "Team members and mentors can insert project mentor messages"
    ON public.project_mentor_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
        AND (
            public.is_mentor_or_admin(auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.core_leads l
                WHERE l.id = project_mentor_messages.project_id
                  AND (
                      l.lead_user_id = auth.uid()
                      OR EXISTS (
                          SELECT 1 FROM public.team_memberships tm
                          WHERE tm.team_id = l.id AND tm.user_id = auth.uid()
                      )
                      OR EXISTS (
                          SELECT 1 FROM public.profiles p
                          WHERE p.id = auth.uid() AND p.team_id = l.id
                      )
                  )
            )
        )
    );

-- DELETE: Author, Mentor/Admin, or Project Lead can delete
DROP POLICY IF EXISTS "Author, mentors, or lead can delete project mentor messages" ON public.project_mentor_messages;
CREATE POLICY "Author, mentors, or lead can delete project mentor messages"
    ON public.project_mentor_messages FOR DELETE
    TO authenticated
    USING (
        auth.uid() = sender_id
        OR public.is_mentor_or_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.core_leads l
            WHERE l.id = project_mentor_messages.project_id
              AND l.lead_user_id = auth.uid()
        )
    );
