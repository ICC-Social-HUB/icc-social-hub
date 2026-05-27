/* ============================================
   ICC Social Hub — Image Viewer Modal (Advanced Zoom & Pan)
   ============================================ */
const ImageViewer = (() => {
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let lastDist = 0;
    let currentImg = null;
    let urlsArray = [];
    let currentIndex = 0;

    function open(urlOrUrls, startIndex = 0) {
        if (!urlOrUrls || (Array.isArray(urlOrUrls) && urlOrUrls.length === 0)) return;
        
        if (Array.isArray(urlOrUrls)) {
            urlsArray = urlOrUrls;
            currentIndex = startIndex;
        } else {
            urlsArray = [urlOrUrls];
            currentIndex = 0;
        }
        
        // Reset state
        scale = 1;
        translateX = 0;
        translateY = 0;

        const viewer = document.createElement('div');
        viewer.id = 'image-viewer-overlay';
        viewer.className = 'fixed inset-0 z-[500] flex items-center justify-center bg-black/95 animate-fade-in touch-none';
        
        viewer.innerHTML = `
            <div id="image-viewer-container" class="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing">
                <img id="viewer-img" src="${urlsArray[currentIndex]}" class="max-w-[95%] max-h-[95%] object-contain transition-transform duration-200 ease-out select-none" style="transform: scale(1) translate(0px, 0px);">
            </div>
            
            <div class="absolute top-4 right-4 flex gap-2 z-[510]">
                <button id="viewer-reset" class="viewer-control-btn" title="Reset Zoom">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                </button>
                <button id="image-viewer-close" class="viewer-control-btn" title="Close">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            ${urlsArray.length > 1 ? `
            <button id="viewer-prev" class="absolute left-4 top-1/2 -translate-y-1/2 z-[510] p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button id="viewer-next" class="absolute right-4 top-1/2 -translate-y-1/2 z-[510] p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
            ` : ''}

            <div class="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 z-[510]">
                <button id="viewer-zoom-out" class="p-2 text-white/70 hover:text-white transition-colors">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4"/></svg>
                </button>
                <span id="zoom-percent" class="text-xs font-bold text-white/90 min-w-[48px] text-center">100%</span>
                <button id="viewer-zoom-in" class="p-2 text-white/70 hover:text-white transition-colors">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                </button>
            </div>
        `;

        document.body.appendChild(viewer);
        document.body.style.overflow = 'hidden';
        currentImg = document.getElementById('viewer-img');

        bindViewerEvents(viewer);
    }

    // Move these to module level so we can remove them
    let _handleMove = null;
    let _handleEnd = null;
    let _handleKeyDown = null;

    function bindViewerEvents(viewer) {
        const container = document.getElementById('image-viewer-container');
        const img = document.getElementById('viewer-img');
        const zoomLabel = document.getElementById('zoom-percent');

        const updateTransform = (smooth = true) => {
            img.style.transition = smooth ? 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)' : 'none';
            img.style.transform = `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`;
            zoomLabel.textContent = `${Math.round(scale * 100)}%`;
        };

        const adjustZoom = (delta, centerX, centerY) => {
            const oldScale = scale;
            scale = Math.min(Math.max(0.5, scale + delta), 5);
            
            if (centerX !== undefined && centerY !== undefined) {
                const rect = img.getBoundingClientRect();
                const offsetX = (centerX - rect.left - rect.width / 2) / oldScale;
                const offsetY = (centerY - rect.top - rect.height / 2) / oldScale;
                
                translateX -= offsetX * (scale - oldScale);
                translateY -= offsetY * (scale - oldScale);
            }
            
            updateTransform();
        };

        viewer.addEventListener('click', (e) => {
            if (e.target === viewer || e.target === container) close();
        });

        document.getElementById('image-viewer-close').addEventListener('click', close);
        document.getElementById('viewer-reset').addEventListener('click', () => {
            scale = 1; translateX = 0; translateY = 0;
            updateTransform();
        });

        document.getElementById('viewer-zoom-in').addEventListener('click', () => adjustZoom(0.25));
        document.getElementById('viewer-zoom-out').addEventListener('click', () => adjustZoom(-0.25));

        const navigateImage = (direction) => {
            if (urlsArray.length <= 1) return;
            currentIndex += direction;
            if (currentIndex < 0) currentIndex = urlsArray.length - 1;
            if (currentIndex >= urlsArray.length) currentIndex = 0;
            
            img.src = urlsArray[currentIndex];
            scale = 1; translateX = 0; translateY = 0;
            updateTransform();
        };

        const prevBtn = document.getElementById('viewer-prev');
        const nextBtn = document.getElementById('viewer-next');
        if (prevBtn) prevBtn.addEventListener('click', () => navigateImage(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => navigateImage(1));

        _handleKeyDown = (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') navigateImage(-1);
            if (e.key === 'ArrowRight') navigateImage(1);
        };
        window.addEventListener('keydown', _handleKeyDown);

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.2 : 0.2;
            adjustZoom(delta, e.clientX, e.clientY);
        }, { passive: false });

        const handleStart = (e) => {
            if (e.touches && e.touches.length === 2) {
                lastDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                return;
            }
            
            isDragging = true;
            const point = e.touches ? e.touches[0] : e;
            startX = point.pageX - translateX;
            startY = point.pageY - translateY;
            img.style.transition = 'none';
        };

        _handleMove = (e) => {
            if (e.touches && e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                const delta = (dist - lastDist) / 200;
                const midX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
                const midY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
                
                adjustZoom(delta, midX, midY);
                lastDist = dist;
                return;
            }

            if (!isDragging) return;
            e.preventDefault();
            const point = e.touches ? e.touches[0] : e;
            translateX = point.pageX - startX;
            translateY = point.pageY - startY;
            updateTransform(false);
        };

        _handleEnd = () => {
            isDragging = false;
            updateTransform(true);
        };

        container.addEventListener('mousedown', handleStart);
        window.addEventListener('mousemove', _handleMove);
        window.addEventListener('mouseup', _handleEnd);

        container.addEventListener('touchstart', handleStart, { passive: false });
        container.addEventListener('touchmove', _handleMove, { passive: false });
        container.addEventListener('touchend', _handleEnd);
    }

    function close() {
        const viewer = document.getElementById('image-viewer-overlay');
        if (viewer) {
            window.removeEventListener('mousemove', _handleMove);
            window.removeEventListener('mouseup', _handleEnd);
            window.removeEventListener('keydown', _handleKeyDown);
            
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
