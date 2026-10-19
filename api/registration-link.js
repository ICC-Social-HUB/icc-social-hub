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
            if (!token || token.length < 12) {
                return res.status(200).json({ valid: false, reason: 'invalid' });
            }

            const tokenHash = hashToken(token);
            let linkRecord = null;

            // Try finding by token_hash first, then fallback by raw token
            const { data: byHash } = await supabase
                .from('registration_links')
                .select('id, is_active, expires_at, created_by, creator_name, creator_role')
                .eq('token_hash', tokenHash)
                .maybeSingle();

            if (byHash) {
                linkRecord = byHash;
            } else {
                const { data: byToken } = await supabase
                    .from('registration_links')
                    .select('id, is_active, expires_at, created_by, creator_name, creator_role')
                    .eq('token', token)
                    .maybeSingle();
                if (byToken) linkRecord = byToken;
            }

            if (!linkRecord) {
                return res.status(200).json({ valid: false, reason: 'invalid' });
            }

            if (!linkRecord.is_active) {
                return res.status(200).json({ 
                    valid: false, 
                    reason: 'disabled',
                    admin_name: linkRecord.creator_name || 'Admin'
                });
            }

            if (linkRecord.expires_at) {
                const expiryDate = new Date(linkRecord.expires_at);
                if (expiryDate.getTime() < Date.now()) {
                    return res.status(200).json({ valid: false, reason: 'expired' });
                }
            }

            return res.status(200).json({ 
                valid: true,
                admin_id: linkRecord.created_by,
                admin_name: linkRecord.creator_name || 'Admin',
                admin_role: linkRecord.creator_role || 'Admin'
            });
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

        if (!isAdmin) {
            return sendError(403, 'Forbidden: Only Super Admins and Admins can manage registration links');
        }

        const creatorName = callerProfile.full_name || callerProfile.username || 'Admin';
        const creatorRole = isSuperAdmin ? 'Super Admin' : 'Admin';

        // Helper to generate unique permanent token
        const generatePermanentToken = () => {
            const seed = callerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
            const rand = crypto.randomBytes(8).toString('hex');
            return `reg_${seed}_${rand}`;
        };

        // ----------------------------------------------------
        // 2A. GET MY PERMANENT LINK (Auto-creates if none exists)
        // ----------------------------------------------------
        if (action === 'get-active' || action === 'get-my-link' || action === 'status') {
            // Find this admin's personal registration link
            let { data: myLink, error: fetchErr } = await supabase
                .from('registration_links')
                .select('*')
                .eq('created_by', callerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (fetchErr) {
                console.warn('Error fetching personal registration link:', fetchErr.message);
            }

            // Clean up older duplicate links for this admin if multiple exist
            const { data: allAdminLinks } = await supabase
                .from('registration_links')
                .select('id')
                .eq('created_by', callerId)
                .order('created_at', { ascending: false });

            if (allAdminLinks && allAdminLinks.length > 1) {
                const keepId = myLink ? myLink.id : allAdminLinks[0].id;
                const extraIds = allAdminLinks.filter(l => l.id !== keepId).map(l => l.id);
                if (extraIds.length > 0) {
                    await supabase.from('registration_links').delete().in('id', extraIds);
                }
            }

            // If no permanent link exists yet for this admin, generate one now!
            if (!myLink) {
                const tokenStr = generatePermanentToken();
                const tokenHash = hashToken(tokenStr);
                const now = new Date().toISOString();

                const { data: createdLink, error: insertErr } = await supabase
                    .from('registration_links')
                    .insert({
                        token: tokenStr,
                        token_hash: tokenHash,
                        is_active: true,
                        created_by: callerId,
                        creator_name: creatorName,
                        creator_role: creatorRole,
                        created_at: now,
                        updated_at: now
                    })
                    .select()
                    .single();

                if (insertErr) {
                    return sendError(500, `Failed to initialize personal link: ${insertErr.message}`);
                }
                myLink = createdLink;
            } else if (!myLink.token) {
                // If token was not stored, assign permanent token
                const tokenStr = generatePermanentToken();
                const tokenHash = hashToken(tokenStr);
                const { data: updatedLink } = await supabase
                    .from('registration_links')
                    .update({
                        token: tokenStr,
                        token_hash: tokenHash,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', myLink.id)
                    .select()
                    .single();
                if (updatedLink) myLink = updatedLink;
            }

            return res.status(200).json({
                success: true,
                link: myLink,
                token: myLink.token
            });
        }

        // ----------------------------------------------------
        // 2B. TOGGLE MY LINK (Enable / Disable)
        // ----------------------------------------------------
        if (action === 'toggle' || action === 'update') {
            const targetActive = typeof params.is_active === 'boolean' ? params.is_active : false;
            
            // Find caller's link
            const { data: targetLink } = await supabase
                .from('registration_links')
                .select('id')
                .eq('created_by', callerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!targetLink) {
                return sendError(404, 'No registration link found for this admin');
            }

            // Toggle by specific ID
            const { data: updatedLink, error: updateErr } = await supabase
                .from('registration_links')
                .update({ 
                    is_active: targetActive,
                    updated_at: new Date().toISOString()
                })
                .eq('id', targetLink.id)
                .select()
                .single();

            if (updateErr) {
                return sendError(500, updateErr.message);
            }

            return res.status(200).json({
                success: true,
                link: updatedLink
            });
        }

        // ----------------------------------------------------
        // 2C. RESET / REGENERATE MY PERMANENT LINK
        // ----------------------------------------------------
        if (action === 'generate' || action === 'regenerate' || action === 'reset') {
            const tokenStr = generatePermanentToken();
            const tokenHash = hashToken(tokenStr);
            const now = new Date().toISOString();

            // Check if caller already has a link
            const { data: existing } = await supabase
                .from('registration_links')
                .select('id')
                .eq('created_by', callerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let resultLink = null;
            if (existing) {
                const { data: updated, error: uErr } = await supabase
                    .from('registration_links')
                    .update({
                        token: tokenStr,
                        token_hash: tokenHash,
                        is_active: true,
                        creator_name: creatorName,
                        creator_role: creatorRole,
                        updated_at: now
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (uErr) return sendError(500, uErr.message);
                resultLink = updated;
            } else {
                const { data: created, error: cErr } = await supabase
                    .from('registration_links')
                    .insert({
                        token: tokenStr,
                        token_hash: tokenHash,
                        is_active: true,
                        created_by: callerId,
                        creator_name: creatorName,
                        creator_role: creatorRole,
                        created_at: now,
                        updated_at: now
                    })
                    .select()
                    .single();
                if (cErr) return sendError(500, cErr.message);
                resultLink = created;
            }

            return res.status(200).json({
                success: true,
                token: tokenStr,
                link: resultLink
            });
        }

        return sendError(400, `Unknown action: ${action}`);

    } catch (err) {
        console.error('Registration link API error:', err);
        return sendError(500, err.message || 'Internal server error');
    }
};
