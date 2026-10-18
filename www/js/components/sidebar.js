/* ============================================
   ICC Social Hub — Sidebar (Hamburger Menu)
   ============================================ */
const Sidebar = (() => {
    let unreadMessages = 0;
    let isOpen = false;

    function render() {
        return `
        <!-- Sidebar Toggle Button (Inside Sticky Header) -->
        <button id="sidebar-toggle-btn" class="w-10 h-10 flex items-center justify-center bg-[#242f3d] hover:bg-[#2b394a] rounded-xl transition-all text-[#708499] hover:text-white group active:scale-95 border border-[#2b394a]">
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
            { id: 'students', label: 'Students', hash: '#students', icon: studentsIcon(window.location.hash.startsWith('#students')) },
            { id: 'events', label: 'Events & Workshops', hash: '#events', icon: eventsIcon(window.location.hash.startsWith('#events')) },
            { id: 'teams', label: 'Projects', hash: '#teams', icon: teamsIcon(window.location.hash.startsWith('#teams')) },
            { id: 'chat', label: 'Messages', hash: '#chat', icon: chatIcon(window.location.hash.startsWith('#chat')), badge: unreadMessages },
            { id: 'attendance', label: 'Attendance', hash: '#attendance', icon: attendanceIcon() },
            { id: 'inventory', label: 'Inventory', hash: '#inventory', icon: inventoryIcon() },
            { id: 'download', label: 'Download App', hash: '#download', icon: downloadIcon(window.location.hash.startsWith('#download')) },
        ];

        if (isAdmin || ICCSupabase.isMentor()) {
            menuItems.push({ 
                id: 'core-space', 
                label: 'Core Space', 
                hash: '#core-space', 
                icon: coreSpaceIcon(window.location.hash.startsWith('#core-space')) 
            });
        }

        if (isAdmin) {
            menuItems.push({ id: 'admin', label: 'Admin Dashboard', hash: '#admin', icon: adminIcon(false) });
        }

        if (ICCSupabase.isMentor()) {
            menuItems.push({ id: 'mentor', label: 'Mentor Dashboard', hash: '#mentor-dashboard', icon: mentorIcon(window.location.hash.startsWith('#mentor-dashboard')) });
        }

        return `
        <!-- Sidebar Backdrop -->
        <div id="sidebar-backdrop" class="fixed inset-0 bg-[#0e1621]/80 backdrop-blur-md z-[2000] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}" onclick="Sidebar.close()"></div>

        <!-- Sidebar Drawer -->
        <aside id="sidebar-drawer" class="fixed top-0 left-0 bottom-0 w-[280px] bg-[#17212b] border-r border-[#101921] z-[2100] transition-transform duration-300 ease-out shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col">
            <!-- Header -->
            <div class="p-5 border-b border-[#101921] flex items-center justify-between bg-[#17212b]">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-[#3390ec] text-white rounded-xl flex items-center justify-center font-heading font-bold text-sm shadow-sm">ICC</div>
                    <span class="font-heading font-semibold text-lg tracking-tight text-white">Social Hub</span>
                </div>
                <button onclick="Sidebar.close()" class="p-2 hover:bg-[#242f3d] rounded-lg transition-colors text-[#708499]">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Profile Section (Telegram Drawer Header Style) -->
            <div class="px-4 py-4 bg-[#17212b]">
                <a href="#profile" onclick="Sidebar.close()" class="p-3 bg-[#242f3d] rounded-xl border border-[#2b394a] hover:bg-[#2b394a] transition-all cursor-pointer block group">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 rounded-full bg-[#3390ec] overflow-hidden border border-white/10 flex items-center justify-center font-bold text-white text-base shadow-sm">
                            ${profile?.avatar_url ? `<img src="${profile.avatar_url}" class="w-full h-full object-cover">` : `${profile?.full_name?.charAt(0) || 'I'}`}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-bold text-sm text-white truncate">${profile?.full_name || 'Innovator'}</h4>
                            <p class="text-xs text-[#708499] truncate">${profile?.email || 'Student'}</p>
                        </div>
                        <div class="text-[#708499] group-hover:text-white transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                        </div>
                    </div>
                </a>
            </div>

            <!-- Menu Items -->
            <nav class="flex-1 px-3 py-2 space-y-1 overflow-y-auto no-scrollbar">
                <!-- Create Post Action -->
                <button id="sidebar-create-post" class="w-full flex items-center gap-3 px-4 py-3 mb-3 bg-[#3390ec] text-white rounded-xl font-semibold shadow-md hover:bg-[#2b7cce] active:scale-[0.98] transition-all">
                    <div class="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    </div>
                    <span>Create New Post</span>
                </button>

                ${menuItems.map(item => `
                    <a href="${item.hash}" onclick="Sidebar.close()" class="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all group ${window.location.hash.startsWith(item.hash) ? 'bg-[#2b5278] text-white font-semibold' : 'text-[#708499] hover:text-white hover:bg-[#242f3d]'}" style="margin-bottom: 2px;">
                        <div class="w-6 h-6 transition-transform group-active:scale-90 relative flex items-center justify-center">
                            ${item.icon}
                            ${item.badge > 0 ? `<span class="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#3390ec] text-white text-[9px] flex items-center justify-center rounded-full border-2 border-[#17212b] font-bold px-1">${item.badge > 9 ? '9+' : item.badge}</span>` : ''}
                        </div>
                        <span class="text-sm font-medium">${item.label}</span>
                    </a>
                `).join('')}
            </nav>

            <!-- Footer -->
            <div class="p-4 border-t border-[#101921] bg-[#17212b]">
                ${ICCSupabase.getUser() ? `
                    <button onclick="ICCSupabase.signOut()" class="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[#708499] hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                        <span class="font-medium text-sm">Sign Out</span>
                    </button>
                ` : `
                    <button onclick="AuthModal.open(); Sidebar.close()" class="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[#708499] hover:text-white hover:bg-[#242f3d] transition-all">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
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

    function coreSpaceIcon(a) {
        return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>'}</svg>`;
    }

    function mentorIcon(a) {
        return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2zm-7.5 9.7V17c0 3.04 3.36 5.5 7.5 5.5s7.5-2.46 7.5-5.5v-5.3L12 16.2 4.5 11.7z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-5.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5"/>'}</svg>`;
    }

    function studentsIcon(a) {
        return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>'}</svg>`;
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
    }

    function close() {
        isOpen = false;
        mount();
        document.body.style.overflow = '';
    }

    return { mount, open, close, updateUnreadCount };
})();
