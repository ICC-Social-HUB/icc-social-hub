/* ============================================
   ICC Social Hub — Image Viewer Modal
   ============================================ */
const ImageViewer = (() => {
    function open(imageUrl) {
        if (!imageUrl) return;

        const viewer = document.createElement('div');
        viewer.id = 'image-viewer-overlay';
        viewer.className = 'fixed inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in cursor-zoom-out';
        
        viewer.innerHTML = `
            <img src="${imageUrl}" class="max-w-full max-h-full object-contain cursor-default animate-scale-in" style="padding: 16px;">
            <button id="image-viewer-close" class="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer z-10 backdrop-blur-sm">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        `;

        viewer.addEventListener('click', (e) => {
            if (e.target.tagName !== 'IMG') {
                close();
            }
        });

        document.body.appendChild(viewer);
        document.body.style.overflow = 'hidden';
    }

    function close() {
        const viewer = document.getElementById('image-viewer-overlay');
        if (viewer) {
            viewer.style.opacity = '0';
            viewer.style.transition = 'opacity 0.2s ease-out';
            setTimeout(() => {
                viewer.remove();
                if (!document.querySelector('.modal-backdrop')) {
                    document.body.style.overflow = '';
                }
            }, 200);
        }
    }

    function init() {
        document.body.addEventListener('click', (e) => {
            const el = e.target.closest('[data-full-image]');
            if (el) {
                e.stopPropagation();
                open(el.dataset.fullImage);
            }
        });
    }

    return { open, close, init };
})();
