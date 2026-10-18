-- =========================================================================
-- ICC Social Hub — Project Tasks Schema & Migration
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    deadline DATE,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to_name TEXT,
    assigned_to_avatar TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' or 'completed'
    submission_content TEXT DEFAULT '',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column check in case table was created earlier
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS deadline DATE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON public.project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON public.project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_deadline ON public.project_tasks(deadline);

-- Enable Row Level Security (RLS)
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Policy 1: All authenticated users can view tasks
DROP POLICY IF EXISTS "Allow authenticated view project tasks" ON public.project_tasks;
CREATE POLICY "Allow authenticated view project tasks"
    ON public.project_tasks FOR SELECT
    TO authenticated
    USING (true);

-- Policy 2: Strictly Mentors can create new tasks
DROP POLICY IF EXISTS "Allow mentors and admins create tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow mentors create tasks" ON public.project_tasks;
CREATE POLICY "Allow mentors create tasks"
    ON public.project_tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (role = 'mentor' OR email = 'iccsocialhub@gmail.com')
        )
    );

-- Policy 3: Mentors and the specifically assigned member can update tasks (to finish task)
DROP POLICY IF EXISTS "Allow update tasks" ON public.project_tasks;
CREATE POLICY "Allow update tasks"
    ON public.project_tasks FOR UPDATE
    TO authenticated
    USING (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (role IN ('mentor', 'admin', 'super_admin', 'superadmin') OR email = 'iccsocialhub@gmail.com')
        )
    );

-- Policy 4: Mentors can delete tasks
DROP POLICY IF EXISTS "Allow mentors and admins delete tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow mentors delete tasks" ON public.project_tasks;
CREATE POLICY "Allow mentors delete tasks"
    ON public.project_tasks FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND (role = 'mentor' OR email = 'iccsocialhub@gmail.com')
        )
    );

-- 5. Enable Realtime updates for live task sync
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.project_tasks;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;
