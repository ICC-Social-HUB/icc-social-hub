/* ============================================
   ICC Social Hub — Hash-based SPA Router
   ============================================ */
const Router = (() => {
    let previousView = null;
    let previousHash = null;
    let currentHash = window.location.hash || '#dashboard';

    function init() {
        window.addEventListener('hashchange', () => {
            previousHash = currentHash;
            currentHash = window.location.hash || '#dashboard';
            handleRoute();
        });
        handleRoute();
    }

    function getPreviousHash() {
        return previousHash;
    }

    function handleRoute() {
        const hash = window.location.hash || '#dashboard';
        const container = document.getElementById('app');
        if (!container) return;

        // Progress Bar Start
        const progressBar = document.getElementById('route-progress');
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.style.opacity = '1';
            requestAnimationFrame(() => progressBar.style.width = '70%');
        }

        // Clean up previous view
        if (previousView === 'feed') FeedView.unmount?.();
        if (previousView === 'teams') TeamsView.unmount?.();
        if (previousView === 'chat') ChatView.unmount?.();
        if (previousView === 'profile') ProfileView.unmount?.();
        if (previousView === 'events') EventsView.unmount?.();
        if (previousView === 'eventDetail') EventDetailView.unmount?.();
        if (previousView === 'mentorDashboard') MentorDashboardView.unmount?.();
        if (previousView === 'students') StudentsView.unmount?.();

        // Clean up any open modals or overlays when route changes
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot) modalRoot.innerHTML = '';
        const workforceModal = document.getElementById('workforce-action-modal');
        if (workforceModal) workforceModal.remove();
        document.body.style.overflow = '';
        if (typeof Sidebar !== 'undefined') Sidebar.close?.();

        // Transition
        container.classList.remove('view-enter');
        container.classList.add('view-exit');

        container.classList.remove('view-exit');
        const isAuthenticated = !!ICCSupabase.getUser();
        const isPublicRoute = hash === '#feed' || hash.startsWith('#post/') || hash === '#events' || hash.startsWith('#event/');

        if (!isAuthenticated && !isPublicRoute) {
            previousView = 'auth-required';
            container.innerHTML = `
                <div class="empty-state min-h-screen flex flex-col items-center justify-center">
                    <div class="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                        <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    </div>
                    <h3 class="font-heading font-bold text-xl text-white mb-2">Sign In Required</h3>
                    <p class="text-sm text-zinc-400 mb-6 text-center max-w-sm">Please sign in to access this section of the ICC Social Hub.</p>
                    <button onclick="AuthModal.open()" class="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-red-600/20">Sign In</button>
                </div>
            `;
            setTimeout(() => {
                if (!ICCSupabase.getUser()) AuthModal.open();
            }, 100); // Auto-open login modal to simulate showing "login page"
        } else {
            // Route matching... (keep existing logic)
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
                const parts = hash.replace('#teams/', '').split('/');
                const teamId = parts[0].split('?')[0];
                const initialTab = parts[1] || (hash.includes('tab=mentor') ? 'mentor_chat' : 'overview');
                TeamsView.mount(container, teamId, initialTab);
            } else if (hash === '#chat') {
                previousView = 'chat';
                ChatView.mount(container);
            } else if (hash.startsWith('#chat/')) {
                previousView = 'chat';
                const partnerId = hash.split('/')[1];
                ChatView.mount(container, partnerId);
            } else if (hash === '#students' || hash.startsWith('#students?') || hash.startsWith('#students/')) {
                previousView = 'students';
                StudentsView.mount(container);
            } else if (hash.startsWith('#profile/')) {
                const userId = hash.split('/')[1]?.split('?')[0];
                if (userId && typeof UserProfileModal !== 'undefined') {
                    UserProfileModal.open(userId);
                }
            } else if (hash === '#profile') {
                previousView = 'profile';
                if (ICCSupabase.getUser() && ICCSupabase.needsOnboarding()) {
                    window.location.hash = '#onboarding';
                    return;
                }
                ProfileView.mount(container);
            } else if (hash === '#onboarding') {
                previousView = 'onboarding';
                if (!ICCSupabase.getUser()) { window.location.hash = '#dashboard'; return; }
                OnboardingView.mount(container);
            } else if (hash === '#admin') {
                if (!ICCSupabase.isAdmin()) { window.location.hash = '#dashboard'; return; }
                previousView = 'admin';
                AdminView.mount(container);
            } else if (hash === '#mentor-dashboard') {
                if (!ICCSupabase.isMentor()) { window.location.hash = '#dashboard'; return; }
                previousView = 'mentorDashboard';
                MentorDashboardView.mount(container);
            } else if (hash === '#notifications') {
                previousView = 'notifications';
                NotificationsView.mount(container);
            } else if (hash === '#download') {
                previousView = 'download';
                DownloadView.mount(container);
            } else if (hash === '#inventory') {
                previousView = 'inventory';
                InventoryView.mount(container);
            } else if (hash === '#attendance') {
                previousView = 'attendance';
                AttendanceView.mount(container);
            } else if (hash === '#events') {
                previousView = 'events';
                EventsView.mount(container);
            } else if (hash.startsWith('#event/')) {
                previousView = 'eventDetail';
                const eventId = hash.split('/')[1];
                EventDetailView.mount(container, eventId);
            } else {
                previousView = 'dashboard';
                DashboardView.mount(container);
            }
        }

            // Progress Bar End
            if (progressBar) {
                progressBar.style.width = '100%';
                setTimeout(() => {
                    progressBar.style.opacity = '0';
                    setTimeout(() => progressBar.style.width = '0%', 400);
                }, 200);
            }

        requestAnimationFrame(() => {
            container.classList.add('view-enter');
        });

        Sidebar.mount();
        if (typeof ProfileCompletionModal !== 'undefined') ProfileCompletionModal.checkAndShow();
        window.scrollTo(0, 0);
    }

    return { init, getPreviousHash };
})();

