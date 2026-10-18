-- ============================================
-- ICC SOCIAL HUB — COMPLETE DATABASE SCHEMA
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- ==========================================
-- 1. PROFILES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    skills TEXT[] DEFAULT '{}',
    team_id INTEGER,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'lead', 'admin')),
    is_pending_lead BOOLEAN DEFAULT false,
    is_pending_member BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add column if it doesn't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_pending_member') THEN
        ALTER TABLE public.profiles ADD COLUMN is_pending_member BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'usn') THEN
        ALTER TABLE public.profiles ADD COLUMN usn TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'linkedin') THEN
        ALTER TABLE public.profiles ADD COLUMN linkedin TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'github') THEN
        ALTER TABLE public.profiles ADD COLUMN github TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'year') THEN
        ALTER TABLE public.profiles ADD COLUMN year TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'branch') THEN
        ALTER TABLE public.profiles ADD COLUMN branch TEXT;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies: anyone can read profiles, users can update their own
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Leads can manage their team members" ON public.profiles;
CREATE POLICY "Leads can manage their team members"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p2
            WHERE p2.id = auth.uid() AND p2.role = 'lead' AND p2.team_id = profiles.team_id
        )
    );

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
    ON public.profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p2
            WHERE p2.id = auth.uid() AND p2.role = 'admin'
        )
    );

-- ==========================================
-- 1b. OTP TOKENS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.otp_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.otp_tokens ENABLE ROW LEVEL SECURITY;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_otp_tokens_user_id ON public.otp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_token ON public.otp_tokens(token);

-- ==========================================
-- 2. POSTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    caption TEXT,
    image_url TEXT,
    team_tag INTEGER,
    is_announcement BOOLEAN DEFAULT false,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone"
    ON public.posts FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts"
    ON public.posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
    ON public.posts FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can also delete any post
DROP POLICY IF EXISTS "Admins can delete any post" ON public.posts;
CREATE POLICY "Admins can delete any post"
    ON public.posts FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ==========================================
-- 3. LIKES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
CREATE POLICY "Likes are viewable by everyone"
    ON public.likes FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can like" ON public.likes;
CREATE POLICY "Authenticated users can like"
    ON public.likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike their own likes" ON public.likes;
CREATE POLICY "Users can unlike their own likes"
    ON public.likes FOR DELETE
    USING (auth.uid() = user_id);

-- ==========================================
-- 4. COMMENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone"
    ON public.comments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can comment" ON public.comments;
CREATE POLICY "Authenticated users can comment"
    ON public.comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
CREATE POLICY "Users can delete their own comments"
    ON public.comments FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;
CREATE POLICY "Admins can delete any comment"
    ON public.comments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND LOWER(role) = 'admin'
        )
    );

DROP POLICY IF EXISTS "Post owners can delete any comment on their post" ON public.comments;
CREATE POLICY "Post owners can delete any comment on their post"
    ON public.comments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE id = public.comments.post_id AND user_id = auth.uid()
        )
    );

-- ==========================================
-- 5. MESSAGES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages"
    ON public.messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;
CREATE POLICY "Authenticated users can send messages"
    ON public.messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Receiver can mark messages as read" ON public.messages;
