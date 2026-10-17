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

        // 3. Components in modal-root
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot && modalRoot.children.length > 0 && modalRoot.innerHTML.trim() !== '') {
            if (typeof AuthModal !== 'undefined' && AuthModal.close) AuthModal.close();
            if (typeof CreatePostModal !== 'undefined' && CreatePostModal.close) CreatePostModal.close();
            if (typeof TeamChatModal !== 'undefined' && TeamChatModal.close) TeamChatModal.close();
            if (typeof UserProfileModal !== 'undefined' && UserProfileModal.close) UserProfileModal.close();
            if (typeof JoinTeamModal !== 'undefined' && JoinTeamModal.close) JoinTeamModal.close();
            if (typeof ChatPanel !== 'undefined' && ChatPanel.close) ChatPanel.close();
            modalRoot.innerHTML = '';
            return true;
        }

        return false;
    }

    function handleBackAction() {
        // Step 1: If any modal/drawer is open, close it!
        if (hasOpenModal()) {
            closeActiveModal();
            return;
        }

        // Step 2: If on sub-page (e.g. #teams, #profile, #chat), go back in hash history!
        const currentHash = window.location.hash || '#dashboard';
        const isHome = currentHash === '#dashboard' || currentHash === '' || currentHash === '#';

        if (!isHome) {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.hash = '#dashboard';
            }
            return;
        }

        // Step 3: On Home screen, require double back press to exit app
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.exitApp();
            }
        } else {
            lastBackPressTime = now;
            if (typeof Toast !== 'undefined' && Toast.info) {
                Toast.info('Press back again to exit app');
            }
        }
    }

    function init() {
        console.log('📱 Initializing Android Native Navigation Controller...');

        // Listen for Capacitor Native Hardware Back Button (Android)
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            window.Capacitor.Plugins.App.addListener('backButton', () => {
                handleBackAction();
            });
        }
    }

    return {
        init,
        handleBackAction,
        hasOpenModal,
        closeActiveModal
    };
})();
