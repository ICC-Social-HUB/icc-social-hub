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
                NotifBell.update();
            }
            if (event === 'SIGNED_OUT') {
                window.location.hash = '#feed';
            }
        });

        // 5. Mount components
        BottomNav.mount();



        // 8. Subscribe to incoming messages & notifications for badges
        if (session) {
            BottomNav.updateAllBadges();
            NotifBell.update();
            ICCSupabase.subscribeToMessages(() => {
                BottomNav.updateUnreadCount();
            });
            ICCSupabase.subscribeToNotifications(async (newNotif) => {
                BottomNav.updateNotifCount();
                NotifBell.update();

                // Enrich for toast
                let actorName = 'Someone';
                if (newNotif.actor_id) {
                    const actor = await ICCSupabase.fetchUserById(newNotif.actor_id);
                    if (actor) actorName = actor.full_name || actor.username || 'Someone';
                }

                // In-app Toast notification
                let msg = 'New notification';
                switch (newNotif.type) {
                    case 'like': msg = `${actorName} liked your post`; break;
                    case 'comment': msg = `${actorName} commented on your post`; break;
                    case 'message': msg = `${actorName} sent you a message`; break;
                    case 'post': msg = `${actorName} shared a new post`; break;
                    case 'team_join': msg = `${actorName} requested to join your team`; break;
                    case 'team_approve': msg = `Your request to join ${newNotif.body} was approved! 🎉`; break;
                    case 'broadcast': msg = `📢 Admin: ${newNotif.body}`; break;
                    case 'system': msg = newNotif.body; break;
                }
                Toast.info(msg);
            });
        }

        // 9. Initialize router
        Router.init();

        // 10. Init particles
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