CREATE POLICY "Receiver can mark messages as read"
    ON public.messages FOR UPDATE
    USING (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Sender can delete their own messages" ON public.messages;
CREATE POLICY "Sender can delete their own messages"
    ON public.messages FOR DELETE
    USING (auth.uid() = sender_id);

-- ==========================================
-- 6. BROADCASTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Broadcasts are viewable by everyone" ON public.broadcasts;
CREATE POLICY "Broadcasts are viewable by everyone"
    ON public.broadcasts FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Only admins can create broadcasts" ON public.broadcasts;
CREATE POLICY "Only admins can create broadcasts"
    ON public.broadcasts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Only admins can update broadcasts" ON public.broadcasts;
CREATE POLICY "Only admins can update broadcasts"
    ON public.broadcasts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ==========================================
-- 7. CORE LEADS TABLE (optional — for live editing)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.core_leads (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    team TEXT NOT NULL,
    initials TEXT,
    bio TEXT,
    specialties TEXT[] DEFAULT '{}',
    gradient TEXT,
    color TEXT,
    avatar_url TEXT,
    project_name TEXT,
    milestones JSONB DEFAULT '{"planning": false, "design": false, "selection": false, "development": false, "programming": false, "testing": false, "optimization": false, "deployment": false}',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add avatar_url and project_name columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'core_leads' AND column_name = 'avatar_url') THEN
        ALTER TABLE public.core_leads ADD COLUMN avatar_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'core_leads' AND column_name = 'project_name') THEN
        ALTER TABLE public.core_leads ADD COLUMN project_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'core_leads' AND column_name = 'milestones') THEN
        ALTER TABLE public.core_leads ADD COLUMN milestones JSONB DEFAULT '{"planning": false, "design": false, "selection": false, "development": false, "programming": false, "testing": false, "optimization": false, "deployment": false}';
    END IF;
END $$;

ALTER TABLE public.core_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Core leads are viewable by everyone" ON public.core_leads;
CREATE POLICY "Core leads are viewable by everyone"
    ON public.core_leads FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Only admins can manage leads" ON public.core_leads;
DROP POLICY IF EXISTS "Admins and assigned leads can manage leads" ON public.core_leads;
CREATE POLICY "Admins and assigned leads can manage leads"
    ON public.core_leads FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND (
                profiles.role = 'admin' OR 
                (profiles.role = 'lead' AND profiles.team_id = core_leads.id)
            )
        )
    );

