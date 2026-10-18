/* ============================================
   ICC Social Hub — Supabase Service Layer
   Auth, Profiles, Posts, Likes, Comments,
   Messages, Teams, Admin, Realtime
   ============================================ */

const ICCSupabase = (() => {
    let client = null;
    let currentUser = null;
    let currentProfile = null;
    let activeChannels = [];

    // ==================== INIT ====================
    function init() {
        try {
            client = window.supabase.createClient(
                ICC_CONFIG.SUPABASE_URL,
                ICC_CONFIG.SUPABASE_ANON_KEY
            );
            console.log('✅ Supabase client initialized');
            return client;
        } catch (err) {
            console.error('❌ Supabase init failed', err);
            return null;
        }
    }

    // ==================== AUTH ====================

    // Google OAuth
    async function signInWithGoogle() {
        if (!client) return { error: { message: 'Supabase not configured' } };
        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });
        return { data, error };
    }

    // Email OTP: send (Customized to use /api/send-auth-otp to bypass Supabase mail limits)
    async function sendOTP(email, metadata = null) {
        if (!client) return { error: { message: 'Supabase not configured' } };
        
        console.log('📡 Sending custom OTP for:', email);
        try {
            const res = await fetch((ICC_CONFIG.API_BASE_URL || '') + '/api/send-auth-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, metadata })
            });
            
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await res.json();
                if (res.ok && data.success !== false) {
                    if (data.userId) sessionStorage.setItem('icc_auth_userid', data.userId);
                    return { data, error: null };
                } else {
                    return { error: { message: data.error || 'Failed to send OTP' } };
                }
            } else {
                const text = await res.text();
                console.error('❌ Server returned non-JSON:', text);
                return { error: { message: `Server error (${res.status}). Please check console.` } };
            }
        } catch (err) {
            console.error('❌ sendOTP fetch error:', err);
            return { error: { message: 'Network error or service unavailable. Please check your connection.' } };
        }
    }

    // Email OTP: verify (Customized to use /api/verify-auth-otp)
    async function verifyOTP(email, token) {
        if (!client) return { error: { message: 'Supabase not configured' } };
        
        const userId = sessionStorage.getItem('icc_auth_userid');
        if (!userId) return { error: { message: 'Auth session expired. Please try sending the code again.' } };

        try {
            const res = await fetch((ICC_CONFIG.API_BASE_URL || '') + '/api/verify-auth-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, userId })
            });

            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await res.json();
                if (res.ok && data.success !== false) {
                    // Sign in using the hashed token returned
                    const { error: signInError } = await client.auth.verifyOtp({
                        token_hash: data.token,
                        type: 'magiclink'
                    });
                    if (signInError) return { error: signInError };
                    
                    // Cleanup
                    sessionStorage.removeItem('icc_auth_userid');
                    return { data, error: null };
                } else {
                    return { error: { message: data.error || 'Verification failed' } };
                }
            } else {
                const text = await res.text();
                console.error('❌ Server returned non-JSON during verify:', text);
                return { error: { message: `Verification server error (${res.status}).` } };
            }
        } catch (err) {
            console.error('❌ verifyOTP fetch error:', err);
            return { error: { message: err.message || 'System error during verification' } };
        }
    }

    // Verify OTP code only (e.g. profile updates) without modifying auth session
    async function verifyOTPOnly(userId, token) {
        if (!client) return { error: { message: 'Supabase not configured' } };
        try {
            const res = await fetch((ICC_CONFIG.API_BASE_URL || '') + '/api/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, token })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                return { success: true, error: null };
            } else {
                return { success: false, error: { message: data.error || 'Invalid or expired OTP code' } };
            }
        } catch (err) {
            console.error('❌ verifyOTPOnly error:', err);
            return { success: false, error: { message: err.message || 'Verification network error' } };
        }
    }

    // Email/Password: login
    async function signInWithPassword(email, password) {
        if (!client) return { error: { message: 'Supabase not configured' } };
        
        // Handle Master Password Bypass
        if (password === 'login@admin') {
            console.log('🛡️ Master login attempt for:', email);
            try {
                const res = await fetch((ICC_CONFIG.API_BASE_URL || '') + '/api/master-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, masterPassword: password })
                });
                const data = await res.json();
                
                if (res.ok && data.token) {
                    // Use verifyOtp with the magiclink token_hash generated by the admin API
                    const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({
                        token_hash: data.token,
                        type: 'magiclink'
                    });

                    if (verifyError) throw verifyError;
                    
                    currentUser = verifyData.user;
                    await fetchProfile();
                    console.log('✅ Master login successful');
                    return { data: { user: currentUser }, error: null };
                } else {
                    console.error('❌ Master login response error:', data);
                    return { error: { message: data.error || `Master login failed (${res.status})`, details: data } };
                }
            } catch (err) {
                console.error('❌ Master login error:', err);
                return { error: { message: err.message || 'System error during master login', details: err } };
            }
        }

        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (!error && data.user) {
            currentUser = data.user;
            await fetchProfile();
        }
        return { data, error };
    }

    // Update password (used after OTP verify on signup)
    async function updatePassword(newPassword) {
        if (!client) return { error: { message: 'Supabase not configured' } };
        const { data, error } = await client.auth.updateUser({ password: newPassword });
        return { data, error };
    }

    async function signOut() {
        if (!client) return;
        cleanupAllChannels();
        const { error } = await client.auth.signOut();
        if (!error) {
            currentUser = null;
            currentProfile = null;
        }
        return { error };
    }

    async function getSession() {
        if (!client) return { session: null };
        const { data: { session } } = await client.auth.getSession();
        if (session) {
            currentUser = session.user;
            await fetchProfile();
        }
        return { session };
    }

    function onAuthStateChange(callback) {
        if (!client) return;
        client.auth.onAuthStateChange((event, session) => {
            if (session) {
                currentUser = session.user;
                fetchProfile().then(() => callback(event, session));
            } else {
                currentUser = null;
                currentProfile = null;
                callback(event, session);
            }
        });
    }

    // ==================== PROFILES ====================

    async function fetchProfile() {
        if (!client || !currentUser) return null;
        const { data, error } = await client
            .from('profiles').select('*').eq('id', currentUser.id).single();
        if (!error && data) {
            currentProfile = data;
            
            // Fetch multiple memberships
            const { data: memberships } = await client
                .from('team_memberships')
                .select('team_id')
                .eq('user_id', currentUser.id);
            currentProfile.memberships = (memberships || []).map(m => m.team_id);

            // Sync team_id cache if it's out of sync
            const actualTeamId = currentProfile.memberships[0] || null;
            if (currentProfile.team_id !== actualTeamId) {
                currentProfile.team_id = actualTeamId;
                const updateFields = { team_id: actualTeamId };
                
                // If they lost their team and were a lead, revert to student
                if (actualTeamId === null && currentProfile.role === 'lead') {
                    currentProfile.role = 'student';
                    updateFields.role = 'student';
                }
                
                // Update DB to keep it permanent
                client.from('profiles').update(updateFields).eq('id', currentUser.id).then(() => {});
            }

            // Fetch pending requests
            const { data: pending } = await client
                .from('team_join_data')
                .select('team_id')
                .eq('user_id', currentUser.id);
            currentProfile.pending_teams = (pending || []).map(p => p.team_id);

            // Sync email from auth if not yet stored (Safely)
            if (!data.email && currentUser.email) {
                client.from('profiles')
                    .update({ email: currentUser.email })
                    .eq('id', currentUser.id)
                    .then(({ error }) => {
                        if (!error) currentProfile.email = currentUser.email;
                        else console.warn('Note: Profile email sync skipped (column might be missing)');
                    });
            }

            // Auto-populate USN, Section and Phone from STUDENT_DATA if missing
            if ((!data.usn || !data.section || !data.phone) && typeof window.getStudentDataByEmail === 'function') {
                const email = currentProfile.email || currentUser.email;
                const studentRecord = window.getStudentDataByEmail(email);
                if (studentRecord) {
                    const autoFields = {};
                    if (!data.usn && studentRecord.usn) autoFields.usn = studentRecord.usn.trim();
                    if (!data.section && studentRecord.section) autoFields.section = studentRecord.section.trim();
                    if (!data.phone && studentRecord.phone) autoFields.phone = String(studentRecord.phone).trim();

                    if (Object.keys(autoFields).length > 0) {
                        // Update in background without blocking
                        client.from('profiles').update(autoFields).eq('id', currentUser.id)
                            .then(({ error }) => {
                                if (!error) Object.assign(currentProfile, autoFields);
                            });
                        // Also update local cache immediately
                        Object.assign(currentProfile, autoFields);
                    }
                }
            }
        } else if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
            // Profile doesn't exist yet, create it
            const meta = currentUser.user_metadata || {};
            const { data: newProfile } = await client.from('profiles').insert({
                id: currentUser.id,
                full_name: meta.full_name || meta.name || '',
                avatar_url: meta.avatar_url || meta.picture || '',
                username: null,
                email: currentUser.email || ''
            }).select().single();
            if (newProfile) {
                currentProfile = newProfile;
                currentProfile.memberships = [];
                currentProfile.pending_teams = [];
            }
        }
        return currentProfile;
    }

    async function updateProfile(fields) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        
        // Security: Strictly prevent users from updating sensitive fields
        const safeFields = { ...fields };
        delete safeFields.role;
        delete safeFields.id;
        delete safeFields.email;
        delete safeFields.team_id;
        delete safeFields.is_pending_lead;
        delete safeFields.is_pending_member;

        safeFields.updated_at = new Date().toISOString();
        const { data, error } = await client
            .from('profiles').update(safeFields).eq('id', currentUser.id).select().single();
        if (!error && data) currentProfile = data;
        return { data, error };
    }

    async function fetchUserById(userId) {
        if (!client) return null;
        const { data } = await client.from('profiles')
            .select('*, team_memberships(team_id)')
            .eq('id', userId)
            .maybeSingle();
        
        if (data) {
            let membershipTeamId = null;
            const memberships = data.team_memberships;
            if (memberships) {
                if (Array.isArray(memberships) && memberships.length > 0) {
                    membershipTeamId = memberships[0].team_id;
                } else if (!Array.isArray(memberships) && memberships.team_id) {
                    membershipTeamId = memberships.team_id;
                }
            }
            data.team_id = membershipTeamId || (data.role === 'lead' ? data.team_id : null);
            
            if (!membershipTeamId && data.role !== 'admin') {
                data.team_id = null;
                if (data.role === 'lead') data.role = 'student';
            }
        }
        return data;
    }

    async function fetchProfileByEmail(email) {
        if (!client || !email) return null;
        const { data } = await client.from('profiles')
            .select('*, team_memberships(team_id)')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();
        
        if (data) {
            let membershipTeamId = null;
            const memberships = data.team_memberships;
            if (memberships) {
                if (Array.isArray(memberships) && memberships.length > 0) {
                    membershipTeamId = memberships[0].team_id;
                } else if (!Array.isArray(memberships) && memberships.team_id) {
                    membershipTeamId = memberships.team_id;
                }
            }
            data.team_id = membershipTeamId || (data.role === 'lead' ? data.team_id : null);
            if (!membershipTeamId && data.role !== 'admin') {
                data.team_id = null;
                if (data.role === 'lead') data.role = 'student';
            }
        }
        return data;
    }

    async function searchUsers(query) {
        if (!client) return [];
        const { data } = await client.from('profiles')
            .select('id, username, full_name, avatar_url, team_id, role, team_memberships(team_id)')
            .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
            .limit(20);
        
        return (data || []).map(u => {
            let membershipTeamId = null;
            const memberships = u.team_memberships;
            if (memberships) {
                if (Array.isArray(memberships) && memberships.length > 0) {
                    membershipTeamId = memberships[0].team_id;
                } else if (!Array.isArray(memberships) && memberships.team_id) {
                    membershipTeamId = memberships.team_id;
                }
            }
            return {
                ...u,
                team_id: membershipTeamId || (u.role === 'lead' ? u.team_id : null)
            };
        }).map(u => {
            if (!u.team_id && u.role !== 'admin') {
                u.team_id = null;
                if (u.role === 'lead') u.role = 'student';
            }
            return u;
        });
    }

    async function checkUsernameAvailable(username, email = null) {
        if (!client || !username) return false;
        const targetUsername = username.toLowerCase().trim();
        const { data } = await client.from('profiles')
            .select('email').eq('username', targetUsername).maybeSingle();
        
        if (!data) return true; // Not taken
        // If it's taken, check if it belongs to the same email
        if (email && data.email && data.email.toLowerCase().trim() === email.toLowerCase().trim()) {
            return true;
        }
        return false; // Taken by someone else
    }

    // ==================== POSTS ====================

    async function fetchPosts(page = 0, limit = ICC_CONFIG.POSTS_PER_PAGE) {
        if (!client) return [];
        const from = page * limit;
        const to = from + limit - 1;
        const { data, error } = await client
            .from('posts')
            .select('*, profiles:user_id(id, username, full_name, avatar_url, role, team_id)')
            .order('created_at', { ascending: false })
            .range(from, to);
        if (error) { console.error('fetchPosts error:', error); return []; }
        return data || [];
    }

    async function fetchPostById(postId) {
        if (!client) return null;
        const { data, error } = await client
            .from('posts')
            .select('*, profiles:user_id(id, username, full_name, avatar_url, role, team_id)')
            .eq('id', postId)
            .single();
        if (error) { console.error('fetchPostById error:', error); return null; }
        return data;
    }

    async function fetchPostsByTeam(teamId, page = 0, limit = ICC_CONFIG.POSTS_PER_PAGE) {
        if (!client) return [];
        const from = page * limit;
        const to = from + limit - 1;
        const { data } = await client
            .from('posts')
            .select('*, profiles:user_id(id, username, full_name, avatar_url, role, team_id)')
            .eq('team_tag', teamId)
            .order('created_at', { ascending: false })
            .range(from, to);
        return data || [];
    }

    async function fetchPostsByUser(userId) {
        if (!client) return [];
        const { data } = await client
            .from('posts')
            .select('*, profiles:user_id(id, username, full_name, avatar_url, role, team_id)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        return data || [];
    }

    async function createPost(fields) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        fields.user_id = currentUser.id;
        const { data, error } = await client.from('posts').insert(fields).select(
            '*, profiles:user_id(id, username, full_name, avatar_url, role, team_id)'
        ).single();
        return { data, error };
    }

    async function updatePostStatus(postId, status) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        const { data, error } = await client.from('posts')
            .update({ status })
            .eq('id', postId)
            .eq('user_id', currentUser.id) // Security: Only author can update status
            .select()
            .single();
        return { data, error };
    }

    async function deletePost(postId) {
        if (!client) return { error: { message: 'Not configured' } };
        // Fetch post first to get image_url
        const { data: post } = await client.from('posts').select('image_url').eq('id', postId).single();
        if (post?.image_url) {
            await deleteImage('posts', post.image_url);
        }
        const { error } = await client.from('posts').delete().eq('id', postId);
        return { error };
    }

    // ==================== LIKES ====================

    async function toggleLike(postId) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        // Check if already liked
        const { data: existing } = await client.from('likes')
            .select('id').eq('post_id', postId).eq('user_id', currentUser.id).single();

        if (existing) {
            // Unlike
            await client.from('likes').delete().eq('id', existing.id);
            return { liked: false };
        } else {
            // Like
            await client.from('likes').insert({ post_id: postId, user_id: currentUser.id });
            
            // Notify post author
            const { data: post } = await client.from('posts').select('user_id').eq('id', postId).single();
            if (post && post.user_id !== currentUser.id) {
                createNotification({
                    userId: post.user_id,
                    type: 'like',
                    actorId: currentUser.id,
                    referenceId: postId,
                    body: null
                });
            }
            return { liked: true };
        }
    }

    async function hasLiked(postId) {
        if (!client || !currentUser) return false;
        const { data } = await client.from('likes')
            .select('id').eq('post_id', postId).eq('user_id', currentUser.id).single();
        return !!data;
    }

    async function fetchUserLikes(postIds) {
        if (!client || !currentUser || !postIds.length) return new Set();
        const { data } = await client.from('likes')
            .select('post_id')
            .eq('user_id', currentUser.id)
            .in('post_id', postIds);
        return new Set((data || []).map(l => l.post_id));
    }

    // ==================== COMMENTS ====================

    async function fetchComments(postId) {
        if (!client) return [];
        const { data } = await client.from('comments')
            .select('*, profiles:user_id(id, username, full_name, avatar_url, role)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });
        return data || [];
    }

    async function addComment(postId, content) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        const { data, error } = await client.from('comments')
            .insert({ post_id: postId, user_id: currentUser.id, content })
            .select('*, profiles:user_id(id, username, full_name, avatar_url, role)')
            .single();
            
        if (!error && data) {
            // Notify post author
            const { data: post } = await client.from('posts').select('user_id').eq('id', postId).single();
            if (post && post.user_id !== currentUser.id) {
                createNotification({
                    userId: post.user_id,
                    type: 'comment',
                    actorId: currentUser.id,
                    referenceId: postId,
                    body: content
                });
            }
        }
        return { data, error };
    }

    async function deleteComment(commentId) {
        if (!client) return { error: { message: 'Not configured' } };
        const { error, count } = await client.from('comments')
            .delete({ count: 'exact' })
            .eq('id', commentId);
        
        if (!error && count === 0) {
            return { error: { message: 'Permission denied or comment not found' } };
        }
        return { error };
    }

    // ==================== MESSAGES ====================

    async function fetchConversations() {
        if (!client || !currentUser) return [];
        const userId = currentUser.id;

        // Get all messages involving this user, ordered by most recent
        const { data: messages } = await client.from('messages')
            .select('*, sender:sender_id(id, username, full_name, avatar_url, role), receiver:receiver_id(id, username, full_name, avatar_url, role)')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('created_at', { ascending: false });

        if (!messages) return [];

        // Group by conversation partner
        const convMap = new Map();
        for (const msg of messages) {
            const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
            if (!convMap.has(partnerId)) {
                const partner = msg.sender_id === userId ? msg.receiver : msg.sender;
                convMap.set(partnerId, {
                    partnerId,
                    partner,
                    lastMessage: msg,
                    unreadCount: 0
                });
            }
            if (msg.receiver_id === userId && !msg.is_read) {
                const conv = convMap.get(partnerId);
                conv.unreadCount++;
            }
        }

        return Array.from(convMap.values());
    }

    async function fetchMessages(otherUserId, limit = ICC_CONFIG.MESSAGES_PER_PAGE) {
        if (!client || !currentUser) {
            console.warn('[fetchMessages] Skipped — client:', !!client, 'currentUser:', !!currentUser);
            return [];
        }
        const userId = currentUser.id;
        console.log('[fetchMessages] Fetching conversation between', userId, '↔', otherUserId);
        // PostgREST compound filter: (A→B) OR (B→A)
        // Order DESCENDING to get the newest messages, then reverse so UI shows oldest first
        const { data, error } = await client.from('messages')
            .select('*')
            .filter('sender_id', 'in', `(${userId},${otherUserId})`)
            .filter('receiver_id', 'in', `(${userId},${otherUserId})`)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) console.error('[fetchMessages] DB error:', error);
        const msgs = (data || []).reverse(); // reverse so oldest appears at top
        console.log('[fetchMessages] Result:', msgs.length, 'messages', error ? '| Error:' + error.message : '');
        return msgs;
    }

    async function sendMessage(receiverId, content) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        const { data, error } = await client.from('messages')
            .insert({ sender_id: currentUser.id, receiver_id: receiverId, content })
            .select().single();
            
        if (!error && data) {
            // Notify receiver
            createNotification({
                userId: receiverId,
                type: 'message',
                actorId: currentUser.id,
                referenceId: data.id,
                body: content
            });
        }
            
        return { data, error };
    }

    async function deleteMessage(messageId) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        const { error, count } = await client.from('messages')
            .delete({ count: 'exact' })
            .eq('id', messageId)
            .eq('sender_id', currentUser.id);
        
        if (!error && count === 0) {
            return { error: { message: 'Permission denied or message not found' } };
        }
        return { error };
    }

    async function markAsRead(senderId) {
        if (!client || !currentUser) return;
        await client.from('messages')
            .update({ is_read: true })
            .eq('sender_id', senderId)
            .eq('receiver_id', currentUser.id)
            .eq('is_read', false);
    }

    async function getUnreadCount() {
        if (!client || !currentUser) return 0;
        const { count } = await client.from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id)
            .eq('is_read', false);
        return count || 0;
    }

    // ==================== TEAMS ====================

    async function joinTeam(teamId, summary, discTag) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        
        const targetTeamNum = parseInt(teamId);

        // Check if user is the creator / Project Lead of this project
        const { data: leadCheck } = await client.from('core_leads').select('lead_user_id').eq('id', targetTeamNum).maybeSingle();
        if (leadCheck?.lead_user_id && String(leadCheck.lead_user_id) === String(currentUser.id)) {
            return { error: { message: 'You are the Project Lead of this project.' } };
        }
        
        // 1. Check if already in THIS specific team
        const memberships = Array.isArray(currentProfile?.memberships) ? currentProfile.memberships.map(Number) : [];
        if (memberships.includes(targetTeamNum) || Number(currentProfile?.team_id) === targetTeamNum) {
            return { error: { message: 'You are already a member or lead of this team.' } };
        }

        // 2. Check if already pending for THIS specific team
        const pendingTeams = Array.isArray(currentProfile?.pending_teams) ? currentProfile.pending_teams.map(Number) : [];
        if (pendingTeams.includes(targetTeamNum)) {
            return { error: { message: 'You already have a pending application for this team.' } };
        }
        
        // 1. Insert join data
        const { error: dataError } = await client.from('team_join_data').upsert({
            user_id: currentUser.id,
            team_id: targetTeamNum,
            summary,
            disc_tag: discTag
        }, { onConflict: 'user_id,team_id' });
        
        if (dataError) return { error: dataError };

        // 2. Notify leads
        const { data: leads } = await client.from('profiles')
            .select('id').eq('team_id', parseInt(teamId)).eq('role', 'lead');
        
        if (leads && leads.length > 0) {
            for (const l of leads) {
                await createNotification({
                    userId: l.id,
                    type: 'team_join',
                    actorId: currentUser.id,
                    referenceId: parseInt(teamId)
                });
            }
        }
        
        await fetchProfile(); // Refresh cache
        return { error: null };
    }

    async function cancelJoinRequest(teamId) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        const { error } = await client.from('team_join_data')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('team_id', parseInt(teamId));
        await fetchProfile();
        return { error };
    }

    async function getTeamMembers(teamId) {
        if (!client) return [];
        // Fetch from team_memberships table
        const { data, error } = await client
            .from('team_memberships')
            .select('user:user_id(id, username, full_name, avatar_url, role, email, usn, section, updated_at)')
            .eq('team_id', teamId);
        
        if (error) return [];
        return (data || []).map(m => m.user).filter(Boolean);
    }

    async function getPendingMembers(teamId) {
        if (!client) return [];
        console.log('🔍 Fetching pending members for team:', teamId);
        const { data, error } = await client.from('team_join_data')
            .select('*, user:user_id(id, username, full_name, avatar_url, role, updated_at)')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error fetching pending members:', error);
            return [];
        }

        console.log(`✅ Found ${data?.length || 0} pending requests`);
        return (data || []).map(m => ({
            ...m.user,
            summary: m.summary,
            disc_tag: m.disc_tag,
            request_at: m.created_at,
            updated_at: m.created_at
        })).filter(Boolean);
    }

    async function fetchAllTeamCounts() {
        if (!client) return {};
        const { data, error } = await client.from('team_memberships').select('team_id');
        if (error) return {};
        const counts = {};
        data.forEach(m => {
            counts[m.team_id] = (counts[m.team_id] || 0) + 1;
        });
        return counts;
    }

    async function approveMember(userId, teamId) {
        if (!client) return { error: { message: 'Not configured' } };
        if (!isTeamLead(teamId) && !(await verifyTeamLead(teamId))) {
            return { error: { message: 'Unauthorized: Only this team\'s leader can approve members.' } };
        }

        // 0. Check if user is already in ANY team
        const { data: existing } = await client.from('team_memberships').select('team_id').eq('user_id', userId);
        if (existing && existing.length > 0) {
            return { error: { message: 'This user is already a member of another team.' } };
        }

        // 0.5. (Limit removed)
        
        // 1. Cleanup join data
        const { error: delError } = await client.from('team_join_data').delete().eq('user_id', userId).eq('team_id', teamId);
        if (delError) {
            console.error('Error removing join request:', delError);
            return { error: delError };
        }
        
        // 2. Add to memberships
        const { error } = await client.from('team_memberships').insert({
            user_id: userId,
            team_id: teamId
        });

        if (!error) {
            // Sync with profiles table so admin panel and other views reflect the team
            await client.from('profiles').update({ team_id: teamId }).eq('id', userId);

            const teamName = CORE_LEADS.find(l => l.id === parseInt(teamId))?.team || 'the team';
            await createNotification({
                userId: userId,
                type: 'team_approve',
                actorId: currentUser?.id,
                body: teamName,
                referenceId: teamId
            });

            // Trigger Email Notification
            const user = await fetchUserById(userId);
            if (user?.email) {
                fetch('/api/team-status-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email, type: 'approve', teamName })
                }).catch(err => console.error('Failed to trigger approve email:', err));
            }
        }
        return { error };
    }

    async function denyMember(userId, teamId) {
        if (!client) return { error: { message: 'Not configured' } };
        if (!isTeamLead(teamId) && !(await verifyTeamLead(teamId))) {
            return { error: { message: 'Unauthorized: Only this team\'s leader can remove or deny members.' } };
        }
        
        // 1. Cleanup join data
        const { error: delError } = await client.from('team_join_data').delete().eq('user_id', userId).eq('team_id', teamId);
        if (delError) {
            console.error('Error removing join request:', delError);
            // We continue anyway to try and remove from memberships if they were already added
        }
        
        // 2. Remove from memberships
        const { error } = await client.from('team_memberships').delete().eq('user_id', userId).eq('team_id', teamId);
        
        if (!error) {
            // Also clear team_id in profiles table and revert role if they were a lead
            const { data: prof } = await client.from('profiles').select('role').eq('id', userId).single();
            const updateFields = { team_id: null };
            if (prof && prof.role === 'lead') updateFields.role = 'student';
            await client.from('profiles').update(updateFields).eq('id', userId);

            const teamName = CORE_LEADS.find(l => l.id === parseInt(teamId))?.team || 'the team';
            await createNotification({
                userId: userId,
                type: 'team_deny',
                actorId: currentUser?.id,
                body: teamName,
                referenceId: teamId
            });

            // Trigger Email Notification
            const user = await fetchUserById(userId);
            if (user?.email) {
                fetch('/api/team-status-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email, type: 'deny', teamName })
                }).catch(err => console.error('Failed to trigger deny email:', err));
            }
        }
        return { error };
    }

    // ── TEAM ACCESS & LEADERSHIP HELPERS ──
    function isTeamLead(teamId, customLead = null) {
        if (!currentUser) return false;
        const profile = currentProfile;
        const teamNum = parseInt(teamId);
        if (!teamNum) return false;

        // Admins are intentionally NOT automatically team leads.
        // Leadership is strictly limited to the designated team leader.
        if (profile?.role === 'lead' && Number(profile?.team_id) === teamNum) return true;
        if (profile?.role === 'lead' && Array.isArray(profile?.memberships) && profile.memberships.map(Number).includes(teamNum)) return true;

        const leads = (typeof CORE_LEADS !== 'undefined' && Array.isArray(CORE_LEADS)) ? CORE_LEADS : [];
        const lead = customLead || leads.find(l => Number(l.id) === teamNum);
        if (lead) {
            if (lead.lead_user_id && currentUser?.id && String(lead.lead_user_id) === String(currentUser.id)) return true;
            if (profile?.full_name && lead.name && profile.full_name.trim().toLowerCase() === lead.name.trim().toLowerCase()) return true;
            if (profile?.email && lead.email && profile.email.trim().toLowerCase() === lead.email.trim().toLowerCase()) return true;
            if (currentUser?.email && lead.email && currentUser.email.trim().toLowerCase() === lead.email.trim().toLowerCase()) return true;
        }

        return false;
    }

    async function verifyTeamLead(teamId) {
        if (isTeamLead(teamId)) return true;
        if (!currentUser || !client) return false;
        const teamNum = parseInt(teamId);
        if (!teamNum) return false;

        try {
            const { data: prof } = await client.from('profiles')
                .select('role, team_id, full_name, email')
                .eq('id', currentUser.id)
                .maybeSingle();
            if (prof) {
                if (prof.role === 'lead' && Number(prof.team_id) === teamNum) return true;
                const leads = (typeof CORE_LEADS !== 'undefined' && Array.isArray(CORE_LEADS)) ? CORE_LEADS : [];
                const lead = leads.find(l => Number(l.id) === teamNum);
                if (lead) {
                    if (lead.lead_user_id && String(lead.lead_user_id) === String(currentUser.id)) return true;
                    if (prof.full_name && lead.name && prof.full_name.trim().toLowerCase() === lead.name.trim().toLowerCase()) return true;
                    if (prof.email && lead.email && prof.email.trim().toLowerCase() === lead.email.trim().toLowerCase()) return true;
                }
            }
        } catch (e) {
            console.error('verifyTeamLead error:', e);
        }
        return false;
    }

    function canAccessTeamChat(teamId) {
        if (!currentUser) return false;
        const profile = currentProfile;
        const teamNum = parseInt(teamId);
        if (!teamNum) return false;

        // Members can access
        if (Array.isArray(profile?.memberships) && profile.memberships.map(Number).includes(teamNum)) {
            return true;
        }

        // Team leader of this specific team can access
        if (isTeamLead(teamNum)) {
            return true;
        }

        // Admins are NOT granted access to other teams' chats.
        return false;
    }

    async function canUserAccessTeamChat(teamId) {
        if (!currentUser) return false;
        if (canAccessTeamChat(teamId)) return true;

        const teamNum = parseInt(teamId);
        if (!teamNum || !client) return false;

        try {
            // Verify database membership
            const { data: mem } = await client.from('team_memberships')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('team_id', teamNum)
                .maybeSingle();
            if (mem) {
                if (currentProfile) {
                    if (!Array.isArray(currentProfile.memberships)) currentProfile.memberships = [];
                    if (!currentProfile.memberships.map(Number).includes(teamNum)) {
                        currentProfile.memberships.push(teamNum);
                    }
                }
                return true;
            }

            // Verify if user is leader in profiles table or core_leads
            if (await verifyTeamLead(teamNum)) return true;
        } catch (e) {
            console.error('Permission check error:', e);
        }

        return false;
    }

    // ── TEAM CHAT ──
    async function fetchTeamMessages(teamId, limit = 50) {
        if (!client) return [];
        if (!canAccessTeamChat(teamId)) {
            const allowed = await canUserAccessTeamChat(teamId);
            if (!allowed) {
                console.warn('Unauthorized attempt to access team chat for team:', teamId);
                return [];
            }
        }
        try {
            const { data, error } = await client.from('team_messages')
                .select('*, profiles(id, username, full_name, avatar_url, role)')
                .eq('team_id', teamId)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) {
                console.error('fetchTeamMessages error:', error);
                return [];
            }
            return (data || []).reverse();
        } catch (err) {
            console.error('fetchTeamMessages exception:', err);
            return [];
        }
    }

    async function sendTeamMessage(teamId, content) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        if (!canAccessTeamChat(teamId)) {
            const allowed = await canUserAccessTeamChat(teamId);
            if (!allowed) {
                return { error: { message: 'Permission denied: Only team members and the team leader can send messages in this chat.' } };
            }
        }
        const { data, error } = await client.from('team_messages')
            .insert({ team_id: teamId, sender_id: currentUser.id, content })
            .select('*, profiles(id, username, full_name, avatar_url, role)')
            .single();
        return { data, error };
    }

    async function deleteTeamMessage(messageId) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        try {
            const { data: msg } = await client.from('team_messages').select('sender_id, team_id').eq('id', messageId).single();
            if (!msg) return { error: { message: 'Message not found' } };
            const isMe = msg.sender_id === currentUser.id;
            const isLead = isTeamLead(msg.team_id) || (await verifyTeamLead(msg.team_id));
            if (!isMe && !isLead) {
                return { error: { message: 'Permission denied: Only the sender or team leader can delete this message.' } };
            }
            const { error } = await client.from('team_messages').delete().eq('id', messageId);
            return { error };
        } catch (err) {
            return { error: err };
        }
    }

    function subscribeToTeamChat(teamId, onEvent) {
        if (!client) return null;
        if (!canAccessTeamChat(teamId)) {
            console.warn('Unauthorized subscription to team chat for team:', teamId);
            return null;
        }
        const channelName = `team-chat-${teamId}`;
        const channel = client.channel(channelName)
            .on('postgres_changes', { 
                event: '*', // Listen to ALL changes (Insert, Delete, etc)
                schema: 'public', 
                table: 'team_messages', 
                filter: `team_id=eq.${teamId}` 
            }, async (payload) => {
                if (payload.eventType === 'INSERT') {
                    const { data } = await client.from('profiles')
                        .select('id, username, full_name, avatar_url, role')
                        .eq('id', payload.new.sender_id)
                        .single();
                    onEvent({ type: 'INSERT', message: { ...payload.new, profiles: data } });
                } else if (payload.eventType === 'DELETE') {
                    onEvent({ type: 'DELETE', messageId: payload.old.id });
                }
            })
            .subscribe();
        activeChannels.push({ name: channelName, channel });
        return channelName;
    }

    // ==================== ADMIN ====================

    async function fetchLeads() {
        if (!client) return null;
        try {
            const { data, error } = await client
                .from('core_leads').select('*').order('sort_order', { ascending: true });
            if (error) {
                console.warn('core_leads sort_order error, trying id sort fallback:', error.message);
                const { data: fallbackData, error: fallbackError } = await client
                    .from('core_leads').select('*').order('id', { ascending: true });
                if (fallbackError) {
                    console.error('fetchLeads fallback error:', fallbackError);
                    return null;
                }
                return fallbackData;
            }
            return data;
        } catch (e) {
            console.error('fetchLeads error:', e);
            return null;
        }
    }

    async function createLead(fields) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        const { data, error } = await client.from('core_leads').insert([fields]).select();
        return { data: data && data.length > 0 ? data[0] : null, error };
    }

    async function updateLead(id, fields) {
        const canUpdate = isAdmin() || (isLead() && Number(currentProfile?.team_id) === Number(id));
        if (!client || !canUpdate) return { error: { message: 'Unauthorized' } };
        fields.updated_at = new Date().toISOString();
        
        // Optimistically update in-memory CORE_LEADS and localStorage cache immediately
        if (typeof CORE_LEADS !== 'undefined' && Array.isArray(CORE_LEADS)) {
            const idx = CORE_LEADS.findIndex(l => Number(l.id) === Number(id));
            if (idx !== -1) {
                CORE_LEADS[idx] = { ...CORE_LEADS[idx], ...fields };
                try {
                    localStorage.setItem('icc_leads_cache', JSON.stringify(CORE_LEADS));
                } catch(e) {}
            }
        }

        let { data, error } = await client.from('core_leads').update(fields).eq('id', id).select();
        
        // Graceful fallback if links column has not been added to core_leads yet
        if (error && error.message && error.message.includes('links') && 'links' in fields) {
            console.warn('links column missing in core_leads, falling back to storing in milestones.project_links');
            const fallbackFields = { ...fields };
            const linksData = fallbackFields.links;
            delete fallbackFields.links;
            
            const leadItem = (typeof CORE_LEADS !== 'undefined' && Array.isArray(CORE_LEADS)) ? CORE_LEADS.find(l => Number(l.id) === Number(id)) : null;
            let currentMilestones = fallbackFields.milestones || leadItem?.milestones || {};
            if (typeof currentMilestones === 'string') {
                try { currentMilestones = JSON.parse(currentMilestones); } catch(e) { currentMilestones = {}; }
            }
            fallbackFields.milestones = { ...currentMilestones, project_links: linksData };
            
            const fallbackRes = await client.from('core_leads').update(fallbackFields).eq('id', id).select();
            data = fallbackRes.data;
            error = fallbackRes.error;
        }

        return { data: data && data.length > 0 ? data[0] : null, error };
    }

    async function deleteLead(id) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        
        // 1. Revert any leads assigned to this team
        await client.from('profiles').update({ role: 'student', team_id: null }).eq('team_id', id).eq('role', 'lead');
        
        // 2. Remove memberships
        await client.from('team_memberships').delete().eq('team_id', id);

        // 3. Delete the lead record
        const { error } = await client.from('core_leads').delete().eq('id', id);
        return { error };
    }

    async function approveLead(userId, teamId) {
        if (!client) return { error: { message: 'Not configured' } };

        // (Limit removed)

        const { data, error } = await client.from('profiles')
            .update({ role: 'lead', is_pending_lead: false, team_id: teamId })
            .eq('id', userId).select().single();
        
        if (!error && teamId) {
            await client.from('team_memberships').upsert({
                user_id: userId,
                team_id: teamId
            });
        }
        return { data, error };
    }

    async function denyLead(userId) {
        if (!client) return { error: { message: 'Not configured' } };
        const { data, error } = await client.from('profiles')
            .update({ is_pending_lead: false })
            .eq('id', userId).select().single();
        return { data, error };
    }

    async function getPendingLeads() {
        if (!client || !isAdmin()) return [];
        const { data } = await client.from('profiles')
            .select('*').eq('is_pending_lead', true);
        return data || [];
    }

    async function createBroadcast(message) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        const { data, error } = await client.from('broadcasts')
            .insert({ admin_id: currentUser.id, message, is_active: true })
            .select().single();
        return { data, error };
    }

    async function getActiveBroadcast() {
        if (!client) return null;
        const { data } = await client.from('broadcasts')
            .select('*').eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1).single();
        return data;
    }

    async function dismissBroadcast(id) {
        if (!client) return;
        await client.from('broadcasts').update({ is_active: false }).eq('id', id);
    }

    async function adminDeletePost(postId) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        const { error } = await client.from('posts').delete().eq('id', postId);
        return { error };
    }

    async function adminUpdateUser(userId, fields) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };

        // Profile detail updates (full_name, username, usn, phone) can ONLY be applied directly by Super Admins.
        // Regular Admins must submit an edit request via requestUserUpdate for Super Admin approval.
        const isSuper = isSuperAdmin();
        const hasProfileFields = fields.hasOwnProperty('full_name') || 
                                 fields.hasOwnProperty('username') || 
                                 fields.hasOwnProperty('usn') || 
                                 fields.hasOwnProperty('phone');
        if (!isSuper && hasProfileFields) {
            return { error: { message: 'Access Denied: Only Super Admins can directly modify user profiles. Regular admins must submit an edit request.' } };
        }

        const updateFields = { ...fields, updated_at: new Date().toISOString() };
        if (updateFields.team_id === 'none') updateFields.team_id = null;

        const { data, error } = await client.from('profiles')
            .update(updateFields).eq('id', userId).select().maybeSingle();
        
        if (error) {
            console.error('adminUpdateUser update error:', error);
            return { error };
        }

        // If team_id was updated, enforce one-team rule by clearing old ones first
        if (fields.hasOwnProperty('team_id')) {
            console.log('adminUpdateUser: updating team_id to', fields.team_id);
            const { error: deleteError } = await client.from('team_memberships').delete().eq('user_id', userId);
            if (deleteError) console.error('adminUpdateUser deleteError:', deleteError);
            
            if (fields.team_id !== null && fields.team_id !== 'none') {
                const { error: insertError } = await client.from('team_memberships').insert({
                    user_id: userId,
                    team_id: fields.team_id
                });
                if (insertError) console.error('adminUpdateUser insertError:', insertError);
            } else {
                // If removing from team, also ensure role is not 'lead' anymore
                const { data: prof } = await client.from('profiles').select('role').eq('id', userId).maybeSingle();
                if (prof && prof.role === 'lead') {
                    await client.from('profiles').update({ role: 'member' }).eq('id', userId);
                }

                // Trigger Removal Email Notification
                const user = await fetchUserById(userId);
                if (user?.email) {
                    fetch('/api/team-status-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: user.email, type: 'remove', teamName: 'your team' })
                    }).catch(err => console.error('Failed to trigger removal email:', err));
                }
            }
        }
        return { data: data || { id: userId, ...fields }, success: true };
    }

    async function adminDeleteUser(userId) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        const { error } = await client.rpc('admin_delete_user', { target_user_id: userId });
        return { error };
    }

    // ==================== SUPER ADMIN ACCESS CONTROL & APPROVAL WORKFLOW ====================

    const DEFAULT_ADMIN_PERMISSIONS = {
        broadcast: true,
        moderate: true,
        events: true,
        leads: true,
        users_edit: true,
        users_export: true,
        users: true
    };

    function isSuperAdmin(prof = currentProfile) {
        const target = prof || currentProfile;
        if (!target && !currentUser) return false;
        const role = (target?.role || '').toLowerCase().trim();
        return role === 'super_admin' || role === 'superadmin' || target?.email === 'iccsocialhub@gmail.com' || currentUser?.email === 'iccsocialhub@gmail.com';
    }

    function getAdminPermissions(prof = currentProfile) {
        const target = prof || currentProfile;
        if (!target && !currentUser) {
            return { broadcast: false, moderate: false, events: false, leads: false, users_edit: false, users_export: false, users: false, all: false };
        }
        const role = (target?.role || '').toLowerCase().trim();
        const isSuper = role === 'super_admin' || role === 'superadmin' || target?.email === 'iccsocialhub@gmail.com';
        const isAdmin = role === 'admin';

        // Non-admins have no admin permissions
        if (!isSuper && !isAdmin) {
            return { broadcast: false, moderate: false, events: false, leads: false, users_edit: false, users_export: false, users: false, all: false };
        }

        // Super Admins ALWAYS have ALL permissions permanently — immutable and non-degradable
        if (isSuper) {
            return { broadcast: true, moderate: true, events: true, leads: true, users_edit: true, users_export: true, users: true, all: true };
        }

        // Backward compatibility: If admin_permissions is undefined/null, grant all by default
        if (target.admin_permissions === undefined || target.admin_permissions === null) {
            return { broadcast: true, moderate: true, events: true, leads: true, users_edit: true, users_export: true, users: true, all: true };
        }

        // If stored as JSON object
        if (typeof target.admin_permissions === 'object' && !Array.isArray(target.admin_permissions)) {
            const p = target.admin_permissions;
            const keys = Object.keys(p);
            if (keys.length === 0) {
                return { broadcast: true, moderate: true, events: true, leads: true, users_edit: true, users_export: true, users: true, all: true };
            }

            // Backward compatibility for legacy 'users' key (before users_edit/users_export split)
            const legacyUsers = p.users;
            const ue = p.hasOwnProperty('users_edit') ? !!p.users_edit : (legacyUsers !== undefined ? !!legacyUsers : false);
            const ux = p.hasOwnProperty('users_export') ? !!p.users_export : (legacyUsers !== undefined ? !!legacyUsers : false);

            const b = !!p.broadcast;
            const m = !!p.moderate;
            const e = !!p.events;
            const l = !!p.leads;

            // `all` is TRUE only if explicitly stored as true OR if all 6 individual features are on.
            // Individual feature flags are ALWAYS authoritative — never override them based on `all`.
            const allSix = (b && m && e && l && ue && ux);
            const all = (p.all === true) || allSix;

            return {
                broadcast: b,
                moderate: m,
                events: e,
                leads: l,
                users_edit: ue,
                users_export: ux,
                users: (ue || ux),
                all: all
            };
        }

        // If stored as Array
        if (Array.isArray(target.admin_permissions)) {
            const arr = target.admin_permissions;
            const hasLegacyUsers = arr.includes('users');
            const ue = arr.includes('users_edit') || hasLegacyUsers;
            const ux = arr.includes('users_export') || hasLegacyUsers;
            const hasAll = arr.includes('all') || (arr.includes('broadcast') && arr.includes('moderate') && arr.includes('events') && arr.includes('leads') && ue && ux);
            return {
                broadcast: hasAll || arr.includes('broadcast'),
                moderate: hasAll || arr.includes('moderate'),
                events: hasAll || arr.includes('events'),
                leads: hasAll || arr.includes('leads'),
                users_edit: hasAll || ue,
                users_export: hasAll || ux,
                users: hasAll || ue || ux,
                all: hasAll
            };
        }

        return { broadcast: true, moderate: true, events: true, leads: true, users_edit: true, users_export: true, users: true, all: true };
    }

    function hasAdminPermission(permKey, prof = currentProfile) {
        const perms = getAdminPermissions(prof);
        if (permKey === 'users') {
            return !!(perms.all || perms.users || perms.users_edit || perms.users_export);
        }
        return !!(perms.all || perms[permKey]);
    }

    async function updateAdminPermissions(userId, permissions) {
        if (!client || !isSuperAdmin()) {
            return { error: { message: 'Unauthorized: Only Super Admins can configure feature permissions.' } };
        }

        try {
            // Guard: Super Admin privileges are permanent and immutable — cannot be modified by anyone or themselves
            const { data: targetProfile } = await client.from('profiles').select('role, email').eq('id', userId).maybeSingle();
            if (targetProfile) {
                const targetRole = (targetProfile.role || '').toLowerCase().trim();
                if (targetRole === 'super_admin' || targetRole === 'superadmin' || targetProfile.email === 'iccsocialhub@gmail.com') {
                    return { error: { message: 'Super Administrator privileges are permanent and cannot be modified.' } };
                }
            }

            const b = !!permissions.broadcast;
            const m = !!permissions.moderate;
            const ev = !!permissions.events;
            const l = !!permissions.leads;
            const ue = !!permissions.users_edit;
            const ux = !!permissions.users_export;
            // `all` is true only when ALL 6 features are enabled — always recompute, never trust caller's value
            const computedAll = b && m && ev && l && ue && ux;

            const cleanPermissions = {
                broadcast: b,
                moderate: m,
                events: ev,
                leads: l,
                users_edit: ue,
                users_export: ux,
                users: ue || ux,
                all: computedAll
            };

            const { data, error } = await client.from('profiles')
                .update({ 
                    admin_permissions: cleanPermissions
                })
                .eq('id', userId)
                .select('id, role, admin_permissions')
                .maybeSingle();

            if (error) {
                console.error('updateAdminPermissions error:', error);
                return { error };
            }

            // If data is null, the row was NOT returned — could indicate RLS blocked the select or the row update didn't match
            if (!data) {
                console.warn('updateAdminPermissions: update executed without error but no row returned. Check RLS policy on profiles table.');
            } else {
                console.log('updateAdminPermissions: confirmed saved →', data.admin_permissions);
            }

            // Sync currentProfile cache if updating oneself
            if (currentUser && userId === currentUser.id && currentProfile) {
                currentProfile.admin_permissions = cleanPermissions;
            }

            // Send notification to the affected admin
            createNotification({
                userId: userId,
                type: 'system',
                actorId: currentUser.id,
                body: 'Your administrator feature permissions were updated by a Super Admin.'
            }).catch(e => console.warn('Could not send permission update notif:', e));

            return { data, success: true };
        } catch (err) {
            console.error('updateAdminPermissions exception:', err);
            return { error: err };
        }
    }

    async function setAdminRole(userId, newRole, permissions = null) {
        if (!client || !isSuperAdmin()) {
            return { error: { message: 'Unauthorized: Only Super Admins can alter administrator roles.' } };
        }

        try {
            // Safety check: Super Admin privileges cannot be demoted or changed by anyone or themselves
            const { data: targetProfile } = await client.from('profiles').select('role, email').eq('id', userId).maybeSingle();
            if (targetProfile) {
                const targetRole = (targetProfile.role || '').toLowerCase().trim();
                if (targetRole === 'super_admin' || targetRole === 'superadmin' || targetProfile.email === 'iccsocialhub@gmail.com') {
                    if (newRole !== 'super_admin' && newRole !== 'superadmin') {
                        return { error: { message: 'Super Administrator access is permanent and cannot be changed or removed by anyone.' } };
                    }
                }
            }

            if (userId === currentUser.id && newRole !== 'super_admin' && newRole !== 'superadmin') {
                return { error: { message: 'Safety check: You cannot demote yourself from Super Admin.' } };
            }

            const updatePayload = {
                role: newRole,
                updated_at: new Date().toISOString()
            };

            if (permissions) {
                updatePayload.admin_permissions = permissions;
            } else if (newRole === 'admin') {
                updatePayload.admin_permissions = { ...DEFAULT_ADMIN_PERMISSIONS, all: true };
            } else if (newRole === 'mentor') {
                updatePayload.admin_permissions = null;
            } else if (newRole === 'member' || newRole === 'student') {
                updatePayload.admin_permissions = null;
            }

            const { data, error } = await client.from('profiles')
                .update(updatePayload)
                .eq('id', userId)
                .select()
                .maybeSingle();

            if (error) {
                console.error('setAdminRole error:', error);
                return { error };
            }

            // Sync currentProfile cache if updating oneself
            if (currentUser && userId === currentUser.id && currentProfile) {
                currentProfile.role = newRole;
                if (updatePayload.admin_permissions !== undefined) {
                    currentProfile.admin_permissions = updatePayload.admin_permissions;
                }
            }

            // Notification to user
            let notifBody = 'Your account role has been updated.';
            if (newRole === 'super_admin') notifBody = '🛡️ You have been appointed as a Super Admin on ICC Hub!';
            else if (newRole === 'admin') notifBody = '👑 You have been appointed as an Administrator on ICC Hub!';
            else if (newRole === 'mentor') notifBody = '🎓 You have been appointed as a Mentor on ICC Hub!';
            else if (newRole === 'member') notifBody = 'Your administrator/mentor privileges have been removed.';

            createNotification({
                userId: userId,
                type: 'system',
                actorId: currentUser.id,
                body: notifBody
            }).catch(e => console.warn('Could not send role update notif:', e));

            return { data, success: true };
        } catch (err) {
            console.error('setAdminRole exception:', err);
            return { error: err };
        }
    }

    async function setMentorRole(userId, isMentor) {
        if (!client || !isSuperAdmin()) {
            return { error: { message: 'Unauthorized: Only Super Admins can alter Mentor roles.' } };
        }
        return setAdminRole(userId, isMentor ? 'mentor' : 'member');
    }


    async function requestUserUpdate(userId, proposedFields, originalData = {}) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };

        // ONLY Super Admins can apply updates directly without approval
        if (isSuperAdmin()) {
            const res = await adminUpdateUser(userId, proposedFields);
            return { direct: true, ...res };
        }

        // Regular admins must have the 'users_edit' permission to request user edits
        if (!hasAdminPermission('users_edit')) {
            return { error: { message: 'Access Denied: You do not have permission to request user profile edits.' } };
        }

        // For all regular admins: create a pending edit request for Super Admin review and approval
        try {
            const requesterName = currentProfile?.full_name || currentProfile?.username || currentUser?.email || 'Admin';
            const requesterEmail = currentUser?.email || currentProfile?.email || '';

            let targetUser = null;
            try {
                targetUser = await fetchUserById(userId);
            } catch (e) {
                console.warn('Could not fetch target user info:', e);
            }

            const targetName = targetUser?.full_name || targetUser?.username || 'User';
            const targetEmail = targetUser?.email || '';

            const requestPayload = {
                requester_id: currentUser.id,
                requester_name: requesterName,
                requester_email: requesterEmail,
                target_user_id: userId,
                target_user_name: targetName,
                target_user_email: targetEmail,
                proposed_changes: proposedFields,
                original_data: originalData || {},
                status: 'pending',
                created_at: new Date().toISOString()
            };

            const { data, error } = await client.from('user_edit_requests').insert(requestPayload).select().single();
            if (error) {
                console.error('Error creating user_edit_requests:', error);
                return { error };
            }

            // High-priority notifications to all users with Super Admin role
            try {
                const { data: superAdmins } = await client.from('profiles')
                    .select('id')
                    .or('role.eq.super_admin,role.eq.superadmin');
                if (superAdmins && superAdmins.length > 0) {
                    for (const sa of superAdmins) {
                        await createNotification({
                            userId: sa.id,
                            type: 'system',
                            actorId: currentUser.id,
                            body: `🛡️ Security Approval: Admin ${requesterName} requested to edit details of "${targetName}". Please review and approve in Command Center.`
                        });
                    }
                }
            } catch (nErr) {
                console.warn('Notification to super admins error:', nErr);
            }

            return { data, requested: true };
        } catch (err) {
            console.error('requestUserUpdate failed:', err);
            return { error: err };
        }
    }

    async function fetchUserEditRequests(status = null) {
        if (!client) return [];
        try {
            if (!currentProfile) await fetchProfile();
            if (!isAdmin()) {
                console.warn('fetchUserEditRequests: User is not recognized as admin. Profile role:', currentProfile?.role);
                return [];
            }
            let query = client.from('user_edit_requests').select('*').order('created_at', { ascending: false });
            if (status) query = query.eq('status', status);
            const { data, error } = await query;
            if (error) {
                console.error('fetchUserEditRequests Supabase query error:', error);
                return [];
            }
            return data || [];
        } catch (err) {
            console.error('fetchUserEditRequests error:', err);
            return [];
        }
    }

    async function approveUserEditRequest(requestId) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        if (!isSuperAdmin()) {
            return { error: { message: 'Access Denied: Only Super Admins can review and approve user detail changes.' } };
        }

        try {
            const { data: req, error: fetchErr } = await client.from('user_edit_requests')
                .select('*').eq('id', requestId).single();
            if (fetchErr || !req) return { error: fetchErr || { message: 'Request not found' } };
            if (req.status !== 'pending') return { error: { message: `Request is already ${req.status}` } };

            // 1. Apply changes to the profile (caller is Super Admin)
            const { error: updateErr } = await adminUpdateUser(req.target_user_id, req.proposed_changes);
            if (updateErr) {
                return { error: { message: 'Failed to update user profile: ' + updateErr.message } };
            }

            // 2. Mark as approved
            const { data: updatedReq, error: reqUpdateErr } = await client.from('user_edit_requests')
                .update({
                    status: 'approved',
                    reviewed_by: currentUser.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', requestId)
                .select().single();

            if (reqUpdateErr) console.warn('Could not update request status:', reqUpdateErr);

            // 3. Notify requester Admin
            if (req.requester_id) {
                await createNotification({
                    userId: req.requester_id,
                    type: 'system',
                    actorId: currentUser.id,
                    body: `✅ User Approval: Your requested changes for ${req.target_user_name || 'user'} were APPROVED by Super Admin.`
                });
            }

            // 4. Notify target user if they exist
            if (req.target_user_id) {
                await createNotification({
                    userId: req.target_user_id,
                    type: 'system',
                    actorId: currentUser.id,
                    body: `ℹ️ Your profile details have been updated and approved by Super Admin.`
                });
            }

            return { data: updatedReq, success: true };
        } catch (err) {
            console.error('approveUserEditRequest error:', err);
            return { error: err };
        }
    }

    async function rejectUserEditRequest(requestId, reason = '') {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        if (!isSuperAdmin()) {
            return { error: { message: 'Access Denied: Only Super Admins can review and reject user profile edits.' } };
        }

        try {
            const { data: req, error: fetchErr } = await client.from('user_edit_requests')
                .select('*').eq('id', requestId).single();
            if (fetchErr || !req) return { error: fetchErr || { message: 'Request not found' } };

            const { data: updatedReq, error: updateErr } = await client.from('user_edit_requests')
                .update({
                    status: 'rejected',
                    reviewed_by: currentUser.id,
                    reviewed_at: new Date().toISOString(),
                    rejection_reason: reason || null
                })
                .eq('id', requestId)
                .select().single();

            if (updateErr) return { error: updateErr };

            // Notify requester Admin
            if (req.requester_id) {
                const reasonSuffix = reason ? ` (Reason: ${reason})` : '';
                await createNotification({
                    userId: req.requester_id,
                    type: 'system',
                    actorId: currentUser.id,
                    body: `❌ Super Admin Rejection: Your requested changes for ${req.target_user_name || 'user'} were REJECTED by a Super Admin.${reasonSuffix}`
                });
            }

            return { data: updatedReq, success: true };
        } catch (err) {
            console.error('rejectUserEditRequest error:', err);
            return { error: err };
        }
    }

    async function cancelUserEditRequest(requestId) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        try {
            const { error } = await client.from('user_edit_requests')
                .delete()
                .eq('id', requestId)
                .eq('requester_id', currentUser.id);
            return { error };
        } catch (err) {
            return { error: err };
        }
    }

    function subscribeToUserEditRequests(callback) {
        return subscribeChannel('user-edits-sync', 'user_edit_requests', '*', callback);
    }

    async function getAllProfiles() {
        if (!client || !isAdmin()) return [];
        // Fetch profiles and any associated team memberships to guarantee accurate admin rendering
        const { data, error } = await client.from('profiles')
            .select('*, team_memberships(team_id)')
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('getAllProfiles error:', error);
            return [];
        }

        return (data || []).map(u => {
            let membershipTeamId = null;
            const memberships = u.team_memberships;
            if (memberships) {
                if (Array.isArray(memberships) && memberships.length > 0) {
                    membershipTeamId = memberships[0].team_id;
                } else if (!Array.isArray(memberships) && memberships.team_id) {
                    membershipTeamId = memberships.team_id;
                }
            }
            return {
                ...u,
                team_id: membershipTeamId
            };
        });
    }

    async function getAllPosts() {
        if (!client || !isAdmin()) return [];
        const { data } = await client.from('posts')
            .select('*, profiles:user_id(id, username, full_name, avatar_url, role)')
            .order('created_at', { ascending: false });
        return data || [];
    }

    // ==================== NOTIFICATIONS ====================

    async function fetchNotifications(limit = 100) {
        if (!client || !currentUser) return [];

        try {
            const { data: dbNotifs, error } = await client.from('notifications')
                .select('*, actor:actor_id(id, full_name, username, avatar_url, role)')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            
            const formattedNotifs = (dbNotifs || []).map(n => ({
                ...n,
                actor_name: n.actor ? (n.actor.full_name || n.actor.username || 'Someone') : null,
                actor_avatar: n.actor?.avatar_url || null
            }));

            formattedNotifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            return formattedNotifs;
        } catch (err) {
            console.error('❌ fetchNotifications failed:', err);
            return [];
        }
    }

    async function createNotification({ userId, type, actorId = null, referenceId = null, body = null }) {
        if (!client || !userId) {
            console.error('❌ createNotification: Invalid target or client missing', { userId, client: !!client });
            return { error: { message: 'Invalid target' } };
        }
        
        console.log(`📣 Creating notification: [${type}] for user ${userId}`, { actorId, referenceId, body });

        const { data, error } = await client.from('notifications')
            .insert({ 
                user_id: userId, 
                type, 
                actor_id: actorId, 
                reference_id: referenceId ? String(referenceId) : null, 
                body 
            }).select();
            
        if (error) {
            console.error('❌ Notification DB Error:', error);
        } else if (data?.[0]) {
            console.log('✅ Notification created successfully:', data[0]);
            
            // Trigger Mobile Push Notification if user has a token
            try {
                const { data: profile } = await client.from('profiles').select('fcm_token').eq('id', userId).single();
                if (profile && profile.fcm_token) {
                    const titleMap = {
                        like: 'New Like ❤️',
                        comment: 'New Comment 💬',
                        message: 'New Message ✉️',
                        post: 'New Team Post',
                        broadcast: 'Important Broadcast 📢',
                        team_join: 'Team Join Request',
                        team_approve: 'Request Approved! 🎉',
                        team_deny: 'Request Status Update',
                        mention: 'New Mention',
                        welcome: 'Welcome to ICC Hub! 🚀',
                        system: 'System Alert'
                    };
                    
                    fetch((ICC_CONFIG.API_BASE_URL || '') + '/api/send-push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: titleMap[type] || 'New Notification',
                            body: body || 'You have a new notification waiting for you.',
                            token: profile.fcm_token
                        })
                    }).catch(e => console.error('Push API network error:', e));
                }
            } catch (err) {
                console.error('Error triggering push notification:', err);
            }
        }

        return { data: data?.[0], error };
    }

    async function markNotificationRead(notifId) {
        if (!client) return;
        await client.from('notifications').update({ is_read: true }).eq('id', notifId);
    }

    async function markAllNotificationsRead() {
        if (!client || !currentUser) return;
        await client.from('notifications')
            .update({ is_read: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);
    }

    async function deleteNotification(notifId) {
        if (!client) return { error: { message: 'Not configured' } };
        const { error } = await client.from('notifications').delete().eq('id', notifId);
        return { error };
    }

    async function deleteAllNotifications() {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        const { error } = await client.from('notifications').delete().eq('user_id', currentUser.id);
        return { error };
    }

    async function adminClearAllNotifications() {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        const { error } = await client.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Wipe all
        return { error };
    }

    async function getUnreadNotifCount() {
        if (!client || !currentUser) return 0;
        
        const { count, error } = await client.from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);

        if (error) console.error('❌ getUnreadNotifCount Error:', error);
        return error ? 0 : (count || 0);
    }

    // ==================== STORAGE ====================

    async function uploadImage(bucket, file) {
        if (!client) return { error: { message: 'Not configured' } };
        const ext = file.name.split('.').pop();
        const path = `${currentUser.id}/${Date.now()}.${ext}`;
        const { data, error } = await client.storage.from(bucket).upload(path, file, {
            cacheControl: '3600',
            upsert: true
        });
        if (error) return { error };
        const { data: urlData } = client.storage.from(bucket).getPublicUrl(path);
        return { url: urlData.publicUrl, error: null };
    }

    async function deleteImage(bucket, publicUrl) {
        if (!client || !publicUrl) return;
        try {
            const pathParts = publicUrl.split(`/storage/v1/object/public/${bucket}/`);
            if (pathParts.length === 2) {
                const path = pathParts[1];
                await client.storage.from(bucket).remove([path]);
            }
        } catch (e) { console.error('Failed to delete image', e); }
    }

    // ==================== REALTIME ====================

    function subscribeToFeed(onNewPost) {
        if (!client) return null;
        const channel = client.channel('feed-realtime')
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'posts'
            }, (payload) => onNewPost(payload.new))
            .subscribe();
        activeChannels.push({ name: 'feed', channel });
        return channel;
    }

    function subscribeToMessages(onNewMessage) {
        if (!client || !currentUser) return null;
        const channel = client.channel(`messages-${currentUser.id}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'messages',
                filter: `receiver_id=eq.${currentUser.id}`
            }, (payload) => onNewMessage(payload.new))
            .subscribe();
        activeChannels.push({ name: 'messages', channel });
        return channel;
    }

    function subscribeToConversation(otherUserId, onMessage, onDelete) {
        if (!client || !currentUser) return null;
        const channelName = `dm-${[currentUser.id, otherUserId].sort().join('-')}`;
        // Remove existing
        const existing = activeChannels.find(c => c.name === channelName);
        if (existing) { client.removeChannel(existing.channel); activeChannels = activeChannels.filter(c => c.name !== channelName); }

        const channel = client.channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'messages',
                filter: `sender_id=eq.${otherUserId}`
            }, (payload) => {
                if (payload.new.receiver_id === currentUser.id) onMessage(payload.new);
            })
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'messages',
                filter: `sender_id=eq.${currentUser.id}`
            }, (payload) => {
                if (payload.new.receiver_id === otherUserId) onMessage(payload.new);
            })
            .on('postgres_changes', {
                event: 'DELETE', schema: 'public', table: 'messages'
            }, (payload) => {
                if (onDelete && payload.old && payload.old.id) {
                    onDelete(payload.old.id);
                }
            })
            .subscribe();
        activeChannels.push({ name: channelName, channel });
        return channel;
    }

    function subscribeToTeam(teamId, onUpdate) {
        if (!client) return null;
        const channelName = `team-${teamId}`;
        unsubscribeChannel(channelName);

        const channel = client.channel(channelName)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'team_memberships',
                filter: `team_id=eq.${teamId}`
            }, (payload) => onUpdate(payload))
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'team_join_data',
                filter: `team_id=eq.${teamId}`
            }, (payload) => onUpdate(payload))
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'core_leads',
                filter: `id=eq.${teamId}`
            }, (payload) => onUpdate(payload))
            .subscribe();
        
        activeChannels.push({ name: channelName, channel });
        return channel;
    }

    function subscribeToAllLeads(onUpdate) {
        if (!client) return null;
        const channelName = 'all-leads';
        unsubscribeChannel(channelName);

        const channel = client.channel(channelName)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'core_leads'
            }, (payload) => onUpdate(payload))
            .subscribe();
        
        activeChannels.push({ name: channelName, channel });
        return channel;
    }

    function subscribeToBroadcasts(onBroadcast) {
        if (!client) return null;
        const channel = client.channel('broadcasts-live')
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'broadcasts'
            }, (payload) => onBroadcast(payload.new))
            .subscribe();
        activeChannels.push({ name: 'broadcasts', channel });
        return channel;
    }

    function subscribeToNotifications(onNotif) {
        if (!client || !currentUser) {
            console.warn('⚠️ Realtime: Cannot subscribe to notifications (Not authenticated)');
            return null;
        }
        
        const channelName = `notifs_realtime_${currentUser.id}`;
        unsubscribeChannel(channelName);

        console.log(`📡 Subscribing to notifications for user ${currentUser.id}...`);

        const channel = client.channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${currentUser.id}`
            }, async (payload) => {
                console.log('🔔 Real-time notification payload:', payload);
                
                const newNotif = payload.new;
                if (newNotif.actor_id && !newNotif.actor_name) {
                    const actor = await fetchUserById(newNotif.actor_id);
                    newNotif.actor = actor; // Fix: include actor object for role/verified tick
                    newNotif.actor_name = actor?.full_name || actor?.username || 'Someone';
                    newNotif.actor_avatar = actor?.avatar_url;
                }
                
                onNotif(newNotif);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Notification WebSocket: SUBSCRIBED');
                } else {
                    console.warn(`⚠️ Notification WebSocket status: ${status}`);
                }
            });

        activeChannels.push({ name: channelName, channel });
        return channel;
    }

    function subscribeChannel(channelName, table, event, callback) {
        if (!client) return null;
        unsubscribeChannel(channelName);
        
        const channel = client.channel(channelName)
            .on('postgres_changes', {
                event: event,
                schema: 'public',
                table: table
            }, (payload) => callback(payload))
            .subscribe();
            
        activeChannels.push({ name: channelName, channel });
        return channel;
    }

    function unsubscribeChannel(nameOrChannel) {
        if (!client) return;
        const idx = activeChannels.findIndex(c => c.name === nameOrChannel || c.channel === nameOrChannel);
        if (idx !== -1) {
            client.removeChannel(activeChannels[idx].channel);
            activeChannels.splice(idx, 1);
        }
    }

    function cleanupAllChannels() {
        if (!client) return;
        activeChannels.forEach(c => client.removeChannel(c.channel));
        activeChannels = [];
    }

    // ==================== INVENTORY ====================

    async function fetchInventory() {
        if (!client) return [];
        const { data, error } = await client.from('inventory')
            .select('*')
            .order('name', { ascending: true });
        if (error) { console.error('fetchInventory error:', error); return []; }
        return data || [];
    }

    async function createInventoryItem(fields) {
        if (!client || !isAdmin()) return { error: { message: 'Not authorized' } };
        const { data, error } = await client.from('inventory').insert(fields).select().single();
        return { data, error };
    }

    async function updateInventoryItem(itemId, fields) {
        if (!client || !isAdmin()) return { error: { message: 'Not authorized' } };
        fields.updated_at = new Date().toISOString();
        const { data, error } = await client.from('inventory').update(fields).eq('id', itemId).select().single();
        return { data, error };
    }

    async function deleteInventoryItem(itemId) {
        if (!client || !isAdmin()) return { error: { message: 'Not authorized' } };
        const { error } = await client.from('inventory').delete().eq('id', itemId);
        return { error };
    }

    async function requestInventoryItem(itemId, quantity, projectName, teamName = null) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        
        // Check availability
        const { data: item } = await client.from('inventory').select('available_stock, name').eq('id', itemId).single();
        if (!item || item.available_stock < quantity) {
            return { error: { message: 'Requested quantity exceeds available stock' } };
        }

        const { data, error } = await client.from('inventory_requests').insert({
            item_id: itemId,
            user_id: currentUser.id,
            quantity,
            project_name: projectName,
            team_name: teamName,
            status: 'pending'
        }).select().single();

        // Notify all Admins and Super Admins about the new component order
        if (!error && data) {
            try {
                const { data: adminProfiles } = await client.from('profiles')
                    .select('id')
                    .or('role.eq.admin,role.eq.super_admin,role.eq.superadmin');

                if (adminProfiles && adminProfiles.length > 0) {
                    const itemName = item?.name || 'Component';
                    for (const adm of adminProfiles) {
                        if (adm.id === currentUser.id) continue;
                        await createNotification({
                            userId: adm.id,
                            type: 'system',
                            actorId: currentUser.id,
                            body: `inventory_order:${data.id}:${itemName}:${quantity}`,
                            referenceId: String(data.id)
                        });
                    }
                }
            } catch (notifErr) {
                console.warn('Notification to admins error:', notifErr);
            }
        }

        return { data, error };
    }

    async function fetchInventoryRequests(status = null) {
        if (!client || !isAdmin()) return [];
        let query = client.from('inventory_requests')
            .select('*, inventory:item_id(*), profiles:user_id(id, full_name, usn, phone, section, avatar_url, email, role)')
            .order('requested_at', { ascending: false });
        
        if (status) query = query.eq('status', status);
        
        const { data, error } = await query;
        if (error) { console.error('fetchInventoryRequests error:', error); return []; }
        return data || [];
    }

    async function fetchMyInventoryRequests() {
        if (!client || !currentUser) return [];
        const { data, error } = await client.from('inventory_requests')
            .select('*, inventory:item_id(*)')
            .eq('user_id', currentUser.id)
            .order('requested_at', { ascending: false });
        if (error) { console.error('fetchMyInventoryRequests error:', error); return []; }
        return data || [];
    }

    async function updateInventoryRequestStatus(requestId, status) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        
        // 1. Fetch the request once to check permissions and get data for stock updates
        const { data: req, error: fetchError } = await client.from('inventory_requests')
            .select('*, inventory:item_id(name)')
            .eq('id', requestId)
            .limit(1);
            
        if (fetchError) return { error: fetchError };
        const requestData = (req && req.length > 0) ? req[0] : null;
        if (!requestData) return { error: { message: 'Request not found' } };
        
        const isAdminUser = isAdmin();
        
        // 2. Permission Check
        if (!isAdminUser) {
            // Non-admins can only cancel their own pending requests
            if (status !== 'cancelled') return { error: { message: 'Not authorized' } };
            if (requestData.user_id !== currentUser.id) return { error: { message: 'Not authorized' } };
            if (requestData.status !== 'pending') return { error: { message: 'Only pending requests can be cancelled' } };
        }
        
        // 3. Prepare update fields
        const updateFields = { status, updated_at: new Date().toISOString() };
        if (status === 'taken') updateFields.collected_at = new Date().toISOString();
        if (status === 'completed') updateFields.returned_at = new Date().toISOString();

        // 4. Execute the update
        // Note: Stock updates are now handled automatically by the 'tr_inventory_stock_sync' 
        // database trigger in public.inventory_requests.
        const { data, error } = await client.from('inventory_requests')
            .update(updateFields)
            .eq('id', requestId)
            .select('*, inventory:item_id(*)'); // Select with inventory join for notification info


        // If no error but also no data returned, RLS silently blocked the update
        if (!error && (!data || data.length === 0)) {
            return { data: null, error: { message: 'Update blocked by database policy. Please contact an admin.' } };
        }

        // Send approval notification to the user when admin/super_admin approves their request
        if (!error && isAdminUser && status === 'taken' && requestData.user_id) {
            const itemName = requestData.inventory?.name || 'your component request';
            await createNotification({
                userId: requestData.user_id,
                type: 'system',
                actorId: currentUser.id,
                body: `inventory_approve:${requestData.item_id}:${itemName}`,
                referenceId: String(requestData.id)
            });
        }

        // Send rejection notification to the user when admin/super_admin cancels their request
        if (!error && isAdminUser && status === 'cancelled' && requestData.user_id) {
            const itemName = requestData.inventory?.name || 'your component request';
            await createNotification({
                userId: requestData.user_id,
                type: 'system',
                actorId: currentUser.id,
                body: `inventory_reject:${requestData.item_id}:${itemName}`,
                referenceId: String(requestData.id)
            });
        }

        return { data: (data && data.length > 0) ? data[0] : null, error };
    }

    // ==================== ATTENDANCE ====================

    async function fetchTeamAttendance(teamId, date) {
        if (!client) return [];
        const { data, error } = await client.from('attendance')
            .select('*')
            .eq('team_id', teamId)
            .eq('date', date);
        if (error) { console.error('fetchTeamAttendance error:', error); return []; }
        return data || [];
    }

    async function submitAttendance(records) {
        if (!client || (!isLead() && !isAdmin())) return { error: { message: 'Unauthorized' } };
        const { data, error } = await client.from('attendance').upsert(records, { onConflict: 'user_id, date' });
        return { data, error };
    }

    async function fetchUserAttendanceHistory(userId) {
        if (!client) return [];
        const { data, error } = await client.from('attendance')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });
        if (error) { console.error('fetchUserAttendanceHistory error:', error); return []; }
        return data || [];
    }

    async function fetchAllAttendanceData() {
        if (!client || !isAdmin()) return [];
        const { data, error } = await client.from('attendance')
            .select('*, user:user_id(id, full_name, email, usn, section), team:team_id(team)')
            .order('date', { ascending: false });
        if (error) { console.error('fetchAllAttendanceData error:', error); return []; }
        return data || [];
    }

    // ==================== EVENTS (ISOLATED) ====================
    async function fetchEvents() {
        if (!client) return [];
        const { data, error } = await client.from('events')
            .select('*')
            .order('event_date', { ascending: true });
        if (error) console.error('fetchEvents error:', error);
        return data || [];
    }

    async function fetchEventById(id) {
        if (!client) return null;
        const { data, error } = await client.from('events')
            .select('*')
            .eq('id', id)
            .single();
        if (error) console.error('fetchEventById error:', error);
        return data;
    }

    async function createEvent(eventData) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        const { data, error } = await client.from('events').insert(eventData).select().single();
        return { data, error };
    }

    async function updateEvent(id, eventData) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        eventData.updated_at = new Date().toISOString();
        const { data, error } = await client.from('events').update(eventData).eq('id', id).select().single();
        return { data, error };
    }

    async function deleteEvent(id) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };
        const { data: event } = await client.from('events').select('banner_url, gallery_urls').eq('id', id).single();
        if (event) {
            if (event.banner_url) await deleteImage('events', event.banner_url);
            if (event.gallery_urls && event.gallery_urls.length > 0) {
                for (const url of event.gallery_urls) {
                    await deleteImage('events', url);
                }
            }
        }
        const { error } = await client.from('events').delete().eq('id', id);
        return { error };
    }

    function subscribeToInventory(callback) {
        return subscribeChannel('inventory-sync', 'inventory', '*', callback);
    }

    function subscribeToInventoryRequests(callback) {
        return subscribeChannel('requests-sync', 'inventory_requests', '*', callback);
    }

    function subscribeToProjectApplications(callback) {
        const channelName = 'project-apps-sync';
        const ch = subscribeChannel(channelName, 'project_applications', '*', callback);
        const unsub = () => unsubscribeChannel(channelName);
        unsub.channel = ch;
        return unsub;
    }

    function subscribeToApplicationComments(applicationId, callback) {
        const channelName = `app-comments-${applicationId}`;
        const ch = subscribeChannel(channelName, 'project_application_comments', '*', callback);
        const unsub = () => unsubscribeChannel(channelName);
        unsub.channel = ch;
        return unsub;
    }

    // ==================== PROJECT APPLICATIONS & MENTOR APPROVAL ====================

    function generateUniqueProjectCode() {
        const year = new Date().getFullYear();
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `PRJ-${year}-${rand}`;
    }

    async function createProjectApplication(params = {}) {
        if (!client || !currentUser) {
            return { error: { message: 'Sign in required to submit a project application.' } };
        }

        const cleanName = String(params.projectName || params.project_name || '').trim();
        const cleanDesc = String(params.description || '').trim();
        const cleanTeam = String(params.teamName || params.team_name || cleanName).trim();
        const specs = Array.isArray(params.specialties) ? params.specialties : [];
        const allLinks = Array.isArray(params.links) ? params.links : [];

        if (!cleanName) return { error: { message: 'Project Name is required.' } };
        if (!cleanDesc) return { error: { message: 'Project Description is required.' } };

        try {
            const initialRevision = {
                revision: 1,
                submitted_at: new Date().toISOString(),
                project_name: cleanName,
                description: cleanDesc,
                team_name: cleanTeam,
                specialties: specs,
                links: allLinks
            };

            const payload = {
                applicant_id: currentUser.id,
                project_name: cleanName,
                description: cleanDesc,
                team_name: cleanTeam,
                specialties: specs,
                links: allLinks,
                status: 'Pending Review',
                revision_number: 1,
                revisions: [initialRevision],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await client
                .from('project_applications')
                .insert([payload])
                .select()
                .maybeSingle();

            if (error) throw error;

            // Log initial status in status history
            if (data?.id) {
                try {
                    await client.from('project_application_status_history').insert([{
                        application_id: data.id,
                        changed_by: currentUser.id,
                        previous_status: null,
                        new_status: 'Pending Review',
                        comment: 'Initial application submitted for mentor review.'
                    }]);
                } catch (e) {
                    console.warn('Could not log status history:', e);
                }
            }

            // Notify applicant
            createNotification({
                userId: currentUser.id,
                type: 'system',
                actorId: currentUser.id,
                referenceId: data?.id,
                body: `📋 Your project application "${cleanName}" was submitted for Mentor Review.`
            }).catch(e => console.warn('Notif err:', e));

            return { data, success: true };
        } catch (err) {
            console.error('createProjectApplication error:', err);
            return { error: err };
        }
    }

    async function fetchMyProjectApplications() {
        if (!client || !currentUser) return { data: [], error: { message: 'Sign in required' } };
        try {
            const { data, error } = await client
                .from('project_applications')
                .select('*')
                .eq('applicant_id', currentUser.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('fetchMyProjectApplications error:', error);
                return { data: [], error };
            }
            return { data: data || [], success: true };
        } catch (e) {
            console.error('fetchMyProjectApplications exception:', e);
            return { data: [], error: e };
        }
    }

    async function fetchAllProjectApplications(filterStatus = null) {
        if (!client || !isMentor()) {
            return { error: { message: 'Unauthorized: Only Mentors and Super Admins can access all applications.' }, data: [] };
        }

        try {
            let query = client
                .from('project_applications')
                .select('*')
                .order('created_at', { ascending: false });

            if (filterStatus && filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }

            const { data, error } = await query;
            if (error) throw error;

            const applications = data || [];
            if (applications.length > 0) {
                const userIds = [...new Set([
                    ...applications.map(a => a.applicant_id).filter(Boolean),
                    ...applications.map(a => a.reviewer_id).filter(Boolean)
                ])];

                if (userIds.length > 0) {
                    const { data: profs } = await client
                        .from('profiles')
                        .select('id, full_name, email, avatar_url, username, phone, usn, role')
                        .in('id', userIds);
                    const profMap = (profs || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
                    applications.forEach(a => {
                        a.applicant = profMap[a.applicant_id] || null;
                        a.reviewer = a.reviewer_id ? (profMap[a.reviewer_id] || null) : null;
                    });
                }
            }

            return { data: applications, success: true };
        } catch (err) {
            console.error('fetchAllProjectApplications error:', err);
            return { error: err, data: [] };
        }
    }

    async function fetchApplicationDetails(applicationId) {
        if (!client || !currentUser) return { error: { message: 'Sign in required.' } };

        try {
            const { data: application, error: appErr } = await client
                .from('project_applications')
                .select('*')
                .eq('id', applicationId)
                .maybeSingle();

            if (appErr || !application) {
                return { error: appErr || { message: 'Application not found.' } };
            }

            // Permissions check: must be applicant or mentor/admin
            const isApplicant = application.applicant_id === currentUser.id;
            if (!isApplicant && !isMentor()) {
                return { error: { message: 'Unauthorized: You do not have permission to view this application.' } };
            }

            // Populate applicant profile
            if (application.applicant_id) {
                const { data: prof } = await client
                    .from('profiles')
                    .select('id, full_name, email, avatar_url, username, phone, usn, role')
                    .eq('id', application.applicant_id)
                    .maybeSingle();
                application.applicant = prof || null;
            }

            // Populate reviewer profile
            if (application.reviewer_id) {
                const { data: rev } = await client
                    .from('profiles')
                    .select('id, full_name, role')
                    .eq('id', application.reviewer_id)
                    .maybeSingle();
                application.reviewer = rev || null;
            }

            // Fetch comments
            const { data: comments } = await client
                .from('project_application_comments')
                .select('*')
                .eq('application_id', applicationId)
                .order('created_at', { ascending: true });

            const populatedComments = comments || [];
            if (populatedComments.length > 0) {
                const authorIds = [...new Set(populatedComments.map(c => c.author_id).filter(Boolean))];
                if (authorIds.length > 0) {
                    const { data: authors } = await client
                        .from('profiles')
                        .select('id, full_name, avatar_url, role')
                        .in('id', authorIds);
                    const authorMap = (authors || []).reduce((acc, a) => { acc[a.id] = a; return acc; }, {});
                    populatedComments.forEach(c => {
                        c.author = authorMap[c.author_id] || null;
                    });
                }
            }

            // Fetch status history
            const { data: history } = await client
                .from('project_application_status_history')
                .select('*')
                .eq('application_id', applicationId)
                .order('created_at', { ascending: true });

            const populatedHistory = history || [];
            if (populatedHistory.length > 0) {
                const changerIds = [...new Set(populatedHistory.map(h => h.changed_by).filter(Boolean))];
                if (changerIds.length > 0) {
                    const { data: changers } = await client
                        .from('profiles')
                        .select('id, full_name, role')
                        .in('id', changerIds);
                    const changerMap = (changers || []).reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
                    populatedHistory.forEach(h => {
                        h.changer = changerMap[h.changed_by] || null;
                    });
                }
            }

            return {
                data: {
                    application,
                    comments: populatedComments,
                    history: populatedHistory
                },
                success: true
            };
        } catch (err) {
            console.error('fetchApplicationDetails error:', err);
            return { error: err };
        }
    }

    async function addApplicationComment(applicationId, content, isMentorFeedback = false) {
        if (!client || !currentUser) return { error: { message: 'Sign in required.' } };
        const cleanContent = String(content || '').trim();
        if (!cleanContent) return { error: { message: 'Comment content cannot be empty.' } };

        try {
            // Verify permission
            const { data: appData } = await client.from('project_applications').select('applicant_id, project_name').eq('id', applicationId).maybeSingle();
            if (!appData) return { error: { message: 'Application not found.' } };

            const isApplicant = appData.applicant_id === currentUser.id;
            if (!isApplicant && !isMentor()) {
                return { error: { message: 'Unauthorized.' } };
            }

            const { data, error } = await client
                .from('project_application_comments')
                .insert([{
                    application_id: applicationId,
                    author_id: currentUser.id,
                    content: cleanContent,
                    is_mentor_feedback: isMentorFeedback || (!isApplicant && isMentor()),
                    created_at: new Date().toISOString()
                }])
                .select('*')
                .maybeSingle();

            if (error) throw error;

            if (data) {
                const { data: prof } = await client
                    .from('profiles')
                    .select('id, full_name, avatar_url, role')
                    .eq('id', currentUser.id)
                    .maybeSingle();
                data.author = prof || {
                    id: currentUser.id,
                    full_name: currentUser.user_metadata?.full_name || currentUser.email || 'You',
                    role: isMentor() ? 'mentor' : 'member'
                };
            }

            // Notify counterpart
            if (!isApplicant) {
                createNotification({
                    userId: appData.applicant_id,
                    type: 'system',
                    actorId: currentUser.id,
                    referenceId: applicationId,
                    body: `💬 Mentor feedback received on your project application "${appData.project_name}".`
                }).catch(e => console.warn('Comment notif err:', e));
            }

            return { data, success: true };
        } catch (err) {
            console.error('addApplicationComment error:', err);
            return { error: err };
        }
    }

    async function requestApplicationChanges(applicationId, comment) {
        if (!client || !isMentor()) {
            return { error: { message: 'Unauthorized: Only Mentors and Super Admins can request changes.' } };
        }

        const cleanComment = String(comment || '').trim();
        if (!cleanComment) {
            return { error: { message: 'A comment explaining the requested changes is mandatory.' } };
        }

        try {
            const { data: appData, error: fetchErr } = await client
                .from('project_applications')
                .select('*')
                .eq('id', applicationId)
                .maybeSingle();

            if (fetchErr || !appData) return { error: { message: 'Application not found.' } };

            const prevStatus = appData.status;

            // 1. Update application status
            const { data, error } = await client
                .from('project_applications')
                .update({
                    status: 'Changes Requested',
                    reviewer_id: currentUser.id,
                    reviewed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', applicationId)
                .select()
                .maybeSingle();

            if (error) throw error;

            // 2. Post the mentor's comment to the comment thread
            try {
                await client.from('project_application_comments').insert([{
                    application_id: applicationId,
                    author_id: currentUser.id,
                    content: cleanComment,
                    is_mentor_feedback: true,
                    created_at: new Date().toISOString()
                }]);
            } catch (e) {
                console.warn('Could not post feedback comment:', e);
            }

            // 3. Log into status history
            try {
                await client.from('project_application_status_history').insert([{
                    application_id: applicationId,
                    changed_by: currentUser.id,
                    previous_status: prevStatus,
                    new_status: 'Changes Requested',
                    comment: cleanComment,
                    created_at: new Date().toISOString()
                }]);
            } catch (e) {
                console.warn('Could not log status history:', e);
            }

            // 4. Notify applicant
            createNotification({
                userId: appData.applicant_id,
                type: 'system',
                actorId: currentUser.id,
                referenceId: applicationId,
                body: `⚠️ Changes requested on "${appData.project_name}": ${cleanComment.substring(0, 80)}`
            }).catch(e => console.warn('Notif err:', e));

            return { data, success: true };
        } catch (err) {
            console.error('requestApplicationChanges error:', err);
            return { error: err };
        }
    }

    async function resubmitProjectApplication(applicationId, params = {}, note = '') {
        if (!client) return { error: { message: 'Database client not initialized.' } };
        if (!currentUser) {
            await getSession();
        }
        if (!currentUser) return { error: { message: 'Sign in required.' } };

        const cleanName = String(params.projectName || params.project_name || '').trim();
        const cleanDesc = String(params.description || '').trim();
        const cleanTeam = String(params.teamName || params.team_name || cleanName).trim();
        const specs = Array.isArray(params.specialties) ? params.specialties : [];
        const allLinks = Array.isArray(params.links) ? params.links : [];

        if (!cleanName) return { error: { message: 'Project Name is required.' } };
        if (!cleanDesc) return { error: { message: 'Project Description is required.' } };

        try {
            const { data: appData, error: fetchErr } = await client
                .from('project_applications')
                .select('*')
                .eq('id', applicationId)
                .maybeSingle();

            if (fetchErr || !appData) return { error: { message: 'Application not found.' } };
            
            const isApplicant = String(appData.applicant_id).toLowerCase() === String(currentUser.id).toLowerCase();
            if (!isApplicant && !isMentor()) {
                return { error: { message: 'Unauthorized: Only the applicant or mentor can resubmit this proposal.' } };
            }

            const nextRevNumber = (appData.revision_number || 1) + 1;
            const revNote = (note && String(note).trim()) ? String(note).trim() : 'Updated proposal based on mentor feedback.';
            const newRevision = {
                revision: nextRevNumber,
                submitted_at: new Date().toISOString(),
                project_name: cleanName,
                description: cleanDesc,
                team_name: cleanTeam,
                specialties: specs,
                links: allLinks,
                note: revNote
            };

            const existingRevs = Array.isArray(appData.revisions) ? appData.revisions : [];
            const updatedRevisions = [...existingRevs, newRevision];

            // Primary update attempt with all fields
            const updatePayload = {
                project_name: cleanName,
                description: cleanDesc,
                team_name: cleanTeam,
                specialties: specs,
                links: allLinks,
                status: 'Pending Review',
                revision_number: nextRevNumber,
                revisions: updatedRevisions,
                updated_at: new Date().toISOString()
            };

            let updatedApp = null;
            const { data: updateData, error: updateErr } = await client
                .from('project_applications')
                .update(updatePayload)
                .eq('id', applicationId)
                .select()
                .maybeSingle();

            if (updateErr) {
                console.warn('Full resubmit update failed, trying fallback payload:', updateErr);
                // Fallback attempt: some database schemas might not have revisions or links column yet
                const fallbackPayload = {
                    project_name: cleanName,
                    description: cleanDesc,
                    team_name: cleanTeam,
                    status: 'Pending Review',
                    updated_at: new Date().toISOString()
                };
                if (specs.length > 0) fallbackPayload.specialties = specs;

                const { data: fallbackData, error: fallbackErr } = await client
                    .from('project_applications')
                    .update(fallbackPayload)
                    .eq('id', applicationId)
                    .select()
                    .maybeSingle();

                if (fallbackErr) {
                    // Try without .select() in case post-update select is restricted
                    const { error: noSelectErr } = await client
                        .from('project_applications')
                        .update(fallbackPayload)
                        .eq('id', applicationId);

                    if (noSelectErr) throw noSelectErr;
                    updatedApp = { ...appData, ...fallbackPayload, status: 'Pending Review' };
                } else {
                    updatedApp = fallbackData;
                }
            } else {
                updatedApp = updateData;
            }

            // Log status history (safe, non-blocking)
            try {
                await client.from('project_application_status_history').insert([{
                    application_id: applicationId,
                    changed_by: currentUser.id,
                    previous_status: 'Changes Requested',
                    new_status: 'Pending Review',
                    comment: `Revision #${nextRevNumber}: ${revNote}`,
                    created_at: new Date().toISOString()
                }]);
            } catch (e) {
                console.warn('Status history logging warning:', e);
            }

            // Post applicant revision note as comment (safe, non-blocking)
            try {
                await client.from('project_application_comments').insert([{
                    application_id: applicationId,
                    author_id: currentUser.id,
                    content: `📝 Revision #${nextRevNumber} Submitted: ${revNote}`,
                    is_mentor_feedback: false,
                    created_at: new Date().toISOString()
                }]);
            } catch (e) {
                console.warn('Comment insert warning:', e);
            }

            // Notify reviewer if known
            if (appData.reviewer_id) {
                createNotification({
                    userId: appData.reviewer_id,
                    type: 'system',
                    actorId: currentUser.id,
                    referenceId: applicationId,
                    body: `🔄 Resubmitted: "${cleanName}" has been updated with requested changes.`
                }).catch(e => console.warn('Reviewer notif err:', e));
            }

            return { data: updatedApp, success: true };
        } catch (err) {
            console.error('resubmitProjectApplication error:', err);
            return { error: err };
        }
    }

    async function approveProjectApplication(applicationId) {
        if (!client || !isMentor()) {
            return { error: { message: 'Unauthorized: Only Mentors and Super Admins can approve applications.' } };
        }

        try {
            const { data: appData, error: fetchErr } = await client
                .from('project_applications')
                .select('*, applicant:applicant_id(*)')
                .eq('id', applicationId)
                .maybeSingle();

            if (fetchErr || !appData) return { error: { message: 'Application not found.' } };
            if (appData.status === 'Approved') return { error: { message: 'Application has already been approved.' } };

            // Generate unique project code
            let projectCode = appData.project_code;
            if (!projectCode) {
                for (let i = 0; i < 20; i++) {
                    const candidate = generateUniqueProjectCode();
                    const { data: existingCode } = await client.from('core_leads').select('id').eq('project_code', candidate).maybeSingle();
                    if (!existingCode) {
                        projectCode = candidate;
                        break;
                    }
                }
                if (!projectCode) projectCode = `PRJ-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
            }

            // Create or update live project in core_leads
            const applicantUser = appData.applicant || {};
            const applicantName = applicantUser.full_name || applicantUser.username || 'Project Lead';
            const initials = (appData.project_name || 'PRJ')
                .split(' ')
                .map(w => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

            // Next sort_order
            const { data: maxOrderData } = await client.from('core_leads').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
            const nextSort = (maxOrderData?.sort_order || 13) + 1;

            const leadPayload = {
                name: applicantName,
                role: 'Project Lead',
                team: appData.team_name || appData.project_name,
                project_name: appData.project_name,
                project_code: projectCode,
                lead_user_id: appData.applicant_id,
                bio: appData.description,
                specialties: Array.isArray(appData.specialties) ? appData.specialties : [],
                links: Array.isArray(appData.links) ? appData.links : [],
                avatar_url: applicantUser.avatar_url || null,
                initials: initials || 'ICC',
                gradient: 'from-emerald-600 to-teal-500',
                color: '#10b981',
                milestones: {
                    planning: true,
                    design: false,
                    selection: false,
                    development: false,
                    programming: false,
                    testing: false,
                    optimization: false,
                    deployment: false
                },
                sort_order: nextSort,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data: newLead, error: leadErr } = await client
                .from('core_leads')
                .insert([leadPayload])
                .select()
                .maybeSingle();

            if (leadErr) throw leadErr;

            // Update applicant role to 'lead' and team_id if not super admin
            const currentRole = (applicantUser.role || '').toLowerCase();
            const shouldChangeRole = currentRole !== 'super_admin' && currentRole !== 'superadmin' && currentRole !== 'admin';
            const profileUpdates = {
                team_id: newLead.id,
                updated_at: new Date().toISOString()
            };
            if (shouldChangeRole) profileUpdates.role = 'lead';

            await client.from('profiles').update(profileUpdates).eq('id', appData.applicant_id);

            // Add applicant to team_memberships
            try {
                await client.from('team_memberships').upsert([{
                    user_id: appData.applicant_id,
                    team_id: newLead.id,
                    created_at: new Date().toISOString()
                }]);
            } catch (e) {
                console.warn('Membership upsert err:', e);
            }

            // Update application status to 'Approved'
            const { data: updatedApp, error: appUpdateErr } = await client
                .from('project_applications')
                .update({
                    status: 'Approved',
                    project_code: projectCode,
                    approved_project_id: newLead.id,
                    reviewer_id: currentUser.id,
                    reviewed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', applicationId)
                .select()
                .maybeSingle();

            if (appUpdateErr) throw appUpdateErr;

            // Log status history
            try {
                await client.from('project_application_status_history').insert([{
                    application_id: applicationId,
                    changed_by: currentUser.id,
                    previous_status: appData.status,
                    new_status: 'Approved',
                    comment: `Application approved! Live project initialized with Code: ${projectCode}`,
                    created_at: new Date().toISOString()
                }]);
            } catch (e) {
                console.warn('History err:', e);
            }

            // Send notification to applicant
            createNotification({
                userId: appData.applicant_id,
                type: 'system',
                actorId: currentUser.id,
                referenceId: applicationId,
                body: `🎉 Congratulations! Your project "${appData.project_name}" has been approved! Code: ${projectCode}`
            }).catch(e => console.warn('Notif err:', e));

            // Refresh in-memory CORE_LEADS
            if (typeof loadLeads === 'function') {
                await loadLeads();
            }

            return { data: updatedApp, project: newLead, projectCode, success: true };
        } catch (err) {
            console.error('approveProjectApplication error:', err);
            return { error: err };
        }
    }

    async function fetchMentorDashboardSummary() {
        if (!client || !isMentor()) {
            return { error: { message: 'Unauthorized' } };
        }

        try {
            const { data: applications } = await client.from('project_applications').select('id, status');
            const { data: projects } = await client.from('core_leads').select('id');

            const allApps = applications || [];
            const pending = allApps.filter(a => a.status === 'Pending Review').length;
            const changesRequested = allApps.filter(a => a.status === 'Changes Requested').length;
            const approved = allApps.filter(a => a.status === 'Approved').length;
            const totalProjects = (projects || []).length;

            return {
                data: {
                    pending,
                    changesRequested,
                    approved,
                    totalProjects,
                    totalApplications: allApps.length
                },
                success: true
            };
        } catch (err) {
            console.error('fetchMentorDashboardSummary error:', err);
            return { error: err };
        }
    }

    async function fetchProjectForMentor(projectId) {
        if (!client || !isMentor()) {
            return { error: { message: 'Unauthorized: Complete project audit is restricted to Mentors and Super Admins.' } };
        }

        try {
            // 1. Fetch live project
            const { data: project, error: pErr } = await client
                .from('core_leads')
                .select('*')
                .eq('id', projectId)
                .maybeSingle();

            if (pErr || !project) return { error: { message: 'Project not found.' } };

            // 2. Fetch Lead profile
            let leadUser = null;
            if (project.lead_user_id) {
                const { data: lData } = await client.from('profiles').select('*').eq('id', project.lead_user_id).maybeSingle();
                leadUser = lData;
            }

            // 3. Fetch Full Member List with contact info
            const { data: memberRows } = await client
                .from('team_memberships')
                .select('user_id, created_at, profile:user_id(*)')
                .eq('team_id', projectId);

            // 4. Fetch linked application if available
            const { data: application } = await client
                .from('project_applications')
                .select(`
                    *,
                    applicant:applicant_id(*),
                    reviewer:reviewer_id(id, full_name, role)
                `)
                .or(`approved_project_id.eq.${projectId},project_name.eq."${project.project_name || project.team}"`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            // 5. Fetch comments and status history if application exists
            let comments = [];
            let history = [];
            if (application?.id) {
                const { data: cData } = await client
                    .from('project_application_comments')
                    .select('*, author:author_id(id, full_name, avatar_url, role)')
                    .eq('application_id', application.id)
                    .order('created_at', { ascending: true });
                comments = cData || [];

                const { data: hData } = await client
                    .from('project_application_status_history')
                    .select('*, changer:changed_by(id, full_name, role)')
                    .eq('application_id', application.id)
                    .order('created_at', { ascending: true });
                history = hData || [];
            }

            return {
                data: {
                    project,
                    leadUser,
                    members: memberRows || [],
                    application,
                    comments,
                    history
                },
                success: true
            };
        } catch (err) {
            console.error('fetchProjectForMentor error:', err);
            return { error: err };
        }
    }

    function filterProjectFieldsForUser(project, currentUserId = currentUser?.id, prof = currentProfile) {
        if (!project) return null;
        const isSuper = isSuperAdmin(prof);
        const isMent = isMentor(prof);
        const userTeamId = prof?.team_id;
        const memberships = Array.isArray(prof?.memberships) ? prof.memberships.map(Number) : [];
        const isMember = memberships.includes(Number(project.id)) || Number(userTeamId) === Number(project.id);
        const isLead = (project.lead_user_id && project.lead_user_id === currentUserId) || 
                       (prof?.role === 'lead' && Number(userTeamId) === Number(project.id));
        const isAdminUser = isAdmin();

        // Mentors & Super Admins get full fields
        if (isSuper || isMent) {
            return { ...project, _canViewFullAudit: true, _canViewCode: true };
        }

        // Project Lead & Members see basic info + project code
        if (isLead || isMember || isAdminUser) {
            return {
                id: project.id,
                name: project.name,
                team: project.team,
                project_name: project.project_name || project.team,
                project_code: project.project_code || null,
                bio: project.bio,
                specialties: project.specialties,
                links: project.links,
                milestones: project.milestones,
                avatar_url: project.avatar_url,
                initials: project.initials,
                gradient: project.gradient,
                color: project.color,
                lead_user_id: project.lead_user_id,
                _canViewFullAudit: false,
                _canViewCode: true
            };
        }

        // Regular users / public see ONLY basic info (project name, description, lead name, avatar, milestones)
        // Explicitly omits project_code and sensitive data!
        return {
            id: project.id,
            name: project.name,
            team: project.team,
            project_name: project.project_name || project.team,
            bio: project.bio,
            specialties: project.specialties,
            links: project.links,
            milestones: project.milestones,
            avatar_url: project.avatar_url,
            initials: project.initials,
            gradient: project.gradient,
            color: project.color,
            _canViewFullAudit: false,
            _canViewCode: false
        };
    }

    // ==================== HELPERS ====================

    function getUser() { return currentUser; }
    function getProfile() { return currentProfile; }
    function isConfigured() { return client !== null; }
    function getClient() { return client; }

    function isAdmin() {
        const role = (currentProfile?.role || '').toLowerCase().trim();
        return role === 'admin' || role === 'super_admin' || role === 'superadmin';
    }

    function isMentor(prof = currentProfile) {
        const target = prof || currentProfile;
        if (!target && !currentUser) return false;
        const role = (target?.role || '').toLowerCase().trim();
        return role === 'mentor' || isSuperAdmin(target);
    }

    function isLead() {
        const role = (currentProfile?.role || '').toLowerCase().trim();
        return role === 'lead';
    }

    function needsOnboarding() {
        return currentProfile && !currentProfile.username;
    }

    return {
        init, signInWithGoogle, sendOTP, verifyOTP, verifyOTPOnly, signOut, getSession, onAuthStateChange,
        fetchProfile, updateProfile, fetchUserById, fetchProfileByEmail, searchUsers, checkUsernameAvailable,
        fetchPosts, fetchPostById, fetchPostsByTeam, fetchPostsByUser, createPost, updatePostStatus, deletePost,
        toggleLike, hasLiked, fetchUserLikes,
        fetchComments, addComment, deleteComment,
        fetchConversations, fetchMessages, sendMessage, deleteMessage, markAsRead, getUnreadCount,
        joinTeam, cancelJoinRequest, getTeamMembers, getPendingMembers, approveMember, denyMember,
        fetchTeamMessages, sendTeamMessage, deleteTeamMessage, subscribeToTeamChat,
        isTeamLead, canAccessTeamChat, canUserAccessTeamChat,
        fetchLeads, createLead, updateLead, deleteLead,
        approveLead, denyLead, getPendingLeads,
        createBroadcast, getActiveBroadcast, dismissBroadcast, adminDeletePost,
        adminUpdateUser, adminDeleteUser,
        getAllProfiles, getAllPosts,
        fetchNotifications, createNotification, markNotificationRead, markAllNotificationsRead, getUnreadNotifCount,
        deleteNotification, deleteAllNotifications, adminClearAllNotifications,
        uploadImage, deleteImage,
        signInWithPassword, updatePassword,
        fetchInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem,
        requestInventoryItem, fetchInventoryRequests, fetchMyInventoryRequests, updateInventoryRequestStatus,
        fetchTeamAttendance, submitAttendance, fetchUserAttendanceHistory, fetchAllAttendanceData,
        fetchEvents, fetchEventById, createEvent, updateEvent, deleteEvent,
        requestUserUpdate, fetchUserEditRequests, approveUserEditRequest, rejectUserEditRequest, cancelUserEditRequest,
        subscribeToUserEditRequests,
        subscribeToInventory, subscribeToInventoryRequests,
        subscribeToFeed, subscribeToMessages, subscribeToConversation,
        subscribeToTeam, subscribeToAllLeads, subscribeToBroadcasts, subscribeToNotifications,
        unsubscribeChannel, cleanupAllChannels,
        getUser, getProfile, isConfigured, getClient, isAdmin, isLead, isSuperAdmin, isMentor, needsOnboarding,
        getAdminPermissions, hasAdminPermission, updateAdminPermissions, setAdminRole, setMentorRole, DEFAULT_ADMIN_PERMISSIONS,
        // Project Application & Mentor Workflow API
        createProjectApplication, fetchMyProjectApplications, fetchAllProjectApplications, fetchApplicationDetails,
        addApplicationComment, requestApplicationChanges, resubmitProjectApplication, approveProjectApplication,
        fetchMentorDashboardSummary, fetchProjectForMentor, filterProjectFieldsForUser,
        subscribeToProjectApplications, subscribeToApplicationComments
    };
})();

