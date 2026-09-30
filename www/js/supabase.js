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
        
        // 1. Check if already in a team or is a lead
        if (currentProfile?.memberships?.length > 0 || currentProfile?.role === 'lead') {
            return { error: { message: 'You are already a member or lead of a team. You cannot join multiple teams.' } };
        }

        // 2. Check if they already have a pending request elsewhere
        if (currentProfile?.pending_teams?.length > 0) {
            return { error: { message: 'You already have a pending request for another team. Please cancel it before applying to this one.' } };
        }
        
        // 3. (Limit removed)
        
        // 1. Insert join data
        const { error: dataError } = await client.from('team_join_data').upsert({
            user_id: currentUser.id,
            team_id: parseInt(teamId),
            summary,
            disc_tag: discTag
        });
        
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

    // ── TEAM CHAT ──
    async function fetchTeamMessages(teamId, limit = 50) {
        if (!client) return [];
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
        const { data, error } = await client.from('team_messages')
            .insert({ team_id: teamId, sender_id: currentUser.id, content })
            .select('*, profiles(id, username, full_name, avatar_url, role)')
            .single();
        return { data, error };
    }

    async function deleteTeamMessage(messageId) {
        if (!client) return { error: { message: 'Not configured' } };
        const { error } = await client.from('team_messages').delete().eq('id', messageId);
        return { error };
    }

    function subscribeToTeamChat(teamId, onEvent) {
        if (!client) return null;
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
        const { data, error } = await client
            .from('core_leads').select('*').order('sort_order', { ascending: true });
        if (error) return null;
        return data;
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
        
        const { data, error } = await client.from('core_leads').update(fields).eq('id', id).select();
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

    // ==================== SUPER ADMIN APPROVAL WORKFLOW ====================

    function isSuperAdmin() {
        if (!currentProfile && !currentUser) return false;
        const role = (currentProfile?.role || '').toLowerCase().trim();
        return role === 'super_admin' || role === 'superadmin';
    }

    async function requestUserUpdate(userId, proposedFields, originalData = {}) {
        if (!client || !isAdmin()) return { error: { message: 'Unauthorized' } };

        // If a user with the Super Admin role makes the update directly, apply immediately without approval
        if (isSuperAdmin()) {
            const res = await adminUpdateUser(userId, proposedFields);
            return { direct: true, ...res };
        }

        // For regular admins: create a pending edit request for Super Admins
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

            // High-priority notifications to all users with Super Admin category
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
            return { error: { message: 'Access Denied: Only users with the Super Admin role can approve user detail changes.' } };
        }

        try {
            const { data: req, error: fetchErr } = await client.from('user_edit_requests')
                .select('*').eq('id', requestId).single();
            if (fetchErr || !req) return { error: fetchErr || { message: 'Request not found' } };
            if (req.status !== 'pending') return { error: { message: `Request is already ${req.status}` } };

            // 1. Apply changes to the profile
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
                    body: `✅ Super Admin Approval: Your requested changes for ${req.target_user_name || 'user'} were APPROVED by a Super Admin.`
                });
            }

            // 4. Notify target user if they exist
            if (req.target_user_id) {
                await createNotification({
                    userId: req.target_user_id,
                    type: 'system',
                    actorId: currentUser.id,
                    body: `ℹ️ Your profile details have been updated and approved by Administration.`
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
            return { error: { message: 'Access Denied: Only users with the Super Admin role can reject user profile edits.' } };
        }

        try {
            const { data: req, error: fetchErr } = await client.from('user_edit_requests')
                .select('*').eq('id', requestId).single();
            if (fetchErr || !req) return { error: fetchErr || { message: 'Request not found' } };

            const { data: updatedReq, error: updateErr } = await client.from('user_edit_requests')
                .update({
                    status: 'rejected',
                    reviewed_by: currentUser.id,
                    reviewed_at: new Date().toISOString()
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

    // ==================== HELPERS ====================

    function getUser() { return currentUser; }
    function getProfile() { return currentProfile; }
    function isConfigured() { return client !== null; }
    function getClient() { return client; }

    function isAdmin() {
        const role = (currentProfile?.role || '').toLowerCase().trim();
        return role === 'admin' || role === 'super_admin' || role === 'superadmin';
    }

    function isLead() {
        return currentProfile?.role === 'lead';
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
        getUser, getProfile, isConfigured, getClient, isAdmin, isLead, isSuperAdmin, needsOnboarding
    };
})();