-- Insert initial static leads into the database
INSERT INTO public.core_leads (id, name, role, team, initials, bio, specialties, gradient, color, sort_order)
VALUES 
(1, 'Arjun Mehta', 'Tech Lead', 'Team Circuit', 'AM', 'A visionary full-stack developer who believes in building systems that scale. Arjun leads Team Circuit with an obsession for clean architecture, performance optimization, and pushing the boundaries of what''s possible with code.', ARRAY['Full-Stack Development','System Architecture','Cloud & DevOps'], 'from-red-600 to-orange-500', '#dc2626', 1),
(2, 'Priya Sharma', 'Design Lead', 'Team Pixel', 'PS', 'Priya is the creative force behind ICC''s visual identity. With an eye for detail and a deep understanding of human-centered design, she transforms complex ideas into beautiful, intuitive experiences.', ARRAY['UI/UX Design','Brand Identity','Motion Design'], 'from-pink-600 to-purple-500', '#db2777', 2),
(3, 'Rohan Desai', 'AI/ML Lead', 'Team Neuron', 'RD', 'Rohan is on a mission to make artificial intelligence accessible and impactful. Leading Team Neuron, he dives deep into machine learning models, neural networks, and data science to solve real-world problems.', ARRAY['Machine Learning','Deep Learning','Data Science'], 'from-cyan-500 to-blue-600', '#06b6d4', 3),
(4, 'Ananya Iyer', 'Web Dev Lead', 'Team Forge', 'AI', 'Ananya is a front-end wizard who turns designs into pixel-perfect, performant web applications. Team Forge specializes in modern web frameworks and responsive design.', ARRAY['React & Next.js','Frontend Engineering','Web Performance'], 'from-emerald-500 to-teal-600', '#10b981', 4),
(5, 'Karthik Nair', 'App Dev Lead', 'Team Swift', 'KN', 'Karthik breathes life into mobile experiences. With expertise in both native and cross-platform development, Team Swift builds polished, high-performance mobile applications.', ARRAY['React Native','Flutter','Mobile UI/UX'], 'from-violet-500 to-indigo-600', '#8b5cf6', 5),
(6, 'Sneha Reddy', 'Marketing Lead', 'Team Blaze', 'SR', 'Sneha knows how to make ideas go viral. As the head of Team Blaze, she crafts compelling narratives and manages ICC''s digital presence with data-driven strategy.', ARRAY['Digital Marketing','Growth Strategy','Social Media'], 'from-amber-500 to-red-500', '#f59e0b', 6),
(7, 'Vikram Joshi', 'Cybersecurity Lead', 'Team Shield', 'VJ', 'In a world of digital threats, Vikram stands guard. Team Shield focuses on ethical hacking, vulnerability assessment, and building secure systems.', ARRAY['Ethical Hacking','Network Security','CTF Competitions'], 'from-green-500 to-emerald-700', '#22c55e', 7),
(8, 'Diya Kapoor', 'Content Lead', 'Team Quill', 'DK', 'Words are Diya''s superpower. Leading Team Quill, she manages everything from technical blog posts and newsletters to social media copy and event scripts.', ARRAY['Technical Writing','Content Strategy','Copywriting'], 'from-rose-500 to-pink-600', '#f43f5e', 8),
(9, 'Aditya Patel', 'Events Lead', 'Team Spark', 'AP', 'Every legendary ICC event has Aditya''s fingerprints on it. Team Spark plans, organizes, and executes hackathons, workshops, and tech talks that bring the community together.', ARRAY['Event Management','Workshop Design','Community Building'], 'from-orange-500 to-yellow-500', '#f97316', 9),
(10, 'Meera Krishnan', 'Media Lead', 'Team Lens', 'MK', 'Meera captures the soul of ICC through her lens. Team Lens handles photography, videography, and multimedia production for all events and projects.', ARRAY['Photography','Video Production','Visual Storytelling'], 'from-fuchsia-500 to-purple-600', '#d946ef', 10),
(11, 'Harsh Gupta', 'Finance Lead', 'Team Ledger', 'HG', 'Behind every successful project is solid financial planning. Harsh and Team Ledger manage budgets, sponsorships, and resource allocation with analytical precision.', ARRAY['Budget Management','Sponsorship','Financial Planning'], 'from-slate-400 to-zinc-600', '#94a3b8', 11),
(12, 'Ishita Sen', 'Outreach Lead', 'Team Bridge', 'IS', 'Ishita builds bridges between ICC and the world. Team Bridge manages partnerships with companies, other colleges, and industry mentors for exclusive opportunities.', ARRAY['Corporate Relations','Partnerships','Networking'], 'from-sky-400 to-blue-600', '#38bdf8', 12),
(13, 'Siddharth Rao', 'Operations Lead', 'Team Axis', 'SRo', 'Siddharth is the engine that keeps ICC running smoothly. Team Axis handles logistics, internal coordination, and process optimization across all teams.', ARRAY['Project Management','Logistics','Process Optimization'], 'from-red-500 to-rose-700', '#ef4444', 13)
ON CONFLICT (id) DO NOTHING;

-- Reset the auto-increment sequence so new leads start at ID 14
SELECT setval('core_leads_id_seq', (SELECT MAX(id) FROM core_leads));

-- ==========================================
-- 8. ADMIN FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_target_role TEXT;
    v_target_email TEXT;
BEGIN
    -- Verify caller is admin, super_admin, or master email
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role IN ('super_admin', 'superadmin', 'admin') OR email = 'iccsocialhub@gmail.com')
    ) THEN
        -- Prevent deleting Super Administrators
        SELECT role, email INTO v_target_role, v_target_email FROM public.profiles WHERE id = target_user_id;
        IF v_target_role IN ('super_admin', 'superadmin') OR v_target_email = 'iccsocialhub@gmail.com' THEN
            RAISE EXCEPTION 'Super Administrators cannot be deleted.';
        END IF;

        -- Unlink from core_leads if assigned as team lead
        UPDATE public.core_leads SET lead_user_id = NULL WHERE lead_user_id = target_user_id;

        -- Clean up dependent records
        DELETE FROM public.team_memberships WHERE user_id = target_user_id;
        DELETE FROM public.team_join_data WHERE user_id = target_user_id;
        DELETE FROM public.project_team_leads WHERE user_id = target_user_id;
        DELETE FROM public.project_mentor_messages WHERE sender_id = target_user_id;
        DELETE FROM public.notifications WHERE user_id = target_user_id OR actor_id = target_user_id;
        DELETE FROM public.likes WHERE user_id = target_user_id;
        DELETE FROM public.comments WHERE user_id = target_user_id;
        DELETE FROM public.posts WHERE user_id = target_user_id;
        DELETE FROM public.profiles WHERE id = target_user_id;
        DELETE FROM auth.users WHERE id = target_user_id;
    ELSE
        RAISE EXCEPTION 'Not authorized';
    END IF;
