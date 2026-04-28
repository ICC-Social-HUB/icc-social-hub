/* ============================================
   ICC Social Hub — Notifications View (v2)
   Rewritten for performance and premium aesthetics.
   ============================================ */
const NotificationsView = (() => {
    let notifications = [];
    let loading = true;
    let currentFilter = 'all';

    const NOTIF_CONFIG = {
        like: { icon: '❤️', label: 'Likes', color: 'text-rose-500', bg: 'bg-rose-500/10' },
        comment: { icon: '💬', label: 'Comments', color: 'text-blue-500', bg: 'bg-blue-500/10' },
        message: { icon: '✉️', label: 'Messages', color: 'text-purple-500', bg: 'bg-purple-500/10' },
        post: { icon: '✨', label: 'Posts', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        broadcast: { icon: '📢', label: 'Official', color: 'text-red-500', bg: 'bg-red-500/10' },
        team_join: { icon: '🤝', label: 'Teams', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        team_approve: { icon: '✅', label: 'Teams', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        team_deny: { icon: '❌', label: 'Teams', color: 'text-zinc-500', bg: 'bg-zinc-800/50' },
        system: { icon: '🔔', label: 'System', color: 'text-zinc-400', bg: 'bg-zinc-800/30' }
    };

    function render() {
        const unreadCount = notifications.filter(n => !n.is_read).length;
        
        return `
        <div class="min-h-screen bg-[#030303] text-white pb-24">
            <!-- Header -->
            <header class="sticky top-0 z-30 bg-[#030303]/80 backdrop-blur-xl border-b border-zinc-900/50 px-4 py-4">
                <div class="max-w-lg mx-auto flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <h1 class="text-xl font-bold tracking-tight">Notifications</h1>
                        ${unreadCount > 0 ? `<span class="px-2 py-0.5 bg-red-600 rounded-full text-[10px] font-bold animate-pulse">${unreadCount}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        ${unreadCount > 0 ? `<button id="notif-read-all" class="text-xs text-zinc-500 hover:text-white transition-colors">Clear all</button>` : ''}
                        <button id="notif-refresh" class="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                            <svg class="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        </button>
                    </div>
                </div>
            </header>

            <div class="max-w-lg mx-auto px-4 mt-4">
                <!-- Filters -->
                <div class="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                    ${['all', 'unread', 'like', 'comment', 'message', 'team'].map(f => `
                        <button class="notif-pill ${currentFilter === f ? 'active' : ''}" data-filter="${f}">
                            ${f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    `).join('')}
                </div>

                <!-- List -->
                <div id="notif-container" class="space-y-1">
                    ${loading ? renderSkeletons() : renderList()}
                </div>
            </div>
        </div>`;
    }

    function renderList() {
        const filtered = getFiltered();
        if (filtered.length === 0) return renderEmpty();

        const groups = groupByDay(filtered);
        let html = '';
        
        for (const [day, items] of groups) {
            html += `<div class="pt-4 first:pt-0">
                <h3 class="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 px-1">${day}</h3>
                <div class="space-y-1.5">
                    ${items.map(n => renderItem(n)).join('')}
                </div>
            </div>`;
        }
        return html;
    }

    function renderItem(n) {
        const config = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.system;
        const isUnread = !n.is_read;
        const time = formatTime(n.created_at);
        const url = getActionUrl(n);

        return `
        <div class="notif-item relative group flex gap-3 p-3.5 rounded-2xl transition-all duration-300 ${isUnread ? 'bg-zinc-900/40 border border-zinc-800/50' : 'hover:bg-zinc-900/30'}" data-id="${n.id}" data-url="${url}">
            <div class="relative flex-shrink-0">
                <div class="w-11 h-11 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700/50">
                    ${n.actor_avatar ? `<img src="${n.actor_avatar}" class="w-full h-full object-cover">` : 
                    `<div class="w-full h-full flex items-center justify-center text-xs font-bold bg-gradient-to-br from-zinc-700 to-zinc-900 text-zinc-400">
                        ${(n.actor_name || '?').charAt(0).toUpperCase()}
                    </div>`}
                </div>
                <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${config.bg} flex items-center justify-center text-[10px] shadow-lg border border-[#030303]">
                    ${config.icon}
                </div>
            </div>
            <div class="flex-1 min-w-0 pr-4">
                <p class="text-sm leading-relaxed text-zinc-300">
                    ${formatBody(n)}
                </p>
                <span class="text-[10px] text-zinc-600 mt-1 block">${time}</span>
            </div>
            ${isUnread ? '<div class="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-600 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.5)]"></div>' : ''}
        </div>`;
    }

    function formatBody(n) {
        const actor = `<span class="text-white font-semibold">${escapeHtml(n.actor_name || 'Someone')}</span>`;
        switch (n.type) {
            case 'like': return `${actor} liked your post`;
            case 'comment': return `${actor} commented on your post: <span class="text-zinc-500 italic">"${escapeHtml(n.body?.slice(0, 50))}${n.body?.length > 50 ? '...' : ''}"</span>`;
            case 'message': return `${actor} sent you a message: <span class="text-zinc-500">"${escapeHtml(n.body?.slice(0, 50))}"</span>`;
            case 'post': return `${actor} shared a new post: <span class="text-zinc-400">${escapeHtml(n.body?.slice(0, 40))}...</span>`;
            case 'broadcast': return `<span class="text-red-500 font-bold">🚨 BROADCAST:</span> ${escapeHtml(n.body)}`;
            case 'team_join': return `${actor} requested to join your team`;
            case 'team_approve': return `🎉 Approved! You are now a member of <span class="text-emerald-400 font-semibold">${escapeHtml(n.body || 'the team')}</span>`;
            case 'team_deny': return `Your request to join <span class="text-zinc-400 font-semibold">${escapeHtml(n.body || 'the team')}</span> was declined.`;
            case 'welcome': return `Welcome to <span class="gradient-text-static">ICC</span>! 🚀 Start by exploring the feed.`;
            default: return n.body || 'New notification';
        }
    }

    function getActionUrl(n) {
        switch (n.type) {
            case 'like':
            case 'comment':
            case 'post': return n.reference_id ? `#post/${n.reference_id}` : '#feed';
            case 'message': return n.actor_id ? `#chat/${n.actor_id}` : '#chat';
            case 'team_join': 
            case 'team_approve':
            case 'team_deny': return `#teams/${n.reference_id || ''}`;
            default: return '#';
        }
    }

    function getFiltered() {
        if (currentFilter === 'all') return notifications;
        if (currentFilter === 'unread') return notifications.filter(n => !n.is_read);
        if (currentFilter === 'team') return notifications.filter(n => n.type.startsWith('team_'));
        return notifications.filter(n => n.type === currentFilter);
    }

    function groupByDay(items) {
        const groups = new Map();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);

        items.forEach(n => {
            const d = new Date(n.created_at);
            const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            let label = 'Earlier';
            if (day.getTime() === today.getTime()) label = 'Today';
            else if (day.getTime() === yesterday.getTime()) label = 'Yesterday';
            else if (now.getTime() - day.getTime() < 7 * 86400000) label = d.toLocaleDateString('en-US', { weekday: 'long' });
            else label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            if (!groups.has(label)) groups.set(label, []);
            groups.get(label).push(n);
        });
        return groups;
    }

    async function mount(container) {
        const user = ICCSupabase.getUser();
        if (!user) {
            container.innerHTML = renderLocked();
            return;
        }

        loading = true;
        container.innerHTML = render();
        
        notifications = await ICCSupabase.fetchNotifications();
        
        // Ensure strictly ordered by newest first
        notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        loading = false;
        container.innerHTML = render();
        bindEvents(container);

        // Instant Live Updates
        ICCSupabase.subscribeToNotifications((newNotif) => {
            // Prevent duplicates if fetch and realtime overlap
            if (notifications.find(n => n.id === newNotif.id)) return;
            
            notifications.unshift(newNotif);
            const list = document.getElementById('notif-container');
            if (list) {
                list.innerHTML = renderList();
                bindListEvents(list);
            }
            BottomNav.updateNotifCount();
            NotifBell.update();
        });
    }

    function bindEvents(container) {
        // Refresh
        document.getElementById('notif-refresh')?.addEventListener('click', async () => {
            loading = true; container.innerHTML = render();
            notifications = await ICCSupabase.fetchNotifications();
            loading = false; container.innerHTML = render();
            bindEvents(container);
        });

        // Filters
        container.querySelectorAll('.notif-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                currentFilter = btn.dataset.filter;
                container.querySelectorAll('.notif-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const list = document.getElementById('notif-container');
                if (list) { list.innerHTML = renderList(); bindListEvents(list); }
            });
        });

        // Mark all read
        document.getElementById('notif-read-all')?.addEventListener('click', async () => {
            await ICCSupabase.markAllNotificationsRead();
            notifications.forEach(n => n.is_read = true);
            container.innerHTML = render();
            bindEvents(container);
            BottomNav.updateNotifCount();
            NotifBell.update();
        });

        bindListEvents(container);
    }

    function bindListEvents(container) {
        container.querySelectorAll('.notif-item').forEach(el => {
            el.addEventListener('click', async () => {
                const id = el.dataset.id;
                const url = el.dataset.url;
                const notif = notifications.find(n => n.id === id);
                if (notif && !notif.is_read) {
                    if (!id.startsWith('pending_') && !id.startsWith('approve_') && !id.startsWith('deny_') && !id.startsWith('removed_') && !id.startsWith('post_') && !id.startsWith('comment_')) {
                        await ICCSupabase.markNotificationRead(id);
                    }
                    notif.is_read = true;
                    BottomNav.updateNotifCount();
                    NotifBell.update();
                }
                if (url && url !== '#') window.location.hash = url;
            });
        });
    }

    function renderEmpty() {
        return `
        <div class="flex flex-col items-center justify-center py-24 text-center opacity-40">
            <div class="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                <svg class="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>
            </div>
            <h3 class="text-lg font-semibold text-zinc-400">All caught up</h3>
            <p class="text-xs text-zinc-600 mt-1 max-w-[180px] mx-auto">New activity in your network will appear here.</p>
        </div>`;
    }

    function renderLocked() {
        return `
        <div class="flex flex-col items-center justify-center min-h-[80vh] text-center px-8">
            <div class="w-20 h-20 rounded-3xl bg-red-600/10 flex items-center justify-center mb-6">
                <svg class="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
            <h3 class="text-2xl font-bold mb-2">Inbox Locked</h3>
            <p class="text-zinc-500 text-sm mb-8">Sign in to see likes, comments, and team activity from your network.</p>
            <button onclick="AuthModal.open()" class="w-full max-w-xs py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-bold transition-all shadow-lg shadow-red-600/20">Sign In</button>
        </div>`;
    }

    function renderSkeletons() {
        return Array(6).fill(0).map(() => `
            <div class="flex gap-3 p-4">
                <div class="w-11 h-11 rounded-full skeleton"></div>
                <div class="flex-1 space-y-2 mt-1">
                    <div class="h-3 w-3/4 skeleton"></div>
                    <div class="h-2 w-1/4 skeleton"></div>
                </div>
            </div>
        `).join('');
    }

    function formatTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
        return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }

    function escapeHtml(s) {
        if (!s) return '';
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    return { mount };
})();
