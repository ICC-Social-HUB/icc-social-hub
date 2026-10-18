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

-- =========================================================================
-- 14. Fix core_leads RLS policies (Allow Mentors, Super Admins, Admins to Insert/Update)
-- =========================================================================
ALTER TABLE public.core_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Core leads are viewable by everyone" ON public.core_leads;
CREATE POLICY "Core leads are viewable by everyone"
    ON public.core_leads FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins and assigned leads can manage leads" ON public.core_leads;
DROP POLICY IF EXISTS "Mentors and admins can insert core leads" ON public.core_leads;
DROP POLICY IF EXISTS "Mentors, admins, and leads can update core leads" ON public.core_leads;
DROP POLICY IF EXISTS "Mentors and admins can delete core leads" ON public.core_leads;

-- INSERT: Mentors, Super Admins, Admins can create live projects upon approval
CREATE POLICY "Mentors and admins can insert core leads"
    ON public.core_leads FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('mentor', 'admin', 'super_admin', 'superadmin')
        )
    );

-- UPDATE: Mentors, Super Admins, Admins, or the assigned Lead can update
CREATE POLICY "Mentors, admins, and leads can update core leads"
    ON public.core_leads FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (
                profiles.role IN ('mentor', 'admin', 'super_admin', 'superadmin') OR 
                core_leads.lead_user_id = auth.uid() OR
                (profiles.role = 'lead' AND profiles.team_id = core_leads.id)
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (
                profiles.role IN ('mentor', 'admin', 'super_admin', 'superadmin') OR 
                core_leads.lead_user_id = auth.uid() OR
                (profiles.role = 'lead' AND profiles.team_id = core_leads.id)
            )
        )
    );

-- DELETE: Mentors, Super Admins, Admins can delete
CREATE POLICY "Mentors and admins can delete core leads"
    ON public.core_leads FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('mentor', 'admin', 'super_admin', 'superadmin')
        )
    );

-- =========================================================================
-- 15. Fix team_memberships: Support users joining multiple projects
-- =========================================================================
-- Drop unique constraint on user_id if it exists (allows user to be in multiple projects)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.team_memberships'::regclass
          AND contype = 'u'
    ) LOOP
        EXECUTE 'ALTER TABLE public.team_memberships DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Update team_memberships policies for Mentors and Super Admins
DROP POLICY IF EXISTS "Leads and admins can add members" ON public.team_memberships;
CREATE POLICY "Leads and admins can add members"
    ON public.team_memberships FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND (
                p.role IN ('mentor', 'admin', 'super_admin', 'superadmin') OR 
                (p.role = 'lead' AND p.team_id = team_memberships.team_id) OR
                auth.uid() = team_memberships.user_id
            )
        )
    );

DROP POLICY IF EXISTS "Leads and admins can remove members" ON public.team_memberships;
CREATE POLICY "Leads and admins can remove members"
    ON public.team_memberships FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND (
                p.role IN ('mentor', 'admin', 'super_admin', 'superadmin') OR 
                (p.role = 'lead' AND p.team_id = team_memberships.team_id) OR
                auth.uid() = team_memberships.user_id
            )
        )
    );

-- =========================================================================
-- 16. Database RPC Function: approve_project_application (SECURITY DEFINER)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.approve_project_application(app_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    app_rec RECORD;
    applicant_rec RECORD;
    new_code TEXT;
    new_lead_id INT;
    max_sort INT;
    lead_initials TEXT;
BEGIN
    -- 1. Check permissions: caller must be mentor or admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('mentor', 'admin', 'super_admin', 'superadmin')
    ) THEN
        RETURN jsonb_build_object('error', 'Unauthorized: Only Mentors and Super Admins can approve applications.');
    END IF;

    -- 2. Fetch application
    SELECT * INTO app_rec FROM public.project_applications WHERE id = app_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Application not found.');
    END IF;

    IF app_rec.status = 'Approved' THEN
        RETURN jsonb_build_object('error', 'Application has already been approved.', 'project_code', app_rec.project_code);
    END IF;

    -- 3. Fetch applicant profile
    SELECT * INTO applicant_rec FROM public.profiles WHERE id = app_rec.applicant_id;

    -- 4. Determine project code
    new_code := app_rec.project_code;
    IF new_code IS NULL OR new_code = '' THEN
        new_code := public.generate_unique_project_code();
    END IF;

    -- 5. Calculate initials & sort order
    lead_initials := UPPER(SUBSTRING(COALESCE(app_rec.project_name, 'PRJ') FROM 1 FOR 2));
    SELECT COALESCE(MAX(sort_order), 13) + 1 INTO max_sort FROM public.core_leads;

    -- 6. Insert new live project into core_leads
    INSERT INTO public.core_leads (
        name,
        role,
        team,
        project_name,
        project_code,
        lead_user_id,
        bio,
        specialties,
        links,
        avatar_url,
        initials,
        gradient,
        color,
        milestones,
        sort_order,
        created_at,
        updated_at
    ) VALUES (
        COALESCE(applicant_rec.full_name, applicant_rec.username, 'Project Lead'),
        'Project Lead',
        COALESCE(app_rec.team_name, app_rec.project_name),
        app_rec.project_name,
        new_code,
        app_rec.applicant_id,
        app_rec.description,
        COALESCE(app_rec.specialties, '{}'),
        COALESCE(app_rec.links, '[]'::jsonb),
        applicant_rec.avatar_url,
        lead_initials,
        'from-emerald-600 to-teal-500',
        '#10b981',
        '{"planning": true, "design": false, "selection": false, "development": false, "programming": false, "testing": false, "optimization": false, "deployment": false}'::jsonb,
        max_sort,
        now(),
        now()
    )
    RETURNING id INTO new_lead_id;

    -- 7. Update applicant profile role to 'lead' if not super admin / admin
    IF applicant_rec.role NOT IN ('super_admin', 'superadmin', 'admin') THEN
        UPDATE public.profiles
        SET role = 'lead',
            team_id = COALESCE(team_id, new_lead_id),
            updated_at = now()
        WHERE id = app_rec.applicant_id;
    END IF;

    -- 8. Add to team_memberships (supports multiple project memberships)
    INSERT INTO public.team_memberships (user_id, team_id, created_at)
    VALUES (app_rec.applicant_id, new_lead_id, now())
    ON CONFLICT (user_id, team_id) DO NOTHING;

    -- 9. Update application status to Approved
    UPDATE public.project_applications
    SET status = 'Approved',
        project_code = new_code,
        approved_project_id = new_lead_id,
        reviewer_id = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    WHERE id = app_id;

    -- 10. Record status history
    INSERT INTO public.project_application_status_history (
        application_id,
        changed_by,
        previous_status,
        new_status,
        comment,
        created_at
    ) VALUES (
        app_id,
        auth.uid(),
        app_rec.status,
        'Approved',
        'Application reviewed and officially approved by mentor. Project published live with code: ' || new_code,
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'project_code', new_code,
        'approved_project_id', new_lead_id
    );
END;
$$;

