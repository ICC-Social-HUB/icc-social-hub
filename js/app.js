/* ============================================
   ICC Social Hub — Main App Entry Point
   ============================================ */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        console.log('🚀 ICC Social Hub initializing...');

        // 1. Initialize Supabase
        ICCSupabase.init();

        // 2. Check existing session
        try {
            await ICCSupabase.getSession();
        } catch (err) {
            console.error('⚠️ Session error:', err);
        }

        // 3. Initialize Router AFTER session is known to avoid "auth-required" flash
        Router.init();

        // 4. Load remaining data
        try {
            await loadLeads();
        } catch (err) {
            console.error('⚠️ Leads error:', err);
        }

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
                } else if (!isInitialRouteHandled || (newUserId && currentUserId && newUserId !== currentUserId)) {
                    isInitialRouteHandled = true;
                    const currentHash = window.location.hash;
                    if (!currentHash.startsWith('#chat/')) {
                        window.dispatchEvent(new Event('hashchange'));
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
        });

        // 5. Mount components
        Sidebar.mount();
        NotifBell.mount();

        // 6.5. Init image viewer
        ImageViewer.init();

        // 7. Init particles
        initParticles();

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
