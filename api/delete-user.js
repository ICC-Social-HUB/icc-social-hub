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
        console.error('❌ delete-user error:', msg);
        return res.status(200).json({ success: false, error: msg });
    };

    try {
        if (req.method !== 'POST' && req.method !== 'DELETE') {
            return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        const url = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
            return sendError(500, 'Server configuration error (missing Supabase credentials)');
        }

        const supabase = createClient(url, serviceKey);

        // Verify Bearer token
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

        // Check caller profile & permissions
        const { data: callerProfile } = await supabase
            .from('profiles')
            .select('id, role, email')
            .eq('id', callerUser.id)
            .maybeSingle();

        const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_USER || '').toLowerCase().trim();
        const isSuperAdmin = callerRole === 'super_admin' || callerRole === 'superadmin' || 
                             (adminEmail && (callerProfile?.email?.toLowerCase() === adminEmail || callerUser?.email?.toLowerCase() === adminEmail));
        const isAdmin = callerRole === 'admin' || isSuperAdmin;

        if (!isAdmin && !isSuperAdmin) {
            return sendError(403, 'Unauthorized: Administrator privileges required');
        }

        const targetUserId = req.body?.userId || req.body?.target_user_id || req.query?.userId;
        if (!targetUserId) {
            return sendError(400, 'Target user ID is required');
        }

        // Prevent self deletion
        if (targetUserId === callerUser.id) {
            return sendError(400, 'You cannot delete your own account');
        }

        // Prevent deleting Super Admins
        const { data: targetProfile } = await supabase
            .from('profiles')
            .select('id, role, email')
            .eq('id', targetUserId)
            .maybeSingle();

        if (targetProfile) {
            const targetRole = (targetProfile.role || '').toLowerCase().trim();
            if (targetRole === 'super_admin' || targetRole === 'superadmin' || (adminEmail && targetProfile.email?.toLowerCase() === adminEmail)) {
                return sendError(403, 'Super Administrators are protected and cannot be deleted.');
            }
        }

        // Check auth user as well
        try {
            const { data: authTarget } = await supabase.auth.admin.getUserById(targetUserId);
            if (adminEmail && authTarget?.user?.email?.toLowerCase() === adminEmail) {
                return sendError(403, 'Super Administrators are protected and cannot be deleted.');
            }
        } catch (e) {
            // Target user might already not exist in Auth
        }

        // Unlink from core_leads if they were lead
        try {
            await supabase.from('core_leads').update({ lead_user_id: null }).eq('lead_user_id', targetUserId);
        } catch (e) {}

        // Clean up child tables to prevent foreign key errors
        try {
            await supabase.from('team_memberships').delete().eq('user_id', targetUserId);
            await supabase.from('team_join_data').delete().eq('user_id', targetUserId);
            await supabase.from('project_team_leads').delete().eq('user_id', targetUserId);
            await supabase.from('project_mentor_messages').delete().eq('sender_id', targetUserId);
            await supabase.from('user_update_requests').delete().or(`requester_id.eq.${targetUserId},target_user_id.eq.${targetUserId}`);
            await supabase.from('notifications').delete().or(`user_id.eq.${targetUserId},actor_id.eq.${targetUserId}`);
            await supabase.from('likes').delete().eq('user_id', targetUserId);
            await supabase.from('comments').delete().eq('user_id', targetUserId);
            await supabase.from('posts').delete().eq('user_id', targetUserId);
            await supabase.from('profiles').delete().eq('id', targetUserId);
        } catch (childErr) {
            console.warn('Child tables cleanup error:', childErr);
        }

        // Delete from auth.users via admin API
        const { error: deleteAuthErr } = await supabase.auth.admin.deleteUser(targetUserId);
        if (deleteAuthErr) {
            console.warn('Auth admin deleteUser warning/error:', deleteAuthErr.message);
        }

        return res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error('❌ Server error in delete-user API:', err);
        return sendError(500, err.message || 'Server error while deleting user');
    }
};
