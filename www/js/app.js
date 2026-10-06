/* ============================================
   ICC Social Hub — App Loading Controller
   ============================================ */
const AppLoader = (() => {
    function updateSplash(statusText, progressPercent) {
        const statusEl = document.getElementById('app-splash-status');
        const barEl = document.getElementById('app-splash-bar');
        if (statusEl && statusText) statusEl.textContent = statusText;
        if (barEl && progressPercent !== undefined) barEl.style.width = progressPercent + '%';
    }

    function hideSplash() {
        const splashEl = document.getElementById('app-splash-screen');
        if (!splashEl) return;
        updateSplash('Ready!', 100);
        setTimeout(() => {
            splashEl.classList.add('splash-hidden');
            setTimeout(() => {
                if (splashEl.parentNode) {
                    splashEl.parentNode.removeChild(splashEl);
                }
            }, 550);
        }, 200);
    }

    function renderViewLoader(message = 'Loading content...') {
        return `
            <div class="view-loader-overlay animate-fade-in">
                <div class="icc-orbital-spinner mb-4">
                    <div class="spinner-ring ring-1"></div>
                    <div class="spinner-ring ring-2"></div>
                    <div class="spinner-core"></div>
                </div>
                <p class="text-xs font-mono text-rose-400/90 tracking-wider animate-pulse">${message}</p>
            </div>
        `;
    }

    return {
        updateSplash,
        hideSplash,
        renderViewLoader
    };
})();

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 ICC Social Hub initializing...');
        AppLoader.updateSplash('Connecting to Hub...', 25);

        // 1. Initialize Supabase & Global Error Handling
        ICCSupabase.init();
        if (typeof ErrorHandler !== 'undefined') ErrorHandler.init();
        AppLoader.updateSplash('Verifying Session...', 50);

        // 2. Check existing session
        try {
            await ICCSupabase.getSession();
        } catch (err) {
            console.error('⚠️ Session error:', err);
        }
        AppLoader.updateSplash('Initializing Views...', 75);

        // 3. Initialize Router & Android Hardware/WebView Navigation
        Router.init();
        if (typeof AndroidNavigation !== 'undefined') AndroidNavigation.init();

        // 4. Load remaining data
        try {
            await loadLeads();
        } catch (err) {
            console.error('⚠️ Leads error:', err);
        }
        AppLoader.updateSplash('Preparing Hub Experience...', 90);

        let subscriptionsStarted = false;
        let isInitialRouteHandled = false;
        let currentUserId = null;

        // 4. Listen for auth state changes
        ICCSupabase.onAuthStateChange(async (event, session) => {
            console.log('🔑 Auth event:', event);
            Sidebar.mount();
            
            if (session) {
                AuthModal.close();
            }
            
            const newUserId = session?.user?.id || null;
            
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (ICCSupabase.needsOnboarding()) {
                    window.location.hash = '#onboarding';
                } else {
                    if (typeof ProfileCompletionModal !== 'undefined') ProfileCompletionModal.checkAndShow();
                    if (!isInitialRouteHandled || (newUserId && currentUserId && newUserId !== currentUserId)) {
                        isInitialRouteHandled = true;
                        const currentHash = window.location.hash;
                        if (!currentHash.startsWith('#chat/')) {
                            window.dispatchEvent(new Event('hashchange'));
                        }
                    }
                }
                currentUserId = newUserId;
                Sidebar.updateUnreadCount();

                if (!subscriptionsStarted) {
                    subscriptionsStarted = true;
                    ICCSupabase.subscribeToMessages(() => {
                        Sidebar.updateUnreadCount();
                    });
                    ICCSupabase.subscribeToNotifications(() => {
                        NotifBell.update();
                        NotifBell.update();
                        Sidebar.updateUnreadCount();
                    });
                    NotifBell.update();
                    
                    // Register for Push Notifications on Native
                    registerPushNotifications();
                }
            }

            if (event === 'SIGNED_OUT') {
                subscriptionsStarted = false;
                window.location.hash = '#dashboard';
            }

            // Hide initial splash loading screen after auth initialization
            AppLoader.hideSplash();
        });

        // 5. Mount components
        Sidebar.mount();
        NotifBell.mount();

        // 6.5. Init image viewer
        ImageViewer.init();

        // 7. Init particles
        initParticles();

        // Safety fallback to hide splash after timeout if auth event doesn't fire
        setTimeout(() => AppLoader.hideSplash(), 1500);

        console.log('✅ ICC Social Hub ready');
    });



    async function registerPushNotifications() {
        if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.PushNotifications) {
            console.warn("Push plugin not found! Running in browser or sync missing.");
            return;
        }

        const PushNotifications = window.Capacitor.Plugins.PushNotifications;

        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.warn("Push permission denied by user.");
            return;
        }

        await PushNotifications.register();

        PushNotifications.addListener('registration', (token) => {
            console.log('✅ Push registration success, token generated.');
            if (ICCSupabase.getUser()) {
                ICCSupabase.updateProfile({ fcm_token: token.value });
            }
        });

        PushNotifications.addListener('registrationError', (error) => {
            console.error('Error registering push:', error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('Push received:', notification);
        });
    }

    function initParticles() {
        const bg = document.getElementById('particles-bg');
        if (!bg) return;
        bg.innerHTML = '';
        for (let i = 0; i < 15; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDuration = (18 + Math.random() * 25) + 's';
            p.style.animationDelay = (Math.random() * 12) + 's';
            bg.appendChild(p);
        }
    }
})();
