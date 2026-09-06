/* ============================================
   ICC Social Hub — User Profile Modal (Full Modal View)
   ============================================ */
const UserProfileModal = (() => {
    let isOpen = false;
    let profile = null;
    let posts = [];

    async function open(userId) {
        isOpen = true;
        profile = null; posts = [];
        mountLoading();
        document.body.style.overflow = 'hidden';
        profile = await ICCSupabase.fetchUserById(userId);
        posts = await ICCSupabase.fetchPostsByUser(userId);
        mount();
    }

    function close() {
        isOpen = false; profile = null; posts = [];
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = '';
        document.body.style.overflow = '';
    }

    function mountLoading() {
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = `
        <div class="fixed inset-0 z-[2000] bg-zinc-950/90 backdrop-blur-md flex items-center justify-center">
            <div class="flex flex-col items-center gap-3">
                <div class="spinner border-red-500 border-t-transparent w-8 h-8"></div>
                <p class="text-xs text-zinc-400 font-medium">Loading user profile...</p>
            </div>
        </div>`;
    }

    function render() {
        if (!isOpen || !profile) return '';
        const teamLead = profile.team_id ? getLeadByTeamId(profile.team_id) : null;
        const isMe = ICCSupabase.getUser()?.id === profile.id;
        const email = profile.email || '';

        return `
        <div class="fixed inset-0 z-[2000] bg-zinc-950 flex flex-col overflow-y-auto w-full h-full animate-fade-in" id="user-profile-overlay">
            <!-- Full Modal Top Sticky Header Bar -->
            <div class="sticky top-0 z-[2100] bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 px-4 h-16 flex items-center justify-between">
                <button id="user-profile-close" class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
                    <span class="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Close Profile</span>
                </button>
                <div class="text-center">
                    <h2 class="font-heading font-bold text-sm text-white truncate max-w-[200px]">${escapeHtml(profile.full_name || 'User Profile')}</h2>
                    <p class="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">User Profile</p>
                </div>
                <div>
                    ${!isMe ? `<button id="user-msg-btn-header" class="p-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-full transition-all border border-red-500/30" title="Send Message">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    </button>` : '<div class="w-9"></div>'}
                </div>
            </div>

            <!-- Full View Content Body -->
            <div class="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
                <!-- Hero Header Card -->
                <div class="glass-card rounded-2xl overflow-hidden relative border border-zinc-800/80 shadow-2xl">
                    <div class="h-32 sm:h-40 bg-gradient-to-r ${teamLead ? teamLead.gradient : 'from-red-600 via-rose-700 to-zinc-900'} relative">
                        <div class="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>
                    </div>
                    <div class="px-6 pb-6 pt-0 relative">
                        <div class="-mt-16 sm:-mt-20 flex justify-center mb-4">
                            <div class="avatar-ring p-1 bg-zinc-950 rounded-full shadow-xl"><div class="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden border-2 border-zinc-800 ${profile.avatar_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}" ${profile.avatar_url ? `data-full-image="${profile.avatar_url}"` : ''}>
                                ${profile.avatar_url ? `<img src="${profile.avatar_url}" class="w-full h-full object-cover">` : `<span class="font-heading font-bold text-3xl sm:text-4xl text-red-500">${(profile.full_name || '?').charAt(0).toUpperCase()}</span>`}
                            </div></div>
                        </div>

                        <div class="text-center space-y-2">
                            <h1 class="font-heading font-bold text-xl sm:text-2xl text-white flex items-center justify-center gap-1.5">${escapeHtml(profile.full_name || 'User')}${profile.role === 'lead' ? ICC_CONFIG.VERIFIED_TICK : ''}</h1>
                            ${profile.username ? `<p class="text-sm text-zinc-400 font-medium">@${escapeHtml(profile.username)}</p>` : ''}
                            
                            <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
                                ${teamLead ? `<span class="px-3 py-1 bg-zinc-800/90 border border-zinc-700/80 rounded-full text-xs text-zinc-200 font-medium">${teamLead.team}</span>` : ''}
                                ${profile.role === 'lead' ? `<span class="px-3 py-1 bg-red-600/20 text-red-400 border border-red-500/30 rounded-full text-xs font-bold uppercase tracking-wider">${profile.role}</span>` : ''}
                                ${profile.role === 'admin' ? `<span class="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold uppercase tracking-wider">Admin</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Contact & Social Details Card -->
                <div class="glass-card rounded-2xl p-5 border border-zinc-800/80 space-y-3">
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Contact Information</h3>
                    
                    <div class="space-y-2.5">
                        ${email ? `
                        <div class="flex items-center gap-3 p-2.5 bg-zinc-950/60 rounded-xl border border-zinc-800/50">
                            <div class="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 flex-shrink-0">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-[10px] text-zinc-500 uppercase font-semibold">Email</p>
                                <a href="mailto:${escapeHtml(email)}" class="text-xs font-medium text-zinc-200 hover:text-white truncate block">${escapeHtml(email)}</a>
                            </div>
                        </div>` : ''}

                        ${profile.phone ? `
                        <div class="flex items-center gap-3 p-2.5 bg-zinc-950/60 rounded-xl border border-zinc-800/50">
                            <div class="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-[10px] text-zinc-500 uppercase font-semibold">Phone Number</p>
                                <a href="tel:${escapeHtml(profile.phone)}" class="text-xs font-medium text-emerald-400 hover:underline truncate block">${escapeHtml(profile.phone)}</a>
                            </div>
                        </div>` : ''}
                    </div>

                    ${(profile.linkedin || profile.github) ? `
                    <div class="pt-3 border-t border-zinc-800/60 flex flex-wrap gap-2.5">
                        ${profile.linkedin ? `
                        <a href="${profile.linkedin.startsWith('http') ? profile.linkedin : 'https://' + profile.linkedin}" target="_blank" rel="noopener noreferrer" 
                           class="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-950/40 border border-blue-800/40 hover:bg-blue-900/40 text-blue-400 rounded-xl text-xs font-semibold transition-all shadow-sm">
                            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
                            LinkedIn Profile
                        </a>` : ''}

                        ${profile.github ? `
                        <a href="${profile.github.startsWith('http') ? profile.github : 'https://' + profile.github}" target="_blank" rel="noopener noreferrer" 
                           class="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 rounded-xl text-xs font-semibold transition-all shadow-sm">
                            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
                            GitHub Profile
                        </a>` : ''}
                    </div>` : ''}
                </div>

                <!-- Bio & Skills Section -->
                ${(profile.bio || (profile.skills && profile.skills.length)) ? `
                <div class="glass-card rounded-2xl p-5 border border-zinc-800/80 space-y-4">
                    ${profile.bio ? `
                    <div>
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Bio</h3>
                        <p class="text-sm text-zinc-300 leading-relaxed">${escapeHtml(profile.bio)}</p>
                    </div>` : ''}

                    ${(profile.skills && profile.skills.length) ? `
                    <div ${profile.bio ? 'class="pt-3 border-t border-zinc-800/60"' : ''}>
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Skills & Expertise</h3>
                        <div class="flex flex-wrap gap-2">
                            ${profile.skills.map(s => `<span class="px-3 py-1 bg-zinc-800/90 border border-zinc-700/80 rounded-lg text-xs text-zinc-300 font-medium">${escapeHtml(s)}</span>`).join('')}
                        </div>
                    </div>` : ''}
                </div>` : ''}

                <!-- Direct Action Button -->
                ${!isMe ? `
                <button id="user-msg-btn" class="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold rounded-2xl shadow-xl shadow-red-900/20 transition-all flex items-center justify-center gap-2" data-user-id="${profile.id}">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    Send Direct Message
                </button>` : ''}

                <!-- User Posts Section -->
                <div class="glass-card rounded-2xl p-5 border border-zinc-800/80 space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Posts (${posts.length})</h3>
                    </div>
                    ${posts.length > 0 ? `
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        ${posts.map(p => `
                        <a href="#post/${p.id}" class="user-profile-post-thumb group relative aspect-square bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden block">
                            ${p.image_url ? `
                            <img src="${p.image_url}" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center text-xs font-medium text-white">
                                View Post
                            </div>` : `
                            <div class="w-full h-full p-3 flex flex-col justify-between group-hover:bg-zinc-800/60 transition-colors">
                                <p class="text-xs text-zinc-400 line-clamp-4 leading-relaxed">${escapeHtml(p.caption || 'Post')}</p>
                                <span class="text-[10px] text-red-400 font-semibold">Read →</span>
                            </div>`}
                        </a>`).join('')}
                    </div>` : `
                    <p class="text-xs text-zinc-500 text-center py-6">No posts created yet.</p>`}
                </div>

                <!-- Footer Credit -->
                <div class="py-6 text-center border-t border-zinc-800/50">
                    <p class="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium mb-3">Crafted with ❤️ by</p>
                    <a href="https://saravanantm1920.wixsite.com/my-site-4" target="_blank" 
                       class="inline-flex items-center gap-2 px-4 py-1.5 bg-zinc-800/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 rounded-full border border-zinc-700/50 hover:border-red-500/50 transition-all duration-300 group">
                        <span class="text-xs font-bold tracking-tight">T M Saravanan</span>
                        <svg class="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
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
    }

    return { open, close };
})();
