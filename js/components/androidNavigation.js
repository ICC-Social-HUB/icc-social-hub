/* ============================================
   ICC Social Hub — Android Navigation Controller
   Handles Android hardware back button & modal closing cleanly
   ============================================ */
const AndroidNavigation = (() => {
    let lastBackPressTime = 0;

    function hasOpenModal() {
        // 1. Sidebar Drawer
        const sidebarDrawer = document.getElementById('sidebar-drawer');
        if (sidebarDrawer && !sidebarDrawer.classList.contains('-translate-x-full')) {
            return true;
        }

        // 2. Image Viewer
        const imageViewer = document.getElementById('image-viewer-overlay');
        if (imageViewer && !imageViewer.classList.contains('hidden')) {
            return true;
        }

        // 3. Global modal-root contents
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot && modalRoot.children.length > 0 && modalRoot.innerHTML.trim() !== '') {
            return true;
        }

        // 4. Workforce Action Modal or Progress Modal
        if (document.getElementById('workforce-action-modal')) return true;
        const progressModal = document.getElementById('progress-modal');
        if (progressModal && !progressModal.classList.contains('hidden')) return true;

        // 5. Students / Hustlers Filter Drawer
        const studentsFilter = document.getElementById('students-filter-drawer');
        if (studentsFilter && !studentsFilter.classList.contains('hidden')) return true;

        return false;
    }

    function closeActiveModal() {
        // 0. Workforce Modal or Progress Modal
        const wfModal = document.getElementById('workforce-action-modal');
        if (wfModal) { wfModal.remove(); return true; }
        const progressModal = document.getElementById('progress-modal');
        if (progressModal && !progressModal.classList.contains('hidden')) {
            progressModal.classList.add('hidden');
            return true;
        }

        // 1. Image Viewer
        const imageViewer = document.getElementById('image-viewer-overlay');
        if (imageViewer && !imageViewer.classList.contains('hidden')) {
            if (typeof ImageViewer !== 'undefined' && ImageViewer.close) {
                ImageViewer.close();
            } else {
                imageViewer.classList.add('hidden');
            }
            return true;
        }

        // 2. Sidebar Drawer
        const sidebarDrawer = document.getElementById('sidebar-drawer');
        if (sidebarDrawer && !sidebarDrawer.classList.contains('-translate-x-full')) {
            if (typeof Sidebar !== 'undefined' && Sidebar.close) {
                Sidebar.close();
            }
            return true;
        }

        // 3. Students / Hustlers Filter Drawer
        const studentsFilter = document.getElementById('students-filter-drawer');
        if (studentsFilter && !studentsFilter.classList.contains('hidden')) {
            if (typeof StudentsView !== 'undefined' && StudentsView.toggleFilterDrawer) {
                StudentsView.toggleFilterDrawer();
            } else {
                studentsFilter.classList.add('hidden');
            }
            return true;
        }

        // 4. Components in modal-root
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot && modalRoot.children.length > 0 && modalRoot.innerHTML.trim() !== '') {
            if (typeof AuthModal !== 'undefined' && AuthModal.close) AuthModal.close();
            if (typeof CreatePostModal !== 'undefined' && CreatePostModal.close) CreatePostModal.close();
            if (typeof TeamChatModal !== 'undefined' && TeamChatModal.close) TeamChatModal.close();
            if (typeof UserProfileModal !== 'undefined' && UserProfileModal.close) UserProfileModal.close();
            if (typeof JoinTeamModal !== 'undefined' && JoinTeamModal.close) JoinTeamModal.close();
            if (typeof ChatPanel !== 'undefined' && ChatPanel.close) ChatPanel.close();
            modalRoot.innerHTML = '';
            document.body.style.overflow = '';
            return true;
        }

        return false;
    }

    function handleBackAction() {
        // Step 1: If any modal/drawer is open, close it!
        if (hasOpenModal()) {
            closeActiveModal();
            return true;
        }

        // Step 2: Specific team sub-page hierarchy
        const currentHash = window.location.hash || '#dashboard';
        if (currentHash.startsWith('#teams/') && currentHash !== '#teams') {
            window.location.hash = '#teams';
            return true;
        }

        // Step 3: Ask Router to go back in history
        if (typeof Router !== 'undefined' && Router.goBack && Router.goBack()) {
            return true;
        }

        // Step 4: If not on home/dashboard, go to dashboard
        const isHome = currentHash === '#dashboard' || currentHash === '' || currentHash === '#';
        if (!isHome) {
            window.location.hash = '#dashboard';
            return true;
        }

        // Step 5: On Home screen, require double back press to exit app
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.exitApp();
            }
            return false; // Exit app
        } else {
            lastBackPressTime = now;
            if (typeof Toast !== 'undefined' && Toast.info) {
                Toast.info('Press back again to exit app');
            }
            return true; // Warned user, do not exit yet
        }
    }

    function init() {
        console.log('📱 Initializing Android & Web Navigation Controller...');

        // 1. Capacitor Native Hardware Back Button (Android)
        function bindCapacitorBack() {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                try {
                    window.Capacitor.Plugins.App.removeAllListeners?.('backButton');
                    window.Capacitor.Plugins.App.addListener('backButton', () => {
                        handleBackAction();
                    });
                    console.log('✅ Capacitor backButton listener bound');
                    return true;
                } catch (e) {
                    console.warn('⚠️ Error binding Capacitor backButton:', e);
                }
            }
            return false;
        }

        if (!bindCapacitorBack()) {
            let tries = 0;
            const timer = setInterval(() => {
                tries++;
                if (bindCapacitorBack() || tries > 25) {
                    clearInterval(timer);
                }
            }, 200);
        }

        // 2. Standard document backbutton event (Cordova / WebViews)
        document.addEventListener('backbutton', (e) => {
            e.preventDefault();
            handleBackAction();
        }, false);

        // 3. Web Popstate Listener (Mobile & Desktop Browsers)
        window.addEventListener('popstate', (e) => {
            if (hasOpenModal()) {
                closeActiveModal();
            }
        });
    }

    return {
        init,
        handleBackAction,
        hasOpenModal,
        closeActiveModal
    };
})();
