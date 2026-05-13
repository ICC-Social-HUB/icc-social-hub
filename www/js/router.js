/* ============================================
   ICC Social Hub — Hash-based SPA Router
   ============================================ */
const Router = (() => {
    let previousView = null;

    function init() {
        window.addEventListener('hashchange', handleRoute);
        handleRoute();
    }

    function handleRoute() {
        const hash = window.location.hash || '#dashboard';
        const container = document.getElementById('app');
        if (!container) return;

        // Clean up previous view
        if (previousView === 'feed') FeedView.unmount?.();
        if (previousView === 'teams') TeamsView.unmount?.();
        if (previousView === 'chat') ChatView.unmount?.();
        if (previousView === 'profile') ProfileView.unmount?.();
        if (previousView === 'inventory') InventoryView.unmount?.();
        if (previousView === 'attendance') AttendanceView.unmount?.();

        // Transition — keep delay short for snappy mobile feel
        container.classList.remove('view-enter');
        container.classList.add('view-exit');

        setTimeout(() => {
            container.classList.remove('view-exit');
            container.innerHTML = ''; // Clear immediately to avoid ghosting

            // Route matching
            if (hash === '#dashboard' || hash === '' || hash === '#') {
                previousView = 'dashboard';
                DashboardView.mount(container);
            } else if (hash === '#feed') {
                previousView = 'feed';
                FeedView.mount(container);
            } else if (hash.startsWith('#post/')) {
                previousView = 'feed';
                const postId = hash.split('/')[1];
                FeedView.mount(container, postId);
            } else if (hash === '#teams') {
                previousView = 'teams';
                TeamsView.mount(container);
            } else if (hash.startsWith('#teams/')) {
                previousView = 'teams';
                const teamId = hash.split('/')[1];
                TeamsView.mount(container, teamId);
            } else if (hash === '#chat') {
                previousView = 'chat';
                ChatView.mount(container);
            } else if (hash.startsWith('#chat/')) {
                previousView = 'chat';
                const partnerId = hash.split('/')[1];
                ChatView.mount(container, partnerId);
            } else if (hash === '#profile') {
                previousView = 'profile';
                // Guard: redirect to onboarding if needed
                if (ICCSupabase.getUser() && ICCSupabase.needsOnboarding()) {
                    window.location.hash = '#onboarding';
                    return;
                }
                ProfileView.mount(container);
            } else if (hash === '#onboarding') {
                previousView = 'onboarding';
                if (!ICCSupabase.getUser()) { window.location.hash = '#feed'; return; }
                OnboardingView.mount(container);
            } else if (hash === '#admin') {
                previousView = 'admin';
                AdminView.mount(container);
            } else if (hash === '#inventory') {
                previousView = 'inventory';
                InventoryView.mount(container);
            } else if (hash === '#attendance') {
                previousView = 'attendance';
                AttendanceView.mount(container);
            } else if (hash === '#notifications') {
                previousView = 'notifications';
                NotificationsView.mount(container);
            } else {
                previousView = 'feed';
                FeedView.mount(container);
            }

            // GPU-synced entrance animation
            requestAnimationFrame(() => {
                container.classList.add('view-enter');
            });

            Sidebar.mount();
            // Instant scroll — smooth causes jank during view transitions on mobile
            window.scrollTo(0, 0);
        }, 80);
    }

    return { init };
})();

