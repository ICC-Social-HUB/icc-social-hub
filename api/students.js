const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // Helper to send standard error response
    const sendError = (status, msg) => {
        return res.status(status).json({ success: false, error: msg });
    };

    try {
        if (req.method !== 'GET' && req.method !== 'POST') {
            return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        const url = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
            return sendError(500, 'Server configuration error (missing Supabase credentials)');
        }

        const supabase = createClient(url, serviceKey);

        // Verify Authentication: ensure user is logged in
        const authHeader = req.headers.authorization || req.headers.Authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();

        if (token) {
            const { data: authData, error: authErr } = await supabase.auth.getUser(token);
            if (authErr || !authData?.user) {
                return sendError(401, 'Unauthorized: Invalid or expired session');
            }
        } else {
            // Check if local dev or anonymous access is requested, require auth token
            const isLocal = req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1'));
            if (!isLocal) {
                return sendError(401, 'Unauthorized: Sign-in required');
            }
        }

        // Parse query params (works for GET and POST body)
        const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});
        const search = (params.q || params.search || '').trim().toLowerCase();
        const projectFilter = params.projects ? (Array.isArray(params.projects) ? params.projects : String(params.projects).split(',').map(s => s.trim()).filter(Boolean)) : [];
        const hasLinkedin = (params.has_linkedin || params.hasLinkedin || 'all').toLowerCase();
        const projectCountFilter = (params.project_count || params.projectCount || 'all').toLowerCase();
        const branchFilter = (params.branch || '').trim();
        const yearFilter = (params.year || '').trim();
        const sort = (params.sort || 'name_asc').toLowerCase();
        const page = Math.max(1, parseInt(params.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || params.page_size, 10) || 24));

        // 1. Fetch all live/approved projects from core_leads to avoid N+1 queries
        let { data: rawProjects, error: projErr } = await supabase
            .from('core_leads')
            .select('id, team, project_name, avatar_url, initials, color, gradient, lead_user_id');

        if (projErr) {
            console.warn('Error fetching core_leads, falling back:', projErr.message);
            rawProjects = [];
        }

        const projectsMap = new Map();
        (rawProjects || []).forEach(p => {
            projectsMap.set(Number(p.id), {
                id: p.id,
                name: p.team || p.project_name || `Project ${p.id}`,
                avatar_url: p.avatar_url || null,
                initials: p.initials || (p.team ? p.team.replace(/Team\s*/i, '').slice(0, 2).toUpperCase() : 'PR'),
                color: p.color || '#3390ec',
                gradient: p.gradient || 'from-blue-600 to-indigo-600',
                lead_user_id: p.lead_user_id || null
            });
        });

        // 2. Fetch all team memberships once (batched)
        const { data: allMemberships, error: memErr } = await supabase
            .from('team_memberships')
            .select('user_id, team_id');

        if (memErr) {
            console.warn('Error fetching team_memberships:', memErr.message);
        }

        // Build a user-to-projects map
        const userProjectsMap = new Map();
        (allMemberships || []).forEach(m => {
            if (!m.user_id) return;
            const proj = projectsMap.get(Number(m.team_id));
            if (!proj) return;
            if (!userProjectsMap.has(m.user_id)) {
                userProjectsMap.set(m.user_id, []);
            }
            const list = userProjectsMap.get(m.user_id);
            if (!list.some(existing => existing.id === proj.id)) {
                list.push(proj);
            }
        });

        // Also add project leads as members of their own project
        (rawProjects || []).forEach(p => {
            if (p.lead_user_id) {
                const proj = projectsMap.get(Number(p.id));
                if (proj) {
                    if (!userProjectsMap.has(p.lead_user_id)) {
                        userProjectsMap.set(p.lead_user_id, []);
                    }
                    const list = userProjectsMap.get(p.lead_user_id);
                    if (!list.some(existing => existing.id === proj.id)) {
                        list.push(proj);
                    }
                }
            }
        });

        // 3. Query profiles table:
        // Exclude Mentors and Super Admins / Admins at database query level
        let query = supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, email, linkedin, year, branch, section, role, team_id, created_at, updated_at');

        // Filter out mentor and admin roles at query level
        query = query.not('role', 'in', '("mentor","admin","super_admin","superadmin")');

        const { data: profiles, error: profErr } = await query;
        if (profErr) {
            return sendError(500, profErr.message || 'Error fetching student profiles');
        }

        // In-memory filter for deactivated/deleted and strict non-mentor / non-superadmin check
        let filteredStudents = (profiles || []).filter(student => {
            // Strictly exclude Mentors and Admins
            const role = (student.role || '').toLowerCase();
            if (role === 'mentor' || role === 'super_admin' || role === 'superadmin' || role === 'admin') {
                return false;
            }
            if (student.is_mentor === true || student.is_super_admin === true) {
                return false;
            }
            // Exclude deactivated/deleted if column exists
            if (student.is_active === false || student.status === 'deactivated' || student.status === 'banned') {
                return false;
            }
            return true;
        });

        // Attach projects array to each student (no phone numbers returned)
        filteredStudents = filteredStudents.map(s => {
            const projects = userProjectsMap.get(s.id) || [];
            // If user's team_id points to an approved project, ensure it's included
            if (s.team_id && projectsMap.has(Number(s.team_id))) {
                const teamProj = projectsMap.get(Number(s.team_id));
                if (!projects.some(p => p.id === teamProj.id)) {
                    projects.push(teamProj);
                }
            }

            return {
                id: s.id,
                full_name: s.full_name || s.username || 'Student',
                username: s.username || '',
                avatar_url: s.avatar_url || null,
                email: s.email || '',
                linkedin: s.linkedin || null,
                year: s.year || '',
                branch: s.branch || '',
                section: s.section || '',
                created_at: s.created_at || null,
                projects: projects.map(p => ({
                    id: p.id,
                    name: p.name,
                    avatar_url: p.avatar_url,
                    initials: p.initials,
                    color: p.color,
                    gradient: p.gradient
                }))
            };
        });

        // 4. Apply Filters

        // Filter by Search (name, email, project name)
        if (search) {
            filteredStudents = filteredStudents.filter(s => {
                const nameMatch = (s.full_name || '').toLowerCase().includes(search);
                const userMatch = (s.username || '').toLowerCase().includes(search);
                const emailMatch = (s.email || '').toLowerCase().includes(search);
                const projectMatch = (s.projects || []).some(p => (p.name || '').toLowerCase().includes(search));
                return nameMatch || userMatch || emailMatch || projectMatch;
            });
        }

        // Filter by Has LinkedIn
        if (hasLinkedin === 'yes') {
            filteredStudents = filteredStudents.filter(s => !!(s.linkedin && s.linkedin.trim()));
        } else if (hasLinkedin === 'no') {
            filteredStudents = filteredStudents.filter(s => !(s.linkedin && s.linkedin.trim()));
        }

        // Filter by Projects Count
        if (projectCountFilter === 'none' || projectCountFilter === '0' || projectCountFilter === 'no_projects') {
            filteredStudents = filteredStudents.filter(s => s.projects.length === 0);
        } else if (projectCountFilter === '1') {
            filteredStudents = filteredStudents.filter(s => s.projects.length === 1);
        } else if (projectCountFilter === '2') {
            filteredStudents = filteredStudents.filter(s => s.projects.length === 2);
        } else if (projectCountFilter === '3+' || projectCountFilter === '3_plus') {
            filteredStudents = filteredStudents.filter(s => s.projects.length >= 3);
        }

        // Filter by Specific Projects (multi-select)
        if (projectFilter.length > 0) {
            const targetIds = projectFilter.map(id => Number(id));
            filteredStudents = filteredStudents.filter(s => {
                return s.projects.some(p => targetIds.includes(Number(p.id)));
            });
        }

        // Filter by Branch
        if (branchFilter) {
            filteredStudents = filteredStudents.filter(s => (s.branch || '').toLowerCase() === branchFilter.toLowerCase());
        }

        // Filter by Year
        if (yearFilter) {
            filteredStudents = filteredStudents.filter(s => (s.year || '').toLowerCase() === yearFilter.toLowerCase());
        }

        // 5. Apply Sorting
        filteredStudents.sort((a, b) => {
            if (sort === 'name_desc') {
                return (b.full_name || '').localeCompare(a.full_name || '');
            } else if (sort === 'most_projects') {
                const diff = (b.projects?.length || 0) - (a.projects?.length || 0);
                if (diff !== 0) return diff;
                return (a.full_name || '').localeCompare(b.full_name || '');
            } else if (sort === 'recently_joined' || sort === 'recent') {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            } else {
                // Default: name_asc
                return (a.full_name || '').localeCompare(b.full_name || '');
            }
        });

        // 6. Pagination
        const totalCount = filteredStudents.length;
        const totalPages = Math.ceil(totalCount / pageSize) || 1;
        const startIndex = (page - 1) * pageSize;
        const paginatedStudents = filteredStudents.slice(startIndex, startIndex + pageSize);

        // Collect available filter options to send along for convenience
        const availableProjects = Array.from(projectsMap.values()).map(p => ({
            id: p.id,
            name: p.name,
            initials: p.initials,
            avatar_url: p.avatar_url
        }));

        return res.status(200).json({
            success: true,
            students: paginatedStudents,
            totalCount,
            page,
            pageSize,
            totalPages,
            availableProjects
        });
    } catch (err) {
        console.error('Unhandled error in /api/students:', err);
        return sendError(500, err.message || 'Internal server error');
    }
};
