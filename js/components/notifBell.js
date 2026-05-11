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
        <a href="#notifications" class="relative w-12 h-12 flex items-center justify-center bg-obsidian/60 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-zinc-900 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.5)] group active:scale-95" id="floating-notif-bell">
            <svg class="w-6 h-6 text-zinc-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            ${unreadCount > 0 ? `<span class="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-crimson rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-obsidian animate-in zoom-in duration-300 text-white shadow-lg shadow-crimson/20">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
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
