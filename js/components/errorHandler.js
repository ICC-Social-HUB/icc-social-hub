/* ============================================
   ICC Social Hub — Global Error & Network Handler
   ============================================ */
const ErrorHandler = (() => {
    let isOffline = !navigator.onLine;

    function init() {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        window.addEventListener('error', handleGlobalError);

        if (isOffline) {
            showOfflineBanner();
        }
    }

    function handleOnline() {
        isOffline = false;
        hideOfflineBanner();
        Toast.success('Back online! Connection restored.');
        // Refresh current route data smoothly
        const currentHash = window.location.hash || '#dashboard';
        window.dispatchEvent(new Event('hashchange'));
    }

    function handleOffline() {
        isOffline = true;
        showOfflineBanner();
        Toast.error('No internet connection.');
    }

    function handleUnhandledRejection(event) {
        const reason = event.reason;
        console.error('⚠️ Unhandled Promise Rejection:', reason);

        const msg = reason?.message || String(reason || '');
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed') || !navigator.onLine) {
            handleOffline();
        } else {
            Toast.error(msg || 'An unexpected server error occurred.');
        }
    }

    function handleGlobalError(event) {
        console.error('⚠️ Global JS Error:', event.error || event.message);
        const msg = event.message || 'An unexpected error occurred.';
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || !navigator.onLine) {
            handleOffline();
        }
    }

    function showOfflineBanner() {
        let root = document.getElementById('offline-banner-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'offline-banner-root';
            document.body.appendChild(root);
        }

        root.innerHTML = `
        <div class="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" id="offline-overlay">
            <div class="bg-zinc-900 border border-red-900/60 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4 animate-slide-up">
                <div class="w-16 h-16 bg-red-950/80 border border-red-800/60 rounded-2xl flex items-center justify-center mx-auto text-red-500 shadow-lg">
                    <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a9 9 0 010-12.728M5.636 5.636L3 3m2.636 2.636l12.728 12.728M8.464 15.536a5 5 0 010-7.072"/>
                    </svg>
                </div>
                <div>
                    <h3 class="font-heading font-bold text-lg text-white">No Internet Connection</h3>
                    <p class="text-xs text-zinc-400 mt-1 leading-relaxed">Please check your Wi-Fi or mobile network settings and try again.</p>
                </div>
                <div class="pt-2 space-y-2">
                    <button id="retry-network-btn" class="w-full py-3 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/30">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Retry Connection
                    </button>
                </div>
            </div>
        </div>`;

        document.getElementById('retry-network-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('retry-network-btn');
            if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner spinner-sm mx-auto"></div> Checking connection...'; }

            try {
                if (navigator.onLine) {
                    handleOnline();
                } else {
                    Toast.error('Still offline. Please check your network.');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Retry Connection';
                    }
                }
            } catch (err) {
                Toast.error('Connection test failed.');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Retry Connection';
                }
            }
        });
    }

    function hideOfflineBanner() {
        const root = document.getElementById('offline-banner-root');
        if (root) root.innerHTML = '';
    }

    function renderErrorState(container, title = 'Something went wrong', message = 'Failed to load content. Please check your connection.', onRetry = null) {
        if (!container) return;
        container.innerHTML = `
        <div class="empty-state py-12 px-4 text-center">
            <div class="w-14 h-14 bg-red-950/40 border border-red-800/40 rounded-2xl flex items-center justify-center mx-auto mb-3 text-red-500">
                <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
            </div>
            <h3 class="font-heading font-semibold text-base text-white mb-1">${escapeHtml(title)}</h3>
            <p class="text-xs text-zinc-400 mb-4 max-w-xs mx-auto leading-relaxed">${escapeHtml(message)}</p>
            ${onRetry ? `
            <button id="error-retry-btn" class="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold text-white transition-all inline-flex items-center gap-2 shadow-md">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Retry Loading
            </button>` : ''}
        </div>`;

        if (onRetry) {
            document.getElementById('error-retry-btn')?.addEventListener('click', () => {
                onRetry();
            });
        }
    }

    return { init, showOfflineBanner, hideOfflineBanner, renderErrorState, handleOffline, handleOnline };
})();
