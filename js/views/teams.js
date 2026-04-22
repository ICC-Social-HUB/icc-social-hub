/* ============================================
   ICC Social Hub — Teams View
   ============================================ */
const TeamsView = (() => {
    let currentTeamId = null;
    let teamMembers = [];

    function renderGrid() {
        const profile = ICCSupabase.getProfile();
        const userTeamId = profile?.team_id;
        return `
        <section class="min-h-screen pt-2 pb-4 px-4" id="teams-section">
            <div class="max-w-5xl mx-auto">
                <div class="text-center mb-8 px-2">
                    <p class="text-red-500 text-xs font-semibold tracking-widest uppercase mb-2">Core Teams</p>
                    <h1 class="font-heading font-bold text-2xl sm:text-3xl mb-2">Meet Your Future <span class="gradient-text-static">Leaders</span></h1>
                    <p class="text-zinc-500 text-sm max-w-md mx-auto">13 teams, 13 visionaries. Find the one that matches your passion.</p>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" id="leads-grid">
                    ${CORE_LEADS.map((lead, i) => {
                        const isMember = userTeamId === lead.id;
                        return `
                        <div class="lead-card bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden cursor-pointer group" data-lead-id="${lead.id}" style="animation:slideUp 0.4s ease-out ${i*0.05}s both">
                            <div class="relative h-28 sm:h-36 overflow-hidden bg-gradient-to-br ${lead.gradient}">
                                <div class="portrait absolute inset-0 flex items-center justify-center">
                                    <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-950/40 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center">
                                        <span class="font-heading font-bold text-xl text-white/90">${lead.initials}</span>
                                    </div>
                                </div>
                                <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-60"></div>
                                ${isMember ? `<div class="absolute top-2 right-2 px-2 py-0.5 bg-emerald-600 rounded-full text-[10px] font-bold flex items-center gap-1 z-10">✓ You</div>` : ''}
                            </div>
                            <div class="p-3">
                                <h3 class="font-heading font-semibold text-sm truncate">${lead.name}</h3>
                                <p class="text-red-500 text-xs">${lead.role}</p>
                                <p class="text-zinc-600 text-[10px] mt-0.5">${lead.team}</p>
                                <div class="card-accent h-0.5 bg-gradient-to-r ${lead.gradient} rounded-full mt-2"></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </section>`;
    }

    function renderDetail(lead) {
        const user = ICCSupabase.getUser();
        const profile = ICCSupabase.getProfile();
        const isMember = profile?.team_id === lead.id;
        const isOther = profile?.team_id && profile.team_id !== lead.id;
        const isLeadUser = profile?.role === 'lead' && profile.team_id === lead.id;

        return `
        <section class="min-h-screen" id="team-detail-section">
            <div class="relative h-40 sm:h-52 bg-gradient-to-br ${lead.gradient} overflow-hidden">
                <div class="absolute inset-0 bg-zinc-950/30"></div>
                <button id="team-back-btn" class="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/50 backdrop-blur-sm rounded-lg text-xs text-zinc-300 hover:text-white border border-white/10 transition-all">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    Back
                </button>
                <div class="absolute -bottom-12 left-1/2 -translate-x-1/2">
                    <div class="avatar-ring"><div class="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center">
                        <span class="font-heading font-bold text-3xl" style="color:${lead.color}">${lead.initials}</span>
                    </div></div>
                </div>
            </div>
            <div class="max-w-3xl mx-auto px-4 pt-16 pb-6">
                <div class="text-center mb-6">
                    <h1 class="font-heading font-bold text-2xl">${lead.name}</h1>
                    <div class="flex items-center justify-center gap-2 mt-1">
                        <span class="px-2.5 py-0.5 bg-red-600/15 text-red-400 rounded-full text-xs font-medium">${lead.role}</span>
                        <span class="text-zinc-500 text-xs">${lead.team}</span>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-2 space-y-5">
                        <div><h3 class="font-heading font-semibold text-sm mb-2 text-zinc-400">About</h3><p class="text-sm text-zinc-300 leading-relaxed">${lead.bio}</p></div>
                        <div><h3 class="font-heading font-semibold text-sm mb-2 text-zinc-400">Specialties</h3><div class="flex flex-wrap gap-2">${lead.specialties.map(s => `<span class="specialty-pill px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400">${s}</span>`).join('')}</div></div>
                        <div class="pt-2">
                            ${!user ? `<button id="team-join-btn" class="join-btn px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-red-600/25">Join ${lead.team}</button><p class="text-[11px] text-zinc-600 mt-1.5">Sign in to join</p>`
                            : isMember ? `<div class="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600/15 border border-emerald-600/30 rounded-xl"><svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="text-emerald-400 text-sm font-semibold">You're a Member</span></div>`
                            : `<button id="team-join-btn" class="join-btn px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-red-600/25">${isOther ? 'Switch to' : 'Join'} ${lead.team}</button>${isOther ? '<p class="text-[11px] text-zinc-600 mt-1.5">You\'ll leave your current team</p>' : ''}`}
                            ${isLeadUser ? `<button id="edit-team-btn" class="ml-3 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors border border-zinc-700">Edit Team</button>` : ''}
                        </div>
                    </div>
                    <div>
                        <div class="glass-card rounded-xl p-4 sticky top-4">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="font-heading font-semibold text-sm">Members</h3>
                                <span id="team-member-count" class="px-2 py-0.5 bg-red-600/15 text-red-400 rounded-full text-xs font-bold">${teamMembers.length}</span>
                            </div>
                            <div class="flex items-center gap-1.5 mb-3 px-2 py-1.5 bg-zinc-950 rounded-lg"><span class="relative flex h-1.5 w-1.5"><span class="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span><span class="text-[10px] text-zinc-500">Live</span></div>
                            <div id="team-roster" class="space-y-1.5 max-h-60 overflow-y-auto">
                                ${teamMembers.length === 0 ? '<p class="text-xs text-zinc-600 text-center py-4">No members yet — be first!</p>'
                                : teamMembers.map((m, i) => `<div class="roster-item flex items-center gap-2 px-2 py-1.5 bg-zinc-950/50 rounded-lg" style="animation-delay:${i*0.04}s"><div class="w-6 h-6 rounded-full bg-gradient-to-br ${lead.gradient} flex items-center justify-center text-[10px] font-bold flex-shrink-0">${(m.full_name||'?').charAt(0).toUpperCase()}</div><p class="text-xs font-medium truncate">${m.full_name||'Anonymous'}</p></div>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
    }

    async function mount(container, teamId) {
        if (teamId) {
            currentTeamId = parseInt(teamId);
            container.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="spinner"></div></div>';
            const lead = CORE_LEADS.find(l => l.id === currentTeamId);
            if (!lead) { container.innerHTML = '<div class="empty-state"><p class="text-zinc-500">Team not found</p></div>'; return; }
            teamMembers = await ICCSupabase.getTeamMembers(currentTeamId);
            container.innerHTML = renderDetail(lead);
            bindDetailEvents(lead);
            ICCSupabase.subscribeToTeam(currentTeamId, async () => {
                teamMembers = await ICCSupabase.getTeamMembers(currentTeamId);
                const roster = document.getElementById('team-roster');
                const count = document.getElementById('team-member-count');
                if (roster) roster.innerHTML = teamMembers.map((m, i) => `<div class="roster-item flex items-center gap-2 px-2 py-1.5 bg-zinc-950/50 rounded-lg" style="animation-delay:${i*0.04}s"><div class="w-6 h-6 rounded-full bg-gradient-to-br ${lead.gradient} flex items-center justify-center text-[10px] font-bold flex-shrink-0">${(m.full_name||'?').charAt(0).toUpperCase()}</div><p class="text-xs font-medium truncate">${m.full_name||'Anonymous'}</p></div>`).join('') || '<p class="text-xs text-zinc-600 text-center py-4">No members yet</p>';
                if (count) count.textContent = teamMembers.length;
            });
        } else {
            currentTeamId = null;
            container.innerHTML = renderGrid();
            bindGridEvents();
        }
    }

    function bindGridEvents() {
        document.querySelectorAll('.lead-card').forEach(card => {
            card.addEventListener('click', () => {
                window.location.hash = `#teams/${card.dataset.leadId}`;
            });
        });
    }

    function bindDetailEvents(lead) {
        document.getElementById('team-back-btn')?.addEventListener('click', () => { window.location.hash = '#teams'; });
        document.getElementById('team-join-btn')?.addEventListener('click', async () => {
            if (!ICCSupabase.getUser()) { AuthModal.open(); return; }
            const btn = document.getElementById('team-join-btn');
            btn.disabled = true; btn.innerHTML = '<div class="spinner spinner-sm"></div>';
            const { error } = await ICCSupabase.joinTeam(lead.id);
            if (error) { Toast.error('Failed to join: ' + error.message); btn.disabled = false; btn.textContent = `Join ${lead.team}`; }
            else { Toast.success(`Welcome to ${lead.team}! 🎉`); BottomNav.mount(); const c = document.getElementById('app'); mount(c, lead.id); }
        });
    }

    function unmount() {
        if (currentTeamId) ICCSupabase.unsubscribeChannel(`team-${currentTeamId}`);
        currentTeamId = null; teamMembers = [];
    }

    return { mount, unmount };
})();
