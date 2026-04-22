/* ============================================
   ICC Social Hub — Toast Notification System
   ============================================ */

const Toast = (() => {
    function show(message, type = 'info', duration = 3500) {
        const root = document.getElementById('toast-root');
        if (!root) return;

        const icons = {
            success: '<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            error: '<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            info: '<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        };

        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
        root.appendChild(el);

        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(20px)';
            el.style.transition = 'all 0.3s ease';
            setTimeout(() => el.remove(), 300);
        }, duration);
    }

    function success(msg) { show(msg, 'success'); }
    function error(msg) { show(msg, 'error'); }
    function info(msg) { show(msg, 'info'); }

    return { show, success, error, info };
})();
