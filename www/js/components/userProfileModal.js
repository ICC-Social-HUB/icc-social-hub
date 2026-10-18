/* ============================================
   ICC Social Hub — User Profile Modal (Redesigned from Reference UI)
   ============================================ */
const UserProfileModal = (() => {
    let isOpen = false;
    let profile = null;
    let posts = [];
    let projects = [];

    async function open(userId) {
        if (!userId) return;
        isOpen = true;
        profile = null; 
        posts = []; 
        projects = [];
        mountLoading();
        document.body.style.overflow = 'hidden';

        try {
            if (!window.history.state?.modalOpen) {
                window.history.pushState({ modalOpen: true, modal: 'user-profile' }, '');
            }
        } catch (e) {}

        try {
            profile = await ICCSupabase.fetchUserById(userId);
            const [fetchedPosts, fetchedProjects] = await Promise.all([
                ICCSupabase.fetchPostsByUser(userId),
                (typeof ICCSupabase.fetchUserProjects === 'function') 
                    ? ICCSupabase.fetchUserProjects(userId) 
                    : []
            ]);
            posts = fetchedPosts || [];
            projects = fetchedProjects || [];
            if (isOpen) mount();
        } catch (e) {
            console.error('Error fetching user profile:', e);
            if (isOpen) close();
        }
    }

    function close() {
        isOpen = false; 
        profile = null; 
        posts = []; 
        projects = [];
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = '';
        document.body.style.overflow = '';
    }

    function mountLoading() {
        const root = document.getElementById('modal-root');
        if (!root) return;
        root.innerHTML = `
        <div class="fixed inset-0 z-[2000] bg-[#0e1621]/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <button id="user-profile-loading-back" class="absolute top-4 left-4 p-2.5 text-[#708499] hover:text-white hover:bg-[#17212b] rounded-full transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
                <span>Back</span>
            </button>
            <div class="flex flex-col items-center gap-3">
                <div class="w-8 h-8 rounded-full border-2 border-[#3390ec] border-t-transparent animate-spin"></div>
                <p class="text-xs text-[#708499] font-medium">Loading profile...</p>
            </div>
        </div>`;
        document.getElementById('user-profile-loading-back')?.addEventListener('click', close);
    }

    function render() {
        if (!isOpen || !profile) return '';

        const currentUserId = ICCSupabase.getUser()?.id;
        const isMe = currentUserId === profile.id;
        const initial = (profile.full_name || profile.username || '?').charAt(0).toUpperCase();

        const linkedinUrl = profile.linkedin ? (profile.linkedin.startsWith('http') ? profile.linkedin : 'https://' + profile.linkedin) : null;
        const githubUrl = profile.github ? (profile.github.startsWith('http') ? profile.github : 'https://' + profile.github) : null;
        const email = profile.email ? String(profile.email).trim() : null;
        const phone = profile.phone ? String(profile.phone).trim() : null;

        const roleTick = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.getRoleTick) 
            ? ICC_CONFIG.getRoleTick(profile) 
            : '';

        const defaultBio = profile.role === 'mentor' 
            ? 'Official Project Mentor and Technical Reviewer for student innovation teams at ICC Social Hub.' 
            : 'Innovator, builder, and creative developer at ICC Social Hub.';
        const bioText = profile.bio ? String(profile.bio).trim() : defaultBio;

        const skills = Array.isArray(profile.skills) 
            ? profile.skills 
            : (typeof profile.skills === 'string' ? profile.skills.split(',').map(s => s.trim()).filter(Boolean) : []);

        return `
        <div class="fixed inset-0 z-[2000] bg-[#0e1621] flex flex-col overflow-y-auto w-full h-full animate-fade-in" id="user-profile-overlay">
            
            <!-- Top Sticky Navigation Bar -->
            <div class="sticky top-0 z-[2100] bg-[#0e1621]/90 backdrop-blur-xl px-4 sm:px-6 h-16 flex items-center justify-between border-b border-[#17212b]/80">
                <button id="user-profile-close" class="p-2 text-[#708499] hover:text-white hover:bg-[#17212b] rounded-full transition-colors flex items-center gap-2 cursor-pointer active:scale-95">
                    <svg class="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
                    <span class="text-xs font-bold uppercase tracking-wider hidden sm:inline text-zinc-300">Back</span>
                </button>
                <div class="text-center px-2 min-w-0">
                    <h2 class="font-heading font-bold text-sm text-white truncate max-w-[200px] sm:max-w-xs">
                        ${escapeHtml(profile.full_name || profile.username || 'Profile')}
                    </h2>
                </div>
                <div>
                    ${!isMe ? `
                    <button id="user-msg-btn-header" class="p-2.5 bg-[#17212b] hover:bg-[#242f3d] text-[#3390ec] hover:text-white rounded-full transition-all cursor-pointer" title="Send Message">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.84-.84c.162-.835.34-1.666.425-2.498A8.026 8.026 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>
                    </button>
                    ` : '<div class="w-9"></div>'}
                </div>
            </div>

            <!-- Profile Content Body (Inspired by Reference Design) -->
            <div class="max-w-xl mx-auto w-full px-5 py-6 sm:py-8 space-y-6">

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
                        <h1 class="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                            ${escapeHtml(profile.full_name || profile.username || 'User')}
                        </h1>
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
                <p class="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal">
                    ${escapeHtml(bioText)}
                </p>

                <!-- 4. Key Metrics / Stats Row (Reference: 600 Followers 100 Post) -->
                <div class="flex items-center gap-8 py-1">
                    <div class="flex items-baseline gap-1.5">
                        <span class="text-lg sm:text-xl font-heading font-extrabold text-white">${projects.length}</span>
                        <span class="text-xs sm:text-sm font-medium text-[#708499]">Projects</span>
                    </div>
                    <div class="flex items-baseline gap-1.5">
                        <span class="text-lg sm:text-xl font-heading font-extrabold text-white">${posts.length}</span>
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
                    ${!isMe ? `
                    <button id="user-msg-btn" data-user-id="${profile.id}" class="w-full py-3.5 bg-white hover:bg-zinc-100 text-zinc-950 font-heading font-bold rounded-full text-sm sm:text-base transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2">
                        <svg class="w-4 h-4 text-zinc-950 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                        <span>Send Message</span>
                    </button>
                    ` : `
                    <button onclick="UserProfileModal.close(); window.location.hash='#profile';" class="w-full py-3.5 bg-white hover:bg-zinc-100 text-zinc-950 font-heading font-bold rounded-full text-sm sm:text-base transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2">
                        <svg class="w-4 h-4 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
                        <span>Edit Your Profile</span>
                    </button>
                    `}
                </div>

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

                <!-- Super Admin Mentor Controls -->
                ${(typeof ICCSupabase.isSuperAdmin === 'function' && ICCSupabase.isSuperAdmin() && !isMe) ? `
                <div class="bg-[#17212b] rounded-2xl p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-amber-400 uppercase tracking-wider">Super Admin Controls</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
                            ${profile.role === 'mentor' ? '🎓 Mentor' : 'Member'}
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${profile.role !== 'mentor' ? `
                            <button id="modal-assign-mentor-btn" class="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer">
                                Assign as Mentor
                            </button>
                        ` : `
                            <button id="modal-revoke-mentor-btn" class="flex-1 py-2.5 px-4 bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white font-bold rounded-xl text-xs transition-all active:scale-95 cursor-pointer">
                                Revoke Mentor Status
                            </button>
                        `}
                    </div>
                </div>
                ` : ''}

                <!-- 7. "My Work" Section (Reference: My Work Grid) -->
                <div class="space-y-3.5 pt-2">
                    <div class="flex items-center justify-between">
                        <h3 class="font-heading font-extrabold text-lg sm:text-xl text-white">
                            My Work
                        </h3>
                        <span class="text-xs font-semibold text-[#708499]">${projects.length} Team${projects.length === 1 ? '' : 's'}</span>
                    </div>

                    ${projects.length > 0 ? `
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                        ${projects.map(p => `
                        <a href="#teams/${p.id}" class="user-profile-project-card group block bg-[#17212b] hover:bg-[#242f3d] rounded-2xl p-3.5 transition-all shadow-md active:scale-95 cursor-pointer" title="Open ${escapeHtml(p.name)}">
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
                    </div>
                    `}
                </div>

                <!-- 8. Posts Section (Reference: Thumbnail Grid) -->
                <div class="space-y-3.5 pt-2">
                    <div class="flex items-center justify-between">
                        <h3 class="font-heading font-extrabold text-lg sm:text-xl text-white">
                            Posts
                        </h3>
                        <span class="text-xs font-semibold text-[#708499]">${posts.length} Post${posts.length === 1 ? '' : 's'}</span>
                    </div>

                    ${posts.length > 0 ? `
                    <div class="grid grid-cols-3 gap-2 sm:gap-3">
                        ${posts.map(p => `
                        <a href="#post/${p.id}" class="user-profile-post-thumb group relative aspect-square bg-[#17212b] rounded-xl overflow-hidden block">
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
                        <p class="text-xs text-[#708499]">No posts published yet.</p>
                    </div>
                    `}
                </div>

                <!-- Footer Credit -->
                <div class="py-6 text-center text-xs text-[#708499]">
                    <p class="text-[10px] uppercase tracking-[0.2em] font-medium mb-2">Crafted with ❤️ by</p>
                    <a href="https://saravanantm1920.wixsite.com/my-site-4" target="_blank" rel="noopener noreferrer" 
                       class="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#17212b] hover:bg-[#242f3d] text-zinc-300 hover:text-white rounded-full transition-all">
                        <span class="text-xs font-bold">T M Saravanan</span>
                    </a>
                </div>
            </div>
        </div>`;
    }

    function mount() {
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = render();
        if (isOpen) bindEvents();
    }

    function bindEvents() {
        document.getElementById('user-profile-close')?.addEventListener('click', close);
        document.getElementById('user-msg-btn')?.addEventListener('click', () => {
            const userId = profile.id;
            close();
            window.location.hash = `#chat/${userId}`;
        });
        document.getElementById('user-msg-btn-header')?.addEventListener('click', () => {
            const userId = profile.id;
            close();
            window.location.hash = `#chat/${userId}`;
        });
        document.querySelectorAll('.user-profile-post-thumb').forEach(thumb => {
            thumb.addEventListener('click', () => close());
        });
        document.querySelectorAll('.user-profile-project-card').forEach(card => {
            card.addEventListener('click', () => close());
        });

        // Super Admin Mentor Controls
        document.getElementById('modal-assign-mentor-btn')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.innerHTML = 'Assigning...';
            const res = await ICCSupabase.setMentorRole(profile.id, true);
            if (res?.error) {
                Toast.error('Failed to assign mentor: ' + (res.error.message || res.error));
                btn.disabled = false;
                btn.innerHTML = 'Assign as Mentor';
            } else {
                Toast.success(`🎓 Appointed ${profile.full_name || profile.username || 'user'} as Mentor!`);
                profile.role = 'mentor';
                mount();
            }
        });

        document.getElementById('modal-revoke-mentor-btn')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            if (!confirm(`Are you sure you want to revoke Mentor status for ${profile.full_name || profile.username || 'this user'}?`)) return;
            btn.disabled = true;
            btn.innerHTML = 'Revoking...';
            const res = await ICCSupabase.setMentorRole(profile.id, false);
            if (res?.error) {
                Toast.error('Failed to revoke mentor: ' + (res.error.message || res.error));
                btn.disabled = false;
                btn.innerHTML = 'Revoke Mentor Status';
            } else {
                Toast.success(`Mentor role revoked for ${profile.full_name || profile.username || 'user'}`);
                profile.role = 'member';
                mount();
            }
        });
    }

    return { open, close };
})();
