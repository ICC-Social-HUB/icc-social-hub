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
        const email = profile.email || user.email || '';

        return `
        <section class="min-h-screen pt-2 pb-4" id="profile-section">
            <div class="max-w-lg mx-auto px-4">
                <div class="flex items-center justify-between mb-4 px-1">
                    <h1 class="font-heading font-bold text-xl">Profile</h1>
                    <button id="profile-signout" class="text-xs text-zinc-500 hover:text-red-400 transition-colors">Sign Out</button>
                </div>
                <div class="glass-card rounded-xl p-5 mb-4">
                    <div class="flex items-center gap-4">
                        <div class="avatar-ring"><div class="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden ${profile.avatar_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}" ${profile.avatar_url ? `data-full-image="${profile.avatar_url}"` : ''}>
                            ${profile.avatar_url ? `<img src="${profile.avatar_url}" class="w-full h-full object-cover">` : `<span class="font-heading font-bold text-xl text-red-500">${(profile.full_name || '?').charAt(0).toUpperCase()}</span>`}
                        </div></div>
                        <div class="flex-1 min-w-0">
                            <h2 class="font-heading font-bold text-lg truncate">${escapeHtml(profile.full_name || 'User')}${profile.role === 'lead' ? ICC_CONFIG.VERIFIED_TICK : ''}</h2>
                            ${profile.username ? `<p class="text-sm text-zinc-500">@${escapeHtml(profile.username)}</p>` : ''}
                            ${email ? `<p class="text-xs text-zinc-500 flex items-center gap-1.5 mt-1 truncate"><svg class="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg><span class="truncate">${escapeHtml(email)}</span></p>` : ''}
                            ${profile.phone ? `<p class="text-xs text-zinc-400 flex items-center gap-1.5 mt-1 truncate"><svg class="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg><a href="tel:${escapeHtml(profile.phone)}" class="hover:underline text-zinc-300">${escapeHtml(profile.phone)}</a></p>` : ''}
                            <div class="flex flex-wrap items-center gap-2 mt-1">
                                ${profile.year ? `<span class="px-2 py-0.5 bg-rose-500/15 text-rose-400 rounded text-[10px] font-semibold">${escapeHtml(profile.year)}</span>` : ''}
                                ${profile.branch ? `<span class="px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded text-[10px] font-semibold">${escapeHtml(profile.branch)}</span>` : ''}
                                ${(profile.memberships || []).map(tid => {
                                    const lead = getLeadByTeamId(tid);
                                    return lead ? `<span class="px-2 py-0.5 bg-zinc-800/80 rounded text-[10px] text-zinc-300 font-medium">${lead.team}</span>` : '';
                                }).join('')}
                                ${profile.role === 'lead' ? `<span class="px-2 py-0.5 bg-red-600/15 text-red-400 rounded text-[10px] font-bold uppercase">${profile.role}</span>` : ''}
                            </div>
                        </div>
                        <button id="profile-edit-btn" class="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
                        </button>
                    </div>

                    ${(profile.linkedin || profile.github) ? `
                    <div class="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-zinc-800/80">
                        ${profile.linkedin ? `
                        <a href="${profile.linkedin.startsWith('http') ? profile.linkedin : 'https://' + profile.linkedin}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-950/40 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-900/40 transition-colors">
                            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
                            LinkedIn
                        </a>` : ''}
                        ${profile.github ? `
                        <a href="${profile.github.startsWith('http') ? profile.github : 'https://' + profile.github}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-800/80 text-zinc-200 rounded-lg text-xs font-medium hover:bg-zinc-700 transition-colors">
                            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
                            GitHub
                        </a>` : ''}
                    </div>` : ''}
                    ${profile.bio ? `<p class="text-sm text-zinc-400 mt-3 leading-relaxed">${escapeHtml(profile.bio)}</p>` : ''}
                    ${profile.skills?.length ? `<div class="flex flex-wrap gap-1.5 mt-3">${profile.skills.map(s => `<span class="px-2 py-0.5 bg-zinc-800/80 rounded text-[10px] text-zinc-400 font-medium">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
                </div>

                ${editing ? renderEditForm(profile) : ''}

                <div class="flex items-center justify-between mb-3 px-1">
                    <p class="text-xs font-semibold text-zinc-500">${userPosts.length} Posts</p>
                </div>
                ${userPosts.length > 0 ? `
                <div class="profile-post-grid mb-4">
                    ${userPosts.map(p => `
                        <a href="#post/${p.id}" class="profile-post-thumb block overflow-hidden rounded-lg">
                            ${p.image_url ? `<img src="${p.image_url}" alt="" loading="lazy" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600 text-[10px] p-1 text-center leading-tight">${escapeHtml((p.caption || '').slice(0, 30))}</div>`}
                        </a>
                    `).join('')}
                </div>` : `
                <div class="empty-state py-12">
                    <p class="text-sm text-zinc-600">No posts yet — share your first idea!</p>
                </div>`}

                ${ICCSupabase.isAdmin() ? `<a href="#admin" class="block w-full text-center px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors border border-zinc-700 mt-4">⚙️ Admin Dashboard</a>` : ''}

                <!-- Developer Credit -->
                <div class="mt-16 mb-12 py-8 border-t border-zinc-800/50 text-center animate-fade-in">
                    <p class="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium mb-3">Crafted with ❤️ by</p>
                    <a href="https://saravanantm1920.wixsite.com/my-site-4" target="_blank" 
                       class="inline-flex items-center gap-2 px-5 py-2 bg-zinc-800/50 hover:bg-red-500/10 text-zinc-300 hover:text-red-500 rounded-full border border-zinc-700/50 hover:border-red-500/50 transition-all duration-300 group shadow-lg">
                        <span class="text-sm font-bold tracking-tight">T M Saravanan</span>
                        <svg class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                    </a>
                </div>
            </div>
        </section>`;
    }

    function renderEditForm(profile) {
        const user = ICCSupabase.getUser();
        const email = profile.email || user?.email || '';

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

                <div>
                    <label class="block text-[11px] font-medium text-zinc-500 mb-1">Full Name</label>
                    <input type="text" id="edit-name" value="${escapeHtml(profile.full_name || '')}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[11px] font-medium text-zinc-500 mb-1">Academic Year <span class="text-red-400">*</span></label>
                        <select id="edit-year" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" required>
                            <option value="" disabled ${!profile.year ? 'selected' : ''}>Select Year</option>
                            ${['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => `<option value="${y}" ${profile.year === y ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-medium text-zinc-500 mb-1">Branch <span class="text-red-400">*</span></label>
                        <select id="edit-branch" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" required>
                            <option value="" disabled ${!profile.branch ? 'selected' : ''}>Select Branch</option>
                            ${['AIML', 'CSE', 'Mech', 'ICB', 'CCE', 'CSD', 'ECE'].map(b => `<option value="${b}" ${profile.branch === b ? 'selected' : ''}>${b}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label class="block text-[11px] font-medium text-zinc-500">Email Address</label>
                        <span class="text-[9px] text-zinc-500 font-mono bg-zinc-900 px-1.5 py-0.5 rounded">Read-Only</span>
                    </div>
                    <input type="email" value="${escapeHtml(email)}" disabled class="form-input w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800/80 rounded-lg text-sm text-zinc-400 cursor-not-allowed opacity-75">
                </div>

                <div>
                    <label class="block text-[11px] font-medium text-zinc-500 mb-1">Phone Number <span class="text-zinc-600">(optional)</span></label>
                    <input type="tel" id="edit-phone" value="${escapeHtml(profile.phone || '')}" placeholder="+91 9876543210" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white">
                </div>

                <div>
                    <label class="block text-[11px] font-medium text-zinc-500 mb-1">LinkedIn Profile <span class="text-zinc-600">(optional)</span></label>
                    <input type="url" id="edit-linkedin" value="${escapeHtml(profile.linkedin || '')}" placeholder="https://linkedin.com/in/username" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white">
                </div>

                <div>
                    <label class="block text-[11px] font-medium text-zinc-500 mb-1">GitHub Profile <span class="text-zinc-600">(optional)</span></label>
                    <input type="url" id="edit-github" value="${escapeHtml(profile.github || '')}" placeholder="https://github.com/username" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white">
                </div>

                <div>
                    <label class="block text-[11px] font-medium text-zinc-500 mb-1">Bio</label>
                    <textarea id="edit-bio" rows="2" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white resize-none" placeholder="Tell us about yourself...">${escapeHtml(profile.bio || '')}</textarea>
                </div>

                <div>
                    <label class="block text-[11px] font-medium text-zinc-500 mb-1">Skills <span class="text-zinc-600">(comma separated)</span></label>
                    <input type="text" id="edit-skills" value="${escapeHtml((profile.skills || []).join(', '))}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" placeholder="React, Python, UI Design...">
                </div>
                
                <!-- PASSWORD RESET SECTION -->
                <div class="pt-2 border-t border-zinc-800/60">
                    <button type="button" id="profile-reset-password-btn" class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2">
                        <svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                        Reset Password via Email OTP
                    </button>
                </div>

                <div class="flex gap-2 pt-2">
                    <button type="submit" id="edit-save-btn" class="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold transition-all">Save Changes</button>
                    <button type="button" id="edit-cancel" class="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors">Cancel</button>
                </div>
            </form>
        </div>`;
    }

    function renderSignedOut() {
        return `<div class="empty-state min-h-screen"><div class="empty-state-icon"><svg class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg></div><h3 class="font-heading font-semibold text-lg mb-1">Your Profile</h3><p class="text-sm text-zinc-500 mb-4">Sign in to see your profile</p><button onclick="AuthModal.open()" class="px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all">Sign In</button></div>`;
    }

    let _avatarFile = null;
    let _removeAvatar = false;

    async function mount(container) {
        editing = false;
        _avatarFile = null;
        _removeAvatar = false;
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
            container.innerHTML = render();
            bindEvents(container);
        });
        document.getElementById('edit-cancel')?.addEventListener('click', () => {
            editing = false;
            _avatarFile = null;
            _removeAvatar = false;
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

        // Password Reset via OTP
        document.getElementById('profile-reset-password-btn')?.addEventListener('click', async () => {
            const user = ICCSupabase.getUser();
            if (!user || !user.email) return;

            if (confirm(`Send a password reset code to ${user.email}?`)) {
                try {
                    const { error } = await ICCSupabase.sendOTP(user.email);
                    if (error) throw error;

                    Toast.success('Reset code sent! Opening reset window...');
                    AuthModal.open('forgot-otp', user.email);
                } catch (err) {
                    Toast.error('Failed to send reset code: ' + err.message);
                }
            }
        });

        // Direct Profile Form Submit (No OTP required for updating details)
        document.getElementById('profile-edit-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const saveBtn = document.getElementById('edit-save-btn');
            
            const yearVal = document.getElementById('edit-year')?.value;
            const branchVal = document.getElementById('edit-branch')?.value;

            if (!yearVal || !branchVal) {
                Toast.error('Academic Year and Branch are compulsory fields');
                return;
            }

            if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<div class="spinner spinner-sm mx-auto"></div> Saving...'; }

            const fields = {
                full_name: document.getElementById('edit-name').value.trim(),
                year: yearVal,
                branch: branchVal,
                phone: document.getElementById('edit-phone').value.trim() || null,
                linkedin: document.getElementById('edit-linkedin').value.trim() || null,
                github: document.getElementById('edit-github').value.trim() || null,
                bio: document.getElementById('edit-bio').value.trim() || null,
                skills: document.getElementById('edit-skills').value.split(',').map(s => s.trim()).filter(Boolean)
            };

            // Upload avatar if file selected
            if (_avatarFile) {
                const { url, error: upErr } = await ICCSupabase.uploadImage('avatars', _avatarFile);
                if (upErr) {
                    Toast.error('Avatar upload failed');
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
                    return;
                }
                fields.avatar_url = url;
            } else if (_removeAvatar) {
                fields.avatar_url = null;
                const oldAvatar = ICCSupabase.getProfile()?.avatar_url;
                if (oldAvatar) await ICCSupabase.deleteImage('avatars', oldAvatar);
            }

            const { error: saveErr } = await ICCSupabase.updateProfile(fields);
            if (saveErr) {
                Toast.error('Profile update failed: ' + saveErr.message);
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
            } else {
                Toast.success('Profile updated successfully!');
                editing = false;
                _avatarFile = null;
                _removeAvatar = false;
                container.innerHTML = render();
                bindEvents(container);
                BottomNav.mount();
            }
        });
    }

    function unmount() { editing = false; userPosts = []; }
    return { mount, unmount };
})();
