/* ============================================
   ICC Social Hub — Modern Minimalist Toast System
   ============================================ */

const Toast = (() => {
    function show(message, type = 'info', duration = 3500) {
        const root = document.getElementById('toast-root');
        if (!root) return;

        const icons = {
            success: `<div class="toast-icon-wrapper toast-icon-success">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
            </div>`,
            error: `<div class="toast-icon-wrapper toast-icon-error">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </div>`,
            info: `<div class="toast-icon-wrapper toast-icon-info">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            </div>`
        };

        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.setAttribute('role', 'alert');
        el.innerHTML = `${icons[type] || icons.info}<span class="toast-msg">${message}</span>`;
        root.appendChild(el);

        setTimeout(() => {
            el.classList.add('toast-dismissing');
            setTimeout(() => {
                if (el.parentNode) el.remove();
            }, 250);
        }, duration);
    }

    function success(msg, duration) { show(msg, 'success', duration); }
    function error(msg, duration) { show(msg, 'error', duration); }
    function info(msg, duration) { show(msg, 'info', duration); }

    return { show, success, error, info };
})();
