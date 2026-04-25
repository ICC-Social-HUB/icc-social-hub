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
        const { session } = await ICCSupabase.getSession();

        // 3. Load leads data
        await loadLeads();

        let subscriptionsStarted = false;

        // 4. Listen for auth state changes
        ICCSupabase.onAuthStateChange(async (event, session) => {
            console.log('🔑 Auth event:', event);
            BottomNav.mount();
            
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (ICCSupabase.needsOnboarding()) {
                    window.location.hash = '#onboarding';
                } else {
                    window.dispatchEvent(new Event('hashchange'));
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
                }
            }

            if (event === 'SIGNED_OUT') {
                subscriptionsStarted = false;
                window.location.hash = '#feed';
            }
        });

        // 5. Mount components
        BottomNav.mount();
        NotifBell.mount();

        // 6. Initialize router
        Router.init();

        // 6.5. Init image viewer
        ImageViewer.init();

        // 7. Init particles
        initParticles();

        console.log('✅ ICC Social Hub ready');
    });



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
