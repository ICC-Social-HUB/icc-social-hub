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

    function sanitizeRichText(html) {
        if (!html) return '';
        const str = String(html).trim();
        if (!str) return '';

        // If it's plain text without HTML tags, preserve line breaks
        const hasTags = /<[a-z][\s\S]*>/i.test(str);
        if (!hasTags) {
            return escapeHtml(str).replace(/\n/g, '<br>');
        }

        const temp = document.createElement('div');
        temp.innerHTML = str;

        // Remove dangerous tags
        const dangerous = temp.querySelectorAll('script, style, iframe, object, embed, form, input, button, textarea, meta, link');
        dangerous.forEach(el => el.remove());

        // Remove dangerous attributes and protocols
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            for (let i = el.attributes.length - 1; i >= 0; i--) {
                const attr = el.attributes[i];
                const name = attr.name.toLowerCase();
                const val = attr.value.trim().toLowerCase();
                if (name.startsWith('on') || val.startsWith('javascript:') || val.startsWith('data:text/html')) {
                    el.removeAttribute(attr.name);
                }
            }
            if (el.tagName === 'A') {
                el.setAttribute('target', '_blank');
                el.setAttribute('rel', 'noopener noreferrer');
            }
        });

        return temp.innerHTML;
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
                            <p class="text-xs text-zinc-400 mt-0.5">Manage Project Contributor</p>
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
                        Remove Contributor from Project
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
                const isLead = isLeadForTeam(leadNum, lead, teamMembers);
                roster.innerHTML = teamMembers.length === 0 ? '<div class="col-span-full text-sm text-zinc-500 text-center py-12">No workforce members yet — be first to join!</div>'
                    : teamMembers.map((m, i) => renderWorkforceCard(m, i, isLead, profile?.id, tags, leadNum, lead)).join('');
            }
        });

        document.getElementById('workforce-remove-action-btn')?.addEventListener('click', async () => {
            if (!confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;
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
                Toast.success(`${memberName} was removed from the project.`);
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

    function renderWorkforceCard(m, i, isLead, currentProfileId, memberTags = {}, leadId = currentTeamId, lead = null) {
        const name = m.full_name || m.username || 'Anonymous';
        const fallbackAvatar = getRoboticAvatar(m.id || m.username || name);
        const avatarSrc = m.avatar_url ? m.avatar_url : fallbackAvatar;
        
        const currentLeadObj = lead || CORE_LEADS.find(l => Number(l.id) === Number(leadId));
        const isThisMemberLead = m.role === 'lead' || Boolean(m.is_lead) || Boolean(currentLeadObj?.name && m.full_name && m.full_name.trim().toLowerCase() === currentLeadObj.name.trim().toLowerCase());
        
        const rawTag = memberTags[m.id];
        const tag = rawTag || (isThisMemberLead ? 'Leader' : '');

        return `
        <div class="workforce-member-item group flex flex-col items-center justify-start text-center relative select-none w-full max-w-[85px] sm:max-w-[95px]" 
             style="animation-delay:${i * 0.04}s">
            
            <!-- Circular Avatar: Clean, uniform circular style -->
            <div class="open-user-profile cursor-pointer relative" data-id="${m.id}" title="View ${escapeHtml(name)}'s Profile">
                <div class="w-13 h-13 sm:w-14 sm:h-14 rounded-full overflow-hidden shadow-md ring-2 ring-zinc-800/90 group-hover:ring-emerald-500/80 group-hover:scale-105 transition-all duration-300 flex items-center justify-center bg-zinc-900 relative">
                    <img src="${avatarSrc}" 
                         alt="${escapeHtml(name)}" 
                         class="w-full h-full object-cover rounded-full" 
                         onerror="this.onerror=null;this.src='${fallbackAvatar}';">
                </div>
            </div>

            <!-- Member Full Name (Completely visible, no truncation) -->
            <h4 class="open-user-profile text-[11px] font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors text-center break-words w-full px-0.5 mt-1 cursor-pointer leading-tight" 
                data-id="${m.id}" 
                title="View ${escapeHtml(name)}'s Profile">
                ${escapeHtml(name)}${isThisMemberLead ? ICC_CONFIG.VERIFIED_TICK : ''}
            </h4>

            <!-- Member Tag below the name: Simple text for all members including leader -->
            ${tag ? `
                <span class="inline-flex items-center justify-center px-1.5 py-0.5 mt-0.5 text-[9px] sm:text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full max-w-full break-words text-center leading-tight">
                    ${escapeHtml(tag)}
                </span>
            ` : ''}

            <!-- 3-dot Menu (Only for Leader of this team) -->
            ${isLead ? `
                <button class="member-actions-btn mt-0.5 p-0.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors cursor-pointer z-10" 
                        data-id="${m.id}" 
                        data-name="${escapeHtml(name)}" 
                        data-tag="${escapeHtml(rawTag || '')}" 
                        data-lead-id="${leadId || ''}"
                        data-is-lead="${isThisMemberLead ? 'true' : 'false'}"
                        title="Member options"
                        onclick="TeamsView.handleMemberActionClick(event, this)">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1.75"/>
                        <circle cx="12" cy="12" r="1.75"/>
                        <circle cx="12" cy="19" r="1.75"/>
                    </svg>
                </button>
            ` : ''}
        </div>`;
    }

    const MILESTONE_PHASES = [
        { id: 'planning', name: 'Planning Phase', label: 'Planning', desc: 'Purpose, objectives, requirements, and constraints' },
        { id: 'design', name: 'Design Phase', label: 'Design', desc: 'Architecture, system design, and technical plans' },
        { id: 'selection', name: 'Component Selection', label: 'Selection', desc: 'Hardware/software selection (controllers, sensors, motors)' },
        { id: 'development', name: 'Construction Phase', label: 'Development', desc: 'Mechanical assembly and hardware integration' },
        { id: 'programming', name: 'Programming Phase', label: 'Programming', desc: 'Control logic, software development, and sensor configuration' },
        { id: 'testing', name: 'Testing Phase', label: 'Testing', desc: 'Performance testing and debugging' },
        { id: 'optimization', name: 'Optimization Phase', label: 'Optimization', desc: 'Fine-tuning speed, stability, and accuracy' },
        { id: 'deployment', name: 'Deployment Phase', label: 'Deployment', desc: 'Final documentation and demonstration' }
    ];

    function renderMilestones(lead, isLead) {
        const milestones = lead.milestones || {};
        const completedCount = MILESTONE_PHASES.filter(p => milestones[p.id]).length;
        const progress = Math.round((completedCount / MILESTONE_PHASES.length) * 100);
        
        // Find index of first uncompleted phase to set as "In Progress"
        const firstUncompletedIndex = MILESTONE_PHASES.findIndex(p => !milestones[p.id]);

        return `
        <div class="glass-card rounded-2xl p-5 sm:p-6 border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl">
            <!-- Header matching the picture -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5 sm:gap-3">
                    <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f97316] flex items-center justify-center text-zinc-950 shadow-md shadow-orange-500/20 flex-shrink-0">
                        <svg class="w-4 h-4 sm:w-4.5 sm:h-4.5 text-zinc-950 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-heading font-bold text-sm sm:text-base text-white tracking-tight leading-tight">Project Progress</h3>
                        <p class="text-[11px] sm:text-xs text-zinc-400 font-normal mt-0.5">${completedCount} of ${MILESTONE_PHASES.length} phases completed</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">${progress}%</span>
                </div>
            </div>
            
            <!-- Progress Bar with emerald glow matching the picture -->
            <div class="w-full h-2 sm:h-2.5 bg-[#1e293b]/80 rounded-full overflow-hidden my-5 border border-zinc-800/40">
                <div class="h-full bg-[#34d399] rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(52,211,153,0.5)]" style="width: ${progress}%"></div>
            </div>

            <!-- Connected Horizontal Stepper Pipeline matching picture -->
            <div class="overflow-x-auto pb-2 pt-1 -mx-2 px-2 scrollbar-none">
                <div class="min-w-[660px] w-full flex items-start justify-between relative">
                    ${MILESTONE_PHASES.map((phase, i) => {
                        const isCompleted = Boolean(milestones[phase.id]);
                        const isInProgress = !isCompleted && (firstUncompletedIndex === i || (firstUncompletedIndex === -1 && i === 0));
                        const isLast = i === MILESTONE_PHASES.length - 1;

                        // Connector line style: green if current phase completed, otherwise dark gray
                        const connectorClass = isCompleted ? 'bg-[#34d399] shadow-[0_0_6px_rgba(52,211,153,0.4)]' : 'bg-zinc-700/60';

                        return `
                        <div class="relative flex-1 flex flex-col items-center text-center group">
                            <!-- Connecting Line to next step -->
                            ${!isLast ? `
                            <div class="absolute top-4 left-1/2 w-full h-[2px] -translate-y-1/2 z-0 ${connectorClass}"></div>
                            ` : ''}

                            <!-- Node Icon Circle -->
                            <div class="relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                                ${isCompleted ? `
                                    <div class="w-8 h-8 rounded-full bg-[#34d399] flex items-center justify-center text-zinc-950 shadow-md shadow-emerald-500/25">
                                        <svg class="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                                        </svg>
                                    </div>
                                ` : isInProgress ? `
                                    <div class="w-8 h-8 rounded-full border-2 border-[#f59e0b] bg-zinc-950 flex items-center justify-center shadow-md shadow-amber-500/25">
                                        <div class="w-3.5 h-3.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                                    </div>
                                ` : `
                                    <div class="w-8 h-8 rounded-full border-2 border-zinc-700/80 bg-zinc-950 flex items-center justify-center">
                                    </div>
                                `}
                            </div>

                            <!-- Phase Title & Status Label -->
                            <div class="mt-2 flex flex-col items-center">
                                <span class="text-[11px] sm:text-xs font-semibold tracking-tight ${isCompleted || isInProgress ? 'text-white' : 'text-zinc-300'}">
                                    ${phase.label}
                                </span>
                                <span class="text-[9.5px] sm:text-[10.5px] font-medium tracking-tight mt-0.5 ${
                                    isCompleted ? 'text-[#34d399]' :
                                    isInProgress ? 'text-[#f59e0b] font-semibold' :
                                    'text-zinc-500'
                                }">
                                    ${isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Not Started'}
                                </span>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            ${isLead ? `
            <button id="update-progress-btn" class="w-full mt-5 py-2.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 group shadow-sm">
                <svg class="w-4 h-4 text-emerald-400 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
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
                    <span class="text-[11px] font-medium text-zinc-500 uppercase tracking-widest hidden sm:inline">Projects Directory</span>
                </div>

                <div class="text-center mb-8 px-2">
                    <p class="text-emerald-500 text-xs font-semibold tracking-widest uppercase mb-2">Projects</p>
                    <h1 class="font-heading font-bold text-2xl sm:text-3xl mb-2">Explore <span class="gradient-text-static">Projects</span></h1>
                    <p class="text-zinc-500 text-sm max-w-md mx-auto">Discover student-led innovation projects and collaborate with creators.</p>
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
                                <h3 class="font-heading font-bold text-sm sm:text-base text-white truncate" title="${lead.project_name || lead.team}">${lead.project_name || lead.team}</h3>
                                <p class="text-zinc-400 text-[11px] mt-0.5 truncate font-medium">Team: <span class="text-zinc-300 font-semibold">${lead.team}</span></p>
                                <p class="text-zinc-500 text-[10px] mt-0.5 truncate">Lead: <span class="text-zinc-400">${lead.name}${ICC_CONFIG.VERIFIED_TICK}</span></p>
                                
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
        const isMember = profile?.memberships?.map(Number).includes(Number(lead.id));
        const isPending = profile?.pending_teams?.map(Number).includes(Number(lead.id));
        const isLead = isLeadForTeam(lead.id, lead, teamMembers);
        const memberTags = getMemberTags(lead.id);

        return `
        <section class="min-h-screen relative pb-16" id="team-detail-section">
            <!-- Floating Quick-Back Button: stays accessible even when scrolled down -->
            <button id="team-floating-back-btn" onclick="TeamsView.goBack(event)" class="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-[#17212b]/95 hover:bg-[#242f3d] text-white text-xs font-bold rounded-full border border-[#2b394a] shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer group" title="Go Back">
                <svg class="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                <span>Back</span>
            </button>

            <!-- Top Section: Left-aligned Project Header (reduced size) & Active Workforce at top -->
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8">
                <!-- Top Navigation Bar with Back Button -->
                <div class="flex items-center justify-between mb-5">
                    <button id="team-back-btn" onclick="TeamsView.goBack(event)" class="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 rounded-xl text-xs font-semibold text-white border border-zinc-800 transition-all cursor-pointer shadow-md active:scale-95">
                        <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        <span>Back</span>
                    </button>
                </div>

                <!-- 2-Column Main Workspace Grid -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    <!-- Left Column (lg:col-span-7 xl:col-span-8): Project Name & Team Name -> About the Project -> Project Progress -->
                    <div class="lg:col-span-7 xl:col-span-8 space-y-5">
                        
                        <!-- 1. Project Name & Team Name Section (Shifted to left, compact) -->
                        <div class="flex items-center gap-4 pb-1">
                            <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-900 ring-2 ring-zinc-800/80 shadow-xl flex items-center justify-center overflow-hidden flex-shrink-0 ${lead.avatar_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}" ${lead.avatar_url ? `data-full-image="${lead.avatar_url}"` : ''}>
                                ${lead.avatar_url
                                    ? `<img src="${lead.avatar_url}" class="w-full h-full object-cover">`
                                    : `<span class="font-heading font-bold text-2xl sm:text-3xl" style="color:${lead.color || '#10b981'}">${lead.initials}</span>`}
                            </div>
                            <div class="min-w-0 flex-1 text-left">
                                <div class="flex items-center flex-wrap gap-2.5 sm:gap-3">
                                    <h1 class="font-heading font-bold text-xl sm:text-2xl lg:text-3xl text-white tracking-tight break-words leading-tight">${lead.project_name || lead.team}</h1>
                                    ${(() => {
                                        if (!user) return `<button id="team-join-btn" class="join-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all hover:shadow-lg hover:shadow-red-600/30 cursor-pointer shadow-md active:scale-95 flex-shrink-0"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg><span>Join Team</span></button>`;
                                        if (isMember || isLead) return `
                                            <div class="inline-flex items-center gap-2 flex-wrap">
                                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600/15 border border-emerald-600/30 rounded-xl text-emerald-400 text-xs font-semibold">
                                                    <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                    <span>${isLead ? "Team Leader" : "Team Member"}</span>
                                                </span>
                                                <button id="open-team-chat-btn" class="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-800 hover:border-emerald-500/40 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95">
                                                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                                                    <span>Team Chat</span>
                                                </button>
                                            </div>`;
                                        if (profile?.memberships?.length > 0 || profile?.role === 'lead') return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 text-xs font-medium"><svg class="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg><span>In Another Project</span></span>`;
                                        if (isPending) return `
                                            <div class="inline-flex items-center gap-2">
                                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-semibold">
                                                    <svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                    <span>Pending</span>
                                                </span>
                                                <button id="team-cancel-btn" class="text-xs text-zinc-500 hover:text-red-400 transition-colors underline decoration-dotted cursor-pointer">Cancel</button>
                                            </div>`;
                                        if (profile?.pending_teams?.length > 0) return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 text-xs font-medium">Pending Elsewhere</span>`;

                                        return `<button id="team-join-btn" class="join-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all hover:shadow-lg hover:shadow-red-600/30 cursor-pointer shadow-md active:scale-95 flex-shrink-0">
                                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                                            <span>Join Team</span>
                                        </button>`;
                                    })()}
                                </div>
                                <div class="flex items-center gap-2 mt-1.5 text-xs">
                                    <span class="px-2.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded-full font-semibold text-zinc-400">Team: <span class="text-zinc-200 font-bold">${lead.team}</span></span>
                                </div>
                            </div>
                        </div>

                        <!-- 2. "About the Project" Section (Shifted to top, below project name and team name) -->
                        <div class="glass-card rounded-2xl p-5 sm:p-6 border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl space-y-4" id="about-project-card">
                            
                            <!-- Clean Preview Container (Default view) -->
                            <div id="about-project-view-container" class="space-y-4">
                                <div class="flex items-center justify-between gap-3">
                                    <h3 class="font-heading font-semibold text-xs uppercase tracking-wider text-zinc-400">About the Project</h3>
                                    ${isLead ? `
                                    <button id="edit-about-btn" class="flex items-center gap-1.5 px-3 py-1 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 border border-zinc-800 hover:border-emerald-500/40 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95" title="Edit About the Project">
                                        <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                        </svg>
                                        <span>Edit</span>
                                    </button>
                                    ` : ''}
                                </div>

                                <!-- Clean Rendered Content Display -->
                                <div id="about-project-display" class="prose-clean text-sm text-zinc-300 leading-relaxed break-words">
                                    ${sanitizeRichText(lead.bio) || '<span class="text-zinc-500 italic">No project description provided yet.</span>'}
                                </div>

                                <div>
                                    <h3 class="font-heading font-semibold text-xs uppercase tracking-wider text-zinc-400 mb-2">Specialties & Tech Stack</h3>
                                    <div class="flex flex-wrap gap-2">
                                        ${(lead.specialties || []).map(s => `<span class="specialty-pill px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400">${s}</span>`).join('')}
                                    </div>
                                </div>
                            </div>

                            <!-- Rich Text Editor Container (Hidden by default, shown when clicking Edit) -->
                            ${isLead ? `
                            <div id="about-project-editor-container" class="hidden space-y-3">
                                <div class="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-heading font-semibold text-xs uppercase tracking-wider text-emerald-400">Edit About Project</h3>
                                        <span class="text-[10px] text-zinc-500 hidden sm:inline">• Formatted paste supported</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button id="cancel-about-btn" type="button" class="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-semibold border border-zinc-800 transition-colors cursor-pointer">
                                            Cancel
                                        </button>
                                        <button id="save-about-btn" type="button" class="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer">
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                                            <span>Save Changes</span>
                                        </button>
                                    </div>
                                </div>

                                <!-- Formatting Toolbar -->
                                <div class="flex flex-wrap items-center gap-1 p-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl select-none" id="rich-editor-toolbar">
                                    <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-bold transition-colors cursor-pointer" data-cmd="bold" title="Bold (Ctrl+B)">
                                        <b>B</b>
                                    </button>
                                    <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs italic font-serif transition-colors cursor-pointer" data-cmd="italic" title="Italic (Ctrl+I)">
                                        <i>I</i>
                                    </button>
                                    <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs underline transition-colors cursor-pointer" data-cmd="underline" title="Underline (Ctrl+U)">
                                        <u>U</u>
                                    </button>
                                    <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs line-through transition-colors cursor-pointer" data-cmd="strikeThrough" title="Strikethrough">
                                        <s>S</s>
                                    </button>

                                    <span class="w-[1px] h-4 bg-zinc-700 mx-1"></span>

                                    <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-semibold transition-colors cursor-pointer" data-cmd="formatBlock" data-val="<h3>" title="Heading">
                                        H1
                                    </button>
                                    <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-semibold transition-colors cursor-pointer" data-cmd="formatBlock" data-val="<h4>" title="Subheading">
                                        H2
                                    </button>

                                    <span class="w-[1px] h-4 bg-zinc-700 mx-1"></span>

                                    <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs transition-colors cursor-pointer" data-cmd="insertUnorderedList" title="Bulleted List">
                                        • List
                                    </button>
                                    <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs transition-colors cursor-pointer" data-cmd="insertOrderedList" title="Numbered List">
                                        1. List
                                    </button>

                                    <span class="w-[1px] h-4 bg-zinc-700 mx-1"></span>

                                    <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs transition-colors cursor-pointer" data-cmd="createLink" title="Insert Link">
                                        🔗 Link
                                    </button>
                                    <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 rounded-md text-xs transition-colors cursor-pointer" data-cmd="removeFormat" title="Clear Formatting">
                                        ⌫ Clear
                                    </button>
                                </div>

                                <!-- Contenteditable Rich Text Area -->
                                <div id="about-project-editor" 
                                     contenteditable="true" 
                                     class="prose-clean min-h-[160px] max-h-[380px] overflow-y-auto p-4 bg-zinc-950/90 border border-zinc-800 focus:border-emerald-500/60 rounded-xl text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all leading-relaxed" 
                                     placeholder="Type or paste formatted project overview...">
                                </div>
                                <p class="text-[10px] text-zinc-500 italic">Tip: You can select text to format, or paste formatted text directly from Google Docs, Word, or Notion.</p>
                            </div>
                            ` : ''}
                        </div>

                        <!-- 3. Project Progress Section (Below "About the Project") -->
                        <div id="project-progress-container">
                            ${renderMilestones(lead, isLead)}
                        </div>

                    </div>

                    <!-- Right Column (lg:col-span-5 xl:col-span-4): Active Workforce at top, then Membership -->
                    <div class="lg:col-span-5 xl:col-span-4 space-y-5 w-full max-w-[340px] mx-auto lg:mx-0">
                        
                        <!-- Active Workforce Section (At top, 3 in a column, reduced horizontal space) -->
                        <div class="w-full" id="workforce-section">
                            <div class="glass-card rounded-2xl p-3.5 sm:p-4 border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl">
                                <div class="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-zinc-800/60">
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-heading font-bold text-sm text-white tracking-tight">Active Workforce</h3>
                                        <span id="team-member-count" class="px-2 py-0.5 bg-red-600/15 text-red-400 border border-red-500/20 rounded-full text-[11px] font-bold">${teamMembers.length}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5 px-2.5 py-0.5 bg-zinc-900/80 border border-zinc-800 rounded-full flex-shrink-0">
                                        <span class="relative flex h-2 w-2">
                                            <span class="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span class="relative rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <span class="text-[10px] text-zinc-400 font-medium">Live Roster</span>
                                    </div>
                                </div>

                                <!-- 3 profiles in a column (grid-cols-3) -->
                                <div id="team-roster" class="grid grid-cols-3 gap-y-3.5 gap-x-2 justify-items-center">
                                    ${teamMembers.length === 0 ? '<div class="col-span-full text-xs text-zinc-500 text-center py-6">No project members yet — be first to join!</div>'
                            : teamMembers.map((m, i) => renderWorkforceCard(m, i, isLead, profile?.id, memberTags, lead.id, lead)).join('')}
                                </div>
                            </div>
                        </div>

                        ${isLead ? `
                        <div class="glass-card rounded-2xl p-4 border border-zinc-800/80 bg-zinc-950/60" id="pending-requests-container">
                            <h3 class="font-heading font-semibold text-sm mb-3">Pending Applications (${pendingMembers.length})</h3>
                            <div class="space-y-2 max-h-48 overflow-y-auto">
                                ${pendingMembers.length === 0 ? '<p class="text-xs text-zinc-600">No pending applications</p>' : pendingMembers.map(m => `
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
                                <h3 class="font-heading font-semibold text-xs text-zinc-300">Project Configuration</h3>
                                <button id="toggle-config-btn" class="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-emerald-400" title="Edit Configuration">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </button>
                            </div>
                            
                            <div id="team-config-expandable" class="hidden animate-slide-down overflow-hidden">
                                <form id="lead-edit-team-form" class="space-y-3 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Project Name (Primary Title)</label><input type="text" id="lead-project-name" value="${lead.project_name || ''}" placeholder="e.g. Autonomous Ground Vehicle" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Team Name (Secondary)</label><input type="text" id="lead-team-name" value="${lead.team}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Project Avatar / Icon (Optional)</label><input type="file" id="lead-avatar-input" accept="image/jpeg, image/png, image/webp" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Project Overview & Objectives</label><textarea id="lead-bio" rows="3" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white resize-none">${lead.bio}</textarea></div>
                                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Specialties & Tech Stack (comma-separated)</label><input type="text" id="lead-specialties" value="${lead.specialties.join(', ')}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                                    <button type="submit" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold mt-2 transition-all shadow-lg shadow-emerald-600/20">Save Project Configuration</button>
                                </form>
                            </div>
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

            const isLead = isLeadForTeam(currentTeamId, lead, teamMembers);
            if (isLead) {
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
                const isLeadRealtime = isLeadForTeam(currentTeamId, lead, teamMembers);
                if (roster) {
                    const memberTags = getMemberTags(currentTeamId);
                    roster.innerHTML = teamMembers.length === 0 ? '<div class="col-span-full text-sm text-zinc-500 text-center py-12">No workforce members yet — be first to join!</div>'
                        : teamMembers.map((m, i) => renderWorkforceCard(m, i, isLeadRealtime, profile?.id, memberTags, currentTeamId, lead)).join('');
                }
                if (count) count.textContent = teamMembers.length;

                if (isLeadRealtime) {
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
            if (!confirm('Cancel your application to this project?')) return;
            const btn = document.getElementById('team-cancel-btn');
            btn.disabled = true; btn.textContent = 'Cancelling...';
            const { error } = await ICCSupabase.cancelJoinRequest(lead.id);
            if (error) { Toast.error('Failed to cancel: ' + error.message); btn.disabled = false; btn.textContent = 'Cancel Application'; }
            else { Toast.success('Application cancelled'); const c = document.getElementById('app'); mount(c, lead.id); }
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
                    Toast.success('Member approved for project!');
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
                    Toast.error('Error: Could not deny application');
                } else {
                    Toast.info('Project application denied');
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

        // About Project Rich Text Editing for Team Leaders
        const editAboutBtn = document.getElementById('edit-about-btn');
        const viewContainer = document.getElementById('about-project-view-container');
        const editorContainer = document.getElementById('about-project-editor-container');
        const aboutEditor = document.getElementById('about-project-editor');
        const aboutDisplay = document.getElementById('about-project-display');
        const cancelAboutBtn = document.getElementById('cancel-about-btn');
        const saveAboutBtn = document.getElementById('save-about-btn');

        if (editAboutBtn && aboutEditor && viewContainer && editorContainer) {
            editAboutBtn.addEventListener('click', () => {
                aboutEditor.innerHTML = lead.bio || '';
                viewContainer.classList.add('hidden');
                editorContainer.classList.remove('hidden');
                aboutEditor.focus();
            });

            cancelAboutBtn?.addEventListener('click', () => {
                editorContainer.classList.add('hidden');
                viewContainer.classList.remove('hidden');
            });

            saveAboutBtn?.addEventListener('click', async () => {
                const rawHtml = aboutEditor.innerHTML.trim();
                const cleanHtml = sanitizeRichText(rawHtml);
                saveAboutBtn.disabled = true;
                const originalText = saveAboutBtn.innerHTML;
                saveAboutBtn.innerHTML = `<span>Saving...</span>`;

                try {
                    const { error } = await ICCSupabase.updateLead(lead.id, { bio: cleanHtml });
                    if (error) {
                        Toast.error('Failed to update About Project: ' + error.message);
                    } else {
                        lead.bio = cleanHtml;
                        const leadInCore = CORE_LEADS.find(l => Number(l.id) === Number(lead.id));
                        if (leadInCore) leadInCore.bio = cleanHtml;

                        // Update clean view display
                        if (aboutDisplay) {
                            aboutDisplay.innerHTML = cleanHtml || '<span class="text-zinc-500 italic">No project description provided yet.</span>';
                        }
                        // Update form textarea if open in config
                        const leadBioInput = document.getElementById('lead-bio');
                        if (leadBioInput) leadBioInput.value = cleanHtml;

                        editorContainer.classList.add('hidden');
                        viewContainer.classList.remove('hidden');
                        Toast.success('About Project updated!');
                    }
                } catch(err) {
                    console.error('Save error:', err);
                    Toast.error('An unexpected error occurred while saving.');
                } finally {
                    saveAboutBtn.disabled = false;
                    saveAboutBtn.innerHTML = originalText;
                }
            });

            // Prevent toolbar buttons from clearing selection in contenteditable
            document.querySelectorAll('#rich-editor-toolbar .toolbar-btn').forEach(btn => {
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                });

                btn.addEventListener('click', () => {
                    const cmd = btn.dataset.cmd;
                    const val = btn.dataset.val || null;

                    if (cmd === 'createLink') {
                        const url = prompt('Enter website link URL:', 'https://');
                        if (url && url.trim()) {
                            let validUrl = url.trim();
                            if (!/^https?:\/\//i.test(validUrl)) {
                                validUrl = 'https://' + validUrl;
                            }
                            document.execCommand('createLink', false, validUrl);
                        }
                    } else {
                        document.execCommand(cmd, false, val);
                    }
                    aboutEditor.focus();
                });
            });

            // Rich paste formatting preservation
            aboutEditor.addEventListener('paste', (e) => {
                const html = e.clipboardData?.getData('text/html');
                if (html) {
                    e.preventDefault();
                    const cleaned = sanitizeRichText(html);
                    document.execCommand('insertHTML', false, cleaned);
                }
            });
        }

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
                if (file.size > 2 * 1024 * 1024) { Toast.error('Image must be under 2MB'); btn.disabled = false; btn.textContent = 'Save Project Configuration'; return; }
                const { url, error: uploadError } = await ICCSupabase.uploadImage('avatars', file);
                if (uploadError) { Toast.error('Image upload failed: ' + uploadError.message); btn.disabled = false; btn.textContent = 'Save Project Configuration'; return; }
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
            if (error) { Toast.error('Failed to update project: ' + error.message); btn.disabled = false; btn.textContent = 'Save Project Configuration'; }
            else { Toast.success('Project configuration updated!'); await loadLeads(); const c = document.getElementById('app'); mount(c, lead.id); }
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
