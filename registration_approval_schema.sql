-- ========================================================
-- ICC Social Hub: Two-Stage Registration & Approval Schema
-- ========================================================

-- 1. Create registration_links table (stores unique permanent links per admin)
CREATE TABLE IF NOT EXISTS public.registration_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    creator_name TEXT,
    creator_role TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist for existing tables
ALTER TABLE public.registration_links ADD COLUMN IF NOT EXISTS token TEXT;

-- Index for rapid token lookup by hash and creator
CREATE INDEX IF NOT EXISTS idx_reg_links_token_hash ON public.registration_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_reg_links_token ON public.registration_links(token);
CREATE INDEX IF NOT EXISTS idx_reg_links_created_by ON public.registration_links(created_by);
CREATE INDEX IF NOT EXISTS idx_reg_links_active ON public.registration_links(is_active);

-- 2. Create registration_requests table
CREATE TABLE IF NOT EXISTS public.registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    usn TEXT NOT NULL,
    branch TEXT NOT NULL,
    year TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    linkedin TEXT,
    github TEXT,
    other_link TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'awaiting_super_admin', 'approved', 'denied')),
    
    -- Admin to whom the application is routed
    assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_admin_name TEXT,

    -- First stage review (Admin or Mentor)
    first_reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_reviewer_name TEXT,
    first_reviewer_role TEXT,
    first_reviewer_note TEXT,
    first_reviewed_at TIMESTAMPTZ,

    -- Final approval (Super Admin ONLY)
    final_approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    final_approver_name TEXT,
    final_approver_role TEXT,
    final_approved_at TIMESTAMPTZ,

    -- Denial tracking
    denial_reason TEXT,
    denied_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    denied_by_name TEXT,
    denied_by_role TEXT,
    denied_at TIMESTAMPTZ,

    -- Audit trail
    audit_log JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure assigned_admin columns exist for existing tables
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS assigned_admin_name TEXT;

-- Indexes for registration requests
CREATE INDEX IF NOT EXISTS idx_reg_requests_status ON public.registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_reg_requests_usn ON public.registration_requests(usn);
CREATE INDEX IF NOT EXISTS idx_reg_requests_email ON public.registration_requests(email);
CREATE INDEX IF NOT EXISTS idx_reg_requests_assigned_admin ON public.registration_requests(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_reg_requests_created_at ON public.registration_requests(created_at DESC);

-- 3. Extend profiles table with approval columns
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS approved_by TEXT DEFAULT 'Legacy import',
    ADD COLUMN IF NOT EXISTS reviewed_by TEXT DEFAULT 'Legacy import',
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ DEFAULT now();

-- Ensure all existing profiles are marked as Approved by 'Legacy import'
UPDATE public.profiles
SET approval_status = 'approved',
    approved_by = COALESCE(approved_by, 'Legacy import'),
    reviewed_by = COALESCE(reviewed_by, 'Legacy import'),
    approved_at = COALESCE(approved_at, now()),
    reviewed_at = COALESCE(reviewed_at, now())
WHERE approval_status IS NULL OR approval_status = '' OR approved_by IS NULL;

-- 4. Enable RLS on new tables
ALTER TABLE public.registration_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically. Add policies for authenticated admins & mentors:
DROP POLICY IF EXISTS "Privileged users can view registration links" ON public.registration_links;
CREATE POLICY "Privileged users can view registration links"
ON public.registration_links FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role IN ('admin', 'super_admin', 'superadmin'))
    )
);

DROP POLICY IF EXISTS "Privileged users can manage registration links" ON public.registration_links;
CREATE POLICY "Privileged users can manage registration links"
ON public.registration_links FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role IN ('admin', 'super_admin', 'superadmin'))
    )
);

DROP POLICY IF EXISTS "Reviewers can view registration requests" ON public.registration_requests;
CREATE POLICY "Reviewers can view registration requests"
ON public.registration_requests FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'superadmin', 'mentor')
    )
);

DROP POLICY IF EXISTS "Reviewers can update registration requests" ON public.registration_requests;
CREATE POLICY "Reviewers can update registration requests"
ON public.registration_requests FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'superadmin', 'mentor')
    )
);
