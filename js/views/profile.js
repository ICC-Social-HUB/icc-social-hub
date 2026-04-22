/* ============================================
   ICC Social Hub — Profile View
   ============================================ */
const ProfileView = (() => {
    let userPosts = [];
    let editing = false;

    function render() {
        const user = ICCSupabase.getUser();
        const profile = ICCSupabase.getProfile();
        if (!user || !profile) return renderSignedOut();

        const teamLead = profile.team_id ? getLeadByTeamId(profile.team_id) : null;
        return `
        <section class="min-h-screen pt-2 pb-4" id="profile-section">
            <div class="max-w-lg mx-auto px-4">
                <div class="flex items-center justify-between mb-4 px-1">
                    <h1 class="font-heading font-bold text-xl">Profile</h1>
                    <button id="profile-signout" class="text-xs text-zinc-500 hover:text-red-400 transition-colors">Sign Out</button>
                </div>
                <div class="glass-card rounded-xl p-5 mb-4">
                    <div class="flex items-center gap-4">
                        <div class="avatar-ring"><div class="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden">
                            ${profile.avatar_url ? `<img src="${profile.avatar_url}" class="w-full h-full object-cover">` : `<span class="font-heading font-bold text-xl text-red-500">${(profile.full_name || '?').charAt(0).toUpperCase()}</span>`}
                        </div></div>
                        <div class="flex-1 min-w-0">
                            <h2 class="font-heading font-bold text-lg truncate">${profile.full_name || 'User'}</h2>
                            ${profile.username ? `<p class="text-sm text-zinc-500">@${profile.username}</p>` : ''}
                            <div class="flex items-center gap-2 mt-1">
                                ${teamLead ? `<span class="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">${teamLead.team}</span>` : ''}
                                ${(profile.role === 'lead' || profile.role === 'admin') ? `<span class="px-2 py-0.5 bg-red-600/15 text-red-400 rounded text-[10px] font-bold uppercase">${profile.role}</span>` : ''}
                            </div>
                        </div>
                        <button id="profile-edit-btn" class="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
                        </button>
                    </div>
                    ${profile.bio ? `<p class="text-sm text-zinc-400 mt-3 leading-relaxed">${escapeHtml(profile.bio)}</p>` : ''}
                    ${profile.skills?.length ? `<div class="flex flex-wrap gap-1.5 mt-3">${profile.skills.map(s => `<span class="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-400">${s}</span>`).join('')}</div>` : ''}
                </div>

                ${editing ? renderEditForm(profile) : ''}

                <div class="flex items-center justify-between mb-3 px-1">
                    <p class="text-xs font-semibold text-zinc-500">${userPosts.length} Posts</p>
                </div>
                ${userPosts.length > 0 ? `
                <div class="profile-post-grid mb-4">
                    ${userPosts.map(p => `<div class="profile-post-thumb">${p.image_url ? `<img src="${p.image_url}" alt="" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600 text-[10px] p-1 text-center leading-tight">${(p.caption || '').slice(0, 30)}</div>`}</div>`).join('')}
                </div>` : `
                <div class="empty-state py-12">
                    <p class="text-sm text-zinc-600">No posts yet — share your first idea!</p>
                </div>`}

                ${ICCSupabase.isAdmin() ? `<a href="#admin" class="block w-full text-center px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors border border-zinc-700 mt-4">⚙️ Admin Dashboard</a>` : ''}
            </div>
        </section>`;
    }

    function renderEditForm(profile) {
        return `
        <div class="glass-card rounded-xl p-5 mb-4 animate-slide-up" id="edit-form-card">
            <h3 class="font-heading font-semibold text-sm mb-3">Edit Profile</h3>
            <form id="profile-edit-form" class="space-y-3">
                <div class="flex items-center gap-4 mb-2">
                    <div class="relative cursor-pointer" id="avatar-upload-trigger">
                        <div class="avatar-ring"><div class="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden" id="avatar-edit-preview">
                            ${profile.avatar_url ? `<img src="${profile.avatar_url}" class="w-full h-full object-cover">` : `<span class="font-heading font-bold text-xl text-red-500">${(profile.full_name || '?').charAt(0).toUpperCase()}</span>`}
                        </div></div>
                        <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                            <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                        </div>
                        <input type="file" id="edit-avatar-file" accept="image/*" class="hidden">
                    </div>
                    <div class="flex flex-col justify-center">
                        <div class="text-xs text-zinc-500 mb-1">Tap to change<br>your photo</div>
                        ${profile.avatar_url ? `<button type="button" id="edit-remove-avatar" class="text-xs text-red-500 hover:text-red-400 font-medium text-left">Remove photo</button>` : ''}
                    </div>
                </div>
                <div><label class="block text-[11px] font-medium text-zinc-500 mb-1">Full Name</label><input type="text" id="edit-name" value="${profile.full_name || ''}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                
                <!-- EMAIL CHANGE OTP SECTION -->
                <div>
                    <label class="block text-[11px] font-medium text-zinc-500 mb-1">Email Address</label>
                    <div class="flex gap-2">
                        <input type="email" id="edit-email" value="${_emailEditState === 'idle' ? (ICCSupabase.getUser()?.email || '') : _newEmailDraft}" class="form-input flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" ${_emailEditState === 'otp_sent' ? 'disabled' : ''} placeholder="New email address">
                        ${_emailEditState === 'idle' ? `<button type="button" id="edit-send-otp-btn" class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-semibold transition-colors">Change</button>` : ''}
                        ${_emailEditState === 'sending' ? `<button type="button" disabled class="px-3 py-2 bg-zinc-800 rounded-lg text-xs font-semibold"><div class="spinner spinner-sm"></div></button>` : ''}
                    </div>
                </div>
                ${_emailEditState === 'otp_sent' ? `
                <div class="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg animate-slide-down">
                    <label class="block text-[11px] font-medium text-zinc-500 mb-1 text-center">Enter 6-digit code sent to ${_newEmailDraft}</label>
                    <div class="flex gap-2">
                        <input type="text" id="edit-otp" placeholder="123456" class="form-input flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white text-center font-bold tracking-[0.2em]" maxlength="6">
                        <button type="button" id="edit-verify-otp-btn" class="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold transition-all w-20" id="verify-btn-text">Verify</button>
                    </div>
                </div>` : ''}

                <div><label class="block text-[11px] font-medium text-zinc-500 mb-1">Bio</label><textarea id="edit-bio" rows="2" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white resize-none">${profile.bio || ''}</textarea></div>
                <div><label class="block text-[11px] font-medium text-zinc-500 mb-1">Skills <span class="text-zinc-600">(comma separated)</span></label><input type="text" id="edit-skills" value="${(profile.skills || []).join(', ')}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" placeholder="React, Design, ML..."></div>
                <div class="flex gap-2 pt-1">
                    <button type="submit" id="edit-save-btn" class="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold transition-all">Save</button>
                    <button type="button" id="edit-cancel" class="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors">Cancel</button>
                </div>
            </form>
        </div>`;
    }

    function renderSignedOut() {
        return `<div class="empty-state min-h-screen"><div class="empty-state-icon"><svg class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg></div><h3 class="font-heading font-semibold text-lg mb-1">Your Profile</h3><p class="text-sm text-zinc-500 mb-4">Sign in to see your profile</p><button onclick="AuthModal.open()" class="px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all">Sign In</button></div>`;
    }

    let _avatarFile = null;
    let _removeAvatar = false;
    let _emailEditState = 'idle'; // 'idle', 'sending', 'otp_sent'
    let _newEmailDraft = '';

    async function mount(container) {
        editing = false;
        _avatarFile = null;
        _removeAvatar = false;
        _emailEditState = 'idle';
        _newEmailDraft = '';
        container.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="spinner"></div></div>';
        if (ICCSupabase.getUser()) {
            userPosts = await ICCSupabase.fetchPostsByUser(ICCSupabase.getUser().id);
        }
        container.innerHTML = render();
        bindEvents(container);
    }

    function bindEvents(container) {
        document.getElementById('profile-signout')?.addEventListener('click', async () => {
            await ICCSupabase.signOut();
            BottomNav.mount();
            window.location.hash = '#feed';
        });
        document.getElementById('profile-edit-btn')?.addEventListener('click', () => {
            editing = !editing;
            _avatarFile = null;
            _removeAvatar = false;
            _emailEditState = 'idle';
            _newEmailDraft = '';
            container.innerHTML = render();
            bindEvents(container);
        });
        document.getElementById('edit-cancel')?.addEventListener('click', () => {
            editing = false;
            _avatarFile = null;
            _removeAvatar = false;
            _emailEditState = 'idle';
            _newEmailDraft = '';
            container.innerHTML = render();
            bindEvents(container);
        });
        // Avatar file upload
        document.getElementById('avatar-upload-trigger')?.addEventListener('click', () => {
            document.getElementById('edit-avatar-file')?.click();
        });
        document.getElementById('edit-avatar-file')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { Toast.error('Image must be under 5MB'); return; }
            _avatarFile = file;
            _removeAvatar = false;
            const preview = document.getElementById('avatar-edit-preview');
            if (preview) preview.innerHTML = `<img src="${URL.createObjectURL(file)}" class="w-full h-full object-cover">`;
        });
        // Remove avatar
        document.getElementById('edit-remove-avatar')?.addEventListener('click', () => {
            _avatarFile = null;
            _removeAvatar = true;
            const preview = document.getElementById('avatar-edit-preview');
            const name = document.getElementById('edit-name')?.value || ICCSupabase.getProfile()?.full_name || '?';
            if (preview) preview.innerHTML = `<span class="font-heading font-bold text-xl text-red-500">${name.charAt(0).toUpperCase()}</span>`;
        });

        // OTP Send
        document.getElementById('edit-send-otp-btn')?.addEventListener('click', async () => {
            const newEmail = document.getElementById('edit-email').value.trim();
            const currentEmail = ICCSupabase.getUser()?.email;
            if (!newEmail || newEmail === currentEmail) {
                Toast.error('Please enter a new email address');
                return;
            }
            _emailEditState = 'sending';
            _newEmailDraft = newEmail;
            container.innerHTML = render();
            bindEvents(container);

            try {
                const response = await fetch('/api/generate-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: ICCSupabase.getUser().id, email: newEmail, newEmail: newEmail })
                });
                
                if (!response.ok) throw new Error((await response.json()).error);
                
                Toast.success('OTP sent to ' + newEmail);
                _emailEditState = 'otp_sent';
            } catch (err) {
                Toast.error('Failed to send OTP: ' + err.message);
                _emailEditState = 'idle';
            }
            container.innerHTML = render();
            bindEvents(container);
        });

        // OTP Verify
        document.getElementById('edit-verify-otp-btn')?.addEventListener('click', async (e) => {
            const otpCode = document.getElementById('edit-otp').value.trim();
            if (otpCode.length !== 6) { Toast.error('Enter 6-digit code'); return; }
            
            const btn = e.target;
            btn.innerHTML = '<div class="spinner spinner-sm"></div>';
            btn.disabled = true;

            try {
                const response = await fetch('/api/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: ICCSupabase.getUser().id, token: otpCode })
                });
                
                if (!response.ok) throw new Error((await response.json()).error);
                
                const data = await response.json();
                
                // Finalize email change in Supabase (Backend handled it securely using Admin API)
                // Update local session data so UI reflects new email immediately
                const client = ICCSupabase.getClient();
                await client.auth.refreshSession();

                Toast.success('Email updated successfully!');
                _emailEditState = 'idle';
                _newEmailDraft = '';
            } catch (err) {
                Toast.error('Verification failed: ' + err.message);
            }
            container.innerHTML = render();
            bindEvents(container);
        });
        document.getElementById('profile-edit-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const saveBtn = document.getElementById('edit-save-btn');
            if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<div class="spinner spinner-sm mx-auto"></div>'; }

            const fields = {
                full_name: document.getElementById('edit-name').value.trim(),
                bio: document.getElementById('edit-bio').value.trim(),
                skills: document.getElementById('edit-skills').value.split(',').map(s => s.trim()).filter(Boolean)
            };

            // Upload avatar if file selected
            if (_avatarFile) {
                const { url, error: upErr } = await ICCSupabase.uploadImage('avatars', _avatarFile);
                if (upErr) { Toast.error('Avatar upload failed'); if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; } return; }
                fields.avatar_url = url;
            } else if (_removeAvatar) {
                fields.avatar_url = null;
                const oldAvatar = ICCSupabase.getProfile()?.avatar_url;
                if (oldAvatar) await ICCSupabase.deleteImage('avatars', oldAvatar);
            }

            const { error } = await ICCSupabase.updateProfile(fields);
            if (error) Toast.error('Update failed: ' + error.message);
            else { Toast.success('Profile updated!'); editing = false; _avatarFile = null; _removeAvatar = false; container.innerHTML = render(); bindEvents(container); BottomNav.mount(); }
        });
    }

    function unmount() { editing = false; userPosts = []; }
    return { mount, unmount };
})();
