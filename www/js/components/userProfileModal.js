/* ============================================
   ICC Social Hub — User Profile Modal
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
        if (root) root.innerHTML = `<div class="modal-backdrop fixed inset-0 z-[100] flex items-center justify-center"><div class="spinner"></div></div>`;
    }

    function render() {
        if (!isOpen || !profile) return '';
        const teamLead = profile.team_id ? getLeadByTeamId(profile.team_id) : null;
        const isMe = ICCSupabase.getUser()?.id === profile.id;
        return `
        <div class="modal-backdrop fixed inset-0 z-[100] flex items-end sm:items-center justify-center" id="user-profile-overlay">
            <div class="modal-content bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
                <div class="relative">
                    <div class="h-24 bg-gradient-to-br ${teamLead ? teamLead.gradient : 'from-red-600 to-rose-700'} rounded-t-2xl"></div>
                    <button id="user-profile-close" class="absolute top-3 right-3 p-2 bg-black/30 backdrop-blur-sm text-white/80 hover:text-white rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    <div class="absolute -bottom-10 left-1/2 -translate-x-1/2">
                        <div class="avatar-ring"><div class="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden ${profile.avatar_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}" ${profile.avatar_url ? `data-full-image="${profile.avatar_url}"` : ''}>
                            ${profile.avatar_url ? `<img src="${profile.avatar_url}" class="w-full h-full object-cover">` : `<span class="font-heading font-bold text-2xl text-red-500">${(profile.full_name || '?').charAt(0).toUpperCase()}</span>`}
                        </div></div>
                    </div>
                </div>
                <div class="pt-14 pb-6 px-6 text-center">
                    <h3 class="font-heading font-bold text-lg">${profile.full_name || 'User'}${profile.role === 'lead' ? ICC_CONFIG.VERIFIED_TICK : ''}</h3>
                    ${profile.username ? `<p class="text-sm text-zinc-500">@${profile.username}</p>` : ''}
                    ${profile.email ? `<p class="text-xs text-zinc-500 flex items-center justify-center gap-1 mt-1"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>${escapeHtml(profile.email)}</p>` : ''}
                    ${profile.bio ? `<p class="text-xs text-zinc-400 mt-2 max-w-xs mx-auto">${escapeHtml(profile.bio)}</p>` : ''}
                    <div class="flex items-center justify-center gap-3 mt-3">
                        ${teamLead ? `<span class="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-xs text-zinc-300">${teamLead.team}</span>` : ''}
                        ${profile.role === 'lead' ? `<span class="px-3 py-1 bg-red-600/15 text-red-400 rounded-full text-xs font-semibold uppercase">Lead</span>` : ''}
                    </div>
                    ${profile.skills && profile.skills.length ? `<div class="flex flex-wrap justify-center gap-1.5 mt-3">${profile.skills.map(s => `<span class="px-2 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-400">${s}</span>`).join('')}</div>` : ''}
                    ${!isMe ? `<button id="user-msg-btn" class="mt-4 px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all" data-user-id="${profile.id}">Message</button>` : ''}
                </div>
                ${posts.length > 0 ? `
                <div class="border-t border-zinc-800 px-4 py-4">
                    <p class="text-xs font-semibold text-zinc-500 mb-3">${posts.length} Posts</p>
                    <div class="profile-post-grid">
                        ${posts.slice(0, 9).map(p => `<div class="profile-post-thumb">${p.image_url ? `<img src="${p.image_url}" alt="" loading="lazy">` : `<div class="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600 text-xs p-2 text-center">${(p.caption || '').slice(0, 30)}</div>`}</div>`).join('')}
                    </div>
                </div>` : ''}

                <!-- Developer Credit -->
                <div class="pb-8 pt-4 text-center border-t border-zinc-800/50 mt-2">
                    <p class="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-medium mb-3">Crafted with ❤️ by</p>
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
        document.getElementById('user-profile-overlay')?.addEventListener('click', e => { if (e.target.id === 'user-profile-overlay') close(); });
        document.getElementById('user-msg-btn')?.addEventListener('click', () => {
            const userId = profile.id;
            close();
            window.location.hash = `#chat/${userId}`;
        });
    }

    return { open, close };
})();
