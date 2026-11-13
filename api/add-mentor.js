const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const sendError = (status, msg) => {
        console.error('❌ add-mentor error:', msg);
        return res.status(200).json({ success: false, error: msg });
    };

    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        const url = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
            return sendError(500, 'Server configuration error (missing Supabase credentials)');
        }

        const supabase = createClient(url, serviceKey);

        // 1. Verify Bearer token & ensure caller is Super Admin
        const authHeader = req.headers.authorization || req.headers.Authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();

        if (!token) {
            return sendError(401, 'Unauthorized: Sign-in required');
        }

        const { data: authData, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !authData?.user) {
            return sendError(401, 'Unauthorized: Invalid or expired session');
        }

        const callerUser = authData.user;

        // Verify Super Admin status
        const { data: callerProfile } = await supabase
            .from('profiles')
            .select('id, role, email')
            .eq('id', callerUser.id)
            .maybeSingle();

        const callerRole = (callerProfile?.role || '').toLowerCase().trim();
        const callerEmail = (callerProfile?.email || callerUser?.email || '').toLowerCase().trim();
        const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_USER || '').toLowerCase().trim();
        const isSuperAdmin = callerRole === 'super_admin' || callerRole === 'superadmin' || 
                             (adminEmail && (callerEmail === adminEmail));

        if (!isSuperAdmin) {
            return sendError(403, 'Forbidden: Only Super Administrators can add new mentors');
        }

        // 2. Validate input
        const { email, full_name, bio, designation, skills, permissions } = req.body || {};
        if (!email || typeof email !== 'string') {
            return sendError(400, 'Valid mentor email address is required');
        }

        const cleanEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return sendError(400, 'Please enter a valid email address format');
        }

        const cleanName = (full_name && typeof full_name === 'string') ? full_name.trim() : '';
        const cleanBio = (bio && typeof bio === 'string') ? bio.trim() : '';
        const cleanDesignation = (designation && typeof designation === 'string') ? designation.trim() : '';
        const mentorSkills = Array.isArray(skills) ? skills : [];

        const defaultPermissions = {
            broadcast: false,
            moderate: false,
            events: false,
            leads: false,
            users_edit: false,
            users_export: true,
            mom: false,
            inventory: false,
            all: false
        };
        const finalPermissions = permissions && typeof permissions === 'object' ? permissions : defaultPermissions;

        // 3. Check if profile already exists for this email
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, bio')
            .ilike('email', cleanEmail)
            .maybeSingle();

        let userId = existingProfile?.id;
        const now = new Date().toISOString();

        if (existingProfile) {
            // Update existing profile to mentor role
            const updateFields = {
                role: 'mentor',
                approval_status: 'approved',
                approved_by: `Super Admin (${callerProfile?.full_name || callerEmail})`,
                approved_at: now,
                updated_at: now
            };

            if (cleanName && !existingProfile.full_name) updateFields.full_name = cleanName;
            if (cleanBio && !existingProfile.bio) updateFields.bio = cleanBio;
            if (cleanDesignation) updateFields.designation = cleanDesignation;
            if (finalPermissions) updateFields.admin_permissions = finalPermissions;

            const { error: updateErr } = await supabase
                .from('profiles')
                .update(updateFields)
                .eq('id', existingProfile.id);

            if (updateErr) {
                // If designation column doesn't exist, retry without it
                if (updateErr.message && updateErr.message.includes('designation')) {
                    delete updateFields.designation;
                    await supabase.from('profiles').update(updateFields).eq('id', existingProfile.id);
                } else {
                    return sendError(500, 'Database error updating profile: ' + updateErr.message);
                }
            }

            return res.status(200).json({
                success: true,
                message: `Existing member ${cleanEmail} upgraded to Mentor!`,
                mentor: {
                    id: existingProfile.id,
                    email: cleanEmail,
                    full_name: updateFields.full_name || existingProfile.full_name,
                    role: 'mentor',
                    is_new: false
                }
            });
        }

        // 4. Create user in Supabase Auth if not already existing
        const { data: newAuthUser, error: authCreateErr } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            email_confirm: true,
            user_metadata: {
                role: 'mentor',
                full_name: cleanName || cleanEmail.split('@')[0]
            }
        });

        if (authCreateErr) {
            if (authCreateErr.message && authCreateErr.message.toLowerCase().includes('already')) {
                // User already exists in Auth, retrieve their ID
                const { data: listData } = await supabase.auth.admin.listUsers();
                const matchedUser = listData?.users?.find(u => (u.email || '').toLowerCase() === cleanEmail);
                if (matchedUser) {
                    userId = matchedUser.id;
                } else {
                    return sendError(500, 'User exists in Auth but could not be located');
                }
            } else {
                return sendError(500, 'Failed to create user in Auth: ' + authCreateErr.message);
            }
        } else {
            userId = newAuthUser.user.id;
        }

        if (!userId) {
            return sendError(500, 'Could not determine user ID for new mentor');
        }

        // 5. Upsert profile record in public.profiles
        // Note: Supabase's on_auth_user_created trigger may have already created the row on auth.users insert
        const newProfile = {
            id: userId,
            email: cleanEmail,
            full_name: cleanName || cleanEmail.split('@')[0],
            role: 'mentor',
            approval_status: 'approved',
            approved_by: `Super Admin (${callerProfile?.full_name || callerEmail})`,
            approved_at: now,
            bio: cleanBio || '',
            designation: cleanDesignation || '',
            skills: mentorSkills,
            admin_permissions: finalPermissions,
            updated_at: now
        };

        const { error: upsertErr } = await supabase
            .from('profiles')
            .upsert(newProfile, { onConflict: 'id' });

        if (upsertErr) {
            // Handle optional designation column if missing in schema
            if (upsertErr.message && upsertErr.message.includes('designation')) {
                delete newProfile.designation;
                const { error: retryErr } = await supabase.from('profiles').upsert(newProfile, { onConflict: 'id' });
                if (retryErr) return sendError(500, 'Database error creating mentor profile: ' + retryErr.message);
            } else {
                return sendError(500, 'Database error creating mentor profile: ' + upsertErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Mentor ${cleanEmail} successfully added!`,
            mentor: {
                id: userId,
                email: cleanEmail,
                full_name: cleanName || cleanEmail.split('@')[0],
                role: 'mentor',
                is_new: true
            }
        });

    } catch (err) {
        return sendError(500, err.message || 'Internal server error');
    }
};

