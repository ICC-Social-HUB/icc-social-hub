/* ============================================
   ICC Social Hub — Dashboard View (Bento Style)
   ============================================ */
const DashboardView = (() => {
    let data = {
        profile: null,
        team: null,
        announcement: null,
        unreadCount: 0,
        requestCount: 0,
        stats: { members: 0, teams: 0 }
    };

    function render() {
        const { profile, team, announcement, unreadCount, requestCount, stats } = data;
        const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'Innovator';
        
        // Calculate team progress
        let progress = 0;
        let completedPhases = 0;
        if (team?.milestones) {
            const phases = Object.keys(team.milestones);
            completedPhases = phases.filter(k => team.milestones[k]).length;
            progress = Math.round((completedPhases / 8) * 100);
        }

        return `
        <section class="min-h-screen pt-4 pb-20 px-4" id="dashboard-section">
            <div class="max-w-4xl mx-auto">
                <div class="bento-grid">
                    
                    <!-- Welcome Tile -->
                    <div class="bento-tile tile-welcome animate-slide-up">
                        <div class="flex items-center justify-between gap-4">
                            <div>
                                <h1 class="font-heading font-bold text-2xl mb-1">Welcome back, <span class="gradient-text-static">${firstName}</span>!</h1>
                                <p class="text-sm text-zinc-400">Your innovation journey continues here.</p>
                            </div>
                            <div class="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden">
                                ${profile?.avatar_url ? `<img src="${profile.avatar_url}" class="w-full h-full object-cover">` : `<span class="text-xl font-bold">${firstName.charAt(0)}</span>`}
                            </div>
                        </div>
                    </div>

                    <!-- Team Progress Tile -->
                    <div class="bento-tile tile-progress animate-slide-up delay-100 cursor-pointer" onclick="window.location.hash = '#teams/${team?.id || ''}'">
                        <div class="tile-label">
                            <svg class="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                            My Team Progress
                        </div>
                        ${team ? `
                            <h2 class="tile-title mb-2">${team.team}</h2>
                            <p class="text-[11px] text-zinc-500 mb-4">${team.project_name || 'No project name set'}</p>
                            <div class="mt-auto">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[10px] font-bold text-emerald-400">${progress}% Complete</span>
                                    <span class="text-[10px] text-zinc-500">${completedPhases}/8 Phases</span>
                                </div>
                                <div class="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                                    <div class="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 ease-out" style="width: ${progress}%"></div>
                                </div>
                            </div>
                        ` : `
                            <div class="flex flex-col items-center justify-center h-full text-center py-4">
                                <p class="text-xs text-zinc-500 mb-3">You haven't joined a team yet.</p>
                                <button onclick="event.stopPropagation(); window.location.hash='#teams'" class="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-bold hover:bg-zinc-800 transition-colors">Find a Team</button>
                            </div>
                        `}
                        <div class="tile-icon-bg"><svg class="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></div>
                    </div>

                    <!-- Announcement Tile -->
                    <div class="bento-tile tile-announcement animate-slide-up delay-200 cursor-pointer" onclick="window.location.hash = '#feed'">
                        <div class="tile-label">
                            <svg class="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
                            Latest Announcement
                        </div>
                        <h2 class="tile-title line-clamp-1">${announcement?.content || 'No new announcements'}</h2>
                        <p class="tile-desc line-clamp-1">${announcement?.profiles?.full_name || 'ICC Admin'}</p>
                        <div class="mt-4 flex items-center gap-2">
                            <div class="flex -space-x-2">
                                ${[1,2,3].map(() => `<div class="w-5 h-5 rounded-full bg-zinc-800 border-2 border-zinc-950"></div>`).join('')}
                            </div>
                            <span class="text-[10px] text-zinc-500">+12 others viewed</span>
                        </div>
                    </div>

                    <!-- Stats Tile -->
                    <div class="bento-tile tile-help animate-slide-up delay-300">
                        <div class="tile-label">Community</div>
                        <div class="text-2xl font-bold gradient-text-static">${requestCount}</div>
                        <p class="text-[10px] text-zinc-500 mt-1">Open Requests</p>
                    </div>

                    <!-- Messages Tile -->
                    <div class="bento-tile tile-messages animate-slide-up delay-300 cursor-pointer" onclick="window.location.hash = '#chat'">
                        <div class="tile-label">Messages</div>
                        <div class="text-2xl font-bold ${unreadCount > 0 ? 'text-red-500' : 'text-zinc-500'}">${unreadCount}</div>
                        <p class="text-[10px] text-zinc-500 mt-1">Unread DMs</p>
                    </div>

                    <!-- Quick Action Tile -->
                    <div class="bento-tile tile-action animate-slide-up delay-400 cursor-pointer" id="dashboard-create-post">
                        <div class="flex flex-col items-center justify-center h-full text-white">
                            <svg class="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                            <span class="text-sm font-bold">New Post</span>
                        </div>
                    </div>

                </div>

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

    async function mount(container) {
        // Optimistic fast render
        const profile = ICCSupabase.getProfile();
        data.profile = profile;
        if (profile?.team_id) {
            data.team = typeof CORE_LEADS !== 'undefined' ? CORE_LEADS.find(l => l.id === parseInt(profile.team_id)) : null;
        }
        
        container.innerHTML = render();
        bindEvents();
        
        try {
            // Fetch live data in background to prevent loading screen hang
            const [posts, unread, stats] = await Promise.all([
                ICCSupabase.fetchPosts(0, 3), // Reduced limit for faster fetch
                ICCSupabase.getUnreadCount(),
                fetchCommunityStats()
            ]);

            data.announcement = posts.find(p => p.is_announcement) || posts[0];
            data.unreadCount = unread;
            data.requestCount = posts.filter(p => p.is_request && p.status !== 'resolved').length;
            data.stats = stats;

            // Re-render with live data
            container.innerHTML = render();
            bindEvents();
        } catch (err) {
            console.error('Dashboard mount error:', err);
            ErrorHandler.renderErrorState(container, 'Failed to Load Dashboard', err.message || 'Please check your connection and try again.', () => mount(container));
        }
    }

    async function fetchCommunityStats() {
        // Mocking for now, could be a real Supabase count
        return { members: 124, teams: 18 };
    }

    function bindEvents() {
        document.getElementById('dashboard-create-post')?.addEventListener('click', () => {
            if (!ICCSupabase.getUser()) { AuthModal.open(); return; }
            CreatePostModal.open();
        });
    }

    return { mount };
})();
