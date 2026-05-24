/* ============================================
   ICC Social Hub — Events View (Public)
   ============================================ */
const EventsView = (() => {
    let allEvents = [];

    function render() {
        const upcoming = allEvents.filter(e => e.status === 'upcoming');
        const past = allEvents.filter(e => e.status === 'past');

        return `
        <div class="max-w-4xl mx-auto px-4 py-8">
            <div class="mb-8 animate-fade-in">
                <h1 class="font-heading font-bold text-3xl">Events & Workshops</h1>
                <p class="text-sm text-zinc-500 mt-1">Discover what's happening at ICC. Open to everyone.</p>
            </div>

            ${upcoming.length > 0 ? `
            <div class="mb-12 animate-fade-in" style="animation-delay: 0.1s">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <h2 class="font-heading font-semibold text-xl">Upcoming Events</h2>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${upcoming.map(e => renderEventCard(e)).join('')}
                </div>
            </div>` : ''}

            ${past.length > 0 ? `
            <div class="animate-fade-in" style="animation-delay: 0.2s">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-2 h-2 bg-zinc-600 rounded-full"></div>
                    <h2 class="font-heading font-semibold text-xl text-zinc-400">Past Events</h2>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-80 hover:opacity-100 transition-opacity">
                    ${past.map(e => renderEventCard(e)).join('')}
                </div>
            </div>` : ''}
            
            ${upcoming.length === 0 && past.length === 0 ? `
            <div class="py-16 text-center glass-card rounded-2xl animate-fade-in">
                <div class="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-zinc-500">
                    <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
                <h3 class="font-heading font-semibold text-lg text-white">No Events Yet</h3>
                <p class="text-sm text-zinc-500 mt-1">Check back later for exciting new workshops and events.</p>
            </div>` : ''}
        </div>`;
    }

    function renderEventCard(event) {
        const dateObj = new Date(event.event_date);
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
        
        return `
        <a href="#event/${event.id}" class="group block relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800/50 hover:border-zinc-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
            <div class="aspect-[4/5] w-full bg-zinc-800 relative">
                ${event.banner_url ? `<img src="${event.banner_url}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="${event.title}">` : '<div class="w-full h-full flex items-center justify-center text-zinc-700"><svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>'}
                <div class="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-md rounded-xl overflow-hidden border border-zinc-800 shadow-md flex flex-col items-center justify-center w-12 h-12 text-center leading-none">
                    <span class="text-[10px] font-bold text-crimson uppercase">${month}</span>
                    <span class="text-base font-bold text-white">${day}</span>
                </div>
            </div>
            <div class="p-4">
                <h3 class="font-heading font-bold text-lg text-white mb-1 group-hover:text-crimson transition-colors line-clamp-1">${event.title}</h3>
                <p class="text-xs text-zinc-400 line-clamp-2">${event.description || 'No description available.'}</p>
                
                <div class="mt-4 flex items-center justify-between">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${event.status === 'upcoming' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}">
                        ${event.status === 'upcoming' ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>' : ''}
                        ${event.status}
                    </span>
                    <span class="text-xs font-semibold text-zinc-500 group-hover:text-white transition-colors flex items-center gap-1">
                        View Details <svg class="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </span>
                </div>
            </div>
        </a>`;
    }

    async function mount(container) {
        container.innerHTML = '<div class="flex items-center justify-center min-h-[50vh]"><div class="spinner"></div></div>';
        allEvents = await ICCSupabase.fetchEvents();
        container.innerHTML = render();
    }

    return { mount };
})();
