/* ============================================
   ICC Social Hub — Feed View (Discovery Wall)
   ============================================ */
const FeedView = (() => {
    let posts = [];
    let userLikes = new Set();
    let page = 0;
    let hasMore = true;
    let loadingMore = false;
    let filter = 'all';

    function render() {
        return `
        <section class="min-h-screen pt-2 pb-4 px-4 sm:px-0 relative overflow-hidden" id="feed-section">
            <div id="ptr-indicator" class="pull-to-refresh" style="transform: translateY(0); opacity: 0;">
                <div class="spinner"></div>
            </div>
            <div class="max-w-lg mx-auto transition-transform duration-200" id="feed-container">
                <div class="flex items-center justify-between mb-4 px-1">
                    <h1 class="font-heading font-bold text-xl">
                        <span class="gradient-text-static">ICC</span> Feed
                    </h1>
                    <div class="flex items-center gap-2">
                        ${ICCSupabase.getUser() ? `<button id="feed-refresh" class="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>` : ''}
                    </div>
                </div>
                <div class="flex gap-2 mb-4 overflow-x-auto pb-1 px-1 no-scrollbar" id="feed-filters">
                    <button class="filter-pill ${filter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                    <button class="filter-pill ${filter === 'announcements' ? 'active' : ''}" data-filter="announcements">📢 Official</button>
                    <button class="filter-pill ${filter === 'requests' ? 'active' : ''}" data-filter="requests">🆘 Requests</button>
                    ${CORE_LEADS.slice(0, 6).map(l => `<button class="filter-pill ${filter === String(l.id) ? 'active' : ''}" data-filter="${l.id}">${(l.team || 'Team').replace('Team ', '')}</button>`).join('')}
                </div>
                <div id="feed-posts"></div>
                <div id="feed-load-more" class="text-center py-4"></div>

                <!-- Developer Credit -->
                <div class="mt-12 mb-8 py-8 border-t border-zinc-800/50 text-center animate-fade-in">
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

    async function mount(container, targetPostId = null) {
        page = 0; posts = []; hasMore = true; filter = 'all';
        container.innerHTML = render();
        const postsEl = document.getElementById('feed-posts');
        postsEl.innerHTML = renderSkeletons();
        
        if (targetPostId) {
            const target = await ICCSupabase.fetchPostById(targetPostId);
            if (target) {
                posts = [target];
                // Mark that we are in "single post" mode or just showing this first
                // For simplicity, we'll just show this post and then load others
            }
        }

        await loadPosts();
        bindEvents();
        ICCSupabase.subscribeToFeed(async newPost => {
            const enriched = await enrichPost(newPost);
            if (enriched) {
                posts.unshift(enriched);
                renderFeed();
            }
        });
    }

    async function loadPosts() {
        loadingMore = true;
        const newPosts = await ICCSupabase.fetchPosts(page, ICC_CONFIG.POSTS_PER_PAGE);
        if (newPosts.length < ICC_CONFIG.POSTS_PER_PAGE) hasMore = false;
        
        // Filter out duplicates (if we prepended a target post)
        const existingIds = new Set(posts.map(p => p.id));
        const uniqueNew = newPosts.filter(p => !existingIds.has(p.id));
        
        posts = [...posts, ...uniqueNew];
        if (ICCSupabase.getUser() && posts.length) {
            userLikes = await ICCSupabase.fetchUserLikes(posts.map(p => p.id));
        }
        loadingMore = false;
        renderFeed();
    }

    function renderFeed() {
        const postsEl = document.getElementById('feed-posts');
        const loadMoreEl = document.getElementById('feed-load-more');
        if (!postsEl) return;

        const filtered = posts.filter(matchesFilter);
        if (filtered.length === 0) {
            postsEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg></div><h3 class="font-heading font-semibold text-lg mb-1">No posts yet</h3><p class="text-sm text-zinc-500">Be the first to share something!</p></div>`;
        } else {
            postsEl.innerHTML = filtered.map(p => PostCard.render(p, userLikes)).join('');
            PostCard.bindEvents(postsEl);
        }

        if (loadMoreEl) {
            loadMoreEl.innerHTML = hasMore ? `<button id="load-more-btn" class="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-medium transition-colors ${loadingMore ? 'opacity-50' : ''}">
                ${loadingMore ? '<div class="spinner spinner-sm mx-auto"></div>' : 'Load More'}
            </button>` : (posts.length > 0 ? '<p class="text-xs text-zinc-600">You\'re all caught up ✨</p>' : '');
            document.getElementById('load-more-btn')?.addEventListener('click', async () => {
                page++;
                await loadPosts();
            });
        }
    }

    function matchesFilter(post) {
        if (filter === 'all') return true;
        if (filter === 'announcements') return post.is_announcement;
        if (filter === 'requests') return post.is_request && post.status !== 'resolved';
        return post.team_tag === parseInt(filter);
    }

    function renderPosts() {
        return posts.filter(matchesFilter).map(p => PostCard.render(p, userLikes)).join('');
    }

    async function enrichPost(raw) {
        const user = await ICCSupabase.fetchUserById(raw.user_id);
        return { ...raw, profiles: user };
    }

    function renderSkeletons() {
        return Array(3).fill(0).map(() => `
            <div class="glass-card mb-6 overflow-hidden animate-pulse">
                <div class="flex items-center gap-3 p-4">
                    <div class="w-11 h-11 rounded-2xl bg-white/5"></div>
                    <div class="space-y-2 flex-1">
                        <div class="h-3 w-24 bg-white/5 rounded"></div>
                        <div class="h-2 w-16 bg-white/5 rounded"></div>
                    </div>
                </div>
                <div class="h-64 w-full bg-white/5"></div>
                <div class="p-4 space-y-3">
                    <div class="h-3 w-3/4 bg-white/5 rounded"></div>
                    <div class="h-3 w-1/2 bg-white/5 rounded"></div>
                </div>
            </div>
        `).join('');
    }

    function bindEvents() {
        document.querySelectorAll('.filter-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                filter = btn.dataset.filter;
                document.querySelectorAll('.filter-pill').forEach(b => {
                    b.classList.remove('active');
                    b.classList.remove('bg-crimson');
                    b.classList.remove('text-white');
                });
                btn.classList.add('active');
                renderFeed();
            });
        });
        document.getElementById('feed-refresh')?.addEventListener('click', async () => {
            page = 0; posts = []; hasMore = true;
            document.getElementById('feed-posts').innerHTML = renderSkeletons();
            await loadPosts();
        });

        // Pull to Refresh Logic
        let startY = 0;
        let pullDistance = 0;
        const section = document.getElementById('feed-section');
        const container = document.getElementById('feed-container');
        const indicator = document.getElementById('ptr-indicator');

        if (section && container && indicator) {
            section.addEventListener('touchstart', (e) => {
                if (window.scrollY === 0) {
                    startY = e.touches[0].pageY;
                    container.style.transition = 'none';
                    indicator.style.transition = 'none';
                }
            }, { passive: true });

            section.addEventListener('touchmove', (e) => {
                if (window.scrollY === 0) {
                    const currentY = e.touches[0].pageY;
                    pullDistance = Math.max(0, (currentY - startY) * 0.4); // Resistance
                    if (pullDistance > 0) {
                        container.style.transform = `translateY(${pullDistance}px)`;
                        indicator.style.transform = `translateY(${pullDistance}px)`;
                        indicator.style.opacity = Math.min(1, pullDistance / 60);
                    }
                }
            }, { passive: true });

            section.addEventListener('touchend', async () => {
                if (pullDistance > 60) {
                    // Trigger Refresh
                    container.style.transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
                    indicator.style.transition = 'all 0.3s ease';
                    container.style.transform = 'translateY(50px)';
                    indicator.style.transform = 'translateY(50px)';
                    indicator.style.opacity = '1';

                    page = 0; posts = []; hasMore = true;
                    await loadPosts();

                    // Snap back
                    container.style.transform = 'translateY(0)';
                    indicator.style.transform = 'translateY(0)';
                    indicator.style.opacity = '0';
                } else {
                    // Cancel
                    container.style.transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
                    indicator.style.transition = 'all 0.3s ease';
                    container.style.transform = 'translateY(0)';
                    indicator.style.transform = 'translateY(0)';
                    indicator.style.opacity = '0';
                }
                pullDistance = 0;
            });
        }
    }

    function unmount() { ICCSupabase.unsubscribeChannel('feed'); }

    return { mount, unmount };
})();
