/* ============================================
   ICC Social Hub — Android & WebView Navigation Controller
   Handles Android hardware back button, gesture navigation & SPA history
   ============================================ */
const AndroidNavigation = (() => {
    let lastBackPressTime = 0;
    let isClosingModalViaPopstate = false;

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

        // 3. Global modal-root or active modal popups
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot && modalRoot.children.length > 0 && modalRoot.innerHTML.trim() !== '') {
            return true;
        }

        // 4. Any generic visible modal backdrop
        const backdrop = document.querySelector('.modal-backdrop, [id$="-modal-backdrop"]');
        if (backdrop && window.getComputedStyle(backdrop).display !== 'none') {
            return true;
        }

        return false;
    }

    function closeActiveModal() {
        let closed = false;
        isClosingModalViaPopstate = true;

        // 1. Image Viewer
        const imageViewer = document.getElementById('image-viewer-overlay');
        if (imageViewer && !imageViewer.classList.contains('hidden')) {
            if (typeof ImageViewer !== 'undefined' && ImageViewer.close) {
                ImageViewer.close();
            } else {
                imageViewer.classList.add('hidden');
            }
            closed = true;
        }

        // 2. Sidebar Drawer
        const sidebarDrawer = document.getElementById('sidebar-drawer');
        if (!closed && sidebarDrawer && !sidebarDrawer.classList.contains('-translate-x-full')) {
            if (typeof Sidebar !== 'undefined' && Sidebar.close) {
                Sidebar.close();
            }
            closed = true;
        }

        // 3. Components in modal-root / specific modal singletons
        if (!closed) {
            if (typeof AuthModal !== 'undefined' && AuthModal.close) AuthModal.close();
            if (typeof CreatePostModal !== 'undefined' && CreatePostModal.close) CreatePostModal.close();
            if (typeof TeamChatModal !== 'undefined' && TeamChatModal.close) TeamChatModal.close();
            if (typeof UserProfileModal !== 'undefined' && UserProfileModal.close) UserProfileModal.close();
            if (typeof JoinTeamModal !== 'undefined' && JoinTeamModal.close) JoinTeamModal.close();
            if (typeof ChatPanel !== 'undefined' && ChatPanel.close) ChatPanel.close();

            const modalRoot = document.getElementById('modal-root');
            if (modalRoot) {
                modalRoot.innerHTML = '';
            }
            closed = true;
        }

        setTimeout(() => { isClosingModalViaPopstate = false; }, 100);
        return closed;
    }

    function pushModalState() {
        if (!history.state || !history.state.modalOpen) {
            history.pushState({ modalOpen: true }, '', window.location.href);
        }
    }

    function onModalClose() {
        if (!isClosingModalViaPopstate && history.state && history.state.modalOpen) {
            history.back();
        }
    }

    function handleBackAction() {
        // Step 1: Close active modal/drawer if open
        if (hasOpenModal()) {
            closeActiveModal();
            return;
        }

        // Step 2: Handle Page Back Navigation
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

        // Step 3: Handle Home view with history stack
        if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
            window.history.back();
            return;
        }

        // Step 4: Double press back to exit app on home screen
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
        console.log('📱 Initializing Android & WebView Dynamic Navigation...');

        // 1. Intercept Capacitor Native Hardware Back Button (Android)
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            window.Capacitor.Plugins.App.addListener('backButton', () => {
                handleBackAction();
            });
        }

        // 2. Intercept Browser / WebView back gesture & popstate events
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
        closeActiveModal,
        pushModalState,
        onModalClose
    };
})();