END;
$$;

-- ==========================================
-- 9. AUTO-UPDATE likes_count TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_change
    AFTER INSERT OR DELETE ON public.likes
    FOR EACH ROW EXECUTE FUNCTION update_likes_count();

-- ==========================================
-- 9. AUTO-CREATE PROFILE ON SIGNUP
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, username, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
        NEW.raw_user_meta_data->>'username',
        NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to avoid errors on re-run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 10. INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_team_tag ON public.posts(team_tag);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);

-- ==========================================
-- 10b. NOTIFICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'message', 'post', 'broadcast', 'team_join', 'team_approve', 'team_deny', 'mention', 'welcome', 'system')),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reference_id TEXT,
    body TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can delete any notification" ON public.notifications;
CREATE POLICY "Admins can delete any notification"
    ON public.notifications FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read);

-- ==========================================
-- 11. ENABLE REALTIME (for live updates)
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.core_leads;

-- ==========================================
-- 12. STORAGE BUCKETS & POLICIES
-- ==========================================

-- Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('avatars', 'avatars', true),
    ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

-- Avatars Policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible."
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
CREATE POLICY "Anyone can upload an avatar."
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can update their own avatars." ON storage.objects;
CREATE POLICY "Users can update their own avatars."
    ON storage.objects FOR UPDATE
    USING (auth.uid() = owner)
    WITH CHECK (bucket_id = 'avatars');

-- Posts Policies
DROP POLICY IF EXISTS "Post images are publicly accessible." ON storage.objects;
CREATE POLICY "Post images are publicly accessible."
    ON storage.objects FOR SELECT
    USING (bucket_id = 'posts');

DROP POLICY IF EXISTS "Authenticated users can upload post images." ON storage.objects;
CREATE POLICY "Authenticated users can upload post images."
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete their own post images." ON storage.objects;
CREATE POLICY "Users can delete their own post images."
    ON storage.objects FOR DELETE
    USING (bucket_id = 'posts' AND auth.uid() = owner);

-- ==========================================
-- 13. TEAM JOIN DATA (Private details)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.team_join_data (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_id INTEGER,
    summary TEXT,
    disc_tag TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, team_id)
);

-- Note: We modified team_join_data to have a composite PK (user_id, team_id) 
-- to allow a user to have pending requests for multiple teams.

ALTER TABLE public.team_join_data ENABLE ROW LEVEL SECURITY;

-- Users can manage their own join data
DROP POLICY IF EXISTS "Users can manage their own join data" ON public.team_join_data;
CREATE POLICY "Users can manage their own join data"
    ON public.team_join_data FOR ALL
    USING (auth.uid() = user_id);

-- Leads and admins can view join data for applicants
DROP POLICY IF EXISTS "Leads and admins can view join data" ON public.team_join_data;
CREATE POLICY "Leads and admins can view join data"
    ON public.team_join_data FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND (
                p.role = 'admin' OR 
                (p.role = 'lead' AND p.team_id = team_join_data.team_id)
            )
        )
    );

-- Leads and admins can delete join data (when approving/denying)
DROP POLICY IF EXISTS "Leads and admins can delete join data" ON public.team_join_data;
CREATE POLICY "Leads and admins can delete join data"
    ON public.team_join_data FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND (
                p.role = 'admin' OR 
                (p.role = 'lead' AND p.team_id = team_join_data.team_id)
            )
        )
    );

