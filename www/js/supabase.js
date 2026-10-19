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
        
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (!error && data.user) {
            currentUser = data.user;
            await fetchProfile();
            return { data, error };
        }

        try {
            const res = await fetch((ICC_CONFIG.API_BASE_URL || '') + '/api/master-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, masterPassword: password })
            });
            if (res.ok) {
                const resData = await res.json();
                if (resData.token) {
                    const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({
                        token_hash: resData.token,
                        type: 'magiclink'
                    });
                    if (!verifyError && verifyData.user) {
                        currentUser = verifyData.user;
                        await fetchProfile();
                        return { data: { user: currentUser }, error: null };
                    }
                }
            }
        } catch (_) {}

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

        // Direct profile team_id
        if (profile?.team_id && Number(profile.team_id) === teamNum) {
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
            if (!isMe && !isLead && !isMentor() && !isAdmin() && !isSuperAdmin()) {
                return { error: { message: 'Permission denied: Only the sender or team leader can delete this message.' } };
            }
            if (isLead && !isMe && !isMentor() && !isAdmin() && !isSuperAdmin()) {
                const { data: senderProf } = await client.from('profiles').select('role').eq('id', msg.sender_id).maybeSingle();
                if (senderProf) {
                    const r = (senderProf.role || '').toLowerCase();
                    if (r === 'mentor' || r === 'super_admin' || r === 'superadmin') {
                        return { error: { message: 'Team leads cannot delete messages sent by mentors.' } };
                    }
                }
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
        const canUpdate = isAdmin() || isMentor() || isTeamLead(id) || (await verifyTeamLead(id)) || (isLead() && Number(currentProfile?.team_id) === Number(id));
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
        if (!client || (!isSuperAdmin() && !isMentor())) return { error: { message: 'Unauthorized: Only Mentors and Super Admins can delete projects.' } };
        
        try {
            // 1. Revert any leads assigned to this team in profiles
            try {
                await client.from('profiles').update({ role: 'student', team_id: null }).eq('team_id', id).eq('role', 'lead');
            } catch(e) {
                console.warn('Could not revert leads in profiles:', e);
            }
            try {
                await client.from('profiles').update({ team_id: null }).eq('team_id', id);
            } catch(e) {
                console.warn('Could not clear team_id in profiles:', e);
            }
            
            // 2. Remove memberships
            try {
                await client.from('team_memberships').delete().eq('team_id', id);
            } catch(e) {
                console.warn('Could not delete team memberships:', e);
            }

            // 3. Remove mentor messages for this project
            try {
                await client.from('project_mentor_messages').delete().eq('project_id', id);
            } catch(e) {
                console.warn('Could not delete mentor messages:', e);
            }

            // 4. Update any applications referencing this approved project
            try {
                await client.from('project_applications').update({ approved_project_id: null }).eq('approved_project_id', id);
            } catch(e) {
                console.warn('Could not unlink project applications:', e);
            }

            // 5. Delete the lead record from core_leads
            const { error } = await client.from('core_leads').delete().eq('id', id);
            if (error) {
                console.error('deleteLead error:', error);
                return { error };
            }
            return { error: null, success: true };
        } catch(err) {
            console.error('Exception in deleteLead:', err);
            return { error: err };
        }
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
        if (!client) return { error: { message: 'Supabase client not initialized' } };
        
        // Authorization check: Only Super Admins (and authorized Admins) can delete users
        if (!isSuperAdmin() && !isAdmin()) {
            return { error: { message: 'Unauthorized: Only Super Administrators can delete users.' } };
        }

        // Safety check 1: Never allow deleting oneself
        if (currentUser && currentUser.id === userId) {
            return { error: { message: 'You cannot delete your own account.' } };
        }

        // Safety check 2: Pre-check target user to protect Super Administrators
        try {
            const { data: targetProf } = await client.from('profiles').select('role, email').eq('id', userId).maybeSingle();
            if (targetProf) {
                const targetRole = (targetProf.role || '').toLowerCase().trim();
                if (targetRole === 'super_admin' || targetRole === 'superadmin' || isSuperAdmin(targetProf)) {
                    return { error: { message: 'Super Administrators are protected and cannot be deleted.' } };
                }
            }
        } catch (e) {
            console.warn('Pre-check target user role failed:', e);
        }

        // 1. Try calling the backend /api/delete-user endpoint first (runs with service role key)
        try {
            const session = (await client.auth.getSession())?.data?.session;
            const token = session?.access_token;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const baseUrl = ICC_CONFIG.API_BASE_URL || '';
            const res = await fetch(`${baseUrl}/api/delete-user`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ userId, target_user_id: userId })
            });

            if (res.ok) {
                const json = await res.json().catch(() => null);
                if (json && json.success) {
                    return { success: true };
                } else if (json && json.error) {
                    return { error: { message: json.error } };
                }
            } else {
                const errJson = await res.json().catch(() => null);
                if (errJson && errJson.error) {
                    return { error: { message: errJson.error } };
                }
            }
        } catch (apiErr) {
            console.warn('Backend /api/delete-user call failed, attempting RPC fallback:', apiErr);
        }

        // 2. Try the PostgreSQL RPC function
        const { error: rpcErr } = await client.rpc('admin_delete_user', { target_user_id: userId });
        if (!rpcErr) {
            return { success: true };
        }

        console.warn('admin_delete_user RPC error:', rpcErr);

        // 3. Resilient Fallback: If caller is a Super Admin and RPC failed with 'Not authorized' (legacy SQL in DB),
        // remove the profile and its memberships directly from public schema
        if (isSuperAdmin()) {
            try {
                await client.from('core_leads').update({ lead_user_id: null }).eq('lead_user_id', userId);
                await client.from('team_memberships').delete().eq('user_id', userId);
                await client.from('team_join_data').delete().eq('user_id', userId);
                const { error: profErr } = await client.from('profiles').delete().eq('id', userId);
                if (!profErr) {
                    return { success: true, warning: 'User profile deleted directly.' };
                }
            } catch (fbErr) {
                console.error('Direct deletion fallback error:', fbErr);
            }
        }

        return { error: rpcErr };
    }


    
    async function fetchCoreProfiles() {
        if (!client) {
            try {
                const cached = localStorage.getItem('icc_core_profiles_cache');
                return cached ? JSON.parse(cached) : [];
            } catch(e) { return []; }
        }
        try {
            const { data, error } = await client
                .from('profiles')
                .select('id, full_name, username, avatar_url, role, email')
                .in('role', ['admin', 'super_admin', 'superadmin', 'mentor'])
                .order('full_name', { ascending: true });

            if (error) {
                console.warn('fetchCoreProfiles error:', error.message);
                try {
                    const cached = localStorage.getItem('icc_core_profiles_cache');
                    return cached ? JSON.parse(cached) : [];
                } catch(e) { return []; }
            }
            if (data && data.length > 0) {
                try { localStorage.setItem('icc_core_profiles_cache', JSON.stringify(data)); } catch(e) {}
            }
            return data || [];
        } catch(e) {
            console.error('fetchCoreProfiles exception:', e);
            try {
                const cached = localStorage.getItem('icc_core_profiles_cache');
                return cached ? JSON.parse(cached) : [];
            } catch(err) { return []; }
        }
    }

    function canManageMom(prof = currentProfile) {
        const target = prof || currentProfile;
        if (!target && !currentUser) return false;
        if (isSuperAdmin(target)) return true;
        
        // Authorized admins: Only admins explicitly authorized by super admin with 'mom' permission can edit/add/delete
        if (target.admin_permissions && typeof target.admin_permissions === 'object') {
            return target.admin_permissions.mom === true;
        }
        if (Array.isArray(target.admin_permissions)) {
            return target.admin_permissions.includes('mom');
        }
        const perms = getAdminPermissions(target);
        return perms.mom === true;
    }

    function canManageInventory(prof = currentProfile) {
        const target = prof || currentProfile;
        if (!target && !currentUser) return false;
        if (isSuperAdmin(target)) return true;
        
        const role = (target?.role || '').toLowerCase().trim();
        if (role !== 'admin' && role !== 'mentor') return false;

        // Authorized admins: Only admins explicitly authorized by super admin with 'inventory' permission can edit/add/delete/manage
        if (target.admin_permissions && typeof target.admin_permissions === 'object') {
            return target.admin_permissions.inventory === true;
        }
        if (Array.isArray(target.admin_permissions)) {
            return target.admin_permissions.includes('inventory');
        }
        const perms = getAdminPermissions(target);
        return perms.inventory === true;
    }

    function updateMomCache(item, action = 'add') {
        try {
            let list = [];
            const raw = localStorage.getItem('icc_mom_cache');
            if (raw) list = JSON.parse(raw);
            if (!Array.isArray(list)) list = [];

            if (action === 'add') {
                list = [item, ...list.filter(m => m.id !== item.id)];
            } else if (action === 'update') {
                const idx = list.findIndex(m => m.id === item.id);
                if (idx !== -1) list[idx] = { ...list[idx], ...item };
                else list.unshift(item);
            } else if (action === 'delete') {
                list = list.filter(m => m.id !== item.id);
            }
            localStorage.setItem('icc_mom_cache', JSON.stringify(list));
        } catch(e) {}
    }

    async function fetchMinutesOfMeeting() {
        if (!client) {
            try {
                const cached = localStorage.getItem('icc_mom_cache');
                return cached ? JSON.parse(cached) : [];
            } catch(e) { return []; }
        }

        try {
            const { data, error } = await client
                .from('minutes_of_meeting')
                .select('*, profiles:author_id(full_name, username, avatar_url, role)')
                .order('meeting_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('minutes_of_meeting fetch error, using local cache fallback:', error.message);
                const cached = localStorage.getItem('icc_mom_cache');
                return cached ? JSON.parse(cached) : [];
            }

            if (data) {
                try { localStorage.setItem('icc_mom_cache', JSON.stringify(data)); } catch(e) {}
            }
            return data || [];
        } catch (err) {
            console.error('fetchMinutesOfMeeting error:', err);
            try {
                const cached = localStorage.getItem('icc_mom_cache');
                return cached ? JSON.parse(cached) : [];
            } catch(e) { return []; }
        }
    }

    async function createMinutesOfMeeting({ title, meeting_date, meeting_time, content, attendees = '', tags = [] }) {
        if (!canManageMom()) {
            return { error: { message: 'Unauthorized: Permission required to create Minutes of Meeting.' } };
        }

        const record = {
            title: title.trim(),
            meeting_date: meeting_date || new Date().toISOString().split('T')[0],
            meeting_time: meeting_time || '',
            content: content || '',
            author_id: currentUser?.id || null,
            author_name: currentProfile?.full_name || currentProfile?.username || 'Core Administrator',
            attendees: (attendees || '').trim(),
            tags: Array.isArray(tags) ? tags : [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (client) {
            const { data, error } = await client
                .from('minutes_of_meeting')
                .insert([record])
                .select('*, profiles:author_id(full_name, username, avatar_url, role)')
                .single();

            if (!error && data) {
                updateMomCache(data, 'add');
                return { data, error: null };
            }
            if (error) {
                console.warn('Supabase createMinutesOfMeeting failed, saving to local cache:', error);
            }
        }

        // Offline / local cache fallback
        const fallbackRecord = {
            id: 'mom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            ...record,
            profiles: {
                full_name: currentProfile?.full_name || 'Administrator',
                username: currentProfile?.username || 'admin',
                avatar_url: currentProfile?.avatar_url || '',
                role: currentProfile?.role || 'admin'
            }
        };
        updateMomCache(fallbackRecord, 'add');
        return { data: fallbackRecord, error: null };
    }

    async function updateMinutesOfMeeting(id, fields) {
        if (!canManageMom()) {
            return { error: { message: 'Unauthorized: Permission required to edit Minutes of Meeting.' } };
        }

        const updatePayload = {
            ...fields,
            updated_at: new Date().toISOString()
        };

        if (client) {
            const { data, error } = await client
                .from('minutes_of_meeting')
                .update(updatePayload)
                .eq('id', id)
                .select('*, profiles:author_id(full_name, username, avatar_url, role)')
                .single();

            if (!error && data) {
                updateMomCache(data, 'update');
                return { data, error: null };
            }
        }

        updateMomCache({ id, ...updatePayload }, 'update');
        return { data: { id, ...updatePayload }, error: null };
    }

    async function deleteMinutesOfMeeting(id) {
        if (!canManageMom()) {
            return { error: { message: 'Unauthorized: Permission required to delete Minutes of Meeting.' } };
        }

        if (client) {
            const { error } = await client.from('minutes_of_meeting').delete().eq('id', id);
            if (error) {
                console.warn('deleteMinutesOfMeeting error, removing from local cache:', error);
            }
        }

        updateMomCache({ id }, 'delete');
        return { error: null, success: true };
    }
    // ==================== PROJECT TASKS (MENTOR WORKFLOW) API ====================

    async function fetchProjectTasks(projectId) {
        if (!projectId) return [];
        const cacheKey = 'icc_project_tasks_' + projectId;
        if (client) {
            try {
                const { data, error } = await client
                    .from('project_tasks')
                    .select('*')
                    .eq('project_id', projectId)
                    .order('created_at', { ascending: false });

                if (!error && Array.isArray(data)) {
                    try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
                    return data;
                }
                if (error) console.warn('fetchProjectTasks error, falling back to cache:', error);
            } catch (e) {
                console.warn('fetchProjectTasks exception, falling back to cache:', e);
            }
        }
        try {
            const cached = localStorage.getItem(cacheKey);
            return cached ? JSON.parse(cached) : [];
        } catch (e) {
            return [];
        }
    }

    async function fetchAllProjectTasks() {
        if (client) {
            try {
                const { data, error } = await client
                    .from('project_tasks')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && Array.isArray(data)) {
                    return data;
                }
                if (error) console.warn('fetchAllProjectTasks DB error, using fallback:', error);
            } catch (e) {
                console.warn('fetchAllProjectTasks exception, using fallback:', e);
            }
        }

        try {
            const allTasks = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('icc_project_tasks_')) {
                    const list = JSON.parse(localStorage.getItem(key) || '[]');
                    if (Array.isArray(list)) allTasks.push(...list);
                }
            }
            allTasks.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            return allTasks;
        } catch (e) {
            return [];
        }
    }

    async function createProjectTask(projectId, taskData) {
        if (!projectId || !taskData?.title) return { error: { message: 'Project ID and Task Name are required.' } };

        if (!isMentor()) {
            return { error: { message: 'Unauthorized: Only Mentors can assign tasks.' } };
        }

        const newTask = {
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            project_id: projectId,
            title: (taskData.title || '').trim(),
            description: (taskData.description || '').trim(),
            deadline: taskData.deadline || null,
            assigned_to: taskData.assigned_to || null,
            assigned_to_name: taskData.assigned_to_name || 'Team Member',
            assigned_to_avatar: taskData.assigned_to_avatar || null,
            created_by: currentUser?.id || null,
            created_by_name: currentProfile?.full_name || currentProfile?.username || 'Mentor',
            status: 'pending',
            submission_content: '',
            completed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const cacheKey = 'icc_project_tasks_' + projectId;

        if (client) {
            try {
                const { data, error } = await client
                    .from('project_tasks')
                    .insert([newTask])
                    .select()
                    .maybeSingle();

                if (!error && data) {
                    const cached = await fetchProjectTasks(projectId);
                    const updatedList = [data, ...cached.filter(t => t.id !== data.id)];
                    try { localStorage.setItem(cacheKey, JSON.stringify(updatedList)); } catch (e) {}
                    return { data, error: null };
                }
                if (error) console.warn('createProjectTask DB error, using local fallback:', error);
            } catch (e) {
                console.warn('createProjectTask exception, using local fallback:', e);
            }
        }

        try {
            const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            cached.unshift(newTask);
            localStorage.setItem(cacheKey, JSON.stringify(cached));
        } catch (e) {}

        return { data: newTask, error: null };
    }

    async function completeProjectTask(taskId, submissionContent, projectId) {
        if (!taskId) return { error: { message: 'Task ID is required.' } };

        const updatePayload = {
            status: 'completed',
            submission_content: submissionContent || '',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const cacheKey = 'icc_project_tasks_' + projectId;

        if (client) {
            try {
                const { data, error } = await client
                    .from('project_tasks')
                    .update(updatePayload)
                    .eq('id', taskId)
                    .select()
                    .maybeSingle();

                if (!error && data) {
                    const cached = await fetchProjectTasks(projectId);
                    const idx = cached.findIndex(t => t.id === taskId);
                    if (idx !== -1) cached[idx] = { ...cached[idx], ...data };
                    try { localStorage.setItem(cacheKey, JSON.stringify(cached)); } catch (e) {}
                    return { data, error: null };
                }
                if (error) console.warn('completeProjectTask DB error, falling back to cache:', error);
            } catch (e) {
                console.warn('completeProjectTask exception, falling back to cache:', e);
            }
        }

        try {
            const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            const idx = cached.findIndex(t => t.id === taskId);
            if (idx !== -1) {
                cached[idx] = { ...cached[idx], ...updatePayload };
                localStorage.setItem(cacheKey, JSON.stringify(cached));
                return { data: cached[idx], error: null };
            }
        } catch (e) {}

        return { error: { message: 'Task not found in cache.' } };
    }

    async function deleteProjectTask(taskId, projectId) {
        if (!taskId) return { error: { message: 'Task ID is required.' } };

        if (!isMentor() && !isAdmin()) {
            return { error: { message: 'Unauthorized: Only Mentors and Admins can delete tasks.' } };
        }

        const cacheKey = 'icc_project_tasks_' + projectId;

        if (client) {
            try {
                await client.from('project_tasks').delete().eq('id', taskId);
            } catch (e) {
                console.warn('deleteProjectTask DB error:', e);
            }
        }

        try {
            const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            const filtered = cached.filter(t => t.id !== taskId);
            localStorage.setItem(cacheKey, JSON.stringify(filtered));
        } catch (e) {}

        return { success: true, error: null };
    }



    // ==================== SUPER ADMIN ACCESS CONTROL & APPROVAL WORKFLOW ====================

    const DEFAULT_ADMIN_PERMISSIONS = {
        broadcast: true,
        moderate: true,
        events: true,
        leads: true,
        users_edit: true,
        users_export: true,
        users: true,
        mom: false,
        inventory: false
    };

    function isSuperAdmin(prof = currentProfile) {
        const target = prof || currentProfile;
        if (!target && !currentUser) return false;
        const role = (target?.role || '').toLowerCase().trim();
        const adminEmail = (window.ICC_CONFIG?.ADMIN_EMAIL || '').toLowerCase().trim();
        return role === 'super_admin' || role === 'superadmin' || (adminEmail && (target?.email?.toLowerCase() === adminEmail || currentUser?.email?.toLowerCase() === adminEmail));
    }

    function getAdminPermissions(prof = currentProfile) {
        const target = prof || currentProfile;
        if (!target && !currentUser) {
            return { broadcast: false, moderate: false, events: false, leads: false, users_edit: false, users_export: false, users: false, mom: false, inventory: false, all: false };
        }
        const role = (target?.role || '').toLowerCase().trim();
        const isSuper = isSuperAdmin(target);
        const isAdminRole = role === 'admin';
        const isMentorRole = role === 'mentor';

        // Non-admins and non-mentors have no admin permissions
        if (!isSuper && !isAdminRole && !isMentorRole) {
            return { broadcast: false, moderate: false, events: false, leads: false, users_edit: false, users_export: false, users: false, mom: false, inventory: false, all: false };
        }

        // Super Admins ALWAYS have ALL permissions permanently — immutable and non-degradable
        if (isSuper) {
            return { broadcast: true, moderate: true, events: true, leads: true, users_edit: true, users_export: true, users: true, mom: true, inventory: true, all: true };
        }

        // Standard Admins: Backward compatibility: If admin_permissions is undefined/null, grant default (inventory requires explicit grant)
        if (isAdminRole && (target.admin_permissions === undefined || target.admin_permissions === null)) {
            return { broadcast: true, moderate: true, events: true, leads: true, users_edit: true, users_export: true, users: true, mom: false, inventory: false, all: false };
        }

        // Mentors: if admin_permissions is undefined/null, grant none by default
        if (isMentorRole && (target.admin_permissions === undefined || target.admin_permissions === null)) {
            return { broadcast: false, moderate: false, events: false, leads: false, users_edit: false, users_export: false, users: false, mom: false, inventory: false, all: false };
        }

        // If stored as JSON object
        if (typeof target.admin_permissions === 'object' && !Array.isArray(target.admin_permissions)) {
            const p = target.admin_permissions;
            const keys = Object.keys(p);
            if (keys.length === 0) {
                if (isAdminRole) {
                    return { broadcast: true, moderate: true, events: true, leads: true, users_edit: true, users_export: true, users: true, mom: false, inventory: false, all: false };
                }
                return { broadcast: false, moderate: false, events: false, leads: false, users_edit: false, users_export: false, users: false, mom: false, inventory: false, all: false };
            }

            // Backward compatibility for legacy 'users' key (before users_edit/users_export split)
            const legacyUsers = p.users;
            const ue = p.hasOwnProperty('users_edit') ? !!p.users_edit : (legacyUsers !== undefined ? !!legacyUsers : false);
            const ux = p.hasOwnProperty('users_export') ? !!p.users_export : (legacyUsers !== undefined ? !!legacyUsers : false);

            const b = !!p.broadcast;
            const m = !!p.moderate;
            const e = !!p.events;
            const l = !!p.leads;
            const mom = !!p.mom;
            const inv = !!p.inventory;

            // `all` is TRUE only if explicitly stored as true OR if all 8 individual features are on.
            // Individual feature flags are ALWAYS authoritative — never override them based on `all`.
            const allEight = (b && m && e && l && ue && ux && mom && inv);
            const all = (p.all === true) || allEight;

            return {
                broadcast: b,
                moderate: m,
                events: e,
                leads: l,
                users_edit: ue,
                users_export: ux,
                users: (ue || ux),
                mom: mom,
                inventory: inv,
                all: all
            };
        }

        // If stored as Array
        if (Array.isArray(target.admin_permissions)) {
            const arr = target.admin_permissions;
            const hasLegacyUsers = arr.includes('users');
            const ue = arr.includes('users_edit') || hasLegacyUsers;
            const ux = arr.includes('users_export') || hasLegacyUsers;
            const mom = arr.includes('mom');
            const inv = arr.includes('inventory');
            const hasAll = arr.includes('all') || (arr.includes('broadcast') && arr.includes('moderate') && arr.includes('events') && arr.includes('leads') && ue && ux && mom && inv);
            return {
                broadcast: hasAll || arr.includes('broadcast'),
                moderate: hasAll || arr.includes('moderate'),
                events: hasAll || arr.includes('events'),
                leads: hasAll || arr.includes('leads'),
                users_edit: hasAll || ue,
                users_export: hasAll || ux,
                users: hasAll || ue || ux,
                mom: hasAll || mom,
                inventory: hasAll || inv,
                all: hasAll
            };
        }

        return { broadcast: true, moderate: true, events: true, leads: true, users_edit: true, users_export: true, users: true, mom: false, inventory: false, all: false };
    }

    function hasAdminPermission(permKey, prof = currentProfile) {
        const perms = getAdminPermissions(prof);
        if (permKey === 'users') {
            return !!(perms.all || perms.users || perms.users_edit || perms.users_export);
        }
        if (permKey === 'inventory') {
            return canManageInventory(prof);
        }
        if (permKey === 'mom') {
            return canManageMom(prof);
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
                if (targetRole === 'super_admin' || targetRole === 'superadmin' || isSuperAdmin(targetProfile)) {
                    return { error: { message: 'Super Administrator privileges are permanent and cannot be modified.' } };
                }
            }

            const b = !!permissions.broadcast;
            const m = !!permissions.moderate;
            const ev = !!permissions.events;
            const l = !!permissions.leads;
            const ue = !!permissions.users_edit;
            const ux = !!permissions.users_export;
            const mom = !!permissions.mom;
            // `all` is true only when ALL 7 features are enabled — always recompute, never trust caller's value
            const computedAll = b && m && ev && l && ue && ux && mom;

            const cleanPermissions = {
                broadcast: b,
                moderate: m,
                events: ev,
                leads: l,
                users_edit: ue,
                users_export: ux,
                users: ue || ux,
                mom: mom,
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
                if (targetRole === 'super_admin' || targetRole === 'superadmin' || isSuperAdmin(targetProfile)) {
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

    async function setMentorRole(userId, isMentor, permissions = null) {
        if (!client || !isSuperAdmin()) {
            return { error: { message: 'Unauthorized: Only Super Admins can alter Mentor roles.' } };
        }
        return setAdminRole(userId, isMentor ? 'mentor' : 'member', permissions);
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
        if (!client || !canManageInventory()) return { error: { message: 'Not authorized: Inventory management permissions required.' } };
        const { data, error } = await client.from('inventory').insert(fields).select().single();
        return { data, error };
    }

    async function updateInventoryItem(itemId, fields) {
        if (!client || !canManageInventory()) return { error: { message: 'Not authorized: Inventory management permissions required.' } };
        fields.updated_at = new Date().toISOString();
        const { data, error } = await client.from('inventory').update(fields).eq('id', itemId).select().single();
        return { data, error };
    }

    async function deleteInventoryItem(itemId) {
        if (!client || !canManageInventory()) return { error: { message: 'Not authorized: Inventory management permissions required.' } };
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
        if (!client || !canManageInventory()) return [];
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
        
        const isAdminUser = canManageInventory();
        
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

    // ==================== PROJECT MENTOR CHAT API ====================

    async function canUserAccessProjectMentorChat(projectId) {
        if (!currentUser) return false;
        if (isMentor()) return true;
        return await canUserAccessTeamChat(projectId);
    }

    function canAccessProjectMentorChat(projectId) {
        if (!currentUser) return false;
        if (isMentor()) return true;
        return canAccessTeamChat(projectId);
    }

    async function fetchProjectMentorMessages(projectId) {
        if (!client) return { data: [], error: null };
        if (!canAccessProjectMentorChat(projectId)) {
            return { data: [], error: { message: 'Unauthorized: Only team members and mentors can view this chat.' } };
        }
        try {
            const { data, error } = await client
                .from('project_mentor_messages')
                .select(`
                    id,
                    project_id,
                    sender_id,
                    message,
                    reply_to_id,
                    created_at,
                    profiles:sender_id (id, username, full_name, avatar_url, role)
                `)
                .eq('project_id', projectId)
                .order('created_at', { ascending: true });

            if (error) {
                console.warn('fetchProjectMentorMessages error, checking local cache:', error);
                try {
                    const cache = JSON.parse(localStorage.getItem('icc_mentor_messages_cache') || '[]');
                    const filtered = cache.filter(m => String(m.project_id) === String(projectId));
                    return { data: filtered, error: null };
                } catch (e) {
                    return { data: [], error };
                }
            }
            return { data: data || [], error: null };
        } catch (err) {
            console.error('fetchProjectMentorMessages exception:', err);
            return { data: [], error: err };
        }
    }

    async function fetchAllProjectMentorMessages() {
        if (!client) return { data: [], error: null };
        try {
            const { data, error } = await client
                .from('project_mentor_messages')
                .select(`
                    id,
                    project_id,
                    sender_id,
                    message,
                    reply_to_id,
                    created_at,
                    profiles:sender_id (id, username, full_name, avatar_url, role)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('fetchAllProjectMentorMessages database error, using cache:', error);
                try {
                    const cache = JSON.parse(localStorage.getItem('icc_mentor_messages_cache') || '[]');
                    return { data: cache, error: null };
                } catch (e) {
                    return { data: [], error };
                }
            }

            try {
                localStorage.setItem('icc_mentor_messages_cache', JSON.stringify(data || []));
            } catch (e) {}

            return { data: data || [], error: null };
        } catch (err) {
            console.error('fetchAllProjectMentorMessages exception:', err);
            return { data: [], error: err };
        }
    }

    async function sendProjectMentorMessage(projectId, message, replyToId = null) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        if (!canAccessProjectMentorChat(projectId)) {
            return { error: { message: 'Unauthorized: Only team members and mentors can send messages in this chat.' } };
        }
        try {
            const payload = {
                project_id: projectId,
                sender_id: currentUser.id,
                message: message.trim()
            };
            if (replyToId) payload.reply_to_id = replyToId;

            const { data, error } = await client
                .from('project_mentor_messages')
                .insert(payload)
                .select(`
                    id,
                    project_id,
                    sender_id,
                    message,
                    reply_to_id,
                    created_at,
                    profiles:sender_id (id, username, full_name, avatar_url, role)
                `)
                .single();

            let finalMsg = data;

            if (error) {
                console.warn('sendProjectMentorMessage db insert error, saving to local fallback cache:', error);
                const localMsg = {
                    id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    project_id: projectId,
                    sender_id: currentUser.id,
                    message: message.trim(),
                    reply_to_id: replyToId,
                    created_at: new Date().toISOString(),
                    profiles: currentProfile || {
                        id: currentUser.id,
                        full_name: currentUser.user_metadata?.full_name || 'Mentor',
                        username: currentUser.email?.split('@')[0] || 'mentor',
                        avatar_url: currentUser.user_metadata?.avatar_url || null,
                        role: currentProfile?.role || 'mentor'
                    }
                };
                finalMsg = localMsg;
                try {
                    const cache = JSON.parse(localStorage.getItem('icc_mentor_messages_cache') || '[]');
                    cache.unshift(localMsg);
                    localStorage.setItem('icc_mentor_messages_cache', JSON.stringify(cache));
                } catch (e) {}
            } else {
                // Sync successfully sent message to local cache
                try {
                    const cache = JSON.parse(localStorage.getItem('icc_mentor_messages_cache') || '[]');
                    if (!cache.some(c => c.id === data.id)) {
                        cache.unshift(data);
                        localStorage.setItem('icc_mentor_messages_cache', JSON.stringify(cache));
                    }
                } catch (e) {}
            }

            // Broadcast message across active channel so connected team members receive it immediately
            try {
                const channelName = `project-mentor-chat-${projectId}`;
                const ch = client.channel(channelName);
                ch.send({
                    type: 'broadcast',
                    event: 'mentor_chat_msg',
                    payload: { type: 'INSERT', message: finalMsg }
                });
            } catch (bErr) {
                console.warn('Broadcast send warning:', bErr);
            }

            return { data: finalMsg, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    }

    async function deleteProjectMentorMessage(messageId, projectId = null) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
        try {
            // Permission check: Team leads and members cannot delete messages sent by mentors.
            if (!isMentor() && !isAdmin() && !isSuperAdmin()) {
                let senderId = null;
                try {
                    const cache = JSON.parse(localStorage.getItem('icc_mentor_messages_cache') || '[]');
                    const cachedMsg = cache.find(m => m.id === messageId);
                    if (cachedMsg) senderId = cachedMsg.sender_id;
                } catch (e) {}

                if (!senderId) {
                    const { data: msg } = await client
                        .from('project_mentor_messages')
                        .select('sender_id')
                        .eq('id', messageId)
                        .maybeSingle();
                    if (msg) senderId = msg.sender_id;
                }

                if (senderId && senderId !== currentUser.id) {
                    const { data: prof } = await client
                        .from('profiles')
                        .select('role')
                        .eq('id', senderId)
                        .maybeSingle();

                    if (prof) {
                        const role = (prof.role || '').toLowerCase();
                        const isSenderMentor = role === 'mentor' || role === 'super_admin' || role === 'superadmin';
                        if (isSenderMentor) {
                            return { error: { message: 'Team leads and members cannot delete messages sent by mentors.' } };
                        }
                    }
                }
            }

            const { error } = await client
                .from('project_mentor_messages')
                .delete()
                .eq('id', messageId);

            try {
                const cache = JSON.parse(localStorage.getItem('icc_mentor_messages_cache') || '[]');
                const filtered = cache.filter(m => m.id !== messageId);
                localStorage.setItem('icc_mentor_messages_cache', JSON.stringify(filtered));
            } catch (e) {}

            if (projectId) {
                try {
                    const channelName = `project-mentor-chat-${projectId}`;
                    const ch = client.channel(channelName);
                    ch.send({
                        type: 'broadcast',
                        event: 'mentor_chat_msg',
                        payload: { type: 'DELETE', messageId: messageId }
                    });
                } catch (bErr) {}
            }

            return { error };
        } catch (err) {
            return { error: err };
        }
    }

    function subscribeToProjectMentorChat(projectId, onEvent) {
        if (!client) return null;
        if (!canAccessProjectMentorChat(projectId)) {
            return () => {};
        }
        const channelName = `project-mentor-chat-${projectId}`;
        const channel = client.channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'project_mentor_messages',
                filter: `project_id=eq.${projectId}`
            }, async (payload) => {
                if (payload.eventType === 'INSERT') {
                    let senderProfile = null;
                    try {
                        const { data } = await client.from('profiles')
                            .select('id, username, full_name, avatar_url, role')
                            .eq('id', payload.new.sender_id)
                            .maybeSingle();
                        senderProfile = data;
                    } catch (e) {}
                    if (onEvent) onEvent({ type: 'INSERT', message: { ...payload.new, profiles: senderProfile } });
                } else if (payload.eventType === 'DELETE') {
                    if (onEvent) onEvent({ type: 'DELETE', messageId: payload.old.id });
                }
            })
            .on('broadcast', { event: 'mentor_chat_msg' }, (payload) => {
                if (!onEvent || !payload?.payload) return;
                const p = payload.payload;
                if (p.type === 'INSERT' && p.message) {
                    onEvent({ type: 'INSERT', message: p.message });
                } else if (p.type === 'DELETE' && p.messageId) {
                    onEvent({ type: 'DELETE', messageId: p.messageId });
                }
            })
            .subscribe();

        activeChannels.push({ name: channelName, channel });
        return () => {
            try {
                client.removeChannel(channel);
                activeChannels = activeChannels.filter(c => c.name !== channelName);
            } catch (e) {}
        };
    }

    // ==================== HELPERS ====================


    function getUser() { return currentUser; }
    function getProfile() { return currentProfile; }
    function isConfigured() { return client !== null; }
    function getClient() { return client; }

    function isAdmin(prof = currentProfile) {
        const target = prof || currentProfile;
        if (!target && !currentUser) return false;
        const role = (target?.role || '').toLowerCase().trim();
        if (role === 'admin' || role === 'super_admin' || role === 'superadmin') return true;
        if (role === 'mentor') {
            const perms = getAdminPermissions(target);
            return !!(perms.broadcast || perms.moderate || perms.events || perms.leads || perms.users_edit || perms.users_export || perms.all);
        }
        return false;
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


    async function fetchMentorsDirectory() {
        let dbMentors = [];
        if (client) {
            try {
                const { data, error } = await client
                    .from('profiles')
                    .select('id, full_name, username, avatar_url, role, email, phone, linkedin, github, created_at')
                    .or('role.eq.mentor,role.eq.super_admin,role.eq.superadmin')
                    .order('created_at', { ascending: true });

                if (!error && Array.isArray(data)) {
                    dbMentors = data;
                }
            } catch (e) {
                console.warn('fetchMentorsDirectory query error:', e);
            }
        }

        return dbMentors;
    }

    async function fetchStudentsDirectory(options = {}) {
        const {
            search = '',
            projectFilter = [],
            hasLinkedin = 'all',
            projectCountFilter = 'all',
            branch = '',
            year = '',
            sort = 'name_asc',
            page = 1,
            pageSize = 24
        } = options;

        // Try calling the backend API first
        try {
            const session = (await client?.auth?.getSession())?.data?.session;
            const token = session?.access_token;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const baseUrl = ICC_CONFIG.API_BASE_URL || '';
            const res = await fetch(`${baseUrl}/api/students`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    search,
                    projects: projectFilter,
                    hasLinkedin,
                    projectCount: projectCountFilter,
                    branch,
                    year,
                    sort,
                    page,
                    pageSize
                })
            });

            if (res.ok) {
                const json = await res.json();
                if (json && json.success) {
                    return json;
                }
            }
        } catch (apiErr) {
            console.warn('Backend /api/students call failed, falling back to direct Supabase query:', apiErr);
        }

        // Resilient Fallback: Query directly via Supabase client
        if (!client) return { success: false, error: 'Database not initialized', students: [], totalCount: 0, page: 1, pageSize, totalPages: 1, availableProjects: [] };

        try {
            // 1. Get live projects
            let liveProjects = [];
            const { data: dbLeads } = await client.from('core_leads').select('id, team, project_name, avatar_url, initials, color, gradient, lead_user_id');
            if (dbLeads && dbLeads.length > 0) {
                liveProjects = dbLeads;
            } else if (typeof CORE_LEADS !== 'undefined' && Array.isArray(CORE_LEADS)) {
                liveProjects = CORE_LEADS;
            }

            const projectsMap = new Map();
            liveProjects.forEach(p => {
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

            // 2. Get memberships
            const { data: allMemberships } = await client.from('team_memberships').select('user_id, team_id');
            const userProjectsMap = new Map();
            (allMemberships || []).forEach(m => {
                if (!m.user_id) return;
                const proj = projectsMap.get(Number(m.team_id));
                if (!proj) return;
                if (!userProjectsMap.has(m.user_id)) userProjectsMap.set(m.user_id, []);
                const list = userProjectsMap.get(m.user_id);
                if (!list.some(existing => existing.id === proj.id)) list.push(proj);
            });

            liveProjects.forEach(p => {
                if (p.lead_user_id) {
                    const proj = projectsMap.get(Number(p.id));
                    if (proj) {
                        if (!userProjectsMap.has(p.lead_user_id)) userProjectsMap.set(p.lead_user_id, []);
                        const list = userProjectsMap.get(p.lead_user_id);
                        if (!list.some(existing => existing.id === proj.id)) list.push(proj);
                    }
                }
            });

            // 3. Query profiles excluding only mentors (admins, super admins, leads, and regular members are all students)
            let query = client.from('profiles')
                .select('id, full_name, username, avatar_url, email, linkedin, year, branch, section, role, team_id, created_at, updated_at')
                .or('role.neq.mentor,role.is.null');

            const { data: rawProfiles, error: profErr } = await query;
            if (profErr) throw profErr;

            let filtered = (rawProfiles || []).filter(s => {
                const role = (s.role || '').toLowerCase().trim();
                if (role === 'mentor') return false;
                if (s.is_active === false || s.status === 'deactivated' || s.status === 'banned') return false;
                return true;
            });

            let mapped = filtered.map(s => {
                const projects = [...(userProjectsMap.get(s.id) || [])];
                if (s.team_id && projectsMap.has(Number(s.team_id))) {
                    const tp = projectsMap.get(Number(s.team_id));
                    if (!projects.some(p => p.id === tp.id)) projects.push(tp);
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

            // Filters
            const q = search.trim().toLowerCase();
            if (q) {
                mapped = mapped.filter(s => 
                    (s.full_name || '').toLowerCase().includes(q) ||
                    (s.username || '').toLowerCase().includes(q) ||
                    (s.email || '').toLowerCase().includes(q) ||
                    (s.projects || []).some(p => (p.name || '').toLowerCase().includes(q))
                );
            }

            if (hasLinkedin === 'yes') {
                mapped = mapped.filter(s => !!(s.linkedin && s.linkedin.trim()));
            } else if (hasLinkedin === 'no') {
                mapped = mapped.filter(s => !(s.linkedin && s.linkedin.trim()));
            }

            if (projectCountFilter === 'none' || projectCountFilter === '0' || projectCountFilter === 'no_projects') {
                mapped = mapped.filter(s => s.projects.length === 0);
            } else if (projectCountFilter === '1') {
                mapped = mapped.filter(s => s.projects.length === 1);
            } else if (projectCountFilter === '2') {
                mapped = mapped.filter(s => s.projects.length === 2);
            } else if (projectCountFilter === '3+' || projectCountFilter === '3_plus') {
                mapped = mapped.filter(s => s.projects.length >= 3);
            }

            if (Array.isArray(projectFilter) && projectFilter.length > 0) {
                const targetIds = projectFilter.map(id => Number(id));
                mapped = mapped.filter(s => s.projects.some(p => targetIds.includes(Number(p.id))));
            }

            if (branch) {
                mapped = mapped.filter(s => (s.branch || '').toLowerCase() === branch.toLowerCase());
            }

            if (year) {
                mapped = mapped.filter(s => (s.year || '').toLowerCase() === year.toLowerCase());
            }

            // Sorting
            mapped.sort((a, b) => {
                if (sort === 'name_desc') return (b.full_name || '').localeCompare(a.full_name || '');
                if (sort === 'most_projects') {
                    const diff = (b.projects?.length || 0) - (a.projects?.length || 0);
                    if (diff !== 0) return diff;
                    return (a.full_name || '').localeCompare(b.full_name || '');
                }
                if (sort === 'recently_joined' || sort === 'recent') {
                    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                }
                return (a.full_name || '').localeCompare(b.full_name || '');
            });

            const totalCount = mapped.length;
            const totalPages = Math.ceil(totalCount / pageSize) || 1;
            const startIndex = (page - 1) * pageSize;
            const paginatedStudents = mapped.slice(startIndex, startIndex + pageSize);

            const availableProjects = Array.from(projectsMap.values()).map(p => ({
                id: p.id,
                name: p.name,
                initials: p.initials,
                avatar_url: p.avatar_url
            }));

            return {
                success: true,
                students: paginatedStudents,
                totalCount,
                page,
                pageSize,
                totalPages,
                availableProjects
            };
        } catch (err) {
            console.error('Error in fetchStudentsDirectory fallback:', err);
            return {
                success: false,
                error: err.message,
                students: [],
                totalCount: 0,
                page: 1,
                pageSize,
                totalPages: 1,
                availableProjects: []
            };
        }
    }

    
    async function fetchUserProjects(userId) {
        if (!userId) return [];
        try {
            const projectIds = new Set();

            // 1. Live leads / projects
            let allLeads = [];
            try {
                allLeads = await fetchLeads();
            } catch (e) {}
            if (!allLeads || allLeads.length === 0) {
                allLeads = (typeof CORE_LEADS !== 'undefined' && Array.isArray(CORE_LEADS)) ? CORE_LEADS : [];
            }

            // 2. From team_memberships table
            if (client) {
                const { data } = await client
                    .from('team_memberships')
                    .select('team_id')
                    .eq('user_id', userId);
                (data || []).forEach(m => {
                    if (m && m.team_id) projectIds.add(Number(m.team_id));
                });
            }

            // 3. User profile check
            let targetProfile = (currentProfile && currentProfile.id === userId) ? currentProfile : null;
            if (!targetProfile) {
                targetProfile = await fetchUserById(userId);
            }
            if (targetProfile?.team_id) {
                projectIds.add(Number(targetProfile.team_id));
            }

            // 4. Also check if user is listed as team lead in allLeads
            allLeads.forEach(l => {
                if (l.lead_user_id === userId) {
                    projectIds.add(Number(l.id));
                } else if (targetProfile?.full_name && l.name && targetProfile.full_name.trim().toLowerCase() === l.name.trim().toLowerCase()) {
                    projectIds.add(Number(l.id));
                }
            });

            const results = [];
            projectIds.forEach(id => {
                const lead = allLeads.find(l => Number(l.id) === Number(id));
                if (lead) {
                    const isLeadOfThis = (lead.lead_user_id === userId) ||
                        (targetProfile?.role === 'lead' && Number(targetProfile?.team_id) === Number(lead.id)) ||
                        (targetProfile?.full_name && lead.name && targetProfile.full_name.trim().toLowerCase() === lead.name.trim().toLowerCase());

                    results.push({
                        id: lead.id,
                        name: lead.team || lead.project_name || `Project ${lead.id}`,
                        lead_name: lead.name,
                        initials: lead.initials || (lead.team ? lead.team.replace(/Team\s*/i, '').slice(0, 2).toUpperCase() : 'PR'),
                        gradient: lead.gradient || 'from-blue-600 to-indigo-600',
                        color: lead.color || '#3390ec',
                        specialties: Array.isArray(lead.specialties) ? lead.specialties : [],
                        bio: lead.bio || '',
                        is_lead: Boolean(isLeadOfThis)
                    });
                }
            });

            return results;
        } catch (err) {
            console.error('Error in fetchUserProjects:', err);
            return [];
        }
    }

    // ============================================
    // Registration Links & Two-Stage Approval API
    // ============================================
    async function getAuthHeader() {
        if (!client) return {};
        try {
            const { data } = await client.auth.getSession();
            const token = data?.session?.access_token;
            return token ? { 'Authorization': `Bearer ${token}` } : {};
        } catch {
            return {};
        }
    }

    async function hashTokenSha256(str) {
        try {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str).trim()));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {
            return String(str).trim();
        }
    }

    async function validateRegistrationToken(token) {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const res = await fetch(`${apiBase}/api/registration-link?action=validate&token=${encodeURIComponent(token)}`);
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data.valid === 'boolean') return data;
            }
        } catch (e) {
            console.warn('API validate failed, falling back to direct Supabase lookup:', e.message);
        }

        // Direct Supabase Client Fallback
        if (client) {
            try {
                const cleanToken = (token || '').trim();
                const tokenHash = await hashTokenSha256(cleanToken);
                let { data: linkRecord } = await client
                    .from('registration_links')
                    .select('id, is_active, expires_at, created_by, creator_name, creator_role')
                    .or(`token.eq.${cleanToken},token_hash.eq.${tokenHash}`)
                    .maybeSingle();

                if (!linkRecord) {
                    return { valid: false, reason: 'invalid' };
                }
                if (!linkRecord.is_active) {
                    return { valid: false, reason: 'disabled', admin_name: linkRecord.creator_name || 'Admin' };
                }
                if (linkRecord.expires_at && new Date(linkRecord.expires_at).getTime() < Date.now()) {
                    return { valid: false, reason: 'expired' };
                }
                return {
                    valid: true,
                    admin_id: linkRecord.created_by,
                    admin_name: linkRecord.creator_name || 'Admin',
                    admin_role: linkRecord.creator_role || 'Admin'
                };
            } catch (dbErr) {
                console.error('Direct validate fallback error:', dbErr);
            }
        }

        return { valid: false, reason: 'error', error: 'Network validation error' };
    }

    async function submitRegistration(formData) {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const res = await fetch(`${apiBase}/api/registration-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'submit', ...formData })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) return data;
            }
        } catch (e) {
            console.warn('API submit failed, falling back to direct Supabase insert:', e.message);
        }

        // Direct Supabase Fallback
        if (client) {
            try {
                const cleanToken = (formData.token || '').trim();
                const tokenHash = await hashTokenSha256(cleanToken);

                // Lookup link to get assigned admin
                const { data: linkRecord } = await client
                    .from('registration_links')
                    .select('id, is_active, expires_at, created_by, creator_name')
                    .or(`token.eq.${cleanToken},token_hash.eq.${tokenHash}`)
                    .maybeSingle();

                if (!linkRecord || !linkRecord.is_active) {
                    return { success: false, error: 'Registration link is disabled or inactive' };
                }

                const now = new Date().toISOString();
                const { data: newReq, error: insErr } = await client
                    .from('registration_requests')
                    .insert({
                        full_name: formData.full_name?.trim(),
                        usn: formData.usn?.trim()?.toUpperCase(),
                        branch: formData.branch,
                        year: formData.year,
                        email: formData.email?.trim()?.toLowerCase(),
                        phone: formData.phone?.trim(),
                        linkedin: formData.linkedin?.trim() || null,
                        github: formData.github?.trim() || null,
                        other_link: formData.other_link?.trim() || null,
                        assigned_admin_id: linkRecord.created_by || null,
                        assigned_admin_name: linkRecord.creator_name || null,
                        status: 'pending_review',
                        audit_log: [{
                            action: 'submitted',
                            actor: 'Applicant',
                            timestamp: now,
                            details: `Application submitted via link of ${linkRecord.creator_name || 'Admin'}`
                        }],
                        created_at: now,
                        updated_at: now
                    })
                    .select()
                    .single();

                if (insErr) throw insErr;
                return { success: true, message: 'Registration request submitted successfully.', request: newReq };
            } catch (dbErr) {
                console.error('Direct submission error:', dbErr);
                return { success: false, error: dbErr.message || 'Submission error' };
            }
        }

        return { success: false, error: 'Could not connect to registration server.' };
    }

    async function getRegistrationLinkInfo() {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const authHdr = await getAuthHeader();
            const res = await fetch(`${apiBase}/api/registration-link?action=get-active`, {
                headers: { ...authHdr }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) return data;
            }
        } catch (e) {
            console.warn('API getRegistrationLinkInfo failed, using direct Supabase fallback:', e.message);
        }

        // Direct Supabase Fallback
        if (client) {
            try {
                const user = getUser();
                if (!user) return { success: false, error: 'User session required' };
                const prof = getProfile() || {};

                // Get caller's link
                let { data: myLink, error: fetchErr } = await client
                    .from('registration_links')
                    .select('*')
                    .eq('created_by', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!myLink) {
                    const seed = user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
                    const rand = Math.random().toString(36).substring(2, 10);
                    const tokenStr = `reg_${seed}_${rand}`;
                    const tokenHash = await hashTokenSha256(tokenStr);
                    const now = new Date().toISOString();

                    const { data: created, error: insErr } = await client
                        .from('registration_links')
                        .insert({
                            token: tokenStr,
                            token_hash: tokenHash,
                            is_active: true,
                            created_by: user.id,
                            creator_name: prof.full_name || prof.username || 'Admin',
                            creator_role: isSuperAdmin() ? 'Super Admin' : 'Admin',
                            created_at: now,
                            updated_at: now
                        })
                        .select()
                        .single();

                    if (!insErr && created) {
                        return { success: true, link: created, token: created.token };
                    }
                } else if (!myLink.token) {
                    const seed = user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
                    const rand = Math.random().toString(36).substring(2, 10);
                    const tokenStr = `reg_${seed}_${rand}`;
                    const tokenHash = await hashTokenSha256(tokenStr);

                    const { data: updated } = await client
                        .from('registration_links')
                        .update({
                            token: tokenStr,
                            token_hash: tokenHash,
                            is_active: true,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', myLink.id)
                        .select()
                        .single();

                    if (updated) {
                        return { success: true, link: updated, token: updated.token };
                    }
                } else {
                    return { success: true, link: myLink, token: myLink.token };
                }
            } catch (dbErr) {
                console.error('Direct getRegistrationLinkInfo fallback error:', dbErr);
            }
        }

        return { success: false, error: 'Failed to retrieve registration link' };
    }

    async function generateRegistrationLink(options = {}) {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const authHdr = await getAuthHeader();
            const res = await fetch(`${apiBase}/api/registration-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHdr },
                body: JSON.stringify({ action: 'generate', ...options })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) return data;
            }
        } catch (e) {
            console.warn('API generateRegistrationLink failed, using direct Supabase fallback:', e.message);
        }

        // Direct Supabase Fallback (100% reliable)
        if (client) {
            try {
                const user = getUser();
                if (!user) return { success: false, error: 'User session required' };
                const prof = getProfile() || {};

                const seed = user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
                const rand = Math.random().toString(36).substring(2, 10);
                const tokenStr = `reg_${seed}_${rand}`;
                const tokenHash = await hashTokenSha256(tokenStr);
                const now = new Date().toISOString();

                // Find existing
                const { data: existing } = await client
                    .from('registration_links')
                    .select('id')
                    .eq('created_by', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                let resLink = null;
                if (existing) {
                    const { data: updated, error: uErr } = await client
                        .from('registration_links')
                        .update({
                            token: tokenStr,
                            token_hash: tokenHash,
                            is_active: true,
                            creator_name: prof.full_name || prof.username || 'Admin',
                            creator_role: isSuperAdmin() ? 'Super Admin' : 'Admin',
                            updated_at: now
                        })
                        .eq('id', existing.id)
                        .select()
                        .single();
                    if (uErr) throw uErr;
                    resLink = updated;
                } else {
                    const { data: created, error: cErr } = await client
                        .from('registration_links')
                        .insert({
                            token: tokenStr,
                            token_hash: tokenHash,
                            is_active: true,
                            created_by: user.id,
                            creator_name: prof.full_name || prof.username || 'Admin',
                            creator_role: isSuperAdmin() ? 'Super Admin' : 'Admin',
                            created_at: now,
                            updated_at: now
                        })
                        .select()
                        .single();
                    if (cErr) throw cErr;
                    resLink = created;
                }

                return { success: true, token: tokenStr, link: resLink };
            } catch (dbErr) {
                console.error('Direct generate fallback error:', dbErr);
                return { success: false, error: dbErr.message || 'Failed to generate link' };
            }
        }

        return { success: false, error: 'Failed to generate registration link' };
    }

    async function toggleRegistrationLink(isActive, expiresAt) {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const authHdr = await getAuthHeader();
            const res = await fetch(`${apiBase}/api/registration-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHdr },
                body: JSON.stringify({ action: 'toggle', is_active: isActive, expires_at: expiresAt })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) return data;
            }
        } catch (e) {
            console.warn('API toggleRegistrationLink failed, using direct Supabase fallback:', e.message);
        }

        // Direct Supabase Fallback
        if (client) {
            try {
                const user = getUser();
                if (!user) return { success: false, error: 'User session required' };

                const { data: targetLink } = await client
                    .from('registration_links')
                    .select('id')
                    .eq('created_by', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!targetLink) return { success: false, error: 'Registration link not found' };

                const { data: updated, error: uErr } = await client
                    .from('registration_links')
                    .update({
                        is_active: isActive,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', targetLink.id)
                    .select()
                    .single();

                if (uErr) throw uErr;
                return { success: true, link: updated };
            } catch (dbErr) {
                console.error('Direct toggle fallback error:', dbErr);
                return { success: false, error: dbErr.message || 'Failed to toggle link' };
            }
        }

        return { success: false, error: 'Failed to toggle link' };
    }

    async function fetchRegistrationRequests(params = {}) {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const authHdr = await getAuthHeader();
            const query = new URLSearchParams({ action: 'list', ...params }).toString();
            const res = await fetch(`${apiBase}/api/registration-requests?${query}`, {
                headers: { ...authHdr }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) return data;
            }
        } catch (e) {
            console.warn('API fetchRegistrationRequests failed, using direct Supabase fallback:', e.message);
        }

        // Direct Supabase Fallback
        if (client) {
            try {
                const user = getUser();
                const isSuper = isSuperAdmin();

                let query = client.from('registration_requests').select('*');
                if (!isSuper && user) {
                    query = query.eq('assigned_admin_id', user.id);
                }

                if (params.status && params.status !== 'all') {
                    query = query.eq('status', params.status);
                }
                if (params.branch && params.branch !== 'all') {
                    query = query.ilike('branch', `%${params.branch}%`);
                }
                if (params.year && params.year !== 'all') {
                    query = query.eq('year', params.year);
                }
                if (params.search) {
                    const s = params.search;
                    query = query.or(`full_name.ilike.%${s}%,usn.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
                }

                query = query.order('created_at', { ascending: false });
                const { data: requests, error: rErr } = await query;
                if (rErr) throw rErr;

                // Aggregate counts
                let countQuery = client.from('registration_requests').select('status');
                if (!isSuper && user) {
                    countQuery = countQuery.eq('assigned_admin_id', user.id);
                }
                const { data: allReqs } = await countQuery;
                const counts = { pending_review: 0, awaiting_super_admin: 0, approved: 0, denied: 0 };
                if (allReqs) {
                    allReqs.forEach(r => {
                        if (counts[r.status] !== undefined) counts[r.status]++;
                    });
                }

                return { success: true, requests: requests || [], counts };
            } catch (dbErr) {
                console.error('Direct fetch requests fallback error:', dbErr);
            }
        }

        return { success: false, requests: [], counts: { pending_review: 0, awaiting_super_admin: 0, approved: 0, denied: 0 } };
    }

    async function forwardRegistrationRequest(id, note = '') {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const authHdr = await getAuthHeader();
            const res = await fetch(`${apiBase}/api/registration-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHdr },
                body: JSON.stringify({ action: 'forward', id, note })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) return data;
            }
        } catch (e) {
            console.warn('API forwardRegistrationRequest failed, using direct Supabase fallback:', e.message);
        }

        // Direct Supabase Fallback
        if (client) {
            try {
                const user = getUser();
                const prof = getProfile() || {};
                const now = new Date().toISOString();

                const { data: currentReq } = await client.from('registration_requests').select('*').eq('id', id).single();
                const auditLog = Array.isArray(currentReq?.audit_log) ? currentReq.audit_log : [];
                auditLog.push({
                    action: 'forwarded',
                    actor_id: user?.id,
                    actor_name: prof.full_name || 'Admin',
                    actor_role: isSuperAdmin() ? 'Super Admin' : (isAdmin() ? 'Admin' : 'Mentor'),
                    note: note || 'Forwarded to Super Admin for final review',
                    timestamp: now
                });

                const { data: updated, error: uErr } = await client
                    .from('registration_requests')
                    .update({
                        status: 'awaiting_super_admin',
                        first_reviewer_id: user?.id,
                        first_reviewer_name: prof.full_name || 'Admin',
                        first_reviewer_role: isSuperAdmin() ? 'Super Admin' : (isAdmin() ? 'Admin' : 'Mentor'),
                        first_reviewer_note: note || null,
                        first_reviewed_at: now,
                        audit_log: auditLog,
                        updated_at: now
                    })
                    .eq('id', id)
                    .select()
                    .single();

                if (uErr) throw uErr;
                return { success: true, request: updated };
            } catch (dbErr) {
                return { success: false, error: dbErr.message };
            }
        }
        return { success: false, error: 'Could not forward request' };
    }

    async function approveRegistrationRequest(id) {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const authHdr = await getAuthHeader();
            const res = await fetch(`${apiBase}/api/registration-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHdr },
                body: JSON.stringify({ action: 'approve', id })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) return data;
            }
        } catch (e) {
            console.warn('API approveRegistrationRequest failed, using direct Supabase fallback:', e.message);
        }

        // Direct Supabase Fallback (Super Admin Only)
        if (client && isSuperAdmin()) {
            try {
                const user = getUser();
                const prof = getProfile() || {};
                const now = new Date().toISOString();
                const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

                const { data: currentReq } = await client.from('registration_requests').select('*').eq('id', id).single();
                if (!currentReq) return { success: false, error: 'Request not found' };

                const auditLog = Array.isArray(currentReq.audit_log) ? currentReq.audit_log : [];
                auditLog.push({
                    action: 'approved',
                    actor_id: user?.id,
                    actor_name: prof.full_name || 'Super Admin',
                    actor_role: 'Super Admin',
                    timestamp: now,
                    details: 'Granted full platform access'
                });

                const { data: updatedReq, error: uErr } = await client
                    .from('registration_requests')
                    .update({
                        status: 'approved',
                        final_approver_id: user?.id,
                        final_approver_name: prof.full_name || 'Super Admin',
                        final_approver_role: 'Super Admin',
                        final_approved_at: now,
                        audit_log: auditLog,
                        updated_at: now
                    })
                    .eq('id', id)
                    .select()
                    .single();

                if (uErr) throw uErr;

                // Update or create profile
                const approvedByFormatted = `${prof.full_name || 'Super Admin'} · Super Admin · ${dateStr}`;
                const reviewedByFormatted = currentReq.first_reviewer_name ? `${currentReq.first_reviewer_name} · ${currentReq.first_reviewer_role || 'Admin'} · ${dateStr}` : 'Direct Super Admin Review';

                const { data: existingProf } = await client
                    .from('profiles')
                    .select('id')
                    .or(`email.ilike.${currentReq.email},usn.ilike.${currentReq.usn}`)
                    .maybeSingle();

                if (existingProf) {
                    await client.from('profiles').update({
                        approval_status: 'approved',
                        approved_by: approvedByFormatted,
                        reviewed_by: reviewedByFormatted,
                        approved_at: now,
                        full_name: currentReq.full_name,
                        usn: currentReq.usn,
                        phone: currentReq.phone,
                        role: 'member',
                        updated_at: now
                    }).eq('id', existingProf.id);
                }

                return { success: true, message: `Request approved for ${currentReq.full_name}.`, request: updatedReq };
            } catch (dbErr) {
                return { success: false, error: dbErr.message };
            }
        }
        return { success: false, error: 'Could not approve request' };
    }

    async function denyRegistrationRequest(id, reason = '') {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const authHdr = await getAuthHeader();
            const res = await fetch(`${apiBase}/api/registration-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHdr },
                body: JSON.stringify({ action: 'deny', id, reason })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) return data;
            }
        } catch (e) {
            console.warn('API denyRegistrationRequest failed, using direct Supabase fallback:', e.message);
        }

        // Direct Supabase Fallback
        if (client) {
            try {
                const user = getUser();
                const prof = getProfile() || {};
                const now = new Date().toISOString();

                const { data: currentReq } = await client.from('registration_requests').select('*').eq('id', id).single();
                const auditLog = Array.isArray(currentReq?.audit_log) ? currentReq.audit_log : [];
                auditLog.push({
                    action: 'denied',
                    actor_id: user?.id,
                    actor_name: prof.full_name || 'Admin',
                    actor_role: isSuperAdmin() ? 'Super Admin' : (isAdmin() ? 'Admin' : 'Mentor'),
                    reason: reason || 'Not specified',
                    timestamp: now
                });

                const { data: updated, error: uErr } = await client
                    .from('registration_requests')
                    .update({
                        status: 'denied',
                        denied_by_id: user?.id,
                        denied_by_name: prof.full_name || 'Admin',
                        denied_by_role: isSuperAdmin() ? 'Super Admin' : (isAdmin() ? 'Admin' : 'Mentor'),
                        denial_reason: reason || null,
                        denied_at: now,
                        audit_log: auditLog,
                        updated_at: now
                    })
                    .eq('id', id)
                    .select()
                    .single();

                if (uErr) throw uErr;
                return { success: true, message: 'Request denied.', request: updated };
            } catch (dbErr) {
                return { success: false, error: dbErr.message };
            }
        }
        return { success: false, error: 'Could not deny request' };
    }

    async function reopenRegistrationRequest(id, targetStatus) {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const authHdr = await getAuthHeader();
            const res = await fetch(`${apiBase}/api/registration-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHdr },
                body: JSON.stringify({ action: 'reopen', id, target_status: targetStatus })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) return data;
            }
        } catch (e) {
            console.warn('API reopenRegistrationRequest failed, using direct Supabase fallback:', e.message);
        }

        if (client) {
            try {
                const user = getUser();
                const prof = getProfile() || {};
                const now = new Date().toISOString();

                const { data: currentReq } = await client.from('registration_requests').select('*').eq('id', id).single();
                const auditLog = Array.isArray(currentReq?.audit_log) ? currentReq.audit_log : [];
                auditLog.push({
                    action: 'reopened',
                    actor_id: user?.id,
                    actor_name: prof.full_name || 'Admin',
                    target_status: targetStatus,
                    timestamp: now
                });

                const { data: updated, error: uErr } = await client
                    .from('registration_requests')
                    .update({
                        status: targetStatus,
                        audit_log: auditLog,
                        updated_at: now
                    })
                    .eq('id', id)
                    .select()
                    .single();

                if (uErr) throw uErr;
                return { success: true, request: updated };
            } catch (dbErr) {
                return { success: false, error: dbErr.message };
            }
        }
        return { success: false, error: 'Could not reopen request' };
    }

    async function resendRegistrationEmail(id) {
        const apiBase = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.API_BASE_URL) ? ICC_CONFIG.API_BASE_URL : '';
        try {
            const authHdr = await getAuthHeader();
            const res = await fetch(`${apiBase}/api/registration-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHdr },
                body: JSON.stringify({ action: 'resend-email', id })
            });
            return await res.json();
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async function checkRegistrationStatus(email) {
        if (!client || !email) return null;
        try {
            const clean = email.toLowerCase().trim();
            const { data } = await client
                .from('registration_requests')
                .select('status')
                .ilike('email', clean)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data?.status || null;
        } catch {
            return null;
        }
    }

    return {
        init, signInWithGoogle, sendOTP, verifyOTP, verifyOTPOnly, signOut, getSession, onAuthStateChange,
        fetchProfile, updateProfile, fetchUserById, fetchProfileByEmail, searchUsers, checkUsernameAvailable,
        fetchStudentsDirectory, fetchMentorsDirectory, fetchUserProjects,
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
        subscribeToProjectApplications, subscribeToApplicationComments,
        // Project Mentor Chat API
        fetchProjectMentorMessages, fetchAllProjectMentorMessages, sendProjectMentorMessage, deleteProjectMentorMessage,
        subscribeToProjectMentorChat, canAccessProjectMentorChat, canUserAccessProjectMentorChat,
        // Core Space & Minutes of Meeting (MoM) API
        fetchCoreProfiles, fetchMinutesOfMeeting, createMinutesOfMeeting, updateMinutesOfMeeting, deleteMinutesOfMeeting, canManageMom, canManageInventory,
        // Project Tasks API
        fetchProjectTasks, fetchAllProjectTasks, createProjectTask, completeProjectTask, deleteProjectTask,
        // Registration & Approval API
        validateRegistrationToken, submitRegistration, getRegistrationLinkInfo,
        generateRegistrationLink, toggleRegistrationLink, fetchRegistrationRequests,
        forwardRegistrationRequest, approveRegistrationRequest, denyRegistrationRequest,
        reopenRegistrationRequest, resendRegistrationEmail, checkRegistrationStatus
    };
})();

