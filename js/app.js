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

        // 4. Listen for auth state changes
        ICCSupabase.onAuthStateChange((event, session) => {
            console.log('🔑 Auth event:', event);
            BottomNav.mount();
            if (event === 'SIGNED_IN') {
                if (ICCSupabase.needsOnboarding()) {
                    window.location.hash = '#onboarding';
                } else {
                    window.dispatchEvent(new Event('hashchange'));
                }
                BottomNav.updateAllBadges();
            }
            if (event === 'SIGNED_OUT') {
                window.location.hash = '#feed';
            }
        });

        // 5. Mount components
        BottomNav.mount();

        // 6. Load broadcast banner
        await loadBroadcast();

        // 7. Subscribe to broadcasts
        ICCSupabase.subscribeToBroadcasts(broadcast => {
            showBroadcast(broadcast);
        });

        // 8. Subscribe to incoming messages & notifications for badges
        if (session) {
            BottomNav.updateAllBadges();
            ICCSupabase.subscribeToMessages(() => {
                BottomNav.updateUnreadCount();
            });
            ICCSupabase.subscribeToNotifications(() => {
                BottomNav.updateNotifCount();
            });
        }

        // 9. Initialize router
        Router.init();

        // 10. Init particles
        initParticles();

        console.log('✅ ICC Social Hub ready');
    });

    async function loadBroadcast() {
        const broadcast = await ICCSupabase.getActiveBroadcast();
        if (broadcast) showBroadcast(broadcast);
    }

    function showBroadcast(broadcast) {
        const bar = document.getElementById('broadcast-bar');
        if (!bar || !broadcast) return;
        bar.className = 'broadcast-banner';
        bar.innerHTML = `
            <span>📢 ${escapeHtml(broadcast.message)}</span>
            <button class="close-broadcast" onclick="this.parentElement.classList.add('hidden')">&times;</button>
        `;
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
