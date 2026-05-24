/* ============================================
   ICC Social Hub — Event Detail View (Public)
   ============================================ */
const EventDetailView = (() => {
    let currentEvent = null;

    function render() {
        if (!currentEvent) {
            return `
            <div class="max-w-3xl mx-auto px-4 py-16 text-center">
                <div class="w-16 h-16 mx-auto bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 mb-4">
                    <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <h2 class="font-heading font-bold text-xl mb-2">Event Not Found</h2>
                <p class="text-zinc-500 text-sm mb-6">This event may have been removed or doesn't exist.</p>
                <a href="#events" class="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold transition-colors">Back to Events</a>
            </div>`;
        }

        const dateObj = new Date(currentEvent.event_date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        let actionButtonsHtml = '';
        if (currentEvent.action_buttons && Array.isArray(currentEvent.action_buttons) && currentEvent.action_buttons.length > 0) {
            actionButtonsHtml = currentEvent.action_buttons.map(btn => `
                <a href="${btn.url}" target="_blank" class="flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-crimson hover:bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-crimson/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                    ${btn.label}
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </a>
            `).join('');
        }

        let galleryHtml = '';
        if (currentEvent.gallery_urls && Array.isArray(currentEvent.gallery_urls) && currentEvent.gallery_urls.length > 0) {
            galleryHtml = `
            <div class="mt-12 animate-fade-in" style="animation-delay: 0.3s">
                <h3 class="font-heading font-bold text-lg mb-4">Event Gallery</h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                    ${currentEvent.gallery_urls.map(url => `
                        <div class="aspect-square rounded-xl overflow-hidden bg-zinc-800 cursor-pointer group" onclick="ImageViewer.open('${url}')">
                            <img src="${url}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Gallery image">
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }

        // Format description nicely (convert newlines to paragraphs)
        const descHtml = (currentEvent.description || '').split('\\n').filter(p => p.trim() !== '').map(p => `<p class="mb-4 last:mb-0 leading-relaxed">${p}</p>`).join('');

        return `
        <div class="pb-16 relative">
            <!-- Back Button Header -->
            <div class="sticky top-[64px] z-[100] w-full bg-obsidian/90 backdrop-blur-md border-b border-zinc-800/50 py-3 px-4">
                <div class="max-w-4xl mx-auto flex items-center">
                    <a href="#events" class="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                        Back to Events
                    </a>
                </div>
            </div>

            <div class="max-w-3xl mx-auto px-4 pt-6">
                <!-- Banner Image -->
                ${currentEvent.banner_url ? `
                <div class="w-full max-w-lg mx-auto h-72 md:h-96 rounded-2xl md:rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800/50 shadow-2xl mb-8 flex items-center justify-center p-2 animate-fade-in cursor-pointer" onclick="ImageViewer.open('${currentEvent.banner_url}')">
                    <img src="${currentEvent.banner_url}" class="w-full h-full object-contain" alt="${currentEvent.title}">
                </div>
                ` : ''}

                <div class="animate-fade-in" style="animation-delay: 0.1s">
                    <div class="flex items-center gap-3 mb-4">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${currentEvent.status === 'upcoming' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}">
                            ${currentEvent.status === 'upcoming' ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>' : ''}
                            ${currentEvent.status}
                        </span>
                        <div class="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                            ${formattedDate} at ${formattedTime}
                        </div>
                    </div>

                    <h1 class="font-heading font-bold text-3xl md:text-5xl text-white mb-6 leading-tight">${currentEvent.title}</h1>
                    
                    ${actionButtonsHtml ? `
                    <div class="flex flex-wrap gap-3 mb-8 pb-8 border-b border-zinc-800/50">
                        ${actionButtonsHtml}
                    </div>
                    ` : '<div class="mb-8 pb-8 border-b border-zinc-800/50"></div>'}

                    <div class="prose prose-invert prose-zinc max-w-none text-zinc-300 text-[15px] md:text-base">
                        ${descHtml}
                    </div>
                </div>

                ${galleryHtml}
            </div>
        </div>`;
    }

    async function mount(container, eventId) {
        container.innerHTML = '<div class="flex items-center justify-center min-h-[50vh]"><div class="spinner"></div></div>';
        currentEvent = await ICCSupabase.fetchEventById(eventId);
        container.innerHTML = render();
    }

    return { mount };
})();
