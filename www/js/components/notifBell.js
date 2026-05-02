/* ============================================
   ICC Social Hub — Persistent Notification Bell
   Fixed in the upper right corner
   ============================================ */
const NotifBell = (() => {
    let unreadCount = 0;

    function render() {
        const user = ICCSupabase.getUser();
        if (!user) return '';

        return `
        <a href="#notifications" class="relative block p-2.5 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all shadow-xl group" id="floating-notif-bell">
            <svg class="w-6 h-6 text-zinc-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
            </svg>
            ${unreadCount > 0 ? `<span class="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-[#030303] animate-in zoom-in duration-300">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
        </a>`;
    }

    function mount() {
        const root = document.getElementById('notif-bell-root');
        if (root) root.innerHTML = render();
    }

    async function update() {
        unreadCount = await ICCSupabase.getUnreadNotifCount();
        mount();
    }

    function setCount(c) {
        unreadCount = c;
        mount();
    }

    return { mount, update, setCount };
})();
