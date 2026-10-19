/* ============================================
   ICC Social Hub — Profile View (Redesigned from Reference UI)
   ============================================ */
const ProfileView = (() => {
    let userPosts = [];
    let userProjects = [];
    let editing = false;
    let _avatarFile = null;
    let _removeAvatar = false;

    function render() {
        const user = ICCSupabase.getUser();
        const profile = ICCSupabase.getProfile();
        if (!user || !profile) return renderSignedOut();

        const initial = (profile.full_name || profile.username || '?').charAt(0).toUpperCase();
        const linkedinUrl = profile.linkedin ? (profile.linkedin.startsWith('http') ? profile.linkedin : 'https://' + profile.linkedin) : null;
        const githubUrl = profile.github ? (profile.github.startsWith('http') ? profile.github : 'https://' + profile.github) : null;
        const email = profile.email || user.email || '';
        const phone = profile.phone ? String(profile.phone).trim() : null;

        const roleTick = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.getRoleTick) 
            ? ICC_CONFIG.getRoleTick(profile) 
            : '';

        const bioText = profile.bio ? String(profile.bio).trim() : '';

        const skills = Array.isArray(profile.skills) 
            ? profile.skills 
            : (typeof profile.skills === 'string' ? profile.skills.split(',').map(s => s.trim()).filter(Boolean) : []);

        return `
        <section class="min-h-screen pt-2 pb-16 bg-[#0e1621]" id="profile-section">
            <div class="max-w-xl mx-auto px-5 py-4 space-y-6">

                <!-- Top Header: Title & Sign Out -->
                <div class="flex items-center justify-between px-1">
                    <h1 class="font-heading font-extrabold text-xl text-white">Profile</h1>
                    <button id="profile-signout" class="text-xs font-semibold text-[#708499] hover:text-red-400 transition-colors cursor-pointer py-1 px-2.5 rounded-lg hover:bg-red-500/10">
                        Sign Out
                    </button>
                </div>

                <!-- 1. Circular Avatar (Top Left Aligned) -->
                <div class="flex items-center justify-between">
                    <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#17212b] overflow-hidden flex items-center justify-center text-3xl sm:text-4xl font-extrabold text-[#3390ec] shadow-xl flex-shrink-0 relative">
                        ${profile.avatar_url ? 
                            `<img src="${profile.avatar_url}" alt="${escapeHtml(profile.full_name || '')}" class="w-full h-full object-cover">` : 
                            initial
                        }
                    </div>
                </div>

                <!-- 2. Name & Verified Checkmark & Username -->
                <div class="space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <h2 class="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                            ${escapeHtml(profile.full_name || profile.username || 'User')}
                        </h2>
                        <span class="inline-flex items-center">
                            ${roleTick || (profile.role === 'lead' ? (ICC_CONFIG.VERIFIED_TICK || '✔') : '')}
                        </span>
                    </div>
                    <div class="flex items-center gap-2 text-xs text-[#708499] font-medium flex-wrap">
                        <span>@${escapeHtml(profile.username || 'user')}</span>
                        ${profile.role === 'mentor' ? `
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300">🎓 Mentor</span>
                        ` : ''}
                        ${profile.role === 'lead' ? `
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#3390ec]/15 text-[#3390ec]">Team Lead</span>
                        ` : ''}
                    </div>
                </div>

                <!-- 3. Bio Description Paragraph -->
                ${bioText ? `
                <p class="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal">
                    ${escapeHtml(bioText)}
                </p>
                ` : ''}

                <!-- 4. Key Metrics / Stats Row (Reference: 600 Followers 100 Post) -->
                <div class="flex items-center gap-8 py-1">
                    <div class="flex items-baseline gap-1.5">
                        <span class="text-lg sm:text-xl font-heading font-extrabold text-white">${userProjects.length}</span>
                        <span class="text-xs sm:text-sm font-medium text-[#708499]">Projects</span>
                    </div>
                    <div class="flex items-baseline gap-1.5">
                        <span class="text-lg sm:text-xl font-heading font-extrabold text-white">${userPosts.length}</span>
                        <span class="text-xs sm:text-sm font-medium text-[#708499]">Posts</span>
                    </div>
                    ${(profile.branch || profile.year) ? `
                    <div class="flex items-baseline gap-1.5">
                        <span class="text-base sm:text-lg font-heading font-bold text-[#3390ec]">${escapeHtml(profile.branch || '')}</span>
                        <span class="text-xs sm:text-sm font-medium text-[#708499]">${escapeHtml(profile.year || '')}</span>
                    </div>
                    ` : ''}
                </div>

                <!-- 5. Full-Width Primary Action Button (Reference: + Follow) -->
                <div>
                    <button id="profile-edit-btn" class="w-full py-3.5 bg-white hover:bg-zinc-100 text-zinc-950 font-heading font-bold rounded-full text-sm sm:text-base transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2">
                        <svg class="w-4 h-4 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
                        <span>${editing ? 'Close Edit Form' : 'Edit Profile'}</span>
                    </button>
                </div>

                <!-- Edit Form (Toggled via Edit Profile Button) -->
                ${editing ? renderEditForm(profile) : ''}

                <!-- 6. Contact & Social Links (Always visible pills) -->
                ${(linkedinUrl || githubUrl || email || phone) ? `
                <div class="flex flex-wrap items-center gap-2 pt-1">
                    ${linkedinUrl ? `
                        <a href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#17212b] hover:bg-[#242f3d] text-[#3390ec] text-xs font-semibold transition-all">
                            <svg class="w-3.5 h-3.5 fill-current flex-shrink-0" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                            <span>LinkedIn</span>
                        </a>
                    ` : ''}

                    ${githubUrl ? `
                        <a href="${githubUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#17212b] hover:bg-[#242f3d] text-zinc-200 text-xs font-semibold transition-all">
                            <svg class="w-3.5 h-3.5 fill-current flex-shrink-0" viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
                            <span>GitHub</span>
                        </a>
                    ` : ''}

                    ${email ? `
                        <a href="mailto:${email}" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#17212b] hover:bg-[#242f3d] text-zinc-300 text-xs font-semibold transition-all">
                            <svg class="w-3.5 h-3.5 text-sky-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                            <span class="truncate max-w-[150px]">${escapeHtml(email)}</span>
                        </a>
                    ` : ''}

                    ${phone ? `
                        <a href="tel:${phone}" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#17212b] hover:bg-[#242f3d] text-zinc-300 text-xs font-semibold transition-all">
                            <svg class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
                            <span>${escapeHtml(phone)}</span>
                        </a>
                    ` : ''}
                </div>
                ` : ''}

                <!-- Skills tags if present -->
                ${skills.length > 0 ? `
                <div class="flex flex-wrap items-center gap-1.5 pt-1">
                    ${skills.map(s => `
                        <span class="px-3 py-1 rounded-lg bg-[#17212b] text-zinc-300 text-xs font-medium">${escapeHtml(s)}</span>
                    `).join('')}
                </div>
                ` : ''}

                <!-- 7. "My Work" Section (Reference: My Work Grid) -->
                <div class="space-y-3.5 pt-2">
                    <div class="flex items-center justify-between">
                        <h3 class="font-heading font-extrabold text-lg sm:text-xl text-white">
                            My Work
                        </h3>
                        <span class="text-xs font-semibold text-[#708499]">${userProjects.length} Team${userProjects.length === 1 ? '' : 's'}</span>
                    </div>

                    ${userProjects.length > 0 ? `
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                        ${userProjects.map(p => `
                        <a href="#teams/${p.id}" class="group block bg-[#17212b] hover:bg-[#242f3d] rounded-2xl p-3.5 transition-all shadow-md active:scale-95 cursor-pointer" title="Open ${escapeHtml(p.name)}">
                            <div class="aspect-[4/3] rounded-xl bg-gradient-to-br ${p.gradient || 'from-blue-600 to-indigo-600'} p-3 flex flex-col justify-between shadow-inner relative overflow-hidden mb-2.5">
                                <div class="w-8 h-8 rounded-lg bg-black/30 backdrop-blur-md flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                    ${p.initials}
                                </div>
                                <span class="text-[9px] font-bold uppercase tracking-wider text-white/95 bg-black/40 px-2 py-0.5 rounded-full inline-block backdrop-blur-xs w-max">
                                    ${p.is_lead ? 'Team Lead' : 'Project'}
                                </span>
                            </div>
                            <h4 class="font-heading font-bold text-sm text-white truncate group-hover:text-[#3390ec] transition-colors">
                                ${escapeHtml(p.name)}
                            </h4>
                            <p class="text-[11px] text-[#708499] truncate mt-0.5">
                                ${p.lead_name ? `Lead: ${escapeHtml(p.lead_name)}` : 'Innovation Team'}
                            </p>
                        </a>
                        `).join('')}
                    </div>
                    ` : `
                    <div class="bg-[#17212b] rounded-2xl p-6 text-center space-y-1.5">
                        <p class="text-xs text-[#708499]">No projects joined yet.</p>
                        <a href="#teams" class="inline-block text-xs text-[#3390ec] hover:underline font-semibold mt-1">Explore Project Teams →</a>
                    </div>
                    `}
                </div>

                <!-- 8. Posts Section (Reference: Thumbnail Grid) -->
                <div class="space-y-3.5 pt-2">
                    <div class="flex items-center justify-between">
                        <h3 class="font-heading font-extrabold text-lg sm:text-xl text-white">
                            Posts
                        </h3>
                        <span class="text-xs font-semibold text-[#708499]">${userPosts.length} Post${userPosts.length === 1 ? '' : 's'}</span>
                    </div>

                    ${userPosts.length > 0 ? `
                    <div class="grid grid-cols-3 gap-2 sm:gap-3">
                        ${userPosts.map(p => `
                        <a href="#post/${p.id}" class="group relative aspect-square bg-[#17212b] rounded-xl overflow-hidden block">
                            ${p.image_url ? `
                                <img src="${p.image_url}" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center text-xs font-medium text-white">
                                    View
                                </div>
                            ` : `
                                <div class="w-full h-full p-2.5 flex flex-col justify-between group-hover:bg-[#242f3d] transition-colors">
                                    <p class="text-xs text-zinc-300 line-clamp-3 leading-relaxed">${escapeHtml(p.caption || 'Post')}</p>
                                    <span class="text-[10px] text-[#3390ec] font-semibold">Read →</span>
                                </div>
                            `}
                        </a>
                        `).join('')}
                    </div>
                    ` : `
                    <div class="bg-[#17212b] rounded-2xl p-6 text-center">
                        <p class="text-xs text-[#708499]">No posts created yet.</p>
                    </div>
                    `}
                </div>

                <!-- Admin Link if Admin -->
                ${ICCSupabase.isAdmin() ? `
                    <a href="#admin" class="block w-full text-center px-4 py-3 bg-[#17212b] hover:bg-[#242f3d] rounded-2xl text-sm font-bold text-white transition-all shadow-sm">
                        ⚙️ Open Admin Dashboard
                    </a>
                ` : ''}

                <!-- Developer Credit -->
                <div class="pt-8 pb-12 text-center text-xs text-[#708499]">
                    <p class="text-[10px] uppercase tracking-[0.2em] font-medium mb-2">Crafted with ❤️ by</p>
                    <a href="https://saravanantm1920.wixsite.com/my-site-4" target="_blank" rel="noopener noreferrer" 
                       class="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#17212b] hover:bg-[#242f3d] text-zinc-300 hover:text-white rounded-full transition-all">
                        <span class="text-xs font-bold">T M Saravanan</span>
                    </a>
                </div>

            </div>
        </section>`;
    }

    function renderEditForm(profile) {
        const user = ICCSupabase.getUser();
        const email = profile.email || user?.email || '';
        const isMentor = (profile.role || '').toLowerCase().trim() === 'mentor';

        return `
        <div class="bg-[#17212b] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 animate-fade-in" id="edit-form-card">
            <h3 class="font-heading font-bold text-base text-white">Edit Profile Details</h3>
            <form id="profile-edit-form" class="space-y-4">
                
                <!-- Avatar Upload Section -->
                <div class="flex items-center gap-4">
                    <div class="relative cursor-pointer" id="avatar-upload-trigger" title="Change Avatar">
                        <div class="w-16 h-16 rounded-full bg-[#0e1621] flex items-center justify-center overflow-hidden shadow-inner text-xl font-bold text-white" id="avatar-edit-preview">
                            ${profile.avatar_url ? `<img src="${profile.avatar_url}" class="w-full h-full object-cover">` : (profile.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-[#3390ec] rounded-full flex items-center justify-center shadow-md text-white">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                        </div>
                        <input type="file" id="edit-avatar-file" accept="image/*" class="hidden">
                    </div>
                    <div class="flex flex-col justify-center text-xs">
                        <span class="text-white font-medium">Profile Photo</span>
                        <span class="text-[#708499]">Tap avatar to upload new image</span>
                        ${profile.avatar_url ? `<button type="button" id="edit-remove-avatar" class="text-xs text-red-400 hover:text-red-300 font-semibold text-left mt-1 cursor-pointer">Remove photo</button>` : ''}
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#708499] mb-1">Full Name</label>
                    <input type="text" id="edit-name" value="${escapeHtml(profile.full_name || '')}" class="w-full px-3.5 py-2.5 bg-[#0e1621] rounded-xl text-sm text-white placeholder-[#708499] focus:outline-none" required>
                </div>

                ${!isMentor ? `
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-[#708499] mb-1">Academic Year</label>
                        <select id="edit-year" class="w-full px-3.5 py-2.5 bg-[#0e1621] rounded-xl text-xs text-white focus:outline-none" required>
                            <option value="" disabled ${!profile.year ? 'selected' : ''}>Select Year</option>
                            ${['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => `<option value="${y}" ${profile.year === y ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-[#708499] mb-1">Branch</label>
                        <select id="edit-branch" class="w-full px-3.5 py-2.5 bg-[#0e1621] rounded-xl text-xs text-white focus:outline-none" required>
                            <option value="" disabled ${!profile.branch ? 'selected' : ''}>Select Branch</option>
                            ${['AIML', 'CSE', 'Mech', 'ICB', 'CCE', 'CSD', 'ECE'].map(b => `<option value="${b}" ${profile.branch === b ? 'selected' : ''}>${b}</option>`).join('')}
                        </select>
                    </div>
                </div>
                ` : ''}

                <div>
                    <label class="block text-xs font-semibold text-[#708499] mb-1">Email Address</label>
                    <input type="email" value="${escapeHtml(email)}" disabled class="w-full px-3.5 py-2.5 bg-[#0e1621]/60 rounded-xl text-sm text-zinc-400 cursor-not-allowed opacity-75">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#708499] mb-1">Phone Number</label>
                    <input type="tel" id="edit-phone" value="${escapeHtml(profile.phone || '')}" placeholder="+91 9876543210" class="w-full px-3.5 py-2.5 bg-[#0e1621] rounded-xl text-sm text-white placeholder-[#708499] focus:outline-none">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#708499] mb-1">LinkedIn URL</label>
                    <input type="url" id="edit-linkedin" value="${escapeHtml(profile.linkedin || '')}" placeholder="https://linkedin.com/in/username" class="w-full px-3.5 py-2.5 bg-[#0e1621] rounded-xl text-sm text-white placeholder-[#708499] focus:outline-none">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#708499] mb-1">GitHub URL</label>
                    <input type="url" id="edit-github" value="${escapeHtml(profile.github || '')}" placeholder="https://github.com/username" class="w-full px-3.5 py-2.5 bg-[#0e1621] rounded-xl text-sm text-white placeholder-[#708499] focus:outline-none">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#708499] mb-1">Bio</label>
                    <textarea id="edit-bio" rows="2" class="w-full px-3.5 py-2.5 bg-[#0e1621] rounded-xl text-sm text-white placeholder-[#708499] focus:outline-none resize-none" placeholder="Tell us about yourself...">${escapeHtml(profile.bio || '')}</textarea>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#708499] mb-1">Skills (comma separated)</label>
                    <input type="text" id="edit-skills" value="${escapeHtml((profile.skills || []).join(', '))}" class="w-full px-3.5 py-2.5 bg-[#0e1621] rounded-xl text-sm text-white placeholder-[#708499] focus:outline-none" placeholder="React, Python, UI Design...">
                </div>

                <!-- Password Reset -->
                <div class="pt-2">
                    <button type="button" id="profile-reset-password-btn" class="w-full py-2.5 bg-[#0e1621] hover:bg-[#242f3d] rounded-xl text-xs font-semibold text-zinc-300 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        <svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                        <span>Reset Password via Email OTP</span>
                    </button>
                </div>

                <div class="flex gap-2.5 pt-2">
                    <button type="submit" id="edit-save-btn" class="flex-1 py-3 bg-[#3390ec] hover:bg-[#2b7cce] text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer">
                        Save Changes
                    </button>
                    <button type="button" id="edit-cancel" class="flex-1 py-3 bg-[#0e1621] hover:bg-[#242f3d] text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                        Cancel
                    </button>
                </div>
            </form>
        </div>`;
    }

    function renderSignedOut() {
        return `
        <div class="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
            <div class="w-16 h-16 rounded-full bg-[#17212b] flex items-center justify-center text-2xl text-[#708499]">
                👤
            </div>
            <h3 class="font-heading font-bold text-lg text-white">Your Profile</h3>
            <p class="text-xs text-[#708499] max-w-xs">Sign in to view your profile, teams, and contributions.</p>
            <button onclick="AuthModal.open()" class="px-6 py-2.5 bg-[#3390ec] hover:bg-[#2b7cce] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer">
                Sign In
            </button>
        </div>`;
    }

    async function mount(container) {
        editing = false;
        _avatarFile = null;
        _removeAvatar = false;
        container.innerHTML = '<div class="flex items-center justify-center min-h-[60vh]"><div class="w-8 h-8 rounded-full border-2 border-[#3390ec] border-t-transparent animate-spin"></div></div>';
        
        const user = ICCSupabase.getUser();
        if (user) {
            const [posts, projects] = await Promise.all([
                ICCSupabase.fetchPostsByUser(user.id),
                (typeof ICCSupabase.fetchUserProjects === 'function') 
                    ? ICCSupabase.fetchUserProjects(user.id) 
                    : []
            ]);
            userPosts = posts || [];
            userProjects = projects || [];
        }

        container.innerHTML = render();
        bindEvents(container);
    }

    function bindEvents(container) {
        document.getElementById('profile-signout')?.addEventListener('click', async () => {
            await ICCSupabase.signOut();
            if (typeof BottomNav !== 'undefined' && BottomNav.mount) BottomNav.mount();
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

        // Avatar upload trigger
        document.getElementById('avatar-upload-trigger')?.addEventListener('click', () => {
            document.getElementById('edit-avatar-file')?.click();
        });

        document.getElementById('edit-avatar-file')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { 
                Toast.error('Image must be under 5MB'); 
                return; 
            }
            _avatarFile = file;
            _removeAvatar = false;
            const preview = document.getElementById('avatar-edit-preview');
            if (preview) {
                preview.innerHTML = `<img src="${URL.createObjectURL(file)}" class="w-full h-full object-cover">`;
            }
        });

        document.getElementById('edit-remove-avatar')?.addEventListener('click', () => {
            _avatarFile = null;
            _removeAvatar = true;
            const preview = document.getElementById('avatar-edit-preview');
            const name = document.getElementById('edit-name')?.value || ICCSupabase.getProfile()?.full_name || '?';
            if (preview) {
                preview.innerHTML = name.charAt(0).toUpperCase();
            }
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

        // Edit form submit
        document.getElementById('profile-edit-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const saveBtn = document.getElementById('edit-save-btn');
            const profile = ICCSupabase.getProfile() || {};
            const isMentor = (profile.role || '').toLowerCase().trim() === 'mentor';
            const yearVal = document.getElementById('edit-year')?.value;
            const branchVal = document.getElementById('edit-branch')?.value;

            if (!isMentor && (!yearVal || !branchVal)) {
                Toast.error('Academic Year and Branch are compulsory fields');
                return;
            }

            const linkedinRaw = document.getElementById('edit-linkedin')?.value.trim() || '';
            let formattedLinkedin = null;
            if (linkedinRaw) {
                const linkedinRegex = /^(https?:\/\/)?([a-z0-9\-]+\.)?linkedin\.com\/.*$/i;
                if (!linkedinRegex.test(linkedinRaw)) {
                    Toast.error('Please enter a valid LinkedIn URL (e.g. https://linkedin.com/in/username)');
                    return;
                }
                formattedLinkedin = linkedinRaw.startsWith('http') ? linkedinRaw : 'https://' + linkedinRaw;
            }

            if (saveBtn) { 
                saveBtn.disabled = true; 
                saveBtn.innerHTML = 'Saving...'; 
            }

            const fields = {
                full_name: document.getElementById('edit-name').value.trim(),
                ...(isMentor ? {} : { year: yearVal, branch: branchVal }),
                phone: document.getElementById('edit-phone').value.trim() || null,
                linkedin: formattedLinkedin,
                github: document.getElementById('edit-github').value.trim() || null,
                bio: document.getElementById('edit-bio').value.trim() || null,
                skills: document.getElementById('edit-skills').value.split(',').map(s => s.trim()).filter(Boolean)
            };

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
                if (typeof BottomNav !== 'undefined' && BottomNav.mount) BottomNav.mount();
            }
        });
    }

    function unmount() { 
        editing = false; 
        userPosts = []; 
        userProjects = []; 
    }

    return { mount, unmount };
})();
