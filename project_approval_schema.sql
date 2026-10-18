-- =========================================================================
-- ICC SOCIAL HUB — PROJECT CREATION & MENTOR APPROVAL WORKFLOW SCHEMA
-- =========================================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gryfobekzlmfonnrwbpg/sql
-- =========================================================================

-- 1. Ensure profiles constraint permits 'mentor' role
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
    CHECK (role IN ('member', 'student', 'lead', 'admin', 'super_admin', 'superadmin', 'mentor'));

-- 2. Add project_code and lead_user_id columns to core_leads if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'core_leads' AND column_name = 'project_code') THEN
        ALTER TABLE public.core_leads ADD COLUMN project_code TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'core_leads' AND column_name = 'lead_user_id') THEN
        ALTER TABLE public.core_leads ADD COLUMN lead_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'core_leads' AND column_name = 'links') THEN
        ALTER TABLE public.core_leads ADD COLUMN links JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 3. Backfill project_code for existing static/core leads if null
UPDATE public.core_leads 
SET project_code = 'PRJ-2026-' || LPAD(id::text, 4, '0') 
WHERE project_code IS NULL;

-- 4. Helper function to generate guaranteed unique project codes
CREATE OR REPLACE FUNCTION public.generate_unique_project_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
    attempts INT := 0;
BEGIN
    LOOP
        attempts := attempts + 1;
        new_code := 'PRJ-2026-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
        SELECT EXISTS(
            SELECT 1 FROM public.core_leads WHERE project_code = new_code
            UNION
            SELECT 1 FROM public.project_applications WHERE project_code = new_code
        ) INTO code_exists;
        
        IF NOT code_exists OR attempts > 100 THEN
            EXIT;
        END IF;
    END LOOP;
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 5. Create project_applications table
CREATE TABLE IF NOT EXISTS public.project_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    description TEXT NOT NULL,
    team_name TEXT,
    specialties TEXT[] DEFAULT '{}',
    links JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'Pending Review' CHECK (status IN ('Pending Review', 'Approved', 'Changes Requested')),
    project_code TEXT UNIQUE,
    approved_project_id INTEGER REFERENCES public.core_leads(id) ON DELETE SET NULL,
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    revision_number INTEGER DEFAULT 1,
    revisions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create project_application_comments table
CREATE TABLE IF NOT EXISTS public.project_application_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.project_applications(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_mentor_feedback BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create project_application_status_history table
CREATE TABLE IF NOT EXISTS public.project_application_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.project_applications(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_application_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_application_status_history ENABLE ROW LEVEL SECURITY;

-- Helper function to check if caller is mentor or admin
CREATE OR REPLACE FUNCTION public.is_mentor_or_admin(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = user_id 
          AND role IN ('mentor', 'admin', 'super_admin', 'superadmin')
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- 9. Policies for project_applications
DROP POLICY IF EXISTS "Applicants and mentors can view applications" ON public.project_applications;
CREATE POLICY "Applicants and mentors can view applications"
    ON public.project_applications FOR SELECT
    USING (
        auth.uid() = applicant_id 
        OR public.is_mentor_or_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Users can create their own applications" ON public.project_applications;
CREATE POLICY "Users can create their own applications"
    ON public.project_applications FOR INSERT
    WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Applicants can edit on changes requested, mentors can review" ON public.project_applications;
CREATE POLICY "Applicants can edit on changes requested, mentors can review"
    ON public.project_applications FOR UPDATE
    USING (
        auth.uid() = applicant_id 
        OR public.is_mentor_or_admin(auth.uid())
    )
    WITH CHECK (
        auth.uid() = applicant_id 
        OR public.is_mentor_or_admin(auth.uid())
    );

-- 10. Policies for project_application_comments
DROP POLICY IF EXISTS "Participants can view comments" ON public.project_application_comments;
CREATE POLICY "Participants can view comments"
    ON public.project_application_comments FOR SELECT
    USING (
        public.is_mentor_or_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.project_applications a 
            WHERE a.id = application_id AND a.applicant_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Participants can insert comments" ON public.project_application_comments;
CREATE POLICY "Participants can insert comments"
    ON public.project_application_comments FOR INSERT
    WITH CHECK (
        auth.uid() = author_id 
        AND (
            public.is_mentor_or_admin(auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.project_applications a 
                WHERE a.id = application_id AND a.applicant_id = auth.uid()
            )
        )
    );

-- 11. Policies for project_application_status_history
DROP POLICY IF EXISTS "Participants can view status history" ON public.project_application_status_history;
CREATE POLICY "Participants can view status history"
    ON public.project_application_status_history FOR SELECT
    USING (
        public.is_mentor_or_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.project_applications a 
            WHERE a.id = application_id AND a.applicant_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authorized can insert status history" ON public.project_application_status_history;
CREATE POLICY "Authorized can insert status history"
    ON public.project_application_status_history FOR INSERT
    WITH CHECK (auth.uid() = changed_by);

-- 12. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_project_app_applicant ON public.project_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_project_app_status ON public.project_applications(status);
CREATE INDEX IF NOT EXISTS idx_project_app_created ON public.project_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_app_comments_app ON public.project_application_comments(application_id);
CREATE INDEX IF NOT EXISTS idx_project_app_history_app ON public.project_application_status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_core_leads_code ON public.core_leads(project_code);

-- 13. Enable Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_application_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_application_status_history;
