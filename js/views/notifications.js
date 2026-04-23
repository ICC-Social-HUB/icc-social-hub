/* ============================================
   ICC Social Hub — Notifications View
   Shows all activity: likes, comments, messages,
   new posts, broadcasts, team joins, etc.
   ============================================ */
const NotificationsView = (() => {
    let notifications = [];
    let loading = true;
    let filter = 'all'; // all, unread, likes, comments, messages, posts

    const NOTIF_ICONS = {
        like: { icon: '❤️', color: '#E11D48', bg: 'rgba(225,29,72,0.12)' },
        comment: { icon: '💬', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
        message: { icon: '✉️', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
        post: { icon: '📝', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
        broadcast: { icon: '📢', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
        team_join: { icon: '👥', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
        team_approve: { icon: '✅', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
        mention: { icon: '@', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
        welcome: { icon: '🚀', color: '#FB7185', bg: 'rgba(251,113,133,0.12)' },
        system: { icon: '🔔', color: '#A1A1AA', bg: 'rgba(161,161,170,0.12)' }
    };

    function render() {
        const unreadCount = notifications.filter(n => !n.is_read).length;
        return `
        <section class="min-h-screen pt-2 pb-4 px-4 sm:px-0" id="notifications-section">
            <div class="max-w-lg mx-auto">
                <div class="flex items-center justify-between mb-4 px-1">
                    <div class="flex items-center gap-3">
                        <h1 class="font-heading font-bold text-xl">
                            <span class="gradient-text-static">Notifications</span>
                        </h1>
                        ${unreadCount > 0 ? `<span class="notif-count-badge">${unreadCount}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        ${unreadCount > 0 ? `<button id="mark-all-read-btn" class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[11px] font-medium transition-colors text-zinc-400 hover:text-white">Mark all read</button>` : ''}
                        <button id="notif-refresh-btn" class="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        </button>
                    </div>
                </div>
                <div class="flex gap-2 mb-4 overflow-x-auto pb-1 px-1 no-scrollbar" id="notif-filters">
                    ${renderFilterPills()}
                </div>
                <div id="notif-list">
                    ${loading ? renderSkeletons() : renderList()}
                </div>
            </div>
        </section>`;
    }

    function renderFilterPills() {
        const filters = [
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
            { id: 'like', label: '❤️ Likes' },
            { id: 'comment', label: '💬 Comments' },
            { id: 'message', label: '✉️ Messages' },
            { id: 'post', label: '📝 Posts' }
        ];
        return filters.map(f =>
            `<button class="filter-pill ${filter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>`
        ).join('');
    }

    function renderList() {
        const filtered = getFiltered();
        if (filtered.length === 0) {
            return `
            <div class="empty-state py-16">
                <div class="empty-state-icon">
                    <svg class="w-7 h-7 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
                    </svg>
                </div>
                <h3 class="font-heading font-semibold text-lg mb-1">${filter === 'unread' ? 'All caught up!' : 'No notifications yet'}</h3>
                <p class="text-sm text-zinc-500">${filter === 'unread' ? 'You\'ve read all your notifications ✨' : 'Your activity feed will show up here'}</p>
            </div>`;
        }

        // Group by day
        const groups = groupByDay(filtered);
        let html = '';
        for (const [label, items] of groups) {
            html += `<div class="mb-6">
                <h3 class="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">${label}</h3>
                <div class="space-y-1">
                    ${items.map((n, i) => renderNotifItem(n, i)).join('')}
                </div>
            </div>`;
        }
        return html;
    }

    function renderNotifItem(n, index) {
        const meta = NOTIF_ICONS[n.type] || NOTIF_ICONS.system;
        const isUnread = !n.is_read;
        const timeStr = formatTimeAgo(n.created_at);
        const actionUrl = getActionUrl(n);

        return `
        <div class="notif-item ${isUnread ? 'notif-unread' : ''} roster-item" style="animation-delay:${index * 0.03}s"
             data-id="${n.id}" ${actionUrl ? `data-href="${actionUrl}"` : ''}>
            <div class="notif-icon-wrap" style="background:${meta.bg}">
                <span class="text-base">${meta.icon}</span>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm leading-snug ${isUnread ? 'text-white font-medium' : 'text-zinc-300'}">
                    ${formatNotifText(n)}
                </p>
                <p class="text-[10px] text-zinc-600 mt-0.5">${timeStr}</p>
            </div>
            ${isUnread ? '<div class="notif-dot"></div>' : ''}
        </div>`;
    }

    function formatNotifText(n) {
        const actor = n.actor_name ? `<span class="text-white font-semibold">${escapeHtml(n.actor_name)}</span>` : 'Someone';
        switch (n.type) {
            case 'like': return `${actor} liked your post`;
            case 'comment': return `${actor} commented on your post${n.body ? ': <span class="text-zinc-500">"' + escapeHtml(n.body.slice(0, 50)) + '"</span>' : ''}`;
            case 'message': return `${actor} sent you a message${n.body ? ': <span class="text-zinc-500">"' + escapeHtml(n.body.slice(0, 50)) + '"</span>' : ''}`;
            case 'post': return `${actor} shared a new post${n.body ? ': <span class="text-zinc-500">"' + escapeHtml(n.body.slice(0, 50)) + '"</span>' : ''}`;
            case 'broadcast': return `📢 Admin broadcast: <span class="text-zinc-400">"${escapeHtml(n.body || '')}"</span>`;
            case 'team_join': return `${actor} requested to join your team`;
            case 'team_approve': return `You've been approved to join <span class="text-white font-semibold">${escapeHtml(n.body || 'the team')}</span>! 🎉`;
            case 'mention': return `${actor} mentioned you in a comment`;
            case 'welcome': return `Welcome to ICC! 🚀 Set up your profile to get started`;
            default: return n.body || 'New notification';
        }
    }

    function getActionUrl(n) {
        switch (n.type) {
            case 'like':
            case 'comment':
            case 'post':
                return n.reference_id ? `#post/${n.reference_id}` : '#feed';
            case 'message':
                return n.actor_id ? `#chat/${n.actor_id}` : '#chat';
            case 'team_join':
            case 'team_approve':
                return '#teams';
            case 'broadcast':
                return '#feed';
            default:
                return null;
        }
    }

    function getFiltered() {
        if (filter === 'all') return notifications;
        if (filter === 'unread') return notifications.filter(n => !n.is_read);
        return notifications.filter(n => n.type === filter);
    }

    function groupByDay(items) {
        const groups = new Map();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);

        for (const item of items) {
            const d = new Date(item.created_at);
            const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

            let label;
            if (itemDay.getTime() === today.getTime()) label = 'Today';
            else if (itemDay.getTime() === yesterday.getTime()) label = 'Yesterday';
            else if (now.getTime() - itemDay.getTime() < 7 * 86400000) {
                label = d.toLocaleDateString('en-US', { weekday: 'long' });
            } else {
                label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }

            if (!groups.has(label)) groups.set(label, []);
            groups.get(label).push(item);
        }
        return groups;
    }

    function renderSkeletons() {
        return Array(6).fill(0).map(() => `
            <div class="flex items-center gap-3 px-3 py-3">
                <div class="skeleton w-10 h-10 rounded-xl flex-shrink-0"></div>
                <div class="flex-1 space-y-2">
                    <div class="skeleton h-3 w-3/4"></div>
                    <div class="skeleton h-2 w-16"></div>
                </div>
            </div>`).join('');
    }

    async function mount(container) {
        const user = ICCSupabase.getUser();
        if (!user) {
            container.innerHTML = `
            <div class="empty-state min-h-screen">
                <div class="empty-state-icon">
                    <svg class="w-7 h-7 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
                    </svg>
                </div>
                <h3 class="font-heading font-semibold text-lg mb-1">Sign in to view notifications</h3>
                <p class="text-sm text-zinc-500 mb-4">Get notified about likes, comments, messages, and more.</p>
                <button onclick="AuthModal.open()" class="px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all">Sign In</button>
            </div>`;
            return;
        }

        loading = true;
        filter = 'all';
        container.innerHTML = render();

        // Fetch notifications
        notifications = await ICCSupabase.fetchNotifications();
        loading = false;
        container.innerHTML = render();
        bindEvents(container);

        // Subscribe to real-time
        ICCSupabase.subscribeToNotifications(async (newNotif) => {
            // Enrich with actor name
            if (newNotif.actor_id) {
                const actor = await ICCSupabase.fetchUserById(newNotif.actor_id);
                if (actor) newNotif.actor_name = actor.full_name || actor.username || 'Someone';
            }
            notifications.unshift(newNotif);
            const listEl = document.getElementById('notif-list');
            if (listEl) {
                listEl.innerHTML = renderList();
                bindListEvents();
            }
            // Update badge counts
            BottomNav.updateNotifCount();
            // Show toast for new notification
            const meta = NOTIF_ICONS[newNotif.type] || NOTIF_ICONS.system;
            Toast.info(`${meta.icon} ${formatNotifText(newNotif).replace(/<[^>]*>/g, '')}`);
        });
    }

    function bindEvents(container) {
        // Filter pills
        container.querySelectorAll('.filter-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                filter = btn.dataset.filter;
                container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const listEl = document.getElementById('notif-list');
                if (listEl) { listEl.innerHTML = renderList(); bindListEvents(); }
            });
        });

        // Mark all read
        document.getElementById('mark-all-read-btn')?.addEventListener('click', async () => {
            await ICCSupabase.markAllNotificationsRead();
            notifications.forEach(n => n.is_read = true);
            container.innerHTML = render();
            bindEvents(container);
            BottomNav.updateNotifCount();
            Toast.success('All notifications marked as read');
        });

        // Refresh
        document.getElementById('notif-refresh-btn')?.addEventListener('click', async () => {
            loading = true;
            const listEl = document.getElementById('notif-list');
            if (listEl) listEl.innerHTML = renderSkeletons();
            notifications = await ICCSupabase.fetchNotifications();
            loading = false;
            container.innerHTML = render();
            bindEvents(container);
        });

        bindListEvents();
    }

    function bindListEvents() {
        document.querySelectorAll('.notif-item').forEach(el => {
            el.addEventListener('click', async () => {
                const id = el.dataset.id;
                const href = el.dataset.href;

                // Mark as read
                const notif = notifications.find(n => n.id === id);
                if (notif && !notif.is_read) {
                    notif.is_read = true;
                    ICCSupabase.markNotificationRead(id);
                    el.classList.remove('notif-unread');
                    const dot = el.querySelector('.notif-dot');
                    if (dot) dot.remove();
                    BottomNav.updateNotifCount();
                }

                // Navigate
                if (href) window.location.hash = href;
            });
        });
    }

    function unmount() {
        const user = ICCSupabase.getUser();
        if (user) ICCSupabase.unsubscribeChannel(`notifs-${user.id}`);
    }

    return { mount, unmount };
})();
