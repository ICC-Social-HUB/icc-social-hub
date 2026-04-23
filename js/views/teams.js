/* ============================================
   ICC Social Hub — Teams View
   ============================================ */
const TeamsView = (() => {
    let currentTeamId = null;
    let teamMembers = [];
    let pendingMembers = [];

    function renderGrid() {
        const profile = ICCSupabase.getProfile();
        const userTeamId = profile?.team_id;
        return `
        <section class="min-h-screen pt-2 pb-4 px-4" id="teams-section">
            <div class="max-w-5xl mx-auto">
                <div class="text-center mb-8 px-2">
                    <p class="text-red-500 text-xs font-semibold tracking-widest uppercase mb-2">Core Teams</p>
                    <h1 class="font-heading font-bold text-2xl sm:text-3xl mb-2">Connect with <span class="gradient-text-static">your team</span></h1>
                    <p class="text-zinc-500 text-sm max-w-md mx-auto">Find the team that matches your passion.</p>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" id="leads-grid">
                    ${CORE_LEADS.map((lead, i) => {
                        const isMember = userTeamId === lead.id;
                        return `
                        <div class="lead-card bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden cursor-pointer group" data-lead-id="${lead.id}" style="animation:slideUp 0.4s ease-out ${i*0.05}s both">
                            <div class="relative h-28 sm:h-36 overflow-hidden bg-gradient-to-br ${lead.gradient}">
                                <div class="portrait absolute inset-0 flex items-center justify-center">
                                    <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-950/40 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center overflow-hidden">
                                        ${lead.avatar_url ? `<img src="${lead.avatar_url}" class="w-full h-full object-cover">` : `<span class="font-heading font-bold text-xl text-white/90">${lead.initials}</span>`}
                                    </div>
                                </div>
                                <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-60"></div>
                                ${isMember ? `<div class="absolute top-2 right-2 px-2 py-0.5 bg-emerald-600 rounded-full text-[10px] font-bold flex items-center gap-1 z-10">✓ You</div>` : ''}
                            </div>
                            <div class="p-3">
                                <h3 class="font-heading font-semibold text-sm truncate">${lead.team}</h3>
                                <p class="text-zinc-400 text-[11px] mt-1">Lead: <span class="text-white">${lead.name}</span></p>
                                <p class="text-zinc-500 text-[10px] mt-0.5 truncate">Project: <span class="${lead.project_name ? 'text-emerald-400' : 'text-zinc-600'}">${lead.project_name || 'TBD'}</span></p>
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
        const isMember = profile?.team_id === lead.id && !profile?.is_pending_member;
        const isPending = profile?.team_id === lead.id && profile?.is_pending_member;
        const isOther = profile?.team_id && profile.team_id !== lead.id && !profile?.is_pending_member;
        const isLeadUser = profile?.role === 'lead' && profile.team_id === lead.id;
        const isLeadOrAdmin = isLeadUser || ICCSupabase.isAdmin();

        return `
        <section class="min-h-screen" id="team-detail-section">
            <!-- Outer wrapper has NO overflow-hidden so the avatar can peek below freely -->
            <div class="relative h-40 sm:h-52">
                <!-- Background gradient clipped independently -->
                <div class="absolute inset-0 bg-gradient-to-br ${lead.gradient} overflow-hidden">
                    <div class="absolute inset-0 bg-zinc-950/30"></div>
                </div>
                <button id="team-back-btn" class="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/50 backdrop-blur-sm rounded-lg text-xs text-zinc-300 hover:text-white border border-white/10 transition-all">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    Back
                </button>
                <!-- Avatar now free to overflow below the banner -->
                <div class="absolute -bottom-12 left-1/2 -translate-x-1/2 z-10">
                    <div class="avatar-ring"><div class="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden">
                        ${lead.avatar_url 
                            ? `<img src="${lead.avatar_url}" class="w-full h-full object-cover">` 
                            : `<span class="font-heading font-bold text-3xl" style="color:${lead.color}">${lead.initials}</span>`}
                    </div></div>
                </div>
            </div>
            <div class="max-w-3xl mx-auto px-4 pt-20 pb-6">
                <div class="text-center mb-6">
                    <h1 class="font-heading font-bold text-2xl">${lead.team}</h1>
                    <div class="flex flex-col items-center justify-center gap-1 mt-2">
                        <span class="text-zinc-400 text-sm font-medium">Lead: <span class="text-white">${lead.name}</span></span>
                        <span class="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-semibold mt-1">
                            Project: <span class="${lead.project_name ? 'text-emerald-400' : 'text-zinc-500'}">${lead.project_name || 'Yet to choose'}</span>
                        </span>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-2 space-y-5">
                        <div><h3 class="font-heading font-semibold text-sm mb-2 text-zinc-400">About</h3><p class="text-sm text-zinc-300 leading-relaxed">${lead.bio}</p></div>
                        <div><h3 class="font-heading font-semibold text-sm mb-2 text-zinc-400">Specialties</h3><div class="flex flex-wrap gap-2">${lead.specialties.map(s => `<span class="specialty-pill px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400">${s}</span>`).join('')}</div></div>
                        <div class="pt-2">
                            ${!user ? `<button id="team-join-btn" class="join-btn px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-red-600/25">Join ${lead.team}</button><p class="text-[11px] text-zinc-600 mt-1.5">Sign in to join</p>`
                            : isMember ? `<div class="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600/15 border border-emerald-600/30 rounded-xl"><svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="text-emerald-400 text-sm font-semibold">You're a Member</span></div>`
                            : isPending ? `<div class="inline-flex items-center gap-2 px-6 py-3 bg-amber-500/15 border border-amber-500/30 rounded-xl"><svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="text-amber-400 text-sm font-semibold">Request Pending</span></div>`
                            : profile?.role === 'lead' ? `<div class="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl"><span class="text-zinc-500 text-xs font-medium">Leads cannot switch teams</span></div>`
                            : `<button id="team-join-btn" class="join-btn px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-red-600/25">${isOther ? 'Switch to' : 'Request to Join'} ${lead.team}</button>${isOther ? '<p class="text-[11px] text-zinc-600 mt-1.5">You\'ll leave your current team</p>' : ''}`}
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
                                : teamMembers.map((m, i) => `
                                <div class="roster-item flex items-center justify-between gap-2 px-2 py-1.5 bg-zinc-950/50 rounded-lg" style="animation-delay:${i*0.04}s">
                                    <a href="#chat/${m.id}" class="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity" title="Message ${m.full_name||'User'}">
                                        <div class="w-6 h-6 rounded-full bg-gradient-to-br ${lead.gradient} flex items-center justify-center text-[10px] font-bold flex-shrink-0">${(m.full_name||'?').charAt(0).toUpperCase()}</div>
                                        <p class="text-xs font-medium truncate">${m.full_name||'Anonymous'}</p>
                                    </a>
                                    ${(isLeadOrAdmin && m.id !== profile?.id) ? `<button class="remove-member-btn px-1.5 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/60 rounded text-[10px] font-medium transition-colors" data-id="${m.id}">Remove</button>` : ''}
                                </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        ${isLeadUser ? `
                        <div class="glass-card rounded-xl p-4 mt-4">
                            <h3 class="font-heading font-semibold text-sm mb-3">Pending Requests (${pendingMembers.length})</h3>
                            <div class="space-y-2 max-h-48 overflow-y-auto">
                                ${pendingMembers.length === 0 ? '<p class="text-xs text-zinc-600">No pending requests</p>' : pendingMembers.map(m => `
                                <div class="flex items-center justify-between px-2 py-1.5 bg-zinc-950 rounded-lg border border-zinc-800">
                                    <div class="min-w-0 pr-2">
                                        <p class="text-xs font-medium truncate">${m.full_name||'Anon'}</p>
                                        <p class="text-[10px] text-zinc-500 truncate">@${m.username||''}</p>
                                    </div>
                                    <div class="flex gap-1 flex-shrink-0">
                                        <button class="approve-member-btn px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-semibold transition-colors" data-id="${m.id}">Approve</button>
                                        <button class="deny-member-btn px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] transition-colors" data-id="${m.id}">Deny</button>
                                    </div>
                                </div>
                                `).join('')}
                            </div>
                            
                            <h3 class="font-heading font-semibold text-sm mt-6 mb-3">Team Configuration</h3>
                            <form id="lead-edit-team-form" class="space-y-3">
                                <div><label class="block text-xs font-medium text-zinc-400 mb-1">Team Profile Picture (Optional)</label><input type="file" id="lead-avatar-input" accept="image/jpeg, image/png, image/webp" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                <div><label class="block text-xs font-medium text-zinc-400 mb-1">Project Name</label><input type="text" id="lead-project-name" value="${lead.project_name || ''}" placeholder="Yet to choose" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                <div><label class="block text-xs font-medium text-zinc-400 mb-1">Team Name</label><input type="text" id="lead-team-name" value="${lead.team}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required></div>
                                <div><label class="block text-xs font-medium text-zinc-400 mb-1">Bio</label><textarea id="lead-bio" rows="3" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white resize-none">${lead.bio}</textarea></div>
                                <div><label class="block text-xs font-medium text-zinc-400 mb-1">Specialties (comma-separated)</label><input type="text" id="lead-specialties" value="${lead.specialties.join(', ')}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                <div class="grid grid-cols-2 gap-3">
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Gradient</label><input type="text" id="lead-gradient" value="${lead.gradient}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Color (Hex)</label><input type="color" id="lead-color" value="${lead.color}" class="form-input w-full h-9 p-0 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer"></div>
                                </div>
                                <button type="submit" class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-semibold mt-2 transition-colors border border-zinc-700">Save Configuration</button>
                            </form>
                        </div>
                        ` : ''}
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
            const profile = ICCSupabase.getProfile();
            if (profile?.role === 'lead' && profile.team_id === currentTeamId) {
                pendingMembers = await ICCSupabase.getPendingMembers(currentTeamId);
            }
            container.innerHTML = renderDetail(lead);
            bindDetailEvents(lead);
            ICCSupabase.subscribeToTeam(currentTeamId, async () => {
                teamMembers = await ICCSupabase.getTeamMembers(currentTeamId);
                const roster = document.getElementById('team-roster');
                const count = document.getElementById('team-member-count');
                if (roster) {
                    const isLeadOrAdmin = (profile?.role === 'lead' && profile.team_id === currentTeamId) || ICCSupabase.isAdmin();
                    roster.innerHTML = teamMembers.length === 0 ? '<p class="text-xs text-zinc-600 text-center py-4">No members yet — be first!</p>'
                                : teamMembers.map((m, i) => `
                                <div class="roster-item flex items-center justify-between gap-2 px-2 py-1.5 bg-zinc-950/50 rounded-lg" style="animation-delay:${i*0.04}s">
                                    <a href="#chat/${m.id}" class="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity" title="Message ${m.full_name||'User'}">
                                        <div class="w-6 h-6 rounded-full bg-gradient-to-br ${lead.gradient} flex items-center justify-center text-[10px] font-bold flex-shrink-0">${(m.full_name||'?').charAt(0).toUpperCase()}</div>
                                        <p class="text-xs font-medium truncate">${m.full_name||'Anonymous'}</p>
                                    </a>
                                    ${(isLeadOrAdmin && m.id !== profile?.id) ? `<button class="remove-member-btn px-1.5 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/60 rounded text-[10px] font-medium transition-colors" data-id="${m.id}">Remove</button>` : ''}
                                </div>
                                `).join('');
                }
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
            if (error) { Toast.error('Failed to request: ' + error.message); btn.disabled = false; btn.textContent = `Request to Join`; }
            else { 
                Toast.success(`Join request sent! The Team Lead will review it shortly.`); 
                // Notify the Team Lead
                const leadProfile = CORE_LEADS.find(l => l.id === lead.id);
                // We need to find the user_id of the lead. 
                // Since CORE_LEADS is hardcoded in data.js, let's see if we can find the lead user_id.
                // In this app, the lead is a user with role='lead' and team_id=lead.id.
                // We can't easily find the lead's UUID here without a query, 
                // but we can at least try to get team members and find the lead.
                const members = await ICCSupabase.getTeamMembers(lead.id);
                const leadUser = members.find(m => m.role === 'lead');
                if (leadUser) {
                    ICCSupabase.createNotification({
                        userId: leadUser.id,
                        type: 'team_join',
                        actorId: ICCSupabase.getUser().id,
                        referenceId: lead.id.toString()
                    });
                }
                const c = document.getElementById('app'); mount(c, lead.id); 
            }
        });

        document.getElementById('team-roster')?.addEventListener('click', async (e) => {
            const btn = e.target.closest('.remove-member-btn');
            if (btn) {
                if (!confirm('Are you sure you want to remove this member?')) return;
                const userId = btn.dataset.id;
                const { error } = await ICCSupabase.denyMember(userId);
                if (error) Toast.error('Failed to remove member');
                else { Toast.success('Member removed'); const c = document.getElementById('app'); mount(c, lead.id); }
            }
        });

        // Team Lead actions
        document.querySelectorAll('.approve-member-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const { error } = await ICCSupabase.approveMember(userId);
                if (error) Toast.error('Failed to approve');
                else { 
                    Toast.success('Member approved!'); 
                    // Notify the approved user
                    ICCSupabase.createNotification({
                        userId: userId,
                        type: 'team_approve',
                        actorId: ICCSupabase.getUser().id,
                        referenceId: lead.id.toString(),
                        body: lead.team
                    });
                    const c = document.getElementById('app'); mount(c, lead.id); 
                }
            });
        });

        document.querySelectorAll('.deny-member-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const { error } = await ICCSupabase.denyMember(userId);
                if (error) Toast.error('Failed to deny');
                else { 
                    Toast.info('Request denied'); 
                    // Maybe notify denial? Usually not necessary but good for UX
                    ICCSupabase.createNotification({
                        userId: userId,
                        type: 'system',
                        actorId: ICCSupabase.getUser().id,
                        body: `Your request to join ${lead.team} was declined.`
                    });
                    const c = document.getElementById('app'); mount(c, lead.id); 
                }
            });
        });

        document.getElementById('lead-edit-team-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true; btn.textContent = 'Saving...';
            
            const fileInput = document.getElementById('lead-avatar-input');
            let newAvatarUrl = lead.avatar_url;
            
            if (fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                if (file.size > 2 * 1024 * 1024) { Toast.error('Image must be under 2MB'); btn.disabled = false; btn.textContent = 'Save Configuration'; return; }
                const { url, error: uploadError } = await ICCSupabase.uploadImage('avatars', file);
                if (uploadError) { Toast.error('Image upload failed: ' + uploadError.message); btn.disabled = false; btn.textContent = 'Save Configuration'; return; }
                newAvatarUrl = url;
            }

            const fields = {
                team: document.getElementById('lead-team-name').value.trim(),
                project_name: document.getElementById('lead-project-name').value.trim(),
                bio: document.getElementById('lead-bio').value.trim(),
                specialties: document.getElementById('lead-specialties').value.split(',').map(s => s.trim()).filter(Boolean),
                gradient: document.getElementById('lead-gradient').value.trim(),
                color: document.getElementById('lead-color').value.trim(),
                avatar_url: newAvatarUrl
            };

            const { error } = await ICCSupabase.updateLead(lead.id, fields);
            if (error) { Toast.error('Failed to update team: ' + error.message); btn.disabled = false; btn.textContent = 'Save Configuration'; }
            else { Toast.success('Team configuration updated!'); await loadLeads(); const c = document.getElementById('app'); mount(c, lead.id); }
        });
    }

    function unmount() {
        if (currentTeamId) ICCSupabase.unsubscribeChannel(`team-${currentTeamId}`);
        currentTeamId = null; teamMembers = [];
    }

    return { mount, unmount };
})();
