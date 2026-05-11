/* ============================================
   ICC Social Hub — Main App Entry Point
   ============================================ */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 ICC Social Hub initializing...');

        // 1. Initialize Supabase
        ICCSupabase.init();

        // 4. Initialize Router immediately so UI shows up (skeletons/loading states)
        Router.init();

        // 5. Check existing session and load data (background-ish)
        try {
            await ICCSupabase.getSession();
            await loadLeads();
        } catch (err) {
            console.error('⚠️ Initialization error:', err);
        }

        let subscriptionsStarted = false;

        // 4. Listen for auth state changes
        ICCSupabase.onAuthStateChange(async (event, session) => {
            console.log('🔑 Auth event:', event);
            BottomNav.mount();
            
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (ICCSupabase.needsOnboarding()) {
                    window.location.hash = '#onboarding';
                } else {
                    // Don't re-dispatch hashchange if we're already inside a chat thread
                    // — it causes a race condition that wipes rendered messages
                    const currentHash = window.location.hash;
                    if (!currentHash.startsWith('#chat/')) {
                        window.dispatchEvent(new Event('hashchange'));
                    }
                }
                BottomNav.updateAllBadges();

                if (!subscriptionsStarted) {
                    subscriptionsStarted = true;
                    ICCSupabase.subscribeToMessages(() => {
                        BottomNav.updateUnreadCount();
                    });
                    ICCSupabase.subscribeToNotifications(() => {
                        NotifBell.update();
                        BottomNav.updateAllBadges();
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
        });

        // 5. Mount components
        Sidebar.mount();
        BottomNav.mount();
        NotifBell.mount();

        // 6.5. Init image viewer
        ImageViewer.init();

        // 7. Init particles
        initParticles();

        // 8. Smart Hide Nav Bar
        let lastScrollY = window.scrollY;
        window.addEventListener('scroll', () => {
            const nav = document.querySelector('.bottom-nav');
            if (!nav) return;
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                nav.classList.add('nav-hidden');
            } else {
                nav.classList.remove('nav-hidden');
            }
            lastScrollY = currentScrollY;
        }, { passive: true });

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