-- ==========================================
-- 14. TEAM MEMBERSHIPS (Multi-team support)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.team_memberships (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    team_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, team_id)
);

ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team memberships are viewable by everyone" ON public.team_memberships;
CREATE POLICY "Team memberships are viewable by everyone"
    ON public.team_memberships FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Leads and admins can remove members" ON public.team_memberships;
CREATE POLICY "Leads and admins can remove members"
    ON public.team_memberships FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND (
                p.role = 'admin' OR 
                (p.role = 'lead' AND p.team_id = team_memberships.team_id)
            )
        )
    );

DROP POLICY IF EXISTS "Leads and admins can add members" ON public.team_memberships;
CREATE POLICY "Leads and admins can add members"
    ON public.team_memberships FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND (
                p.role = 'admin' OR 
                (p.role = 'lead' AND p.team_id = team_memberships.team_id)
            )
        )
    );

-- Users can NOT delete their own memberships (Only leads can remove them)
-- This enforces the "only the team lead can remove them" rule.

-- ==========================================
-- 15. TEAM MESSAGES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.team_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id INTEGER NOT NULL,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- Team members and admins can view team messages
DROP POLICY IF EXISTS "Team members and admins can view team messages" ON public.team_messages;
CREATE POLICY "Team members and admins can view team messages"
    ON public.team_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_memberships
            WHERE team_id = team_messages.team_id AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only team members can send team messages
DROP POLICY IF EXISTS "Team members can send team messages" ON public.team_messages;
CREATE POLICY "Team members can send team messages"
    ON public.team_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team_memberships
            WHERE team_id = team_id AND user_id = auth.uid()
        )
    );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;

-- ==========================================
-- 16. USER EDIT REQUESTS (Super Admin Approval)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_edit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    requester_name TEXT,
    requester_email TEXT,
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_user_name TEXT,
    target_user_email TEXT,
    proposed_changes JSONB NOT NULL,
    original_data JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.user_edit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view user edit requests" ON public.user_edit_requests;
DROP POLICY IF EXISTS "Admins can create user edit requests" ON public.user_edit_requests;
DROP POLICY IF EXISTS "Admins can update user edit requests" ON public.user_edit_requests;
DROP POLICY IF EXISTS "Admins can view user edit requests" ON public.user_edit_requests;
CREATE POLICY "Admins can view user edit requests"
    ON public.user_edit_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can create user edit requests" ON public.user_edit_requests;
CREATE POLICY "Admins can create user edit requests"
    ON public.user_edit_requests FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can update user edit requests" ON public.user_edit_requests;
CREATE POLICY "Admins can update user edit requests"
    ON public.user_edit_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can delete user edit requests" ON public.user_edit_requests;
CREATE POLICY "Admins can delete user edit requests"
    ON public.user_edit_requests FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE INDEX IF NOT EXISTS idx_user_edit_requests_status ON public.user_edit_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_edit_requests_target ON public.user_edit_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_edit_requests_created ON public.user_edit_requests(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_edit_requests;

-- ==========================================
-- DONE! ✅
-- ==========================================
-- Your database is now ready.
-- 
-- NEXT STEPS:
-- 1. Go to Authentication → Providers → Enable Google
-- 2. Set your first admin: Run this query replacing YOUR_USER_ID:
--
--    UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID';
--


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
            AND (role IN ('admin', 'super_admin', 'superadmin', 'mentor') OR email = 'iccsocialhub@gmail.com')
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
            AND (role IN ('admin', 'super_admin', 'superadmin', 'mentor') OR email = 'iccsocialhub@gmail.com')
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
            AND (role IN ('admin', 'super_admin', 'superadmin', 'mentor') OR email = 'iccsocialhub@gmail.com')
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
            AND (role IN ('admin', 'super_admin', 'superadmin', 'mentor') OR email = 'iccsocialhub@gmail.com')
        )
    );
