/* ============================================
   ICC Social Hub — Sidebar (Hamburger Menu)
   ============================================ */
const Sidebar = (() => {
    let unreadMessages = 0;
    let isOpen = false;

    function render() {
        return `
        <!-- Sidebar Toggle Button (Inside Sticky Header) -->
        <button id="sidebar-toggle-btn" class="w-10 h-10 flex items-center justify-center bg-zinc-900/50 hover:bg-zinc-800 rounded-xl transition-all text-zinc-400 hover:text-white group active:scale-95 border border-zinc-800/50">
            <div class="flex flex-col gap-1.5 items-center justify-center">
                <span class="w-5 h-0.5 bg-current rounded-full transition-all"></span>
                <span class="w-5 h-0.5 bg-current rounded-full transition-all"></span>
                <span class="w-5 h-0.5 bg-current rounded-full transition-all"></span>
            </div>
        </button>
        `;
    }

    function renderDrawer() {
        const profile = ICCSupabase.getProfile();
        const isAdmin = ICCSupabase.isAdmin();

        const menuItems = [
            { id: 'notifications', label: 'Notifications', hash: '#notifications', icon: notifIcon(window.location.hash.startsWith('#notifications')) },
            { id: 'home', label: 'Home', hash: '#dashboard', icon: homeIcon(window.location.hash.startsWith('#dashboard')) },
            { id: 'feed', label: 'Innovation Feed', hash: '#feed', icon: feedIcon(window.location.hash.startsWith('#feed')) },
            { id: 'events', label: 'Events & Workshops', hash: '#events', icon: eventsIcon(window.location.hash.startsWith('#events')) },
            { id: 'teams', label: 'Teams & Projects', hash: '#teams', icon: teamsIcon(window.location.hash.startsWith('#teams')) },
            { id: 'chat', label: 'Messages', hash: '#chat', icon: chatIcon(window.location.hash.startsWith('#chat')), badge: unreadMessages },
            { id: 'attendance', label: 'Attendance', hash: '#attendance', icon: attendanceIcon() },
            { id: 'inventory', label: 'Inventory', hash: '#inventory', icon: inventoryIcon() },
            { id: 'download', label: 'Download App', hash: '#download', icon: downloadIcon(window.location.hash.startsWith('#download')) },
        ];

        if (isAdmin) {
            menuItems.push({ id: 'admin', label: 'Admin Dashboard', hash: '#admin', icon: adminIcon(false) });
        }

        return `
        <!-- Sidebar Backdrop -->
        <div id="sidebar-backdrop" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}" onclick="Sidebar.close()"></div>

        <!-- Sidebar Drawer -->
        <aside id="sidebar-drawer" class="fixed top-0 left-0 bottom-0 w-[280px] bg-obsidian border-r border-zinc-800 z-[2100] transition-transform duration-300 ease-out shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col">
            <!-- Header -->
            <div class="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gradient-to-br from-crimson to-crimson-dark rounded-xl flex items-center justify-center font-heading font-bold text-sm">ICC</div>
                    <span class="font-heading font-bold text-lg tracking-tight">Social Hub</span>
                </div>
                <button onclick="Sidebar.close()" class="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Profile Section -->
            <div class="px-6 py-4">
                <a href="#profile" onclick="Sidebar.close()" class="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 hover:bg-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer block group">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden border border-zinc-700 group-hover:border-zinc-600 transition-colors">
                            ${profile?.avatar_url ? `<img src="${profile.avatar_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center font-bold text-lg">${profile?.full_name?.charAt(0) || 'I'}</div>`}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-bold text-sm truncate group-hover:text-white transition-colors">${profile?.full_name || 'Innovator'}</h4>
                            <p class="text-xs text-zinc-500 truncate">${profile?.email || 'Student'}</p>
                        </div>
                        <div class="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                        </div>
                    </div>
                </a>
            </div>

            <!-- Menu Items -->
            <nav class="flex-1 px-4 py-2 space-y-1 overflow-y-auto no-scrollbar">
                <!-- Create Post Action -->
                <button id="sidebar-create-post" class="w-full flex items-center gap-4 px-4 py-4 mb-4 bg-crimson text-white rounded-2xl font-bold shadow-lg shadow-crimson/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    <div class="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    </div>
                    <span>Create New Post</span>
                </button>

                ${menuItems.map(item => `
                    <a href="${item.hash}" onclick="Sidebar.close()" class="flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all group ${window.location.hash.startsWith(item.hash) ? 'bg-crimson/10 text-crimson font-bold' : ''}">
                        <div class="w-6 h-6 transition-transform group-active:scale-90 relative">
                            ${item.icon}
                            ${item.badge > 0 ? `<span class="absolute -top-1 -right-1 min-w-[16px] h-4 bg-crimson text-white text-[9px] flex items-center justify-center rounded-full border-2 border-obsidian font-bold px-1">${item.badge > 9 ? '9+' : item.badge}</span>` : ''}
                        </div>
                        <span class="text-sm">${item.label}</span>
                    </a>
                `).join('')}
            </nav>

            <!-- Footer -->
            <div class="p-4 border-t border-zinc-800">
                ${ICCSupabase.getUser() ? `
                    <button onclick="ICCSupabase.signOut()" class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                        <span class="font-medium text-sm">Sign Out</span>
                    </button>
                ` : `
                    <button onclick="AuthModal.open(); Sidebar.close()" class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                        <span class="font-medium text-sm">Sign In</span>
                    </button>
                `}
            </div>
        </aside>
        `;
    }

    function inventoryIcon() {
        return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`;
    }

    function attendanceIcon() {
        return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`;
    }

    function downloadIcon(a) {
        return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'2'}">${a?'<path d="M12 2L12 15M12 15L8 11M12 15L16 11M5 18H19" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M5 20h14"/>'}</svg>`;
    }

    function eventsIcon(a) {
        return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"/>'}</svg>`;
    }

    function mount() {
        const toggleRoot = document.getElementById('sidebar-toggle-root');
        if (toggleRoot) toggleRoot.innerHTML = render();

        let drawerRoot = document.getElementById('sidebar-drawer-root');
        if (!drawerRoot) {
            drawerRoot = document.createElement('div');
            drawerRoot.id = 'sidebar-drawer-root';
            document.body.appendChild(drawerRoot);
        }
        drawerRoot.innerHTML = renderDrawer();
        
        bindEvents();
    }

    function bindEvents() {
        document.getElementById('sidebar-toggle-btn')?.addEventListener('click', open);
        document.getElementById('sidebar-create-post')?.addEventListener('click', () => {
            close();
            if (!ICCSupabase.getUser()) { AuthModal.open(); return; }
            CreatePostModal.open();
        });
    }

    async function updateUnreadCount() {
        unreadMessages = await ICCSupabase.getUnreadCount();
        if (isOpen) mount();
    }

    function open() {
        isOpen = true;
        mount();
        document.body.style.overflow = 'hidden';
        if (typeof AndroidNavigation !== 'undefined') AndroidNavigation.pushModalState();
    }

    function close() {
        isOpen = false;
        mount();
        document.body.style.overflow = '';
        if (typeof AndroidNavigation !== 'undefined') AndroidNavigation.onModalClose();
    }

    return { mount, open, close, updateUnreadCount };
})();
