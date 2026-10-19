const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Helper to hash token with SHA-256
function hashToken(token) {
    return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

module.exports = async (req, res) => {
    // Helper to send standard JSON response
    const sendError = (status, msg) => {
        return res.status(status).json({ success: false, error: msg });
    };

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return sendError(500, 'Server configuration error: missing Supabase credentials');
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    try {
        const method = req.method;
        const params = method === 'GET' ? (req.query || {}) : (req.body || {});
        const action = (params.action || (method === 'GET' ? 'validate' : 'generate')).toLowerCase();

        // ----------------------------------------------------
        // 1. PUBLIC ACTION: VALIDATE TOKEN
        // ----------------------------------------------------
        if (action === 'validate') {
            const token = (params.token || '').trim();
            if (!token || token.length < 16) {
                return res.status(200).json({ valid: false, reason: 'invalid' });
            }

            const tokenHash = hashToken(token);
            const { data: linkRecord, error: linkErr } = await supabase
                .from('registration_links')
                .select('id, is_active, expires_at')
                .eq('token_hash', tokenHash)
                .maybeSingle();

            if (linkErr || !linkRecord) {
                return res.status(200).json({ valid: false, reason: 'invalid' });
            }

            if (!linkRecord.is_active) {
                return res.status(200).json({ valid: false, reason: 'disabled' });
            }

            if (linkRecord.expires_at) {
                const expiryDate = new Date(linkRecord.expires_at);
                if (expiryDate.getTime() < Date.now()) {
                    return res.status(200).json({ valid: false, reason: 'expired' });
                }
            }

            return res.status(200).json({ valid: true });
        }

        // ----------------------------------------------------
        // 2. ADMIN/SUPER ADMIN ACTIONS (Require Authentication)
        // ----------------------------------------------------
        const authHeader = req.headers.authorization || req.headers.Authorization || '';
        const userToken = authHeader.replace(/^Bearer\s+/i, '').trim();

        if (!userToken) {
            return sendError(401, 'Unauthorized: Sign-in required');
        }

        const { data: authData, error: authErr } = await supabase.auth.getUser(userToken);
        if (authErr || !authData?.user) {
            return sendError(401, 'Unauthorized: Invalid or expired session');
        }

        const callerId = authData.user.id;

        // Fetch user profile and verify Super Admin or Admin role
        const { data: callerProfile, error: profErr } = await supabase
            .from('profiles')
            .select('id, full_name, username, role, email')
            .eq('id', callerId)
            .single();

        if (profErr || !callerProfile) {
            return sendError(403, 'Forbidden: User profile not found');
        }

        const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_USER || '').toLowerCase().trim();
        const callerEmail = (callerProfile.email || authData.user.email || '').toLowerCase().trim();
        const role = (callerProfile.role || '').toLowerCase();
        const isSuperAdmin = role === 'super_admin' || role === 'superadmin' || (adminEmail && callerEmail === adminEmail);
        const isAdmin = role === 'admin' || isSuperAdmin;

        // Explicit check: Mentors cannot manage registration links!
        if (!isAdmin) {
            return sendError(403, 'Forbidden: Only Super Admins and Admins can manage the registration link');
        }

        // ----------------------------------------------------
        // 2A. GET ACTIVE LINK METADATA
        // ----------------------------------------------------
        if (action === 'get-active' || action === 'status') {
            const { data: activeLink, error: fetchErr } = await supabase
                .from('registration_links')
                .select('id, is_active, expires_at, creator_name, creator_role, created_at, updated_at')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (fetchErr) {
                return sendError(500, fetchErr.message);
            }

            return res.status(200).json({
                success: true,
                link: activeLink || null
            });
        }

        // ----------------------------------------------------
        // 2B. GENERATE OR REGENERATE LINK
        // ----------------------------------------------------
        if (action === 'generate' || action === 'regenerate') {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = hashToken(rawToken);
            const expiresAt = params.expires_at ? new Date(params.expires_at).toISOString() : null;

            // Invalidate all existing active links immediately
            await supabase
                .from('registration_links')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('is_active', true);

            const creatorName = callerProfile.full_name || callerProfile.username || 'Admin';
            const creatorRole = isSuperAdmin ? 'Super Admin' : 'Admin';

            const { data: newLink, error: insertErr } = await supabase
                .from('registration_links')
                .insert({
                    token_hash: tokenHash,
                    is_active: true,
                    expires_at: expiresAt,
                    created_by: callerId,
                    creator_name: creatorName,
                    creator_role: creatorRole,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select('id, is_active, expires_at, created_at')
                .single();

            if (insertErr) {
                return sendError(500, `Failed to generate link: ${insertErr.message}`);
            }

            // Return plain token ONLY ONCE during generation/regeneration
            return res.status(200).json({
                success: true,
                token: rawToken,
                link: newLink
            });
        }

        // ----------------------------------------------------
        // 2C. TOGGLE LINK STATUS OR UPDATE EXPIRY
        // ----------------------------------------------------
        if (action === 'toggle' || action === 'update') {
            const linkId = params.id;
            const updatePayload = {
                updated_at: new Date().toISOString()
            };

            if (typeof params.is_active === 'boolean') {
                updatePayload.is_active = params.is_active;
            }
            if (params.expires_at !== undefined) {
                updatePayload.expires_at = params.expires_at ? new Date(params.expires_at).toISOString() : null;
            }

            let query = supabase.from('registration_links').update(updatePayload);
            if (linkId) {
                query = query.eq('id', linkId);
            } else {
                // If no specific id is passed, update the most recent link
                const { data: latest } = await supabase
                    .from('registration_links')
                    .select('id')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (!latest) {
                    return sendError(404, 'No registration link found to update');
                }
                query = query.eq('id', latest.id);
            }

            const { data: updatedLink, error: updateErr } = await query
                .select('id, is_active, expires_at, updated_at')
                .single();

            if (updateErr) {
                return sendError(500, updateErr.message);
            }

            return res.status(200).json({
                success: true,
                link: updatedLink
            });
        }

        return sendError(400, `Unknown action: ${action}`);

    } catch (err) {
        console.error('Registration link API error:', err);
        return sendError(500, err.message || 'Internal server error');
    }
};
