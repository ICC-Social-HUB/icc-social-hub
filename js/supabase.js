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
                return { error: { message: 'System error during master login', details: err } };
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
        fields.updated_at = new Date().toISOString();
        const { data, error } = await client
            .from('profiles').update(fields).eq('id', currentUser.id).select().single();
        if (!error && data) currentProfile = data;
        return { data, error };
    }

    async function fetchUserById(userId) {
        if (!client) return null;
        const { data } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
        return data;
    }

    async function fetchProfileByEmail(email) {
        if (!client || !email) return null;
        const { data } = await client.from('profiles')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();
        return data;
    }

    async function searchUsers(query) {
        if (!client) return [];
        const { data } = await client.from('profiles')
            .select('id, username, full_name, avatar_url, team_id, role')
            .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
            .limit(20);
        return data || [];
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
        
        // 3. Check if target team is full
        const { data: members } = await client.from('team_memberships').select('user_id').eq('team_id', parseInt(teamId));
        if (members && members.length >= 7) {
            return { error: { message: 'This team is already full (max 7 members).' } };
        }
        
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
            .select('user:user_id(id, username, full_name, avatar_url, role, updated_at)')
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

        // 0.5. Check if team is full
        const { data: teamMembers } = await client.from('team_memberships').select('user_id').eq('team_id', teamId);
        if (teamMembers && teamMembers.length >= 7) {
            return { error: { message: 'This team is already full (max 7 members). Cannot approve more members.' } };
        }
        
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
        if (!client) return { error: { message: 'Not configured' } };
        const { data, error } = await client.from('core_leads').insert([fields]).select();
        return { data: data && data.length > 0 ? data[0] : null, error };
    }

    async function updateLead(id, fields) {
        if (!client) return { error: { message: 'Not configured' } };
        fields.updated_at = new Date().toISOString();
        
        const { data, error } = await client.from('core_leads').update(fields).eq('id', id).select();
        return { data: data && data.length > 0 ? data[0] : null, error };
    }

    async function deleteLead(id) {
        if (!client) return { error: { message: 'Not configured' } };
        const { error } = await client.from('core_leads').delete().eq('id', id);
        return { error };
    }

    async function approveLead(userId, teamId) {
        if (!client) return { error: { message: 'Not configured' } };

        // Check limit
        if (teamId) {
            const { data: members } = await client.from('team_memberships').select('user_id').eq('team_id', teamId);
            if (members && members.length >= 7) {
                const isAlreadyIn = members.some(m => m.user_id === userId);
                if (!isAlreadyIn) {
                    return { error: { message: 'This team is already full (max 7 members).' } };
                }
            }
        }

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
        if (!client) return [];
        const { data } = await client.from('profiles')
            .select('*').eq('is_pending_lead', true);
        return data || [];
    }

    async function createBroadcast(message) {
        if (!client || !currentUser) return { error: { message: 'Not authenticated' } };
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
        if (!client) return { error: { message: 'Not configured' } };
        // Admin uses service role or RLS bypass — for now using normal delete
        const { error } = await client.from('posts').delete().eq('id', postId);
        return { error };
    }

    async function adminUpdateUser(userId, fields) {
        if (!client) return { error: { message: 'Not configured' } };

        // If team_id is being changed, check limit
        if (fields.hasOwnProperty('team_id') && fields.team_id !== null && fields.team_id !== 'none') {
            const { data: members } = await client.from('team_memberships').select('user_id').eq('team_id', fields.team_id);
            if (members && members.length >= 7) {
                const isAlreadyIn = members.some(m => m.user_id === userId);
                if (!isAlreadyIn) {
                    return { error: { message: 'Target team is full (7/7).' } };
                }
            }
        }

        const { data, error } = await client.from('profiles')
            .update(fields).eq('id', userId).select().single();
        
        // If team_id was updated, enforce one-team rule by clearing old ones first
        if (!error && fields.hasOwnProperty('team_id')) {
            console.log('adminUpdateUser: updating team_id to', fields.team_id);
            const { error: deleteError } = await client.from('team_memberships').delete().eq('user_id', userId);
            if (deleteError) console.error('adminUpdateUser deleteError:', deleteError);
            
            if (fields.team_id !== null) {
                const { error: insertError } = await client.from('team_memberships').insert({
                    user_id: userId,
                    team_id: fields.team_id
                });
                if (insertError) console.error('adminUpdateUser insertError:', insertError);
            } else {
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
        return { data, error };
    }

    async function adminDeleteUser(userId) {
        if (!client) return { error: { message: 'Not configured' } };
        const { error } = await client.rpc('admin_delete_user', { target_user_id: userId });
        return { error };
    }

    async function getAllProfiles() {
        if (!client) return [];
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
            if (u.team_memberships) {
                if (Array.isArray(u.team_memberships) && u.team_memberships.length > 0) {
                    membershipTeamId = u.team_memberships[0].team_id;
                } else if (!Array.isArray(u.team_memberships) && u.team_memberships.team_id) {
                    membershipTeamId = u.team_memberships.team_id;
                }
            }
            return {
                ...u,
                team_id: membershipTeamId || u.team_id
            };
        });
    }

    async function getAllPosts() {
        if (!client) return [];
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

    // ==================== HELPERS ====================

    function getUser() { return currentUser; }
    function getProfile() { return currentProfile; }
    function isConfigured() { return client !== null; }
    function getClient() { return client; }

    function isAdmin() {
        return currentProfile?.role === 'admin';
    }

    function isLead() {
        return currentProfile?.role === 'lead';
    }

    function needsOnboarding() {
        return currentProfile && !currentProfile.username;
    }

    return {
        init, signInWithGoogle, sendOTP, verifyOTP, signOut, getSession, onAuthStateChange,
        fetchProfile, updateProfile, fetchUserById, fetchProfileByEmail, searchUsers, checkUsernameAvailable,
        fetchPosts, fetchPostById, fetchPostsByTeam, fetchPostsByUser, createPost, deletePost,
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
        subscribeToFeed, subscribeToMessages, subscribeToConversation,
        subscribeToTeam, subscribeToBroadcasts, subscribeToNotifications,
        unsubscribeChannel, cleanupAllChannels,
        getUser, getProfile, isConfigured, getClient, isAdmin, isLead, needsOnboarding
    };
})();
