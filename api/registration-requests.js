const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { sendRegistrationApprovalEmail, sendRegistrationDenialEmail } = require('./_mailer');

// Helper to hash token with SHA-256
function hashToken(token) {
    return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

// Simple in-memory rate limiter for submissions
const rateLimitMap = new Map();
function isRateLimited(ip) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxSubmissions = 5;

    const timestamps = rateLimitMap.get(ip) || [];
    const recent = timestamps.filter(t => now - t < windowMs);
    recent.push(now);
    rateLimitMap.set(ip, recent);

    // Clean up older entries periodically
    if (rateLimitMap.size > 1000) {
        for (const [key, times] of rateLimitMap.entries()) {
            if (times.every(t => now - t > windowMs)) {
                rateLimitMap.delete(key);
            }
        }
    }

    return recent.length > maxSubmissions;
}

// College USN Regex Validator (e.g., 1KS25AI109, 1MS22CS001, etc.)
const USN_REGEX = /^1[A-Za-z]{2}\d{2}[A-Za-z]{2}\d{3}$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
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
        const action = (params.action || (method === 'POST' ? 'submit' : 'list')).toLowerCase();

        // =========================================================================
        // 1. PUBLIC ACTION: SUBMIT REGISTRATION REQUEST
        // =========================================================================
        if (action === 'submit') {
            // Anti-Spam: Rate Limit by IP
            const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
            if (isRateLimited(clientIp)) {
                return sendError(429, 'Too many requests. Please wait a minute before trying again.');
            }

            // Anti-Spam: Honeypot field must be completely empty
            if (params.hp_company || params.honeypot || params.website_hp) {
                // Silently pretend success to fool bots
                return res.status(200).json({ success: true, message: 'Request submitted' });
            }

            // Validate Link Token
            const token = (params.token || '').trim();
            if (!token) {
                return sendError(400, 'A valid registration link token is required.');
            }

            const tokenHash = hashToken(token);
            const { data: linkRecord, error: linkErr } = await supabase
                .from('registration_links')
                .select('id, is_active, expires_at')
                .eq('token_hash', tokenHash)
                .maybeSingle();

            if (linkErr || !linkRecord || !linkRecord.is_active) {
                return sendError(403, 'This registration link is not active. Please contact your admin.');
            }

            if (linkRecord.expires_at && new Date(linkRecord.expires_at).getTime() < Date.now()) {
                return sendError(403, 'This registration link has expired. Please contact your admin.');
            }

            // Extract & sanitize fields
            const fullName = (params.full_name || '').trim();
            const usn = (params.usn || '').trim().toUpperCase();
            const branch = (params.branch || '').trim();
            const year = (params.year || '').trim();
            const email = (params.email || '').trim().toLowerCase();
            const phone = (params.phone || '').trim().replace(/[^0-9]/g, '');
            const linkedin = (params.linkedin || '').trim();
            const github = (params.github || '').trim();
            const otherLink = (params.other_link || '').trim();

            // Field-level Validation
            if (!fullName || fullName.length < 2) {
                return sendError(400, 'Please enter your full legal name.');
            }
            if (!usn || !USN_REGEX.test(usn)) {
                return sendError(400, 'Invalid USN format. Please enter a valid college USN (e.g. 1KS25AI109).');
            }
            if (!branch) {
                return sendError(400, 'Please select or enter your branch of study.');
            }
            if (!year) {
                return sendError(400, 'Please select or enter your current academic year.');
            }
            if (!email || !EMAIL_REGEX.test(email)) {
                return sendError(400, 'Please enter a valid email address.');
            }
            if (!phone || !PHONE_REGEX.test(phone)) {
                return sendError(400, 'Please enter a valid 10-digit Indian phone number.');
            }

            // Validate URLs if provided
            const isValidUrl = (urlStr) => {
                try {
                    const parsed = new URL(urlStr);
                    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
                } catch {
                    return false;
                }
            };
            if (linkedin && !isValidUrl(linkedin)) {
                return sendError(400, 'Please enter a valid LinkedIn URL (https://...)');
            }
            if (github && !isValidUrl(github)) {
                return sendError(400, 'Please enter a valid GitHub URL (https://...)');
            }
            if (otherLink && !isValidUrl(otherLink)) {
                return sendError(400, 'Please enter a valid URL for your website or portfolio.');
            }

            // Duplicate Prevention: Check profiles table
            const { data: existingProfiles, error: profCheckErr } = await supabase
                .from('profiles')
                .select('id, email, usn')
                .or(`email.ilike.${email},usn.ilike.${usn}`)
                .limit(1);

            if (!profCheckErr && existingProfiles && existingProfiles.length > 0) {
                const match = existingProfiles[0];
                if (match.email?.toLowerCase() === email) {
                    return sendError(409, 'A student account with this email address already exists. Please log in.');
                }
                if (match.usn?.toUpperCase() === usn) {
                    return sendError(409, 'A student account with this USN already exists. Please log in.');
                }
            }

            // Duplicate Prevention: Check existing open requests (pending_review, awaiting_super_admin)
            const { data: existingRequests, error: reqCheckErr } = await supabase
                .from('registration_requests')
                .select('id, email, usn, status')
                .in('status', ['pending_review', 'awaiting_super_admin'])
                .or(`email.ilike.${email},usn.ilike.${usn}`)
                .limit(1);

            if (!reqCheckErr && existingRequests && existingRequests.length > 0) {
                const match = existingRequests[0];
                if (match.email?.toLowerCase() === email) {
                    return sendError(409, 'A registration request with this email is currently under review.');
                }
                if (match.usn?.toUpperCase() === usn) {
                    return sendError(409, 'A registration request with this USN is currently under review.');
                }
            }

            // Create initial audit log
            const now = new Date().toISOString();
            const initialAudit = [
                {
                    action: 'submitted',
                    actor: 'Applicant',
                    timestamp: now,
                    details: 'Registration form submitted via private link'
                }
            ];

            // Insert Request
            const { data: newRequest, error: insertErr } = await supabase
                .from('registration_requests')
                .insert({
                    full_name: fullName,
                    usn: usn,
                    branch: branch,
                    year: year,
                    email: email,
                    phone: phone,
                    linkedin: linkedin || null,
                    github: github || null,
                    other_link: otherLink || null,
                    status: 'pending_review',
                    audit_log: initialAudit,
                    created_at: now,
                    updated_at: now
                })
                .select('id, status, created_at')
                .single();

            if (insertErr) {
                console.error('Error inserting registration request:', insertErr);
                return sendError(500, 'Unable to submit your registration request at this time. Please try again.');
            }

            return res.status(200).json({
                success: true,
                message: 'Your registration request has been submitted successfully.',
                request: {
                    id: newRequest.id,
                    status: newRequest.status
                }
            });
        }

        // =========================================================================
        // 2. AUTHENTICATED ACTIONS (Admin, Mentor, Super Admin)
        // =========================================================================
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

        // Fetch caller profile and verify role
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
        const isMentor = role === 'mentor';

        if (!isAdmin && !isMentor) {
            return sendError(403, 'Forbidden: Access restricted to Admins, Mentors, and Super Admins');
        }

        const callerName = callerProfile.full_name || callerProfile.username || 'Reviewer';
        const callerRoleTitle = isSuperAdmin ? 'Super Admin' : (isAdmin ? 'Admin' : 'Mentor');

        // ----------------------------------------------------
        // 2A. LIST REQUESTS WITH COUNTS & FILTERING
        // ----------------------------------------------------
        if (action === 'list') {
            const statusFilter = (params.status || 'all').toLowerCase();
            const branchFilter = (params.branch || '').trim();
            const yearFilter = (params.year || '').trim();
            const search = (params.search || '').trim().toLowerCase();

            let query = supabase.from('registration_requests').select('*');

            if (statusFilter && statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }
            if (branchFilter && branchFilter !== 'all') {
                query = query.ilike('branch', `%${branchFilter}%`);
            }
            if (yearFilter && yearFilter !== 'all') {
                query = query.eq('year', yearFilter);
            }
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,usn.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
            }

            query = query.order('created_at', { ascending: false });

            const { data: requests, error: listErr } = await query;
            if (listErr) {
                return sendError(500, listErr.message);
            }

            // Fetch aggregate counts for badges
            const { data: allReqs, error: countErr } = await supabase
                .from('registration_requests')
                .select('status');

            const counts = {
                pending_review: 0,
                awaiting_super_admin: 0,
                approved: 0,
                denied: 0
            };

            if (!countErr && allReqs) {
                allReqs.forEach(r => {
                    if (counts[r.status] !== undefined) {
                        counts[r.status]++;
                    }
                });
            }

            return res.status(200).json({
                success: true,
                requests: requests || [],
                counts,
                viewer: {
                    id: callerId,
                    name: callerName,
                    role: callerRoleTitle,
                    isSuperAdmin,
                    isAdmin,
                    isMentor
                }
            });
        }

        // ----------------------------------------------------
        // 2B. FORWARD TO SUPER ADMIN (Admin & Mentor)
        // ----------------------------------------------------
        if (action === 'forward') {
            const requestId = params.id || params.request_id;
            const note = (params.note || '').trim();

            if (!requestId) {
                return sendError(400, 'Request ID is required');
            }

            // Concurrency check: retrieve current state
            const { data: currentReq, error: getErr } = await supabase
                .from('registration_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (getErr || !currentReq) {
                return sendError(404, 'Registration request not found');
            }

            // Check if already handled by someone else
            if (currentReq.status === 'awaiting_super_admin') {
                return sendError(409, `This request was already forwarded by ${currentReq.first_reviewer_name || 'another reviewer'}.`);
            }
            if (currentReq.status === 'approved') {
                return sendError(409, `This request was already approved by ${currentReq.final_approver_name || 'Super Admin'}.`);
            }

            const now = new Date().toISOString();
            const auditLog = Array.isArray(currentReq.audit_log) ? currentReq.audit_log : [];
            auditLog.push({
                action: 'forwarded',
                actor_id: callerId,
                actor_name: callerName,
                actor_role: callerRoleTitle,
                note: note || 'Forwarded to Super Admin for final review',
                timestamp: now
            });

            const { data: updatedReq, error: updateErr } = await supabase
                .from('registration_requests')
                .update({
                    status: 'awaiting_super_admin',
                    first_reviewer_id: callerId,
                    first_reviewer_name: callerName,
                    first_reviewer_role: callerRoleTitle,
                    first_reviewer_note: note || null,
                    first_reviewed_at: now,
                    audit_log: auditLog,
                    updated_at: now
                })
                .eq('id', requestId)
                .select()
                .single();

            if (updateErr) {
                return sendError(500, updateErr.message);
            }

            // In-app Notification for Super Admins
            try {
                const { data: superAdmins } = await supabase
                    .from('profiles')
                    .select('id')
                    .or('role.eq.super_admin,role.eq.superadmin');

                if (superAdmins && superAdmins.length > 0) {
                    const notifRows = superAdmins.map(sa => ({
                        user_id: sa.id,
                        actor_id: callerId,
                        type: 'system',
                        body: `📋 Registration Request forwarded: ${currentReq.full_name} (${currentReq.usn}) is awaiting your final approval.`,
                        created_at: now
                    }));
                    await supabase.from('notifications').insert(notifRows);
                }
            } catch (e) {
                console.warn('Could not insert in-app notification:', e.message);
            }

            return res.status(200).json({
                success: true,
                message: 'Request forwarded to Super Admin successfully.',
                request: updatedReq
            });
        }

        // ----------------------------------------------------
        // 2C. APPROVE REQUEST (Super Admin ONLY)
        // ----------------------------------------------------
        if (action === 'approve') {
            // STRICT PERMISSION CHECK: ONLY SUPER ADMIN!
            if (!isSuperAdmin) {
                return sendError(403, 'Forbidden: Only the Super Administrator can give final approval to grant platform access.');
            }

            const requestId = params.id || params.request_id;
            if (!requestId) {
                return sendError(400, 'Request ID is required');
            }

            // Concurrency check
            const { data: currentReq, error: getErr } = await supabase
                .from('registration_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (getErr || !currentReq) {
                return sendError(404, 'Registration request not found');
            }

            if (currentReq.status === 'approved') {
                return sendError(409, `This request was already approved by ${currentReq.final_approver_name || 'Super Admin'}.`);
            }

            const now = new Date().toISOString();
            const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

            const approvedByFormatted = `${callerName} · Super Admin · ${dateStr}`;
            let reviewedByFormatted = 'Direct Super Admin Review';
            if (currentReq.first_reviewer_name) {
                const fDate = currentReq.first_reviewed_at 
                    ? new Date(currentReq.first_reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : dateStr;
                reviewedByFormatted = `${currentReq.first_reviewer_name} · ${currentReq.first_reviewer_role || 'Admin'} · ${fDate}`;
            }

            const auditLog = Array.isArray(currentReq.audit_log) ? currentReq.audit_log : [];
            auditLog.push({
                action: 'approved',
                actor_id: callerId,
                actor_name: callerName,
                actor_role: 'Super Admin',
                timestamp: now,
                details: 'Granted full platform access'
            });

            // 1. Update the registration request
            const { data: updatedReq, error: updateErr } = await supabase
                .from('registration_requests')
                .update({
                    status: 'approved',
                    final_approver_id: callerId,
                    final_approver_name: callerName,
                    final_approver_role: 'Super Admin',
                    final_approved_at: now,
                    audit_log: auditLog,
                    updated_at: now
                })
                .eq('id', requestId)
                .select()
                .single();

            if (updateErr) {
                return sendError(500, updateErr.message);
            }

            // 2. Create or Update user in profiles & Auth
            // Check if profile exists by email or USN
            const { data: existingProf } = await supabase
                .from('profiles')
                .select('id, email')
                .or(`email.ilike.${currentReq.email},usn.ilike.${currentReq.usn}`)
                .maybeSingle();

            if (existingProf) {
                await supabase
                    .from('profiles')
                    .update({
                        approval_status: 'approved',
                        approved_by: approvedByFormatted,
                        reviewed_by: reviewedByFormatted,
                        approved_at: now,
                        reviewed_at: currentReq.first_reviewed_at || now,
                        full_name: currentReq.full_name,
                        usn: currentReq.usn,
                        phone: currentReq.phone,
                        linkedin_url: currentReq.linkedin || null,
                        github_url: currentReq.github || null,
                        role: 'member',
                        updated_at: now
                    })
                    .eq('id', existingProf.id);
            } else {
                // Generate a base username from email or name
                const baseUsername = (currentReq.email.split('@')[0] || currentReq.full_name.toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 15);
                const randomSuffix = Math.floor(100 + Math.random() * 900);
                const username = `${baseUsername}${randomSuffix}`;

                // Insert into public.profiles
                await supabase
                    .from('profiles')
                    .insert({
                        email: currentReq.email,
                        full_name: currentReq.full_name,
                        username: username,
                        usn: currentReq.usn,
                        phone: currentReq.phone,
                        role: 'member',
                        approval_status: 'approved',
                        approved_by: approvedByFormatted,
                        reviewed_by: reviewedByFormatted,
                        approved_at: now,
                        reviewed_at: currentReq.first_reviewed_at || now,
                        linkedin_url: currentReq.linkedin || null,
                        github_url: currentReq.github || null,
                        created_at: now,
                        updated_at: now
                    });
            }

            // 3. Send Approval Email to Student
            const appUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'icc-social-hub.vercel.app'}`;
            let emailSent = false;
            try {
                emailSent = await sendRegistrationApprovalEmail(currentReq.email, currentReq.full_name, currentReq.usn, appUrl);
            } catch (mailErr) {
                console.error('Failed to send approval email:', mailErr);
            }

            return res.status(200).json({
                success: true,
                message: `Request approved for ${currentReq.full_name}. Student now has active access.`,
                emailSent,
                request: updatedReq
            });
        }

        // ----------------------------------------------------
        // 2D. DENY REQUEST (Admin, Mentor, Super Admin)
        // ----------------------------------------------------
        if (action === 'deny') {
            const requestId = params.id || params.request_id;
            const reason = (params.reason || '').trim();

            if (!requestId) {
                return sendError(400, 'Request ID is required');
            }

            const { data: currentReq, error: getErr } = await supabase
                .from('registration_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (getErr || !currentReq) {
                return sendError(404, 'Registration request not found');
            }

            // Concurrency check
            if (currentReq.status === 'denied') {
                return sendError(409, `This request was already denied by ${currentReq.denied_by_name || 'another reviewer'}.`);
            }

            const now = new Date().toISOString();
            const auditLog = Array.isArray(currentReq.audit_log) ? currentReq.audit_log : [];
            auditLog.push({
                action: 'denied',
                actor_id: callerId,
                actor_name: callerName,
                actor_role: callerRoleTitle,
                reason: reason || 'Not specified',
                timestamp: now
            });

            const { data: updatedReq, error: updateErr } = await supabase
                .from('registration_requests')
                .update({
                    status: 'denied',
                    denied_by_id: callerId,
                    denied_by_name: callerName,
                    denied_by_role: callerRoleTitle,
                    denial_reason: reason || null,
                    denied_at: now,
                    audit_log: auditLog,
                    updated_at: now
                })
                .eq('id', requestId)
                .select()
                .single();

            if (updateErr) {
                return sendError(500, updateErr.message);
            }

            // Send polite denial email to student
            let emailSent = false;
            try {
                emailSent = await sendRegistrationDenialEmail(currentReq.email, currentReq.full_name, reason);
            } catch (mailErr) {
                console.error('Failed to send denial email:', mailErr);
            }

            return res.status(200).json({
                success: true,
                message: 'Request denied.',
                emailSent,
                request: updatedReq
            });
        }

        // ----------------------------------------------------
        // 2E. REOPEN / REVERT DENIED REQUEST
        // ----------------------------------------------------
        if (action === 'reopen') {
            const requestId = params.id || params.request_id;
            const targetStatus = params.target_status || (isSuperAdmin ? 'approved' : 'awaiting_super_admin');

            const { data: currentReq, error: getErr } = await supabase
                .from('registration_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (getErr || !currentReq) {
                return sendError(404, 'Registration request not found');
            }

            // If non-super admin tries to reopen directly to approved, reject with 403
            if (targetStatus === 'approved' && !isSuperAdmin) {
                return sendError(403, 'Forbidden: Only Super Administrators can approve a request.');
            }

            const now = new Date().toISOString();
            const auditLog = Array.isArray(currentReq.audit_log) ? currentReq.audit_log : [];
            auditLog.push({
                action: 'reopened',
                actor_id: callerId,
                actor_name: callerName,
                actor_role: callerRoleTitle,
                target_status: targetStatus,
                timestamp: now,
                details: `Reopened denial by ${callerName}`
            });

            const updatePayload = {
                status: targetStatus,
                audit_log: auditLog,
                updated_at: now
            };

            if (targetStatus === 'awaiting_super_admin') {
                updatePayload.first_reviewer_id = callerId;
                updatePayload.first_reviewer_name = callerName;
                updatePayload.first_reviewer_role = callerRoleTitle;
                updatePayload.first_reviewer_note = 'Reopened denied request and forwarded to Super Admin';
                updatePayload.first_reviewed_at = now;
            } else if (targetStatus === 'approved') {
                updatePayload.final_approver_id = callerId;
                updatePayload.final_approver_name = callerName;
                updatePayload.final_approver_role = 'Super Admin';
                updatePayload.final_approved_at = now;
            }

            const { data: updatedReq, error: updateErr } = await supabase
                .from('registration_requests')
                .update(updatePayload)
                .eq('id', requestId)
                .select()
                .single();

            if (updateErr) {
                return sendError(500, updateErr.message);
            }

            // If Super Admin reversed to approved, trigger approval email
            if (targetStatus === 'approved') {
                const appUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'icc-social-hub.vercel.app'}`;
                try {
                    await sendRegistrationApprovalEmail(currentReq.email, currentReq.full_name, currentReq.usn, appUrl);
                } catch (e) {}
            }

            return res.status(200).json({
                success: true,
                message: `Request reopened and status updated to ${targetStatus}.`,
                request: updatedReq
            });
        }

        // ----------------------------------------------------
        // 2F. RESEND NOTIFICATION EMAIL (Super Admin & Admin)
        // ----------------------------------------------------
        if (action === 'resend-email') {
            const requestId = params.id || params.request_id;
            const { data: currentReq } = await supabase
                .from('registration_requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (!currentReq) return sendError(404, 'Request not found');

            const appUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || 'icc-social-hub.vercel.app'}`;
            let sent = false;
            if (currentReq.status === 'approved') {
                sent = await sendRegistrationApprovalEmail(currentReq.email, currentReq.full_name, currentReq.usn, appUrl);
            } else if (currentReq.status === 'denied') {
                sent = await sendRegistrationDenialEmail(currentReq.email, currentReq.full_name, currentReq.denial_reason);
            }

            return res.status(200).json({
                success: sent,
                message: sent ? 'Email resent successfully.' : 'Failed to send email. Check mailer credentials.'
            });
        }

        return sendError(400, `Unknown action: ${action}`);

    } catch (err) {
        console.error('Registration requests API error:', err);
        return sendError(500, err.message || 'Internal server error');
    }
};
