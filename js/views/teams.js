/* ============================================
   ICC Social Hub — Teams View
   ============================================ */
const TeamsView = (() => {
    let currentTeamId = null;
    let teamMembers = [];
    let pendingMembers = [];

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }

    function getMemberTags(teamId) {
        const lead = CORE_LEADS.find(l => l.id === Number(teamId));
        let milestones = lead?.milestones || {};
        if (typeof milestones === 'string') {
            try { milestones = JSON.parse(milestones); } catch(e) { milestones = {}; }
        }
        let tags = milestones?.member_tags || {};
        if (typeof tags === 'string') {
            try { tags = JSON.parse(tags); } catch(e) { tags = {}; }
        }
        try {
            const local = JSON.parse(localStorage.getItem(`team_tags_${teamId}`) || '{}');
            tags = { ...tags, ...local };
        } catch(e) {}
        return tags || {};
    }

    function isLeadForTeam(leadId, customLead = null, members = teamMembers) {
        const profile = ICCSupabase.getProfile();
        if (!profile) return false;
        if (typeof ICCSupabase.isAdmin === 'function' && ICCSupabase.isAdmin()) return true;

        const leadNum = Number(leadId);
        if (!leadNum) return false;
        const lead = customLead || CORE_LEADS.find(l => Number(l.id) === leadNum);

        // 1. Direct role & team_id match
        if (profile.role === 'lead' && Number(profile.team_id) === leadNum) return true;

        // 2. Lead role with team in memberships
        if (profile.role === 'lead' && Array.isArray(profile.memberships) && profile.memberships.map(Number).includes(leadNum)) return true;

        // 3. User is in this team's members with role 'lead' or is_lead
        if (Array.isArray(members) && members.some(m => m.id === profile.id && (m.role === 'lead' || m.is_lead))) return true;

        // 4. User's full name matches team leader's name
        if (profile.full_name && lead?.name && profile.full_name.trim().toLowerCase() === lead.name.trim().toLowerCase()) return true;

        // 5. User's email matches team lead email
        if (profile.email && lead?.email && profile.email.trim().toLowerCase() === lead.email.trim().toLowerCase()) return true;

        return false;
    }

    function sortTeamMembers(members, lead) {
        if (!Array.isArray(members)) return [];
        return [...members].sort((a, b) => {
            const aIsLead = a.role === 'lead' || Boolean(a.is_lead) || Boolean(lead?.name && a.full_name && a.full_name.trim().toLowerCase() === lead.name.trim().toLowerCase());
            const bIsLead = b.role === 'lead' || Boolean(b.is_lead) || Boolean(lead?.name && b.full_name && b.full_name.trim().toLowerCase() === lead.name.trim().toLowerCase());
            if (aIsLead && !bIsLead) return -1;
            if (!aIsLead && bIsLead) return 1;
            return (a.full_name || a.username || '').localeCompare(b.full_name || b.username || '');
        });
    }

    async function saveMemberTag(teamId, memberId, newTag) {
        const leadNum = Number(teamId);
        let currentLead = CORE_LEADS.find(l => l.id === leadNum);
        if (!currentLead) return;

        if (!isLeadForTeam(leadNum, currentLead, teamMembers)) {
            Toast.error('You do not have permission to edit tags for this team.');
            return;
        }

        if (!currentLead.milestones || typeof currentLead.milestones !== 'object') {
            try {
                currentLead.milestones = typeof currentLead.milestones === 'string' ? JSON.parse(currentLead.milestones) : {};
            } catch(e) {
                currentLead.milestones = {};
            }
        }
        if (!currentLead.milestones.member_tags || typeof currentLead.milestones.member_tags !== 'object') {
            currentLead.milestones.member_tags = {};
        }

        if (newTag) {
            currentLead.milestones.member_tags[memberId] = newTag;
        } else {
            delete currentLead.milestones.member_tags[memberId];
        }

        try {
            localStorage.setItem(`team_tags_${leadNum}`, JSON.stringify(currentLead.milestones.member_tags));
        } catch(e) {}

        const { error } = await ICCSupabase.updateLead(leadNum, { milestones: currentLead.milestones });
        if (error) {
            console.warn('Could not persist tag to Supabase:', error);
        }
    }

    function openMemberActionModal(memberId, memberName, currentTag, leadId, isThisMemberLead = false) {
        const existing = document.getElementById('workforce-action-modal');
        if (existing) existing.remove();

        const leadNum = Number(leadId || currentTeamId);
        const lead = CORE_LEADS.find(l => Number(l.id) === leadNum);

        // Security check: Must be lead of this team or admin
        if (!isLeadForTeam(leadNum, lead, teamMembers)) {
            Toast.error('You do not have permission to manage members of this team.');
            return;
        }

        const profile = ICCSupabase.getProfile();
        const isSelf = memberId === profile?.id || (profile?.full_name && memberName && profile.full_name.trim().toLowerCase() === memberName.trim().toLowerCase());
        const canRemove = !isSelf && !isThisMemberLead;

        const defaultTagVal = currentTag || (isThisMemberLead ? 'Team Leader' : '');

        const modalHtml = `
        <div id="workforce-action-modal" class="fixed inset-0 z-[2500] bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div class="min-w-0 pr-2">
                        <h3 class="font-heading font-bold text-base text-white break-words">${escapeHtml(memberName)}</h3>
                        ${isThisMemberLead ? `
                            <div class="flex items-center gap-1 mt-0.5">
                                <span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                                    <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M2.5 14.5l1.5-7.5 4 4.5 4-6 4 6 4-4.5 1.5 7.5h-19z"/></svg>
                                    Team Leader
                                </span>
                            </div>
                        ` : `
                            <p class="text-xs text-zinc-400 mt-0.5">Manage Team Member</p>
                        `}
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" id="back-workforce-modal-btn" class="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer" title="Go Back">
                            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                            <span>Back</span>
                        </button>
                        <button id="close-workforce-modal-btn" class="text-zinc-500 hover:text-white p-1 rounded-lg">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Update Tag Form -->
                <form id="workforce-tag-form" class="space-y-3">
                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                            ${isThisMemberLead ? "Leader's Role Title / Tag" : "Member Tag / Role Title"}
                        </label>
                        <input type="text" id="workforce-tag-input" 
                               value="${escapeHtml(defaultTagVal)}" 
                               placeholder="${isThisMemberLead ? 'e.g. Team Leader, Founder' : 'e.g. Frontend Dev, Robotics Specialist'}" 
                               maxlength="40"
                               class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-colors">
                        <p class="text-[10px] text-zinc-500 mt-1">Displayed directly below the name in the workforce roster.</p>
                    </div>
                    <button type="submit" class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-98">
                        Save Tag Name
                    </button>
                </form>

                ${canRemove ? `
                <div class="pt-3 border-t border-zinc-800/80">
                    <button id="workforce-remove-action-btn" class="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-98">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Remove Member from Team
                    </button>
                </div>
                ` : ''}
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalEl = document.getElementById('workforce-action-modal');
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) modalEl.remove();
        });

        try {
            if (!window.history.state?.modalOpen) {
                window.history.pushState({ modalOpen: true, modal: 'workforce-action' }, '');
            }
        } catch (e) {}

        document.getElementById('back-workforce-modal-btn')?.addEventListener('click', () => {
            modalEl.remove();
        });

        document.getElementById('close-workforce-modal-btn')?.addEventListener('click', () => {
            modalEl.remove();
        });

        document.getElementById('workforce-tag-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputVal = document.getElementById('workforce-tag-input')?.value.trim();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            await saveMemberTag(leadNum, memberId, inputVal);
            modalEl.remove();
            Toast.success(inputVal ? 'Tag updated!' : 'Tag cleared!');
            
            // Re-render workforce roster
            const roster = document.getElementById('team-roster');
            if (roster) {
                const tags = getMemberTags(leadNum);
                const isLeadOrAdmin = isLeadForTeam(leadNum, lead, teamMembers);
                roster.innerHTML = teamMembers.length === 0 ? '<div class="col-span-full text-sm text-zinc-500 text-center py-12">No workforce members yet — be first to join!</div>'
                    : teamMembers.map((m, i) => renderWorkforceCard(m, i, isLeadOrAdmin, profile?.id, tags, leadNum, lead)).join('');
            }
        });

        document.getElementById('workforce-remove-action-btn')?.addEventListener('click', async () => {
            if (!confirm(`Are you sure you want to remove ${memberName} from this team?`)) return;
            const rmBtn = document.getElementById('workforce-remove-action-btn');
            if (rmBtn) {
                rmBtn.disabled = true;
                rmBtn.textContent = 'Removing...';
            }
            modalEl.remove();

            // Clear any tag for this member
            await saveMemberTag(leadNum, memberId, null);

            const { error } = await ICCSupabase.denyMember(memberId, leadNum);
            if (error) {
                Toast.error('Could not remove member: ' + error.message);
            } else {
                Toast.success(`${memberName} was removed from the team.`);
                const c = document.getElementById('app');
                mount(c, leadNum);
            }
        });
    }

    function handleMemberActionClick(e, btn) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!btn) return;
        const memberId = btn.dataset.id;
        const memberName = btn.dataset.name;
        const currentTag = btn.dataset.tag;
        const leadId = btn.dataset.leadId || currentTeamId;
        const isLead = btn.dataset.isLead === 'true';

        if (!isLeadForTeam(leadId)) {
            Toast.error('You do not have permission to manage members of this team.');
            return;
        }

        openMemberActionModal(memberId, memberName, currentTag, leadId, isLead);
    }

    function getRoboticAvatar(seed = '') {
        const colors = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa'];
        let hash = 0;
        const str = String(seed || 'robot');
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        const color = colors[Math.abs(hash) % colors.length];

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
            <defs>
                <linearGradient id="bg_${Math.abs(hash)}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#18181b"/>
                    <stop offset="100%" stop-color="#09090b"/>
                </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="48" fill="url(#bg_${Math.abs(hash)})" stroke="#27272a" stroke-width="2"/>
            <circle cx="50" cy="20" r="3.5" fill="${color}"/>
            <line x1="50" y1="23.5" x2="50" y2="32" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="22" y="44" width="5" height="12" rx="2.5" fill="${color}" opacity="0.8"/>
            <rect x="73" y="44" width="5" height="12" rx="2.5" fill="${color}" opacity="0.8"/>
            <rect x="27" y="32" width="46" height="36" rx="10" fill="#27272a" stroke="#3f3f46" stroke-width="2"/>
            <rect x="33" y="40" width="34" height="14" rx="7" fill="#09090b" stroke="#18181b" stroke-width="1.5"/>
            <circle cx="42" cy="47" r="3.5" fill="${color}"/>
            <circle cx="58" cy="47" r="3.5" fill="${color}"/>
            <circle cx="43" cy="46" r="1.2" fill="#ffffff" opacity="0.8"/>
            <circle cx="59" cy="46" r="1.2" fill="#ffffff" opacity="0.8"/>
            <path d="M41 59h18" stroke="#52525b" stroke-width="2" stroke-linecap="round"/>
            <path d="M43 68h14v5h-14z" fill="#27272a"/>
            <path d="M25 90c0-10 10-14 25-14s25 4 25 14" fill="#18181b" stroke="#27272a" stroke-width="2"/>
            <circle cx="50" cy="84" r="2.5" fill="${color}" opacity="0.7"/>
        </svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    function renderWorkforceCard(m, i, isLeadOrAdmin, currentProfileId, memberTags = {}, leadId = currentTeamId, lead = null) {
        const name = m.full_name || m.username || 'Anonymous';
        const fallbackAvatar = getRoboticAvatar(m.id || m.username || name);
        const avatarSrc = m.avatar_url ? m.avatar_url : fallbackAvatar;
        
        const currentLeadObj = lead || CORE_LEADS.find(l => Number(l.id) === Number(leadId));
        const isThisMemberLead = m.role === 'lead' || Boolean(m.is_lead) || Boolean(currentLeadObj?.name && m.full_name && m.full_name.trim().toLowerCase() === currentLeadObj.name.trim().toLowerCase());
        
        const rawTag = memberTags[m.id];
        const tag = rawTag || (isThisMemberLead ? 'Team Leader' : '');

        return `
        <div class="workforce-member-item group flex flex-col items-center justify-start text-center relative select-none w-full max-w-[130px] sm:max-w-[155px]" 
             style="animation-delay:${i * 0.04}s">
            
            <!-- Circular Avatar with Leader prominence -->
            <div class="open-user-profile cursor-pointer relative" data-id="${m.id}" title="View ${escapeHtml(name)}'s Profile">
                <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-xl ${isThisMemberLead ? 'ring-2 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.35)] group-hover:ring-amber-300' : 'ring-2 ring-zinc-800/90 group-hover:ring-emerald-500/80'} group-hover:scale-105 transition-all duration-300 flex items-center justify-center bg-zinc-900 relative">
                    <img src="${avatarSrc}" 
                         alt="${escapeHtml(name)}" 
                         class="w-full h-full object-cover rounded-full" 
                         onerror="this.onerror=null;this.src='${fallbackAvatar}';">
                </div>
                ${isThisMemberLead ? `
                <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-tr from-amber-600 to-yellow-400 rounded-full border-2 border-zinc-950 flex items-center justify-center shadow-lg" title="Team Leader">
                    <svg class="w-3 h-3 text-zinc-950 fill-current" viewBox="0 0 20 20">
                        <path d="M2.5 14.5l1.5-7.5 4 4.5 4-6 4 6 4-4.5 1.5 7.5h-19z"/>
                    </svg>
                </div>
                ` : ''}
            </div>

            <!-- Member Full Name (Completely visible, no truncation) -->
            <h4 class="open-user-profile text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors text-center break-words w-full px-1 mt-2.5 cursor-pointer leading-snug" 
                data-id="${m.id}" 
                title="View ${escapeHtml(name)}'s Profile">
                ${escapeHtml(name)}${isThisMemberLead ? ICC_CONFIG.VERIFIED_TICK : ''}
            </h4>

            <!-- Member Tag below the name (Prominent and unique for Leader) -->
            ${isThisMemberLead ? `
                <div class="inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 mt-1.5 text-[10px] sm:text-[11px] font-extrabold text-amber-300 bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-500/20 border border-amber-400/50 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.3)] tracking-wide uppercase select-none">
                    <svg class="w-3 h-3 text-amber-400 fill-current flex-shrink-0" viewBox="0 0 20 20">
                        <path d="M2.5 14.5l1.5-7.5 4 4.5 4-6 4 6 4-4.5 1.5 7.5h-19z"/>
                    </svg>
                    <span class="break-words leading-tight text-center">${escapeHtml(tag)}</span>
                </div>
            ` : (tag ? `
                <span class="inline-flex items-center justify-center px-2 py-0.5 mt-1 text-[10px] sm:text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full max-w-full break-words text-center leading-tight">
                    ${escapeHtml(tag)}
                </span>
            ` : '')}

            <!-- 3-dot Menu (Only for Leader of this team or Admin) -->
            ${isLeadOrAdmin ? `
                <button class="member-actions-btn mt-1.5 p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors cursor-pointer z-10" 
                        data-id="${m.id}" 
                        data-name="${escapeHtml(name)}" 
                        data-tag="${escapeHtml(rawTag || '')}" 
                        data-lead-id="${leadId || ''}"
                        data-is-lead="${isThisMemberLead ? 'true' : 'false'}"
                        title="Member options"
                        onclick="TeamsView.handleMemberActionClick(event, this)">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1.75"/>
                        <circle cx="12" cy="12" r="1.75"/>
                        <circle cx="12" cy="19" r="1.75"/>
                    </svg>
                </button>
            ` : ''}
        </div>`;
    }

    const MILESTONE_PHASES = [
        { id: 'planning', name: 'Planning Phase', desc: 'Purpose, objectives, requirements, and constraints' },
        { id: 'design', name: 'Design Phase', desc: 'Architecture, system design, and technical plans' },
        { id: 'selection', name: 'Component Selection', desc: 'Hardware/software selection (controllers, sensors, motors)' },
        { id: 'development', name: 'Construction Phase', desc: 'Mechanical assembly and hardware integration' },
        { id: 'programming', name: 'Programming Phase', desc: 'Control logic, software development, and sensor configuration' },
        { id: 'testing', name: 'Testing Phase', desc: 'Performance testing and debugging' },
        { id: 'optimization', name: 'Optimization Phase', desc: 'Fine-tuning speed, stability, and accuracy' },
        { id: 'deployment', name: 'Deployment Phase', desc: 'Final documentation and demonstration' }
    ];

    function renderMilestones(lead, isLeadOrAdmin) {
        const milestones = lead.milestones || {};
        const completedCount = MILESTONE_PHASES.filter(p => milestones[p.id]).length;
        const progress = (completedCount / MILESTONE_PHASES.length) * 100;
        
        return `
        <div class="mt-8 pt-6 border-t border-zinc-800/50">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="font-heading font-semibold text-sm text-zinc-400">Project Progress</h3>
                    <p class="text-[10px] text-zinc-500">${completedCount} of 8 phases completed</p>
                </div>
                <div class="text-right">
                    <span class="text-lg font-bold gradient-text-static">${Math.round(progress)}%</span>
                </div>
            </div>
            
            <!-- Progress Bar -->
            <div class="w-full h-2 bg-zinc-900 rounded-full overflow-hidden mb-6 border border-zinc-800/50">
                <div class="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700 ease-out" style="width: ${progress}%"></div>
            </div>

            <!-- Phase Indicators -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${MILESTONE_PHASES.map((phase, i) => {
                    const isCompleted = milestones[phase.id];
                    const isNext = !isCompleted && (i === 0 || milestones[MILESTONE_PHASES[i-1].id]);
                    const statusClass = isCompleted ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 
                                      isNext ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 
                                      'bg-zinc-900/50 border-zinc-800/50 text-zinc-500';
                    const iconClass = isCompleted ? 'text-emerald-500' : isNext ? 'text-blue-500' : 'text-zinc-700';
                    
                    return `
                    <div class="flex items-start gap-3 p-3 rounded-xl border ${statusClass} transition-all duration-300">
                        <div class="mt-0.5 ${iconClass}">
                            ${isCompleted ? 
                                `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>` : 
                                `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /></svg>`
                            }
                        </div>
                        <div>
                            <p class="text-xs font-bold leading-tight">${phase.name}</p>
                            <p class="text-[9px] opacity-70 mt-0.5 leading-tight">${phase.desc}</p>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            ${isLeadOrAdmin ? `
            <button id="update-progress-btn" class="w-full mt-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group">
                <svg class="w-4 h-4 text-emerald-500 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Update Project Milestones
            </button>

            <!-- Update Progress Sub-Modal (Hidden by default) -->
            <div id="progress-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm hidden">
                <div class="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-zoom-in">
                    <div class="p-4 border-b border-zinc-800 flex items-center justify-between">
                        <h3 class="font-heading font-bold text-lg">Update Milestones</h3>
                        <div class="flex items-center gap-2">
                            <button type="button" id="back-progress-modal" class="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer" title="Go Back">
                                <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                                <span>Back</span>
                            </button>
                            <button id="close-progress-modal" class="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                        </div>
                    </div>
                    <div class="p-4 max-h-[60vh] overflow-y-auto">
                        <p class="text-xs text-zinc-500 mb-4">Mark the phases your team has successfully completed.</p>
                        <form id="update-milestones-form" class="space-y-3">
                            ${MILESTONE_PHASES.map(phase => `
                            <label class="flex items-center gap-3 p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-950 transition-colors">
                                <input type="checkbox" name="${phase.id}" ${milestones[phase.id] ? 'checked' : ''} class="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-emerald-600 focus:ring-emerald-600 focus:ring-offset-zinc-900">
                                <div class="flex-1">
                                    <p class="text-sm font-semibold">${phase.name}</p>
                                    <p class="text-[10px] text-zinc-500">${phase.desc}</p>
                                </div>
                            </label>
                            `).join('')}
                            <button type="submit" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold mt-4 transition-all shadow-lg shadow-emerald-600/20">Save Milestone Progress</button>
                        </form>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>`;
    }

    function renderGrid() {
        const profile = ICCSupabase.getProfile();
        const userTeamId = profile?.team_id;
        return `
        <section class="min-h-screen pt-2 pb-8 px-4" id="teams-section">
            <div class="max-w-5xl mx-auto">
                <!-- Top Navigation Bar with Back Button -->
                <div class="mb-4 flex items-center justify-between">
                    <button id="teams-grid-back-btn" onclick="window.location.hash='#dashboard'" class="flex items-center gap-2 px-3.5 py-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 group" title="Return to Dashboard">
                        <svg class="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        <span>Back to Dashboard</span>
                    </button>
                    <span class="text-[11px] font-medium text-zinc-500 uppercase tracking-widest hidden sm:inline">Teams & Projects</span>
                </div>

                <div class="text-center mb-8 px-2">
                    <p class="text-red-500 text-xs font-semibold tracking-widest uppercase mb-2">Core Teams</p>
                    <h1 class="font-heading font-bold text-2xl sm:text-3xl mb-2">Connect with <span class="gradient-text-static">your team</span></h1>
                    <p class="text-zinc-500 text-sm max-w-md mx-auto">Find the team that matches your passion.</p>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" id="leads-grid">
                    ${CORE_LEADS.map((lead, i) => {
            const isMember = profile?.memberships?.includes(lead.id);
            const isPending = profile?.pending_teams?.includes(lead.id);
            
            const milestones = lead.milestones || {};
            const completedCount = MILESTONE_PHASES.filter(p => milestones[p.id]).length;
            const progress = Math.round((completedCount / MILESTONE_PHASES.length) * 100);

            return `
                        <div class="lead-card bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden cursor-pointer group" data-lead-id="${lead.id}" style="animation:slideUp 0.4s ease-out ${i * 0.05}s both">
                            <div class="relative h-28 sm:h-36 overflow-hidden bg-gradient-to-br ${lead.gradient}">
                                <div class="portrait absolute inset-0 flex items-center justify-center">
                                    <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-950/40 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center overflow-hidden">
                                        ${lead.avatar_url ? `<img src="${lead.avatar_url}" class="w-full h-full object-cover">` : `<span class="font-heading font-bold text-xl text-white/90">${lead.initials}</span>`}
                                    </div>
                                </div>
                                <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-60"></div>
                                ${isMember ? `<div class="absolute top-2 right-2 px-2 py-0.5 bg-emerald-600 rounded-full text-[10px] font-bold flex items-center gap-1 z-10">✓ Member</div>` : ''}
                                ${isPending ? `<div class="absolute top-2 right-2 px-2 py-0.5 bg-amber-600 rounded-full text-[10px] font-bold flex items-center gap-1 z-10 animate-pulse">⏳ Pending</div>` : ''}
                            </div>
                            <div class="p-3">
                                <h3 class="font-heading font-semibold text-sm truncate">${lead.team}</h3>
                                <p class="text-zinc-400 text-[11px] mt-1">Lead: <span class="text-white">${lead.name}${ICC_CONFIG.VERIFIED_TICK}</span></p>
                                <p class="text-zinc-500 text-[10px] mt-0.5 truncate">Project: <span class="${lead.project_name ? 'text-emerald-400' : 'text-zinc-600'}">${lead.project_name || 'TBD'}</span></p>
                                
                                <!-- Progress Mini Indicator -->
                                <div class="mt-3 pt-3 border-t border-zinc-800/30 space-y-1.5">
                                    <div class="flex items-center justify-between text-[9px] font-bold uppercase tracking-tight">
                                        <span class="text-zinc-500">Project Progress</span>
                                        <span class="${progress > 0 ? 'text-emerald-400' : 'text-zinc-400'}">${progress}%</span>
                                    </div>
                                    <div class="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                                        <div class="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all duration-700" style="width: ${progress}%"></div>
                                    </div>
                                </div>

                                <div class="card-accent h-0.5 bg-gradient-to-r ${lead.gradient} rounded-full mt-3 opacity-30"></div>
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
        const isMember = profile?.memberships?.includes(lead.id);
        const isPending = profile?.pending_teams?.includes(lead.id);
        const isLeadOrAdmin = isLeadForTeam(lead.id, lead, teamMembers);
        const memberTags = getMemberTags(lead.id);

        return `
        <section class="min-h-screen relative pb-16" id="team-detail-section">
            <!-- Floating Quick-Back Button: stays accessible even when scrolled down -->
            <button id="team-floating-back-btn" onclick="TeamsView.goBack(event)" class="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-[#17212b]/95 hover:bg-[#242f3d] text-white text-xs font-bold rounded-full border border-[#2b394a] shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer group" title="Go Back">
                <svg class="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                <span>Back</span>
            </button>

            <!-- Clean Header without Colored Banner -->
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div class="flex items-center justify-between mb-4">
                    <button id="team-back-btn" onclick="TeamsView.goBack(event)" class="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900/90 hover:bg-zinc-800 rounded-xl text-xs font-semibold text-white border border-zinc-800 transition-all cursor-pointer shadow-md active:scale-95">
                        <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        <span>Back</span>
                    </button>
                </div>

                <div class="flex flex-col items-center justify-center text-center pb-8 border-b border-zinc-800/40">
                    <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-zinc-900 ring-4 ring-zinc-800/80 shadow-2xl flex items-center justify-center overflow-hidden mb-4 ${lead.avatar_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}" ${lead.avatar_url ? `data-full-image="${lead.avatar_url}"` : ''}>
                        ${lead.avatar_url
                            ? `<img src="${lead.avatar_url}" class="w-full h-full object-cover">`
                            : `<span class="font-heading font-bold text-3xl" style="color:${lead.color || '#10b981'}">${lead.initials}</span>`}
                    </div>
                    <h1 class="font-heading font-bold text-2xl sm:text-3xl text-white tracking-tight">${lead.team}</h1>
                    <div class="flex flex-wrap items-center justify-center gap-2 mt-2">
                        <span class="text-zinc-400 text-sm font-medium">Lead: <span id="lead-profile-link" class="text-emerald-400 hover:text-emerald-300 cursor-pointer underline decoration-dotted transition-colors" title="View Profile">${lead.name}${ICC_CONFIG.VERIFIED_TICK}</span></span>
                        <span class="text-zinc-600 hidden sm:inline">•</span>
                        <span class="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-semibold">
                            Project: <span class="${lead.project_name ? 'text-emerald-400' : 'text-zinc-500'}">${lead.project_name || 'Yet to choose'}</span>
                        </span>
                    </div>
                </div>
            </div>

            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <!-- Two-Column Layout on Laptop (lg:), Single-Column on Mobile/Tablet -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    <!-- Left Area: Details, Membership & Milestones (lg:col-span-7) -->
                    <div class="lg:col-span-7 space-y-6">
                        <!-- About & Specialties -->
                        <div class="glass-card rounded-2xl p-6 border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl space-y-5">
                            <div>
                                <h3 class="font-heading font-semibold text-xs uppercase tracking-wider text-zinc-400 mb-2">About</h3>
                                <p class="text-sm text-zinc-300 leading-relaxed">${lead.bio || 'No bio provided yet.'}</p>
                            </div>
                            <div>
                                <h3 class="font-heading font-semibold text-xs uppercase tracking-wider text-zinc-400 mb-2">Specialties</h3>
                                <div class="flex flex-wrap gap-2">
                                    ${(lead.specialties || []).map(s => `<span class="specialty-pill px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400">${s}</span>`).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Membership Action Card & Pending/Lead Admin Controls -->
                        <div class="glass-card rounded-2xl p-5 border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl">
                            <h4 class="font-heading font-semibold text-xs uppercase tracking-wider text-zinc-400 mb-3">Membership</h4>
                            ${(() => {
                                if (!user) return `<button id="team-join-btn" class="join-btn w-full px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-red-600/25">Join ${lead.team}</button><p class="text-[11px] text-zinc-600 mt-1.5 text-center">Sign in to join</p>`;
                                if (isMember || ICCSupabase.isAdmin()) return `
                                    <div class="flex flex-col gap-3">
                                        <div class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600/15 border border-emerald-600/30 rounded-xl">
                                            <svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                            <span class="text-emerald-400 text-sm font-semibold">You're a Member</span>
                                        </div>
                                        <button id="open-team-chat-btn" class="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-sm font-bold transition-all shadow-lg shadow-zinc-950/50 group">
                                            <svg class="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                                            Open Team Chat
                                        </button>
                                    </div>`;
                                if (profile?.memberships?.length > 0 || profile?.role === 'lead') return `<div class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-xl opacity-60 w-full"><svg class="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg><span class="text-zinc-500 text-sm font-semibold">Already in a Team</span></div><p class="text-[10px] text-zinc-600 mt-2 text-center">You can only be in one team at a time.</p>`;
                                if (isPending) return `
                                    <div class="flex flex-col gap-2">
                                        <div class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-500/15 border border-amber-500/30 rounded-xl">
                                            <svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                            <span class="text-amber-400 text-sm font-semibold">Request Pending</span>
                                        </div>
                                        <button id="team-cancel-btn" class="text-[11px] text-zinc-500 hover:text-red-400 transition-colors w-fit mx-auto underline decoration-dotted">Cancel Request</button>
                                    </div>`;

                                if (profile?.pending_teams?.length > 0) return `
                                    <div class="flex flex-col gap-1.5">
                                        <div class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-xl opacity-60">
                                            <svg class="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                            <span class="text-zinc-500 text-sm font-semibold">Request Pending Elsewhere</span>
                                        </div>
                                        <p class="text-[10px] text-zinc-600 mt-0.5 text-center">You already have a pending request for another team. Cancel it to apply here.</p>
                                    </div>`;

                                return `<button id="team-join-btn" class="join-btn w-full px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-red-600/25">Request to Join ${lead.team}</button>`;
                            })()}
                        </div>

                        ${isLeadOrAdmin ? `
                        <div class="glass-card rounded-2xl p-4 border border-zinc-800/80 bg-zinc-950/60" id="pending-requests-container">
                            <h3 class="font-heading font-semibold text-sm mb-3">Pending Requests (${pendingMembers.length})</h3>
                            <div class="space-y-2 max-h-48 overflow-y-auto">
                                ${pendingMembers.length === 0 ? '<p class="text-xs text-zinc-600">No pending requests</p>' : pendingMembers.map(m => `
                                <div class="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden mb-3">
                                    <div class="flex items-center justify-between px-3 py-2 bg-zinc-900/50">
                                        <div class="flex items-center gap-2 min-w-0 pr-2">
                                            <div class="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden cursor-pointer open-user-profile" data-id="${m.id}">
                                                ${m.avatar_url ? `<img src="${m.avatar_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-[10px] font-bold bg-zinc-700 text-zinc-400">${(m.full_name || '?').charAt(0).toUpperCase()}</div>`}
                                            </div>
                                            <div class="min-w-0">
                                                <p class="text-[13px] font-bold break-words cursor-pointer hover:text-emerald-400 transition-colors open-user-profile leading-tight" data-id="${m.id}">${m.full_name || m.username || 'Anon'}</p>
                                                <p class="text-[10px] text-zinc-500 truncate">@${m.username || ''}</p>
                                            </div>
                                        </div>
                                        <div class="flex gap-1.5 flex-shrink-0">
                                            <button class="approve-member-btn px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-bold transition-colors" data-id="${m.id}">Approve</button>
                                            <button class="deny-member-btn px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] transition-colors" data-id="${m.id}">Deny</button>
                                        </div>
                                    </div>
                                    <div class="p-3">
                                        <div class="flex items-center gap-2 mb-2">
                                            <span class="px-2 py-0.5 bg-red-600/10 text-red-400 border border-red-500/20 rounded text-[9px] font-bold uppercase tracking-wider">${m.disc_tag || 'No Tag'}</span>
                                            <span class="text-[10px] text-zinc-500 italic">DISC Personality</span>
                                        </div>
                                        <p class="text-[11px] text-zinc-400 leading-relaxed italic bg-zinc-900/30 p-2 rounded-lg border border-zinc-800/50">"${m.summary || 'No summary provided.'}"</p>
                                    </div>
                                </div>
                                `).join('')}
                            </div>
                            
                            <div class="flex items-center justify-between mt-5 mb-2 pt-3 border-t border-zinc-800/60">
                                <h3 class="font-heading font-semibold text-xs text-zinc-300">Team Configuration</h3>
                                <button id="toggle-config-btn" class="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-emerald-400" title="Edit Configuration">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </button>
                            </div>
                            
                            <div id="team-config-expandable" class="hidden animate-slide-down overflow-hidden">
                                <form id="lead-edit-team-form" class="space-y-3 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Team Profile Picture (Optional)</label><input type="file" id="lead-avatar-input" accept="image/jpeg, image/png, image/webp" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Project Name</label><input type="text" id="lead-project-name" value="${lead.project_name || ''}" placeholder="Yet to choose" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Team Name</label><input type="text" id="lead-team-name" value="${lead.team}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Bio</label><textarea id="lead-bio" rows="3" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white resize-none">${lead.bio}</textarea></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Specialties (comma-separated)</label><input type="text" id="lead-specialties" value="${lead.specialties.join(', ')}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                    <button type="submit" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold mt-2 transition-all shadow-lg shadow-emerald-600/20">Save Configuration</button>
                                </form>
                            </div>
                        </div>
                        ` : ''}

                        <!-- Milestone Tracker -->
                        ${renderMilestones(lead, isLeadOrAdmin)}
                    </div>

                    <!-- Right Area on Laptop (lg:): Active Workforce Section (lg:col-span-5) -->
                    <div class="lg:col-span-5 w-full" id="workforce-section">
                        <div class="glass-card rounded-2xl p-5 sm:p-6 border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl">
                            <div class="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-zinc-800/60">
                                <div>
                                    <div class="flex items-center gap-2.5">
                                        <h3 class="font-heading font-bold text-lg sm:text-xl text-white tracking-tight">Active Workforce</h3>
                                        <span id="team-member-count" class="px-2.5 py-0.5 bg-red-600/15 text-red-400 border border-red-500/20 rounded-full text-xs font-bold">${teamMembers.length}</span>
                                    </div>
                                    <p class="text-xs text-zinc-400 mt-1">Dedicated contributors powering ${lead.team}</p>
                                </div>
                                <div class="flex items-center gap-2 px-3 py-1 bg-zinc-900/80 border border-zinc-800 rounded-full flex-shrink-0">
                                    <span class="relative flex h-2 w-2">
                                        <span class="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span class="relative rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <span class="text-[11px] text-zinc-400 font-medium">Live Roster</span>
                                </div>
                            </div>

                            <!-- Seamless circle-only grid in workforce column -->
                            <div id="team-roster" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-y-8 gap-x-4 justify-items-center">
                                ${teamMembers.length === 0 ? '<div class="col-span-full text-sm text-zinc-500 text-center py-12">No workforce members yet — be first to join!</div>'
                        : teamMembers.map((m, i) => renderWorkforceCard(m, i, isLeadOrAdmin, profile?.id, memberTags, lead.id, lead)).join('')}
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
            await loadLeads();
            let lead = CORE_LEADS.find(l => Number(l.id) === Number(currentTeamId));
            if (!lead) {
                try {
                    const client = ICCSupabase.getClient();
                    if (client) {
                        const { data } = await client.from('core_leads').select('*').eq('id', currentTeamId).maybeSingle();
                        if (data) {
                            const staticMatch = CORE_LEADS_STATIC.find(s => s.id === data.id);
                            lead = { ...(staticMatch || {}), ...data };
                        }
                    }
                } catch (e) {}
            }
            if (!lead) { container.innerHTML = '<div class="empty-state"><p class="text-zinc-500">Team not found</p></div>'; return; }
            
            teamMembers = await ICCSupabase.getTeamMembers(currentTeamId);
            const profile = ICCSupabase.getProfile();
            
            // Ensure team leader is present in teamMembers and sorted at top
            const hasLead = teamMembers.some(m => m.role === 'lead' || Boolean(m.is_lead) || (lead?.name && m.full_name && m.full_name.trim().toLowerCase() === lead.name.trim().toLowerCase()));
            if (!hasLead) {
                try {
                    const client = ICCSupabase.getClient();
                    if (client) {
                        let leadProf = null;
                        const { data: profByTeam } = await client.from('profiles').select('id, username, full_name, avatar_url, role, email, usn, section, updated_at').eq('team_id', currentTeamId).eq('role', 'lead').maybeSingle();
                        if (profByTeam) leadProf = profByTeam;
                        else if (lead?.name) {
                            const { data: profByName } = await client.from('profiles').select('id, username, full_name, avatar_url, role, email, usn, section, updated_at').ilike('full_name', lead.name).maybeSingle();
                            if (profByName) leadProf = profByName;
                        }
                        if (leadProf) {
                            leadProf.role = 'lead';
                            teamMembers.unshift(leadProf);
                        } else if (lead) {
                            teamMembers.unshift({
                                id: `lead_${lead.id}`,
                                full_name: lead.name,
                                username: lead.name.toLowerCase().replace(/\s+/g, '_'),
                                avatar_url: lead.avatar_url,
                                role: 'lead',
                                is_lead: true
                            });
                        }
                    }
                } catch (e) {}
            }
            teamMembers = sortTeamMembers(teamMembers, lead);

            const isLeadOrAdmin = isLeadForTeam(currentTeamId, lead, teamMembers);
            if (isLeadOrAdmin) {
                pendingMembers = await ICCSupabase.getPendingMembers(currentTeamId);
            }
            container.innerHTML = renderDetail(lead);
            bindDetailEvents(lead);
            ICCSupabase.subscribeToTeam(currentTeamId, async (payload) => {
                // If the change is in core_leads, re-fetch all leads and re-render
                if (payload && payload.table === 'core_leads') {
                    await loadLeads();
                    const updatedLead = CORE_LEADS.find(l => Number(l.id) === Number(currentTeamId));
                    if (updatedLead) {
                        const detailSection = document.getElementById('team-detail-section');
                        if (detailSection) {
                            container.innerHTML = renderDetail(updatedLead);
                            bindDetailEvents(updatedLead);
                        }
                    }
                    return;
                }

                teamMembers = await ICCSupabase.getTeamMembers(currentTeamId);
                const hasLeadRealtime = teamMembers.some(m => m.role === 'lead' || Boolean(m.is_lead) || (lead?.name && m.full_name && m.full_name.trim().toLowerCase() === lead.name.trim().toLowerCase()));
                if (!hasLeadRealtime && lead) {
                    teamMembers.unshift({
                        id: `lead_${lead.id}`,
                        full_name: lead.name,
                        username: lead.name.toLowerCase().replace(/\s+/g, '_'),
                        avatar_url: lead.avatar_url,
                        role: 'lead',
                        is_lead: true
                    });
                }
                teamMembers = sortTeamMembers(teamMembers, lead);

                const roster = document.getElementById('team-roster');
                const count = document.getElementById('team-member-count');
                const isLeadOrAdminRealtime = isLeadForTeam(currentTeamId, lead, teamMembers);
                if (roster) {
                    const memberTags = getMemberTags(currentTeamId);
                    roster.innerHTML = teamMembers.length === 0 ? '<div class="col-span-full text-sm text-zinc-500 text-center py-12">No workforce members yet — be first to join!</div>'
                        : teamMembers.map((m, i) => renderWorkforceCard(m, i, isLeadOrAdminRealtime, profile?.id, memberTags, currentTeamId, lead)).join('');
                }
                if (count) count.textContent = teamMembers.length;

                if (isLeadOrAdminRealtime) {
                    pendingMembers = await ICCSupabase.getPendingMembers(currentTeamId);
                    const pendingContainer = document.getElementById('pending-requests-container');
                    if (pendingContainer) {
                        const leadForPending = CORE_LEADS.find(l => Number(l.id) === Number(currentTeamId)) || lead;
                        pendingContainer.innerHTML = `
                            <h3 class="font-heading font-semibold text-sm mb-3">Pending Requests (${pendingMembers.length})</h3>
                            <div class="space-y-2 max-h-48 overflow-y-auto">
                                ${pendingMembers.length === 0 ? '<p class="text-xs text-zinc-600">No pending requests</p>' : pendingMembers.map(m => `
                                <div class="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden mb-3">
                                    <div class="flex items-center justify-between px-3 py-2 bg-zinc-900/50">
                                        <div class="flex items-center gap-2 min-w-0 pr-2">
                                            <div class="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden cursor-pointer open-user-profile" data-id="${m.id}">
                                                ${m.avatar_url ? `<img src="${m.avatar_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-[10px] font-bold bg-zinc-700 text-zinc-400">${(m.full_name || '?').charAt(0).toUpperCase()}</div>`}
                                            </div>
                                            <div class="min-w-0">
                                                <p class="text-[13px] font-bold break-words cursor-pointer hover:text-emerald-400 transition-colors open-user-profile leading-tight" data-id="${m.id}">${m.full_name || m.username || 'Anon'}</p>
                                                <p class="text-[10px] text-zinc-500 truncate">@${m.username || ''}</p>
                                            </div>
                                        </div>
                                        <div class="flex gap-1.5 flex-shrink-0">
                                            <button class="approve-member-btn px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-bold transition-colors" data-id="${m.id}">Approve</button>
                                            <button class="deny-member-btn px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] transition-colors" data-id="${m.id}">Deny</button>
                                        </div>
                                    </div>
                                    <div class="p-3">
                                        <div class="flex items-center gap-2 mb-2">
                                            <span class="px-2 py-0.5 bg-red-600/10 text-red-400 border border-red-500/20 rounded text-[9px] font-bold uppercase tracking-wider">${m.disc_tag || 'No Tag'}</span>
                                            <span class="text-[10px] text-zinc-500 italic">DISC Personality</span>
                                        </div>
                                        <p class="text-[11px] text-zinc-400 leading-relaxed italic bg-zinc-900/30 p-2 rounded-lg border border-zinc-800/50">"${m.summary || 'No summary provided.'}"</p>
                                    </div>
                                </div>
                                `).join('')}
                            </div>
                            
                            <div class="flex items-center justify-between mt-6 mb-3">
                                <h3 class="font-heading font-semibold text-sm">Team Configuration</h3>
                                <button id="toggle-config-btn" class="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-emerald-400" title="Edit Configuration">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </button>
                            </div>
                            
                            <div id="team-config-expandable" class="hidden animate-slide-down overflow-hidden">
                                <form id="lead-edit-team-form" class="space-y-3 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Team Profile Picture (Optional)</label><input type="file" id="lead-avatar-input" accept="image/jpeg, image/png, image/webp" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Project Name</label><input type="text" id="lead-project-name" value="${leadForPending.project_name || ''}" placeholder="Yet to choose" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Team Name</label><input type="text" id="lead-team-name" value="${leadForPending.team}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Bio</label><textarea id="lead-bio" rows="3" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white resize-none">${leadForPending.bio || ''}</textarea></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Specialties (comma-separated)</label><input type="text" id="lead-specialties" value="${(leadForPending.specialties || []).join(', ')}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                    <button type="submit" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold mt-2 transition-all shadow-lg shadow-emerald-600/20">Save Configuration</button>
                                </form>
                            </div>
                        `;
                        // Re-bind events for the new buttons
                        bindDetailEvents(leadForPending);
                    }
                }
            });
        } else {
            currentTeamId = null;
            container.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="spinner"></div></div>';
            await loadLeads();
            container.innerHTML = renderGrid();
            bindGridEvents();
            ICCSupabase.subscribeToAllLeads(async () => {
                await loadLeads();
                const teamsGrid = document.getElementById('teams-section');
                if (teamsGrid) {
                    container.innerHTML = renderGrid();
                    bindGridEvents();
                }
            });
        }
    }

    function bindGridEvents() {
        const gridBackBtn = document.getElementById('teams-grid-back-btn');
        if (gridBackBtn) {
            gridBackBtn.onclick = (e) => {
                e.preventDefault();
                window.location.hash = '#dashboard';
            };
        }

        document.querySelectorAll('.lead-card').forEach(card => {
            card.onclick = () => {
                window.location.hash = `#teams/${card.dataset.leadId}`;
            };
        });
    }

    function goBack(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (typeof AndroidNavigation !== 'undefined' && AndroidNavigation.hasOpenModal && AndroidNavigation.hasOpenModal()) {
            AndroidNavigation.closeActiveModal();
            return;
        }
        const prev = (typeof Router !== 'undefined' && Router.getPreviousHash) ? Router.getPreviousHash() : null;
        if (prev && prev !== window.location.hash && !prev.startsWith('#teams/')) {
            window.location.hash = prev;
        } else {
            window.location.hash = '#teams';
        }
    }

    function bindDetailEvents(lead) {
        const backBtn = document.getElementById('team-back-btn');
        if (backBtn) backBtn.onclick = goBack;
        const floatingBackBtn = document.getElementById('team-floating-back-btn');
        if (floatingBackBtn) floatingBackBtn.onclick = goBack;
        document.getElementById('lead-profile-link')?.addEventListener('click', () => {
            const leadMember = teamMembers.find(m => m.role === 'lead');
            if (leadMember) {
                UserProfileModal.open(leadMember.id);
            } else {
                Toast.info("This lead hasn't set up their profile yet");
            }
        });
        document.getElementById('team-join-btn')?.addEventListener('click', async () => {
            if (!ICCSupabase.getUser()) { AuthModal.open(); return; }
            JoinTeamModal.open(lead);
        });
        document.getElementById('open-team-chat-btn')?.addEventListener('click', () => {
            TeamChatModal.open(lead.id);
        });

        document.getElementById('team-cancel-btn')?.addEventListener('click', async () => {
            if (!confirm('Cancel your join request?')) return;
            const btn = document.getElementById('team-cancel-btn');
            btn.disabled = true; btn.textContent = 'Cancelling...';
            const { error } = await ICCSupabase.cancelJoinRequest(lead.id);
            if (error) { Toast.error('Failed to cancel: ' + error.message); btn.disabled = false; btn.textContent = 'Cancel Request'; }
            else { Toast.success('Request cancelled'); const c = document.getElementById('app'); mount(c, lead.id); }
        });

        document.getElementById('team-roster')?.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.member-actions-btn');
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                handleMemberActionClick(e, actionBtn);
                return;
            }

            const profileCard = e.target.closest('.open-user-profile');
            if (profileCard) {
                const userId = profileCard.dataset.id;
                if (userId && typeof UserProfileModal !== 'undefined') {
                    UserProfileModal.open(userId);
                }
            }
        });

        // Team Lead actions
        document.querySelectorAll('.approve-member-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const { error } = await ICCSupabase.approveMember(userId, lead.id);
                if (error) Toast.error('Failed to approve member');
                else {
                    Toast.success('Member approved!');
                    const c = document.getElementById('app'); mount(c, lead.id);
                }
            });
        });

        document.querySelectorAll('.deny-member-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const { error } = await ICCSupabase.denyMember(userId, lead.id);
                if (error) {
                    console.error('Denial error:', error);
                    Toast.error('Error: Could not deny request');
                } else {
                    Toast.info('Join request denied');
                    const c = document.getElementById('app'); mount(c, lead.id);
                }
            });
        });

        document.querySelectorAll('.open-user-profile').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = el.dataset.id;
                if (userId) UserProfileModal.open(userId);
            });
        });

        // Toggle config
        document.getElementById('toggle-config-btn')?.addEventListener('click', () => {
            const el = document.getElementById('team-config-expandable');
            if (el) el.classList.toggle('hidden');
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
                avatar_url: newAvatarUrl
            };

            const { error } = await ICCSupabase.updateLead(lead.id, fields);
            if (error) { Toast.error('Failed to update team: ' + error.message); btn.disabled = false; btn.textContent = 'Save Configuration'; }
            else { Toast.success('Team configuration updated!'); await loadLeads(); const c = document.getElementById('app'); mount(c, lead.id); }
        });

        // Milestone Progress Events
        document.getElementById('update-progress-btn')?.addEventListener('click', () => {
            document.getElementById('progress-modal')?.classList.remove('hidden');
            try {
                if (!window.history.state?.modalOpen) {
                    window.history.pushState({ modalOpen: true, modal: 'progress' }, '');
                }
            } catch (e) {}
        });

        const closeProgress = () => {
            document.getElementById('progress-modal')?.classList.add('hidden');
        };
        document.getElementById('close-progress-modal')?.addEventListener('click', closeProgress);
        document.getElementById('back-progress-modal')?.addEventListener('click', closeProgress);

        document.getElementById('update-milestones-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true; btn.textContent = 'Updating...';

            const formData = new FormData(e.target);
            const newMilestones = {};
            MILESTONE_PHASES.forEach(phase => {
                newMilestones[phase.id] = formData.has(phase.id);
            });

            const { error } = await ICCSupabase.updateLead(lead.id, { milestones: newMilestones });
            
            if (error) {
                Toast.error('Failed to update progress: ' + error.message);
                btn.disabled = false; btn.textContent = 'Save Milestone Progress';
            } else {
                Toast.success('Project progress updated!');
                document.getElementById('progress-modal')?.classList.add('hidden');
                // Realtime subscription should handle the UI update, but we can also force a reload
                await loadLeads();
                const c = document.getElementById('app'); mount(c, lead.id);
            }
        });
    }

    function unmount() {
        if (currentTeamId) ICCSupabase?.unsubscribeChannel?.(`team-${currentTeamId}`);
        currentTeamId = null; teamMembers = [];
        const floatingBtn = document.getElementById('team-floating-back-btn');
        if (floatingBtn) floatingBtn.remove();
        const workforceModal = document.getElementById('workforce-action-modal');
        if (workforceModal) workforceModal.remove();
    }

    return { mount, unmount, goBack, handleMemberActionClick, openMemberActionModal, getMemberTags, isLeadForTeam };
})();
