/* ============================================
   ICC Social Hub — Teams View
   ============================================ */
const TeamsView = (() => {
    let currentTeamId = null;
    let teamMembers = [];
    let pendingMembers = [];
    let currentProjectTab = 'overview';
    let currentMentorMessages = [];
    let projectTasks = [];
    let currentTaskFilter = 'all';
    let activeCompletingTaskId = null;
    let mentorReplyTarget = null;
    let mentorChatUnsubscribe = null;

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

        // 0. Direct creator / project lead match from core_leads (for approved projects)
        if (lead?.lead_user_id && profile?.id && String(lead.lead_user_id) === String(profile.id)) return true;

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

    // ==========================================
    // FEATURE 1: PROJECT CREATION & APPLICATIONS
    // ==========================================

    function renderRichEditorToolbar(toolbarId) {
        return `
        <div class="flex flex-wrap items-center gap-1 p-1.5 bg-zinc-900/95 border border-zinc-800 rounded-xl select-none" id="${toolbarId}">
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-bold transition-colors cursor-pointer active:scale-95" data-cmd="bold" title="Bold (Ctrl+B)">
                <b>B</b>
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs italic font-serif transition-colors cursor-pointer active:scale-95" data-cmd="italic" title="Italic (Ctrl+I)">
                <i>I</i>
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs underline transition-colors cursor-pointer active:scale-95" data-cmd="underline" title="Underline (Ctrl+U)">
                <u>U</u>
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs line-through transition-colors cursor-pointer active:scale-95" data-cmd="strikeThrough" title="Strikethrough">
                <s>S</s>
            </button>

            <span class="w-[1px] h-4 bg-zinc-700 mx-1"></span>

            <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-semibold transition-colors cursor-pointer active:scale-95" data-cmd="formatBlock" data-val="<h3>" title="Main Heading">
                H1
            </button>
            <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-semibold transition-colors cursor-pointer active:scale-95" data-cmd="formatBlock" data-val="<h4>" title="Subheading">
                H2
            </button>

            <span class="w-[1px] h-4 bg-zinc-700 mx-1"></span>

            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="insertUnorderedList" title="Bulleted List">
                • List
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="insertOrderedList" title="Numbered List">
                1. List
            </button>

            <span class="w-[1px] h-4 bg-zinc-700 mx-1"></span>

            <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="createLink" title="Insert Link">
                🔗 Link
            </button>
            <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="removeFormat" title="Clear Formatting">
                ⌫ Clear
            </button>
        </div>`;
    }

    function bindRichEditorToolbar(toolbarId, editorElement) {
        const toolbar = document.getElementById(toolbarId);
        if (!toolbar || !editorElement) return;

        toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevents editor from losing focus/selection
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
                editorElement.focus();
            });
        });

        // Rich paste handling (preserving bold, underline, lists, links)
        editorElement.addEventListener('paste', (e) => {
            const html = e.clipboardData?.getData('text/html');
            if (html) {
                e.preventDefault();
                const cleaned = sanitizeRichText(html);
                document.execCommand('insertHTML', false, cleaned);
            }
        });
    }

    function openCreateProjectModal() {
        const user = ICCSupabase.getUser();
        if (!user) {
            if (typeof AuthModal !== 'undefined') AuthModal.open();
            return;
        }

        const existing = document.getElementById('create-project-modal');
        if (existing) existing.remove();

        const profile = ICCSupabase.getProfile();

        const modalHtml = `
        <div id="create-project-modal" class="fixed inset-0 z-[2500] bg-zinc-950 text-white flex flex-col w-full h-full min-h-screen overflow-y-auto animate-fade-in">
            <!-- Fullscreen Sticky Top Header -->
            <header class="sticky top-0 z-30 w-full bg-[#17212b]/95 backdrop-blur-xl border-b border-zinc-800 px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-3">
                    <button id="cancel-create-proj-btn" type="button" class="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold border border-zinc-800 transition-all cursor-pointer active:scale-95" title="Return to Projects">
                        <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        <span class="hidden sm:inline">Back to Projects</span>
                    </button>
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-emerald-600 border border-emerald-500/30 flex items-center justify-center text-white shadow-md">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                        </div>
                        <div>
                            <h1 class="font-heading font-bold text-sm sm:text-base text-white">Create Project Proposal</h1>
                            <p class="text-[11px] text-zinc-400 hidden md:block">Full proposal studio with rich text overview, custom resources & mentor approval</p>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 sm:gap-3">
                    <button type="submit" form="create-project-form" id="submit-create-proj-btn" class="px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2">
                        <span>Submit Proposal</span>
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </button>
                    <button id="close-create-proj-modal" type="button" class="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer" title="Close Studio">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            </header>

            <!-- Fullscreen Form Body -->
            <div class="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-6 sm:py-8">
                <!-- Workflow Alert Banner -->
                <div class="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-xs text-amber-300">
                    <div class="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-400 mt-0.5">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <div>
                        <span class="font-bold text-amber-200">Mentor Approval Workflow:</span> Submitting saves this proposal with status <span class="font-bold text-white underline">"Pending Review"</span>. Mentors can review your problem statement, request refinements, or approve it. Once approved, the project is published live to everyone, a unique database project code is assigned, and you become the official Project Lead.
                    </div>
                </div>

                <form id="create-project-form" class="space-y-6">
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        
                        <!-- Left Column: Core Fields & Rich Text Description (lg:col-span-8) -->
                        <div class="lg:col-span-8 space-y-6">
                            
                            <!-- Project Title & Team Identity Card -->
                            <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 space-y-4 backdrop-blur-xl">
                                <h3 class="font-heading font-bold text-sm uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                    <span>Project & Team Identity</span>
                                </h3>

                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                                            Project Name <span class="text-red-400">*</span>
                                        </label>
                                        <input type="text" id="cp-project-name" required placeholder="e.g. Autonomous Campus Delivery Drone" maxlength="120"
                                               class="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-colors">
                                    </div>

                                    <div>
                                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                                            Team Name <span class="text-zinc-500 text-[11px]">(Optional, defaults to Project Name)</span>
                                        </label>
                                        <input type="text" id="cp-team-name" placeholder="e.g. AeroInnovators" maxlength="80"
                                               class="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-colors">
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                                        Specialties, Tech Stack & Key Domains <span class="text-zinc-500 text-[11px]">(Comma-separated)</span>
                                    </label>
                                    <input type="text" id="cp-specialties" placeholder="e.g. AI / ML, Computer Vision, Embedded C++, ROS2, Drone Avionics"
                                           class="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-colors">
                                </div>
                            </div>

                            <!-- Rich Text Description & Project Vision Card -->
                            <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 space-y-3.5 backdrop-blur-xl">
                                <div class="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-zinc-800/60">
                                    <div>
                                        <h3 class="font-heading font-bold text-sm uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7"/></svg>
                                            <span>Description & Project Vision <span class="text-red-400">*</span></span>
                                        </h3>
                                        <p class="text-[11px] text-zinc-400 mt-0.5">Format with bold, underline, headings, lists or paste formatted text from Docs/Notion</p>
                                    </div>
                                    <span class="text-[10px] text-zinc-500 font-mono hidden sm:inline">Rich Format Editor</span>
                                </div>

                                <!-- Formatting Toolbar -->
                                ${renderRichEditorToolbar('cp-desc-toolbar')}

                                <!-- Contenteditable Rich Area -->
                                <div id="cp-project-desc-editor" 
                                     contenteditable="true" 
                                     class="prose-clean min-h-[320px] max-h-[580px] overflow-y-auto p-4 sm:p-5 bg-zinc-950/90 border border-zinc-800 focus:border-emerald-500/60 rounded-xl text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all leading-relaxed" 
                                     placeholder="Type or paste formatted project overview: problem statement, architecture, technologies, target milestones, and expected outcome..."></div>

                                <div class="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                                    <span>Tip: Highlight text to bold (Ctrl+B), underline (Ctrl+U), or convert to bullet points.</span>
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Links, Custom Resources & Leadership Info (lg:col-span-4) -->
                        <div class="lg:col-span-4 space-y-6">
                            
                            <!-- Project Links & Custom Resources Card -->
                            <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4 backdrop-blur-xl">
                                <div class="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
                                    <div class="flex items-center gap-2">
                                        <div class="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                                        </div>
                                        <h3 class="font-heading font-bold text-xs uppercase tracking-wider text-zinc-300">Links & Resources</h3>
                                    </div>
                                    <button type="button" id="cp-add-custom-link-btn" class="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm active:scale-95">
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                        <span>+ Add Link</span>
                                    </button>
                                </div>

                                <!-- GitHub Field -->
                                <div class="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl space-y-1.5">
                                    <div class="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                                        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                                        <span>GitHub Repository</span>
                                    </div>
                                    <input type="url" id="cp-github-url" placeholder="https://github.com/your-org/repo"
                                           class="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-zinc-600 outline-none transition-colors">
                                </div>

                                <!-- YouTube Field -->
                                <div class="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl space-y-1.5">
                                    <div class="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                                        <svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                        <span>YouTube Video / Demo</span>
                                    </div>
                                    <input type="url" id="cp-demo-url" placeholder="https://youtube.com/watch?v=..."
                                           class="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-zinc-600 outline-none transition-colors">
                                </div>

                                <!-- Custom Links Dynamic List -->
                                <div class="space-y-2 pt-1">
                                    <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Custom Links (Figma, Docs, Research Paper)</span>
                                    <div id="cp-custom-links-container" class="space-y-2">
                                        <!-- Dynamically added custom links -->
                                    </div>
                                    <p class="text-[10px] text-zinc-500 italic">Click "+ Add Link" above to attach Figma prototypes, Google Docs, Notion specs, or live deployments.</p>
                                </div>
                            </div>

                            <!-- Designated Project Lead Dossier Card -->
                            <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5 backdrop-blur-xl">
                                <h3 class="font-heading font-bold text-xs uppercase tracking-wider text-zinc-400">Applicant & Leadership</h3>
                                <div class="flex items-center gap-3 p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl">
                                    <div class="w-10 h-10 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                        ${profile?.full_name?.charAt(0) || 'U'}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p class="text-xs font-bold text-white truncate">${escapeHtml(profile?.full_name || 'Innovator')}</p>
                                        <p class="text-[11px] text-zinc-400 truncate">${escapeHtml(profile?.email || '')}</p>
                                    </div>
                                </div>
                                <div class="space-y-1.5 text-xs text-zinc-400 leading-relaxed bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/50">
                                    <div class="flex items-center gap-2 text-emerald-400 font-semibold">
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                                        <span>Designated Project Lead</span>
                                    </div>
                                    <p class="text-[11px] text-zinc-400">
                                        Upon mentor review and approval, you will automatically become the Project Lead for this project with permissions to manage members, milestones, and project links.
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>
                </form>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('create-project-modal');

        const close = () => modal?.remove();
        document.getElementById('close-create-proj-modal')?.addEventListener('click', close);
        document.getElementById('cancel-create-proj-btn')?.addEventListener('click', close);

        // Bind rich text toolbar
        const descEditor = document.getElementById('cp-project-desc-editor');
        bindRichEditorToolbar('cp-desc-toolbar', descEditor);

        // Custom links handling
        const customLinksContainer = document.getElementById('cp-custom-links-container');
        function addCustomLinkRow(name = '', url = '') {
            const row = document.createElement('div');
            row.className = 'cp-custom-link-row flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-xl animate-fade-in';
            row.innerHTML = `
                <input type="text" class="cp-custom-link-name form-input text-xs w-2/5 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-white" placeholder="Label (e.g. Figma)" value="${escapeHtml(name)}">
                <input type="url" class="cp-custom-link-url form-input text-xs flex-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-white" placeholder="https://..." value="${escapeHtml(url)}">
                <button type="button" class="cp-remove-link-btn p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer" title="Remove Link">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            `;
            row.querySelector('.cp-remove-link-btn').addEventListener('click', () => row.remove());
            customLinksContainer.appendChild(row);
        }

        document.getElementById('cp-add-custom-link-btn')?.addEventListener('click', () => {
            addCustomLinkRow();
        });

        // Add 1 default empty custom link row for immediate discoverability
        addCustomLinkRow('', '');

        document.getElementById('create-project-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('submit-create-proj-btn');
            const projectName = document.getElementById('cp-project-name')?.value.trim();
            const teamName = document.getElementById('cp-team-name')?.value.trim() || projectName;
            const rawHtml = descEditor ? descEditor.innerHTML.trim() : '';
            const textOnly = descEditor ? descEditor.textContent.trim() : '';
            const specialtiesRaw = document.getElementById('cp-specialties')?.value.trim();
            const githubUrl = document.getElementById('cp-github-url')?.value.trim();
            const demoUrl = document.getElementById('cp-demo-url')?.value.trim();

            if (!projectName) {
                Toast.error('Please enter a project name.');
                return;
            }
            if (!textOnly || textOnly.length < 10) {
                Toast.error('Please enter a descriptive project overview & vision (at least 10 characters).');
                descEditor?.focus();
                return;
            }

            const cleanHtml = sanitizeRichText(rawHtml);
            const specialties = specialtiesRaw ? specialtiesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
            const allLinks = [];

            if (githubUrl) {
                allLinks.push({
                    type: 'github',
                    name: 'GitHub Repository',
                    url: formatExternalUrl(githubUrl)
                });
            }
            if (demoUrl) {
                allLinks.push({
                    type: 'youtube',
                    name: 'Demo Video',
                    url: formatExternalUrl(demoUrl)
                });
            }

            document.querySelectorAll('.cp-custom-link-row').forEach(row => {
                const name = row.querySelector('.cp-custom-link-name')?.value.trim();
                const url = row.querySelector('.cp-custom-link-url')?.value.trim();
                if (url) {
                    allLinks.push({
                        type: detectLinkType(url, 'custom'),
                        name: name || 'Project Resource',
                        url: formatExternalUrl(url)
                    });
                }
            });

            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                <span>Submitting Proposal...</span>
            `;

            const { data, error } = await ICCSupabase.createProjectApplication({
                projectName: projectName,
                project_name: projectName,
                teamName: teamName,
                team_name: teamName,
                description: cleanHtml,
                specialties: specialties,
                links: allLinks
            });

            if (error) {
                Toast.error('Failed to submit proposal: ' + error.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Submit Proposal</span>';
                return;
            }

            Toast.success('Project proposal submitted! A mentor will review it shortly.');
            close();
            openMyApplicationsModal(data.id);
        });
    }

    async function openMyApplicationsModal(highlightAppId = null) {
        const user = ICCSupabase.getUser();
        if (!user) {
            if (typeof AuthModal !== 'undefined') AuthModal.open();
            return;
        }

        const existing = document.getElementById('my-applications-modal');
        if (existing) existing.remove();

        // Create base modal wrapper with loading state
        const modalHtml = `
        <div id="my-applications-modal" class="fixed inset-0 z-[2500] bg-zinc-950 text-white w-full h-full min-h-screen flex flex-col overflow-hidden animate-fade-in">
            <!-- Full Width Top Navigation Bar -->
            <header class="h-16 px-4 sm:px-6 md:px-8 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 z-20">
                <div class="flex items-center gap-3 min-w-0">
                    <button id="back-my-apps-btn" type="button" class="flex items-center gap-2 px-3.5 py-1.5 text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm" title="Back to Projects Directory">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                        <span>Back</span>
                    </button>
                    <div class="h-5 w-px bg-zinc-800 hidden sm:block"></div>
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 flex-shrink-0">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        </div>
                        <div class="min-w-0">
                            <h1 class="font-heading font-bold text-base sm:text-lg text-white leading-tight truncate">My Project Applications</h1>
                            <p class="text-[11px] text-zinc-400 hidden sm:block truncate">Track approval status, mentor feedback & revisions</p>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2.5 flex-shrink-0">
                    <button id="my-apps-new-btn" type="button" class="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                        <span class="hidden sm:inline">New Proposal</span>
                    </button>
                    <button id="close-my-apps-modal" type="button" class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer" title="Close Page">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            </header>

            <!-- Fullscreen Studio Content Area -->
            <main id="my-apps-content" class="flex-1 h-[calc(100vh-64px)] overflow-hidden">
                <div class="flex flex-col items-center justify-center h-full text-zinc-500 text-sm gap-3">
                    <div class="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p class="text-xs text-zinc-400">Loading your project proposals...</p>
                </div>
            </main>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('my-applications-modal');
        let currentUnsubComments = null;

        const cleanupCommentsSub = () => {
            if (currentUnsubComments) {
                try {
                    if (typeof currentUnsubComments === 'function') {
                        currentUnsubComments();
                    } else if (typeof ICCSupabase.unsubscribeChannel === 'function') {
                        ICCSupabase.unsubscribeChannel(currentUnsubComments);
                    }
                } catch (e) {
                    console.warn('Could not cleanup comments sub:', e);
                }
                currentUnsubComments = null;
            }
        };

        const close = () => {
            cleanupCommentsSub();
            document.removeEventListener('keydown', onEsc);
            modal?.remove();
        };

        const onEsc = (e) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', onEsc);

        document.getElementById('back-my-apps-btn')?.addEventListener('click', close);
        document.getElementById('close-my-apps-modal')?.addEventListener('click', close);
        document.getElementById('my-apps-new-btn')?.addEventListener('click', () => {
            close();
            openCreateProjectModal();
        });
        modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });

        async function loadApplications() {
            const content = document.getElementById('my-apps-content');
            if (!content) return;

            const res = await ICCSupabase.fetchMyProjectApplications();
            const allApps = Array.isArray(res) ? res : (res?.data || []);
            const error = res?.error || null;
            if (error) {
                content.innerHTML = `
                    <div class="flex items-center justify-center h-full p-6">
                        <div class="max-w-md w-full p-6 text-center text-rose-400 bg-rose-500/10 rounded-2xl border border-rose-500/20 space-y-2">
                            <p class="font-bold text-sm">Failed to load applications</p>
                            <p class="text-xs text-rose-300">${escapeHtml(error.message)}</p>
                            <button onclick="document.getElementById('back-my-apps-btn')?.click()" class="mt-3 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold">
                                Return to Projects
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            // Exclude applications that are approved and now live in Projects
            const apps = allApps.filter(app => String(app.status || '').trim().toLowerCase() !== 'approved');

            if (!apps || apps.length === 0) {
                const hasApprovedProjects = allApps.some(app => String(app.status || '').trim().toLowerCase() === 'approved');
                content.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-center px-4 space-y-4">
                        <div class="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                        </div>
                        <div class="space-y-1">
                            <h4 class="font-bold text-white text-base">${hasApprovedProjects ? 'All Proposals Approved & Live!' : 'No Applications Yet'}</h4>
                            <p class="text-xs text-zinc-400 max-w-sm">${hasApprovedProjects ? 'Your project proposal has been approved and is now active and live in the Projects directory. You have no pending applications.' : 'You have not submitted any project applications. Submit your innovation project proposal to get reviewed by mentors.'}</p>
                        </div>
                        <div class="flex items-center gap-3 pt-2 flex-wrap justify-center">
                            ${hasApprovedProjects ? `
                                <button onclick="document.getElementById('back-my-apps-btn')?.click()" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer">
                                    Explore Projects
                                </button>
                            ` : ''}
                            <button onclick="document.getElementById('my-apps-new-btn')?.click()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer">
                                + Create New Proposal
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            let selectedAppId = highlightAppId || apps[0]?.id;
            renderMasterDetail(apps, selectedAppId);
        }

        async function renderMasterDetail(apps, activeAppId) {
            const content = document.getElementById('my-apps-content');
            if (!content) return;

            const activeApp = apps.find(a => a.id === activeAppId) || apps[0];
            if (!activeApp) return;

            // Fetch active app comments and status history
            const { data: details } = await ICCSupabase.fetchApplicationDetails(activeApp.id);
            const comments = details?.comments || [];
            const history = details?.history || [];

            // Setup realtime subscription for comments
            cleanupCommentsSub();
            try {
                currentUnsubComments = ICCSupabase.subscribeToApplicationComments(activeApp.id, async () => {
                    const refreshed = await ICCSupabase.fetchApplicationDetails(activeApp.id);
                    if (refreshed?.data?.comments) {
                        renderCommentsList(refreshed.data.comments);
                    }
                });
            } catch (err) {
                console.warn('Realtime comments subscription warning:', err);
            }

            const normStatus = (st) => String(st || '').toLowerCase().replace(/[\s_-]+/g, '_');
            const statusBadge = (status) => {
                const s = normStatus(status);
                if (s === 'approved') return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400">✓ Approved</span>`;
                if (s === 'changes_requested') return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400">⚠️ Changes Requested</span>`;
                return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block mr-1 animate-pulse"></span>Pending Review</span>`;
            };

            const activeAppStatusKey = normStatus(activeApp.status);

            // Extract the latest mentor change request note from status history or comments
            const latestChangeHistory = [...history].reverse().find(h => {
                const s = normStatus(h.new_status || h.to_status);
                return s === 'changes_requested' && (h.comment || h.notes);
            });
            const latestFeedbackComment = [...comments].reverse().find(c => {
                return c.is_mentor_feedback && (c.content || c.comment);
            });
            const mentorChangeComment = latestChangeHistory?.comment 
                || latestChangeHistory?.notes 
                || latestFeedbackComment?.content 
                || latestFeedbackComment?.comment 
                || activeApp.changes_requested_comment 
                || '';
            const mentorChangerName = latestChangeHistory?.changer?.full_name 
                || latestFeedbackComment?.author?.full_name 
                || (activeApp.reviewer?.full_name) 
                || 'Mentor';
            const mentorChangeDate = latestChangeHistory?.created_at || latestFeedbackComment?.created_at;

            content.innerHTML = `
            <div class="h-full flex flex-col lg:flex-row overflow-hidden">
                <!-- Left Sidebar: Applications List (Fixed Width on Desktop) -->
                <aside class="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-900/40 flex flex-col flex-shrink-0 h-64 lg:h-full overflow-hidden">
                    <div class="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60 flex-shrink-0">
                        <h2 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Submissions (${apps.length})</h2>
                        <span class="text-[11px] text-zinc-500">Select to inspect</span>
                    </div>
                    <div class="flex-1 overflow-y-auto p-3 space-y-2">
                        ${apps.map(app => `
                            <div class="app-item-card p-3.5 rounded-xl border transition-all cursor-pointer ${app.id === activeApp.id ? 'bg-zinc-800 border-zinc-700 shadow-md ring-1 ring-emerald-500/30' : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/40'}" data-app-id="${app.id}">
                                <div class="flex items-start justify-between gap-2">
                                    <h3 class="font-bold text-sm text-white truncate flex-1">${escapeHtml(app.project_name)}</h3>
                                    ${statusBadge(app.status)}
                                </div>
                                <p class="text-[11px] text-zinc-400 truncate mt-1">Team: <span class="text-zinc-300 font-medium">${escapeHtml(app.team_name || app.project_name)}</span></p>
                                <div class="flex items-center justify-between text-[10px] text-zinc-500 mt-2.5 pt-2 border-t border-zinc-800/50">
                                    <span class="font-mono">Rev #${app.revision_number || 1}</span>
                                    <span>${new Date(app.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </aside>

                <!-- Right Main Dossier: Active Application, Revisions & Comments -->
                <section class="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-zinc-950">
                    <div class="max-w-4xl mx-auto space-y-6">
                        <!-- Status Notification Banner -->
                        ${activeAppStatusKey === 'changes_requested' ? `
                            <div class="p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-4 text-rose-300 shadow-sm">
                                <div class="flex items-center justify-between gap-3 flex-wrap">
                                    <div class="flex items-center gap-2">
                                        <span class="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                                        <h4 class="font-bold text-sm text-rose-200">Mentor Requested Changes</h4>
                                    </div>
                                    ${mentorChangeDate ? `<span class="text-[11px] text-zinc-400 font-mono">${new Date(mentorChangeDate).toLocaleString()}</span>` : ''}
                                </div>

                                <!-- Mentor Requested Changes Description Card -->
                                <div class="p-4 bg-zinc-950/90 border border-rose-500/40 rounded-xl space-y-2">
                                    <div class="flex items-center justify-between flex-wrap gap-2">
                                        <span class="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <svg class="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                                            Mentor Feedback & Requested Modifications:
                                        </span>
                                        <span class="text-[11px] text-zinc-400 font-medium">Reviewer: <strong class="text-zinc-200">${escapeHtml(mentorChangerName)}</strong></span>
                                    </div>
                                    <div class="text-xs sm:text-sm text-zinc-100 leading-relaxed italic bg-zinc-900/80 p-3.5 rounded-xl whitespace-pre-wrap font-sans">
"${escapeHtml(mentorChangeComment || 'Please review mentor recommendations, revise the proposal overview, architecture, or resource links, and resubmit for review.')}"
                                    </div>
                                </div>

                                <div class="flex items-center justify-between flex-wrap gap-2 pt-1">
                                    <p class="text-xs text-rose-300 leading-relaxed">
                                        Review the feedback above, modify your proposal details in the editor below, and click <span class="font-bold text-white underline">"Resubmit for Review"</span>.
                                    </p>
                                    <button id="toggle-resubmit-form-btn" class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer inline-flex items-center gap-1.5 active:scale-95">
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                        <span>Edit & Resubmit Proposal</span>
                                    </button>
                                </div>
                            </div>
                        ` : activeAppStatusKey === 'approved' ? `
                            <div class="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between flex-wrap gap-4 text-emerald-300 shadow-sm">
                                <div class="space-y-1">
                                    <div class="flex items-center gap-2">
                                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                                        <h4 class="font-bold text-sm text-emerald-200">Project Approved & Live!</h4>
                                    </div>
                                    <p class="text-xs text-emerald-300">
                                        Congratulations! Your project is published in the public directory and you are appointed as Project Lead.
                                    </p>
                                </div>
                                ${activeApp.project_code ? `
                                    <div class="px-4 py-2 bg-emerald-500/15 rounded-xl flex items-center gap-2.5">
                                        <span class="text-xs text-zinc-400 font-medium">Project Code:</span>
                                        <span class="font-mono font-bold text-emerald-400 text-sm tracking-wide">${escapeHtml(activeApp.project_code)}</span>
                                    </div>
                                ` : ''}
                            </div>
                        ` : `
                            <div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-300 text-xs shadow-sm">
                                <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"></span>
                                <div>
                                    <span class="font-bold">Under Mentor Review:</span> Your proposal is currently in the mentor review queue. Mentors will examine your problem statement, architecture, and attached resources.
                                </div>
                            </div>
                        `}

                        <!-- Resubmission Form (Visible when toggled or when changes requested) -->
                        <div id="resubmit-form-card" class="${activeAppStatusKey === 'changes_requested' ? '' : 'hidden'} p-5 sm:p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-4 shadow-md">
                            <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <h4 class="font-bold text-sm text-white flex items-center gap-2">
                                    <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                    <span>Edit & Resubmit Proposal (Revision ${(activeApp.revision_number || 1) + 1})</span>
                                </h4>
                                <span class="text-[11px] text-zinc-500">Incremental Revision</span>
                            </div>
                            <form id="resubmit-app-form" class="space-y-4">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Project Name *</label>
                                        <input type="text" id="rs-name" required value="${escapeHtml(activeApp.project_name)}"
                                               class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none transition-colors">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Team Name</label>
                                        <input type="text" id="rs-team" value="${escapeHtml(activeApp.team_name || '')}"
                                               class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none transition-colors">
                                    </div>
                                </div>
                                <div>
                                    <div class="flex items-center justify-between pb-1.5">
                                        <label class="block text-xs font-semibold text-zinc-300">Description & Vision *</label>
                                        <span class="text-[10px] text-zinc-500">Rich Text Formatted</span>
                                    </div>
                                    ${renderRichEditorToolbar('rs-desc-toolbar')}
                                    <div id="rs-desc-editor" contenteditable="true"
                                         class="prose-clean min-h-[160px] max-h-[360px] overflow-y-auto p-3.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-zinc-200 outline-none leading-relaxed mt-1">
                                        ${sanitizeRichText(activeApp.description)}
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-zinc-300 mb-1.5">Specialties / Tags (comma-separated)</label>
                                    <input type="text" id="rs-specialties" value="${escapeHtml(Array.isArray(activeApp.specialties) ? activeApp.specialties.join(', ') : (activeApp.specialties || ''))}"
                                           class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-white outline-none transition-colors">
                                </div>

                                <!-- Custom Links in Resubmit Form -->
                                <div class="space-y-2 pt-1">
                                    <div class="flex items-center justify-between">
                                        <label class="block text-xs font-semibold text-zinc-300">Attached Links & Custom Resources</label>
                                        <button type="button" id="rs-add-link-btn" class="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer flex items-center gap-1">
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                            <span>Add Link</span>
                                        </button>
                                    </div>
                                    <div id="rs-custom-links-container" class="space-y-2">
                                        ${(Array.isArray(activeApp.links) ? activeApp.links : []).map(l => `
                                            <div class="rs-link-row flex items-center gap-2 p-1.5 bg-zinc-950 border border-zinc-800 rounded-xl">
                                                <input type="text" class="rs-link-name text-xs w-2/5 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-white" placeholder="Label (e.g. Figma)" value="${escapeHtml(l.name || '')}">
                                                <input type="url" class="rs-link-url text-xs flex-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-white" placeholder="https://..." value="${escapeHtml(l.url || '')}">
                                                <button type="button" class="rs-remove-link-btn p-1 text-zinc-500 hover:text-rose-400 rounded cursor-pointer" title="Remove"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-xs font-semibold text-emerald-400 mb-1.5">Applicant Note / Explanation of Changes <span class="text-zinc-500 font-normal">(Optional)</span></label>
                                    <textarea id="rs-note" rows="2" placeholder="Describe what revisions and improvements you made in response to mentor comments..."
                                              class="w-full px-3 py-2 bg-zinc-950 border border-emerald-500/40 rounded-xl text-xs text-white focus:border-emerald-500 outline-none resize-none leading-relaxed"></textarea>
                                </div>
                                <div class="flex items-center justify-end gap-2 pt-1">
                                    <button type="submit" id="rs-submit-btn" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5">
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                                        <span>Resubmit for Mentor Review</span>
                                    </button>
                                </div>
                            </form>
                        </div>

                        <!-- Application Overview Card -->
                        <div class="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                            <div class="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                    <h3 class="font-heading font-bold text-lg text-white">${escapeHtml(activeApp.project_name)}</h3>
                                    <p class="text-xs text-zinc-400 mt-0.5">Team: <span class="text-zinc-200 font-semibold">${escapeHtml(activeApp.team_name || activeApp.project_name)}</span></p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="px-2.5 py-0.5 bg-zinc-900/80 text-zinc-400 rounded-full text-[11px] font-mono">
                                        Revision #${activeApp.revision_number || 1}
                                    </span>
                                    ${statusBadge(activeApp.status)}
                                </div>
                            </div>

                            <div class="pt-2 border-t border-zinc-800/60">
                                <h4 class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Description & Vision</h4>
                                <div class="text-xs sm:text-sm text-zinc-200 leading-relaxed prose-clean bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/60">
                                    ${sanitizeRichText(activeApp.description)}
                                </div>
                            </div>

                            ${Array.isArray(activeApp.specialties) && activeApp.specialties.length > 0 ? `
                                <div class="pt-2 border-t border-zinc-800/60">
                                    <h4 class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Domains & Specialties</h4>
                                    <div class="flex flex-wrap gap-1.5">
                                        ${activeApp.specialties.map(s => `<span class="px-2.5 py-1 bg-zinc-900/80 text-zinc-300 rounded-lg text-xs font-medium">${escapeHtml(s)}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            ${Array.isArray(activeApp.links) && activeApp.links.length > 0 ? `
                                <div class="pt-2 border-t border-zinc-800/60">
                                    <h4 class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Attached Links & Resources</h4>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        ${activeApp.links.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="p-2.5 bg-zinc-950/70 hover:bg-zinc-800/70 border border-zinc-800 hover:border-emerald-500/40 text-emerald-400 rounded-xl text-xs flex items-center justify-between transition-colors"><span>🔗 ${escapeHtml(l.name || l.url)}</span><svg class="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Discussion & Comment Thread with Mentors -->
                        <div class="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                            <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
                                <h4 class="font-heading font-bold text-sm text-white flex items-center gap-2">
                                    <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                                    <span>Mentor Review Discussion & Comments</span>
                                </h4>
                                <span id="comments-count-pill" class="px-2.5 py-0.5 bg-zinc-800/80 text-zinc-300 rounded-full text-[10px] font-bold">
                                    ${comments.length} message${comments.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            <!-- Comments List -->
                            <div id="app-comments-list" class="space-y-3 max-h-72 overflow-y-auto pr-1">
                                ${comments.length === 0 ? `
                                    <p class="text-xs text-zinc-500 py-4 text-center italic">No comments yet. When mentors review your proposal, their notes and questions will appear here.</p>
                                ` : comments.map(c => {
                                    const isFeedback = c.is_mentor_feedback || c.author?.role === 'mentor' || c.user_role === 'mentor';
                                    const authorName = c.author?.full_name || c.profiles?.full_name || (c.author_id === ICCSupabase.getUser()?.id ? 'You' : 'User');
                                    const authorRole = (c.author?.role || c.user_role || '').toLowerCase();
                                    const roleBadge = isFeedback ? '🎓 Mentor' : (authorRole === 'superadmin' || authorRole === 'super_admin' ? '⚡ Super Admin' : 'Applicant');
                                    const messageText = c.content || c.comment || '';
                                    return `
                                    <div class="p-3.5 rounded-xl border ${isFeedback ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-zinc-950/70 border-zinc-800'} space-y-1.5">
                                        <div class="flex items-center justify-between text-xs">
                                            <div class="flex items-center gap-2">
                                                <span class="font-bold text-white">${escapeHtml(authorName)}</span>
                                                <span class="text-[10px] font-bold ${isFeedback ? 'text-emerald-400' : 'text-zinc-400'}">
                                                    ${roleBadge}
                                                </span>
                                            </div>
                                            <span class="text-[10px] text-zinc-500">${c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                                        </div>
                                        <p class="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(messageText)}</p>
                                    </div>
                                    `;
                                }).join('')}
                            </div>

                            <!-- Post Reply Box with Visual Feedback -->
                            <form id="post-comment-form" class="space-y-2.5 pt-3 border-t border-zinc-800">
                                <textarea id="new-comment-text" rows="2" placeholder="Write a reply or question for mentors..."
                                          class="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-white placeholder-zinc-500 outline-none resize-none leading-relaxed transition-colors"></textarea>
                                <div class="flex justify-end">
                                    <button type="submit" id="send-comment-btn" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5">
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                                        <span>Send Message</span>
                                    </button>
                                </div>
                            </form>
                        </div>

                        <!-- Status History Timeline -->
                        ${history.length > 0 ? `
                            <div class="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-3 shadow-sm">
                                <h4 class="font-heading font-bold text-xs uppercase tracking-wider text-zinc-400">Status History & Audit Trail</h4>
                                <div class="space-y-2 text-xs">
                                    ${history.map(h => {
                                        const fromSt = h.previous_status || h.from_status || 'Submitted';
                                        const toSt = h.new_status || h.to_status || 'Pending Review';
                                        const noteText = h.comment || h.notes || '';
                                        return `
                                        <div class="flex items-start gap-2.5 p-2.5 bg-zinc-950/60 rounded-xl border border-zinc-800/50">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></span>
                                            <div class="flex-1 min-w-0">
                                                <p class="text-white font-medium">Status: <span class="text-zinc-400">${escapeHtml(fromSt)}</span> → <span class="font-bold text-emerald-400">${escapeHtml(toSt)}</span></p>
                                                ${noteText ? `<p class="text-zinc-400 text-[11px] mt-0.5">${escapeHtml(noteText)}</p>` : ''}
                                                <p class="text-[10px] text-zinc-500 mt-0.5">${h.created_at ? new Date(h.created_at).toLocaleString() : ''}</p>
                                            </div>
                                        </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </section>
            </div>
            `;

            // Card click listener for switching applications
            document.querySelectorAll('.app-item-card').forEach(card => {
                card.onclick = () => {
                    const appId = card.dataset.appId;
                    renderMasterDetail(apps, appId);
                };
            });

            // Bind rich text editor for resubmission
            const rsDescEditor = document.getElementById('rs-desc-editor');
            bindRichEditorToolbar('rs-desc-toolbar', rsDescEditor);

            // Resubmit custom links handling
            const rsLinksContainer = document.getElementById('rs-custom-links-container');
            document.querySelectorAll('.rs-remove-link-btn').forEach(btn => {
                btn.addEventListener('click', (e) => e.target.closest('.rs-link-row')?.remove());
            });

            document.getElementById('rs-add-link-btn')?.addEventListener('click', () => {
                if (!rsLinksContainer) return;
                const row = document.createElement('div');
                row.className = 'rs-link-row flex items-center gap-2 p-1.5 bg-zinc-950 border border-zinc-800 rounded-xl animate-fade-in';
                row.innerHTML = `
                    <input type="text" class="rs-link-name text-xs w-2/5 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-white" placeholder="Label (e.g. Docs)">
                    <input type="url" class="rs-link-url text-xs flex-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-white" placeholder="https://...">
                    <button type="button" class="rs-remove-link-btn p-1 text-zinc-500 hover:text-rose-400 rounded cursor-pointer" title="Remove"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                `;
                row.querySelector('.rs-remove-link-btn').addEventListener('click', () => row.remove());
                rsLinksContainer.appendChild(row);
            });

            // Toggle resubmit form
            document.getElementById('toggle-resubmit-form-btn')?.addEventListener('click', () => {
                const card = document.getElementById('resubmit-form-card');
                if (card) {
                    card.classList.toggle('hidden');
                    if (!card.classList.contains('hidden')) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });

            // Resubmit application handler with Visual Feedback
            document.getElementById('resubmit-app-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('rs-submit-btn');
                const name = document.getElementById('rs-name')?.value.trim();
                const team = document.getElementById('rs-team')?.value.trim();
                const rawHtml = rsDescEditor ? rsDescEditor.innerHTML.trim() : '';
                const textOnly = rsDescEditor ? rsDescEditor.textContent.trim() : '';
                const spec = document.getElementById('rs-specialties')?.value.trim();
                const note = document.getElementById('rs-note')?.value.trim();

                if (!name) {
                    Toast.error('Project name is required.');
                    return;
                }
                if (!textOnly || textOnly.length < 10) {
                    Toast.error('Please enter a descriptive project overview & vision (at least 10 characters).');
                    rsDescEditor?.focus();
                    return;
                }

                const finalNote = note || 'Applicant updated project proposal based on mentor feedback.';
                const cleanHtml = sanitizeRichText(rawHtml);
                const allLinks = [];
                document.querySelectorAll('.rs-link-row').forEach(row => {
                    const lName = row.querySelector('.rs-link-name')?.value.trim();
                    const lUrl = row.querySelector('.rs-link-url')?.value.trim();
                    if (lUrl) {
                        allLinks.push({
                            type: detectLinkType(lUrl, 'custom'),
                            name: lName || 'Project Resource',
                            url: formatExternalUrl(lUrl)
                        });
                    }
                });

                // Immediate visual feedback
                btn.disabled = true;
                const originalBtnHtml = btn.innerHTML;
                btn.innerHTML = `
                    <svg class="w-3.5 h-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                    <span>Resubmitting Proposal...</span>
                `;

                const { data, error } = await ICCSupabase.resubmitProjectApplication(activeApp.id, {
                    projectName: name,
                    project_name: name,
                    teamName: team || name,
                    team_name: team || name,
                    description: cleanHtml,
                    specialties: spec ? spec.split(',').map(s => s.trim()).filter(Boolean) : [],
                    links: allLinks
                }, finalNote);

                if (error) {
                    Toast.error('Failed to resubmit: ' + (error.message || error));
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHtml;
                } else {
                    Toast.success('Proposal resubmitted for mentor review!');
                    await loadApplications(activeApp.id);
                }
            });

            // Post reply comment handler with Visual Feedback
            document.getElementById('post-comment-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = document.getElementById('new-comment-text');
                const comment = input?.value.trim();
                if (!comment) return;

                const btn = document.getElementById('send-comment-btn');
                btn.disabled = true;
                const originalBtnHtml = btn.innerHTML;
                btn.innerHTML = `
                    <svg class="w-3.5 h-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                    <span>Sending...</span>
                `;

                const { data, error } = await ICCSupabase.addApplicationComment(activeApp.id, comment);
                if (error) {
                    Toast.error('Failed to send comment: ' + error.message);
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHtml;
                } else {
                    Toast.success('Reply sent successfully');
                    input.value = '';
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHtml;
                    const refreshed = await ICCSupabase.fetchApplicationDetails(activeApp.id);
                    if (refreshed?.data?.comments) {
                        renderCommentsList(refreshed.data.comments);
                        const list = document.getElementById('app-comments-list');
                        if (list) list.scrollTop = list.scrollHeight;
                    }
                }
            });
        }

        function renderCommentsList(comments) {
            const list = document.getElementById('app-comments-list');
            const pill = document.getElementById('comments-count-pill');
            if (pill) pill.textContent = `${comments.length} message${comments.length === 1 ? '' : 's'}`;
            if (!list) return;

            if (comments.length === 0) {
                list.innerHTML = `<p class="text-xs text-zinc-500 py-3 text-center italic">No comments yet. When mentors review your proposal, their notes will appear here.</p>`;
                return;
            }

            list.innerHTML = comments.map(c => {
                const isFeedback = c.is_mentor_feedback || c.author?.role === 'mentor' || c.user_role === 'mentor';
                const authorName = c.author?.full_name || c.profiles?.full_name || (c.author_id === ICCSupabase.getUser()?.id ? 'You' : 'User');
                const authorRole = (c.author?.role || c.user_role || '').toLowerCase();
                const roleBadge = isFeedback ? '🎓 Mentor' : (authorRole === 'superadmin' || authorRole === 'super_admin' ? '⚡ Super Admin' : 'Applicant');
                const messageText = c.content || c.comment || '';
                return `
                <div class="p-3 rounded-xl border ${isFeedback ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-zinc-900 border-zinc-800'} space-y-1">
                    <div class="flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-white">${escapeHtml(authorName)}</span>
                            <span class="text-[10px] font-bold ${isFeedback ? 'text-emerald-400' : 'text-zinc-400'}">
                                ${roleBadge}
                            </span>
                        </div>
                        <span class="text-[10px] text-zinc-500">${c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                    </div>
                    <p class="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(messageText)}</p>
                </div>
                `;
            }).join('');
            list.scrollTop = list.scrollHeight;
        }

        await loadApplications();
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
        <div class="workforce-member-item group flex flex-col items-center justify-start text-center relative select-none w-full max-w-[100px] sm:max-w-[115px] lg:max-w-[125px]" 
             style="animation-delay:${i * 0.04}s">
            
            <!-- Circular Avatar: Clean, uniform circular style -->
            <div class="open-user-profile cursor-pointer relative" data-id="${m.id}" title="View ${escapeHtml(name)}'s Profile">
                <div class="w-13 h-13 sm:w-14 sm:h-14 lg:w-15 lg:h-15 rounded-full overflow-hidden shadow-md ring-2 ring-zinc-800/90 group-hover:ring-emerald-500/80 group-hover:scale-105 transition-all duration-300 flex items-center justify-center bg-zinc-900 relative">
                    <img src="${avatarSrc}" 
                         alt="${escapeHtml(name)}" 
                         class="w-full h-full object-cover rounded-full" 
                         onerror="this.onerror=null;this.src='${fallbackAvatar}';">
                </div>
            </div>

            <!-- Member Full Name (Completely visible, no truncation) -->
            <h4 class="open-user-profile text-[11px] sm:text-xs font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors text-center break-words w-full px-0.5 mt-1 cursor-pointer leading-tight" 
                data-id="${m.id}" 
                title="View ${escapeHtml(name)}'s Profile">
                ${escapeHtml(name)}${m.role === 'mentor' || m.is_mentor ? ICC_CONFIG.MENTOR_TICK : (isThisMemberLead ? ICC_CONFIG.VERIFIED_TICK : '')}
            </h4>

            <!-- Member Tag below the name: Simple text for all members including leader -->
            ${tag ? `
                <span class="inline-flex items-center justify-center px-2 py-0.5 mt-0.5 text-[9px] sm:text-[10px] font-medium text-emerald-400 bg-emerald-500/15 rounded-full max-w-full break-words text-center leading-tight">
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
        <div class="glass-card rounded-2xl p-4 sm:p-5 lg:p-6 border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl">
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

    
    function isUserJoinedProject(lead, profile, user) {
        if (!lead) return false;
        const leadId = Number(lead.id);
        const userId = user?.id || profile?.id;
        
        // 1. Direct creator / project lead match from core_leads
        if (lead.lead_user_id && userId && String(lead.lead_user_id) === String(userId)) return true;

        // 2. Direct role & team_id match
        if (profile?.team_id && Number(profile.team_id) === leadId) return true;

        // 3. User is in memberships
        if (Array.isArray(profile?.memberships) && profile.memberships.map(Number).includes(leadId)) return true;

        // 4. Name or email match
        if (profile?.full_name && lead.name && profile.full_name.trim().toLowerCase() === lead.name.trim().toLowerCase()) return true;
        if (profile?.email && lead.email && profile.email.trim().toLowerCase() === lead.email.trim().toLowerCase()) return true;

        return false;
    }

    function renderGrid() {
        const user = ICCSupabase.getUser();
        const profile = ICCSupabase.getProfile();
        const userTeamId = profile?.team_id;

        // Projects which the user joined or leads are listed on the top of the list
        const sortedLeads = [...CORE_LEADS].sort((a, b) => {
            const aJoined = isUserJoinedProject(a, profile, user);
            const bJoined = isUserJoinedProject(b, profile, user);
            if (aJoined && !bJoined) return -1;
            if (!aJoined && bJoined) return 1;
            return 0;
        });
        return `
        <section class="min-h-screen pt-2 pb-8 px-2.5 sm:px-4 md:px-6 lg:px-8 xl:px-10" id="teams-section">
            <div class="w-full max-w-[1760px] mx-auto">
                <!-- Top Navigation Bar with Back Button & Actions -->
                <div class="mb-4 flex items-center justify-between gap-3 flex-wrap">
                    <button id="teams-grid-back-btn" onclick="window.location.hash='#dashboard'" class="flex items-center gap-2 px-3.5 py-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 group" title="Return to Dashboard">
                        <svg class="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        <span>Back to Dashboard</span>
                    </button>
                    
                    <div class="flex items-center gap-2.5">
                        ${user ? `
                            <button id="open-my-apps-btn" onclick="TeamsView.openMyApplicationsModal()" class="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95" title="Track your project proposals and mentor review status">
                                <svg class="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                <span>My Applications</span>
                            </button>
                        ` : ''}

                        <button id="open-create-proj-btn" onclick="TeamsView.openCreateProjectModal()" class="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer" title="Submit a new project proposal for mentor review">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                            <span>+ Create Project</span>
                        </button>
                    </div>
                </div>

                <div class="text-center mb-8 px-2">
                    <p class="text-emerald-500 text-xs font-semibold tracking-widest uppercase mb-2">Projects</p>
                    <h1 class="font-heading font-bold text-2xl sm:text-3xl mb-2">Explore <span class="gradient-text-static">Projects</span></h1>
                    <p class="text-zinc-500 text-sm max-w-md mx-auto">Discover student-led innovation projects and collaborate with creators.</p>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4" id="leads-grid">
                    ${sortedLeads.map((lead, i) => {
            const isJoined = isUserJoinedProject(lead, profile, user);
            const isMember = isJoined || (profile?.memberships && profile.memberships.map(Number).includes(Number(lead.id)));
            const isPending = profile?.pending_teams && profile.pending_teams.map(Number).includes(Number(lead.id));
            const isLead = (lead.lead_user_id && user && String(lead.lead_user_id) === String(user.id)) || (profile?.role === 'lead' && Number(profile?.team_id) === Number(lead.id));
            
            const milestones = lead.milestones || {};
            const completedCount = MILESTONE_PHASES.filter(p => milestones[p.id]).length;
            const progress = Math.round((completedCount / MILESTONE_PHASES.length) * 100);

            return `
                        <div class="lead-card bg-zinc-900/60 border ${isJoined ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30' : 'border-zinc-800/50'} rounded-xl overflow-hidden cursor-pointer group" data-lead-id="${lead.id}" style="animation:slideUp 0.4s ease-out ${i * 0.05}s both">
                            <div class="relative h-28 sm:h-36 overflow-hidden bg-gradient-to-br ${lead.gradient}">
                                <div class="portrait absolute inset-0 flex items-center justify-center">
                                    <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-950/40 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center overflow-hidden">
                                        ${lead.avatar_url ? `<img src="${lead.avatar_url}" class="w-full h-full object-cover">` : `<span class="font-heading font-bold text-xl text-white/90">${lead.initials}</span>`}
                                    </div>
                                </div>
                                <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-60"></div>
                                ${isJoined ? `<div class="absolute top-2 right-2 px-2 py-0.5 bg-emerald-600 rounded-full text-[10px] font-bold flex items-center gap-1 z-10 text-white shadow-md">✓ ${isLead ? 'Lead' : 'Joined'}</div>` : ''}
                                ${(!isJoined && isPending) ? `<div class="absolute top-2 right-2 px-2 py-0.5 bg-amber-600 rounded-full text-[10px] font-bold flex items-center gap-1 z-10 animate-pulse text-white">⏳ Pending</div>` : ''}
                            </div>
                            <div class="p-3">
                                <h3 class="font-heading font-bold text-sm sm:text-base text-white truncate" title="${lead.project_name || lead.team}">${lead.project_name || lead.team}</h3>
                                <p class="text-zinc-400 text-[11px] mt-0.5 truncate font-medium">Team: <span class="text-zinc-300 font-semibold">${lead.team}</span></p>
                                <p class="text-zinc-500 text-[10px] mt-0.5 truncate">Lead: <span class="text-zinc-400">${lead.name}${lead.role === 'mentor' ? ICC_CONFIG.MENTOR_TICK : ICC_CONFIG.VERIFIED_TICK}</span></p>
                                
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

    function getProjectLinks(lead) {
        if (!lead) return [];
        let links = lead.links;
        if (typeof links === 'string') {
            try { links = JSON.parse(links); } catch (e) { links = null; }
        }
        if (Array.isArray(links) && links.length > 0) {
            return links.filter(l => l && l.url && String(l.url).trim().length > 0);
        }

        let milestones = lead.milestones || {};
        if (typeof milestones === 'string') {
            try { milestones = JSON.parse(milestones); } catch (e) { milestones = {}; }
        }
        let projectLinks = milestones.project_links;
        if (typeof projectLinks === 'string') {
            try { projectLinks = JSON.parse(projectLinks); } catch (e) { projectLinks = null; }
        }
        if (Array.isArray(projectLinks) && projectLinks.length > 0) {
            return projectLinks.filter(l => l && l.url && String(l.url).trim().length > 0);
        }

        return [];
    }

    function formatExternalUrl(url) {
        if (!url) return '#';
        const trimmed = String(url).trim();
        if (!/^https?:\/\//i.test(trimmed)) {
            return 'https://' + trimmed;
        }
        return trimmed;
    }

    function detectLinkType(url, fallbackType = 'custom') {
        if (!url) return fallbackType;
        const lower = String(url).toLowerCase();
        if (lower.includes('github.com')) return 'github';
        if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
        if (lower.includes('figma.com')) return 'figma';
        if (lower.includes('docs.google.com') || lower.includes('drive.google.com')) return 'doc';
        return fallbackType || 'link';
    }

    function getDisplayUrl(url) {
        if (!url) return '';
        try {
            const formatted = formatExternalUrl(url);
            const u = new URL(formatted);
            const path = u.pathname.length > 1 ? (u.pathname.length > 25 ? u.pathname.substring(0, 25) + '…' : u.pathname) : '';
            return u.hostname + path;
        } catch (e) {
            return String(url).replace(/^https?:\/\//i, '').split('/')[0];
        }
    }

    function renderLinkCard(link) {
        const type = detectLinkType(link.url, link.type);
        const href = formatExternalUrl(link.url);
        const displayUrl = getDisplayUrl(link.url);

        let iconHtml = '';
        let borderHover = 'hover:border-zinc-700/80 hover:shadow-zinc-900/50';
        let badgeText = '';

        if (type === 'github') {
            iconHtml = `
            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>`;
            borderHover = 'hover:border-zinc-500 hover:shadow-black/60';
            badgeText = 'GitHub';
        } else if (type === 'youtube') {
            iconHtml = `
            <svg class="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>`;
            borderHover = 'hover:border-red-500/40 hover:shadow-red-950/30';
            badgeText = 'YouTube';
        } else if (type === 'figma') {
            iconHtml = `
            <svg class="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 24c2.208 0 4-1.792 4-4v-4H8c-2.208 0-4 1.792-4 4s1.792 4 4 4zM4 12c0-2.208 1.792-4 4-4h4v8H8c-2.208 0-4-1.792-4-4zm0-8c0-2.208 1.792-4 4-4h4v8H8C5.792 8 4 6.208 4 4zm8-4h4c2.208 0 4 1.792 4 4s-1.792 4-4 4h-4V0zm0 8h4c2.208 0 4 1.792 4 4s-1.792 4-4 4h-4V8z"/>
            </svg>`;
            borderHover = 'hover:border-purple-500/40 hover:shadow-purple-950/30';
            badgeText = 'Figma';
        } else {
            iconHtml = `
            <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>`;
            borderHover = 'hover:border-emerald-500/40 hover:shadow-emerald-950/30';
            badgeText = 'Link';
        }

        return `
        <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" 
           class="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/50 hover:bg-zinc-900/80 ${borderHover} transition-all duration-200 group cursor-pointer shadow-sm">
            <div class="flex items-center gap-3 min-w-0 pr-2">
                <div class="w-10 h-10 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                    ${iconHtml}
                </div>
                <div class="min-w-0">
                    <div class="flex items-center gap-2">
                        <p class="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate leading-tight">${escapeHtml(link.name || 'Project Resource')}</p>
                        ${badgeText ? `<span class="px-1.5 py-0.5 text-[9px] font-semibold rounded-md bg-zinc-900/80 text-zinc-400">${badgeText}</span>` : ''}
                    </div>
                    <p class="text-[11px] text-zinc-500 truncate mt-1 group-hover:text-zinc-400 transition-colors">${escapeHtml(displayUrl)}</p>
                </div>
            </div>
            <div class="p-1.5 rounded-lg text-zinc-500 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
            </div>
        </a>`;
    }

    function renderProjectLinksSection(lead, isLead) {
        const validLinks = getProjectLinks(lead);
        
        // If links are not pasted, it shouldn't show in the main modal
        if (validLinks.length === 0 && !isLead) {
            return '';
        }

        return `
        <div class="glass-card rounded-2xl p-4 sm:p-5 lg:p-6 border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl space-y-3.5" id="project-links-card">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                    <h3 class="font-heading font-semibold text-xs uppercase tracking-wider text-zinc-400">Project Links & Resources</h3>
                    ${validLinks.length > 0 ? `<span class="px-2 py-0.5 bg-zinc-900/80 rounded-full text-[10px] font-semibold text-zinc-400">${validLinks.length}</span>` : ''}
                </div>
                ${isLead ? `
                <button id="manage-links-btn" type="button" class="flex items-center gap-1.5 px-3 py-1 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 border border-zinc-800 hover:border-emerald-500/40 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95" title="Manage Project Links">
                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    <span>${validLinks.length > 0 ? 'Edit Links' : 'Add Links'}</span>
                </button>
                ` : ''}
            </div>

            ${validLinks.length > 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-1">
                ${validLinks.map(link => renderLinkCard(link)).join('')}
            </div>
            ` : isLead ? `
            <div class="p-4 rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/40 text-center">
                <p class="text-xs text-zinc-400 mb-2.5">No links added yet. Add your GitHub repository, YouTube video, or documentation.</p>
                <button type="button" onclick="document.getElementById('manage-links-btn')?.click()" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-800 hover:border-emerald-500/40 rounded-xl text-xs font-semibold transition-all cursor-pointer">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    <span>Add GitHub, YouTube & Links</span>
                </button>
            </div>
            ` : ''}
        </div>
        `;
    }

    
    /* =========================================================================
       IN-APP CONFIRMATION POPUP CARD (No native confirm dialogs)
       ========================================================================= */
    function showConfirmationPopup({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false, onConfirm }) {
        let root = document.getElementById('icc-confirm-popup-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'icc-confirm-popup-root';
            document.body.appendChild(root);
        }
        root.innerHTML = `
        <div class="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" id="confirm-popup-backdrop">
            <div class="glass-card rounded-2xl border border-zinc-800 bg-zinc-950 p-6 max-w-sm w-full space-y-4 shadow-2xl animate-zoom-in text-center">
                <div class="w-12 h-12 rounded-2xl ${isDanger ? 'bg-red-500/15 border border-red-500/30 text-red-400' : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'} flex items-center justify-center mx-auto shadow-md">
                    ${isDanger ? `
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    ` : `
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    `}
                </div>
                <div>
                    <h3 class="font-heading font-bold text-base text-white">${escapeHtml(title)}</h3>
                    <p class="text-xs text-zinc-400 mt-1 leading-relaxed">${escapeHtml(message)}</p>
                </div>
                <div class="flex items-center gap-2 pt-2">
                    <button type="button" id="confirm-popup-cancel-btn" class="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-zinc-800">
                        ${escapeHtml(cancelText)}
                    </button>
                    <button type="button" id="confirm-popup-action-btn" class="flex-1 py-2.5 ${isDanger ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'} rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer">
                        ${escapeHtml(confirmText)}
                    </button>
                </div>
            </div>
        </div>`;

        const close = () => { if (root) root.innerHTML = ''; };
        const cancelBtn = document.getElementById('confirm-popup-cancel-btn');
        const backdrop = document.getElementById('confirm-popup-backdrop');
        const actionBtn = document.getElementById('confirm-popup-action-btn');

        if (cancelBtn) cancelBtn.onclick = close;
        if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
        if (actionBtn) {
            actionBtn.onclick = async () => {
                close();
                if (typeof onConfirm === 'function') await onConfirm();
            };
        }
    }

    /* =========================================================================
       PAGE 2: MENTOR CHAT PAGE VIEW & REALTIME CONTROLLER
       ========================================================================= */
    // ==========================================
    // PROJECT TASKS SECTION (MENTOR ASSIGNMENT & COMPLETION)
    // ==========================================

    function renderTasksPage(lead, isLead, isMember, isMentorOrAdmin) {
        const user = ICCSupabase.getUser();
        const pendingCount = projectTasks.filter(t => t.status !== 'completed').length;
        const completedCount = projectTasks.filter(t => t.status === 'completed').length;

        const filteredTasks = projectTasks.filter(t => {
            if (currentTaskFilter === 'pending') return t.status !== 'completed';
            if (currentTaskFilter === 'completed') return t.status === 'completed';
            return true;
        });

        return `
        <div class="glass-card rounded-2xl p-4 sm:p-6 lg:p-7 border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl shadow-xl space-y-6">
            <!-- Header Bar -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
                <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 11l3 3L22 4"/>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="font-heading font-bold text-lg sm:text-xl text-white">Project Tasks & Deliverables</h2>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/20">
                                Mentor Workflow
                            </span>
                        </div>
                        <p class="text-xs text-zinc-400 mt-0.5">
                            Tasks assigned by project mentors to team members to drive execution and milestones.
                        </p>
                    </div>
                </div>

                <!-- Mentor/Admin Action -->
                ${isMentorOrAdmin ? `
                    <button id="open-add-task-modal-btn" type="button" class="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                        <span>+ Assign New Task</span>
                    </button>
                ` : ''}
            </div>

            <!-- Filter Pills -->
            <div class="flex items-center gap-2 flex-wrap">
                <button type="button" class="task-filter-pill px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${currentTaskFilter === 'all' ? 'bg-sky-600 text-white shadow-sm' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}" data-filter="all">
                    All (${projectTasks.length})
                </button>
                <button type="button" class="task-filter-pill px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${currentTaskFilter === 'pending' ? 'bg-amber-600 text-white shadow-sm' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}" data-filter="pending">
                    Pending (${pendingCount})
                </button>
                <button type="button" class="task-filter-pill px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${currentTaskFilter === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}" data-filter="completed">
                    Completed (${completedCount})
                </button>
            </div>

            <!-- Task List Container -->
            <div id="project-tasks-list-container" class="space-y-4">
                ${filteredTasks.length === 0 ? `
                    <div class="text-center py-12 px-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/60 space-y-3">
                        <div class="w-12 h-12 rounded-2xl bg-zinc-800/80 text-zinc-500 flex items-center justify-center mx-auto">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                            </svg>
                        </div>
                        <h4 class="font-heading font-semibold text-sm text-zinc-300">No tasks found</h4>
                        <p class="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                            ${currentTaskFilter === 'completed' 
                                ? 'No completed tasks yet. Team members can complete assigned tasks to show progress.'
                                : isMentorOrAdmin
                                    ? 'No tasks assigned yet. Click "+ Assign New Task" to assign work to a team member.'
                                    : 'No tasks currently assigned for this project. Mentors will assign action items here.'}
                        </p>
                    </div>
                ` : filteredTasks.map(t => renderTaskCard(t, user, isMentorOrAdmin)).join('')}
            </div>
        </div>

        <!-- Assign Task Modal -->
        <div id="assign-task-modal" class="fixed inset-0 z-[2500] bg-black/80 backdrop-blur-md hidden flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div class="bg-[#17212b] border border-[#242f3d] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-zoom-in" onclick="event.stopPropagation()">
                <div class="p-4 sm:p-5 border-b border-[#242f3d] flex items-center justify-between bg-[#121924]">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                        </div>
                        <h3 class="font-heading font-bold text-sm text-white">Assign Task to Member</h3>
                    </div>
                    <button type="button" id="close-assign-task-modal" class="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <form id="assign-task-form" class="p-4 sm:p-6 space-y-4">
                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                            Task Name <span class="text-red-400">*</span>
                        </label>
                        <input type="text" id="task-name-input" required placeholder="e.g. Implement WebSocket real-time alerts" maxlength="120"
                               class="w-full px-3.5 py-2.5 bg-[#0e1621] border border-[#242f3d] focus:border-sky-500 rounded-xl text-sm text-white placeholder-zinc-500 outline-none transition-colors">
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                            Task Description <span class="text-red-400">*</span>
                        </label>
                        <textarea id="task-desc-input" rows="3" required placeholder="Outline the deliverable requirements, expected outcome, key test cases or milestone details..."
                                  class="w-full px-3.5 py-2.5 bg-[#0e1621] border border-[#242f3d] focus:border-sky-500 rounded-xl text-sm text-white placeholder-zinc-500 outline-none transition-colors leading-relaxed"></textarea>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                            Assign To Team Member <span class="text-red-400">*</span>
                        </label>
                        <select id="task-assignee-select" required class="w-full px-3.5 py-2.5 bg-[#0e1621] border border-[#242f3d] focus:border-sky-500 rounded-xl text-sm text-white outline-none transition-colors cursor-pointer">
                            <option value="" disabled selected>Select a team member...</option>
                            ${(() => {
                                const membersForAssign = [...teamMembers];
                                if (lead && lead.name && !membersForAssign.some(m => m.full_name === lead.name)) {
                                    membersForAssign.unshift({ id: lead.lead_id || lead.id, full_name: lead.name, role: 'lead' });
                                }
                                return membersForAssign.map(m => `
                                    <option value="${m.id}" data-name="${escapeHtml(m.full_name || m.username || 'Member')}">
                                        ${escapeHtml(m.full_name || m.username || 'Member')} (${m.role === 'lead' ? 'Team Lead' : 'Member'}${m.specialty ? ' - ' + m.specialty : ''})
                                    </option>
                                `).join('');
                            })()}
                        </select>
                    </div>

                    <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#242f3d]">
                        <button type="button" id="cancel-assign-task-btn" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" id="submit-assign-task-btn" class="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer">
                            Assign Task
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Finish Task Modal (Formatted Text Input) -->
        <div id="finish-task-modal" class="fixed inset-0 z-[2500] bg-black/80 backdrop-blur-md hidden flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div class="bg-[#17212b] border border-[#242f3d] w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl animate-zoom-in" onclick="event.stopPropagation()">
                <div class="p-4 sm:p-5 border-b border-[#242f3d] flex items-center justify-between bg-[#121924]">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </div>
                        <div>
                            <h3 class="font-heading font-bold text-sm text-white">Complete & Upload Work</h3>
                            <p id="finish-task-modal-title" class="text-[11px] text-zinc-400 truncate max-w-xs sm:max-w-md"></p>
                        </div>
                    </div>
                    <button type="button" id="close-finish-task-modal" class="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <form id="finish-task-form" class="p-4 sm:p-6 space-y-4">
                    <div>
                        <div class="flex items-center justify-between pb-1.5">
                            <label class="block text-xs font-semibold text-zinc-300">
                                What did you accomplish? <span class="text-red-400">*</span>
                            </label>
                            <span class="text-[10px] text-zinc-500 font-mono">Formatted Text Editor</span>
                        </div>
                        <p class="text-[11px] text-zinc-400 mb-2">
                            Type or paste your work report. Use <b>Bold</b>, <u>Underline</u>, <i>Italics</i>, or bullet lists to organize your findings.
                        </p>

                        <!-- Formatting Toolbar -->
                        ${renderRichEditorToolbar('finish-task-toolbar')}

                        <!-- Contenteditable Rich Text Area -->
                        <div id="finish-task-editor" 
                             contenteditable="true" 
                             class="prose-clean min-h-[180px] max-h-[320px] overflow-y-auto p-4 bg-[#0e1621] border border-[#242f3d] focus:border-emerald-500 rounded-xl text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all leading-relaxed"
                             placeholder="Detail what was done, key results, code changes, links or notes for mentor review..."></div>
                    </div>

                    <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#242f3d]">
                        <button type="button" id="cancel-finish-task-btn" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" id="submit-finish-task-btn" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                            <span>Mark Completed</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
        `;
    }

    function renderTaskCard(task, user, isMentorOrAdmin) {
        const isCompleted = task.status === 'completed';
        const isAssignedToCurrentUser = user && String(user.id) === String(task.assigned_to);

        return `
        <div class="bg-[#17212b] border ${isCompleted ? 'border-emerald-500/30' : 'border-[#242f3d]'} rounded-2xl p-4 sm:p-5 transition-all shadow-sm space-y-3.5">
            <!-- Top Badges & Actions -->
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    ${isCompleted ? `
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                            <span>Completed</span>
                        </span>
                    ` : `
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            <span>Pending</span>
                        </span>
                    `}
                    <span class="text-[11px] text-zinc-500">
                        Assigned ${formatTimeAgo(task.created_at)} by <strong class="text-zinc-400 font-semibold">${escapeHtml(task.created_by_name || 'Mentor')}</strong>
                    </span>
                </div>

                ${isMentorOrAdmin ? `
                    <button type="button" class="delete-task-btn p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer" data-task-id="${task.id}" title="Delete Task">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                ` : ''}
            </div>

            <!-- Task Title & Description -->
            <div>
                <h3 class="font-heading font-bold text-base sm:text-lg text-white tracking-tight">${escapeHtml(task.title)}</h3>
                <p class="text-xs sm:text-sm text-zinc-300 mt-1 leading-relaxed whitespace-pre-line">${escapeHtml(task.description)}</p>
            </div>

            <!-- Assignee Info -->
            <div class="flex items-center gap-2 pt-1 text-xs">
                <span class="text-zinc-500">Assigned To:</span>
                <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#121924] border border-[#242f3d]">
                    <div class="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-[10px]">
                        ${task.assigned_to_name ? task.assigned_to_name.charAt(0).toUpperCase() : 'M'}
                    </div>
                    <span class="font-semibold text-zinc-200">${escapeHtml(task.assigned_to_name || 'Team Member')}</span>
                </div>
            </div>

            <!-- Completed Details OR Action Button -->
            ${isCompleted ? `
                <div class="mt-3 pt-3 border-t border-[#242f3d] space-y-2">
                    <div class="flex items-center justify-between text-xs font-semibold text-emerald-400">
                        <div class="flex items-center gap-1.5">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <span>Work Done / Submission Report:</span>
                        </div>
                        <span class="text-[11px] text-zinc-500 font-normal">Completed ${formatTimeAgo(task.completed_at)}</span>
                    </div>
                    <div class="p-3.5 bg-[#121924] rounded-xl border border-emerald-500/20 text-xs sm:text-sm text-zinc-200 prose-clean leading-relaxed break-words">
                        ${sanitizeRichText(task.submission_content) || '<span class="text-zinc-500 italic">Task marked completed without extra notes.</span>'}
                    </div>
                </div>
            ` : `
                <div class="mt-3 pt-3 border-t border-[#242f3d] flex items-center justify-between gap-3 flex-wrap">
                    ${isAssignedToCurrentUser ? `
                        <div class="flex items-center gap-2 text-xs text-amber-300 font-medium">
                            <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                            <span>Assigned to you</span>
                        </div>
                        <button type="button" class="open-finish-task-modal-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5" data-task-id="${task.id}" data-task-title="${escapeHtml(task.title)}">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                            <span>Finish Task</span>
                        </button>
                    ` : `
                        <span class="text-xs text-zinc-500 italic">
                            Only ${escapeHtml(task.assigned_to_name)} can finish this task.
                        </span>
                    `}
                </div>
            `}
        </div>
        `;
    }

    async function initProjectTasks(lead, isLead, isMember, isMentorOrAdmin) {
        if (!lead?.id) return;
        projectTasks = await ICCSupabase.fetchProjectTasks(lead.id);

        const badge = document.getElementById('project-tasks-tab-badge');
        if (badge) {
            badge.textContent = projectTasks.length;
            if (projectTasks.length > 0) badge.classList.remove('hidden');
            else badge.classList.add('hidden');
        }

        bindProjectTasksEvents(lead, isLead, isMember, isMentorOrAdmin);
    }

    function bindProjectTasksEvents(lead, isLead, isMember, isMentorOrAdmin) {
        const user = ICCSupabase.getUser();

        // 1. Filter Pills
        document.querySelectorAll('.task-filter-pill').forEach(btn => {
            btn.onclick = () => {
                currentTaskFilter = btn.dataset.filter;
                const container = document.getElementById('project-tab-tasks-content');
                if (container) {
                    container.innerHTML = renderTasksPage(lead, isLead, isMember, isMentorOrAdmin);
                    bindProjectTasksEvents(lead, isLead, isMember, isMentorOrAdmin);
                }
            };
        });

        // 2. Open Add Task Modal
        const assignModal = document.getElementById('assign-task-modal');
        const openAddBtn = document.getElementById('open-add-task-modal-btn');
        const closeAddBtn = document.getElementById('close-assign-task-modal');
        const cancelAddBtn = document.getElementById('cancel-assign-task-btn');

        if (openAddBtn) {
            openAddBtn.onclick = () => {
                if (assignModal) assignModal.classList.remove('hidden');
            };
        }

        const closeAssignModal = () => {
            if (assignModal) assignModal.classList.add('hidden');
        };
        if (closeAddBtn) closeAddBtn.onclick = closeAssignModal;
        if (cancelAddBtn) cancelAddBtn.onclick = closeAssignModal;

        // 3. Submit Add Task Form
        const assignForm = document.getElementById('assign-task-form');
        if (assignForm) {
            assignForm.onsubmit = async (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('task-name-input');
                const descInput = document.getElementById('task-desc-input');
                const assigneeSelect = document.getElementById('task-assignee-select');
                const submitBtn = document.getElementById('submit-assign-task-btn');

                const title = nameInput?.value.trim();
                const description = descInput?.value.trim();
                const assigned_to = assigneeSelect?.value;
                const selectedOption = assigneeSelect?.options[assigneeSelect.selectedIndex];
                const assigned_to_name = selectedOption?.dataset.name || selectedOption?.text?.split('(')[0]?.trim() || 'Team Member';

                if (!title || !description || !assigned_to) {
                    Toast.error('Please fill in task name, description, and assign to a team member.');
                    return;
                }

                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Assigning...'; }

                const { data, error } = await ICCSupabase.createProjectTask(lead.id, {
                    title,
                    description,
                    assigned_to,
                    assigned_to_name
                });

                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Assign Task'; }

                if (error) {
                    Toast.error('Failed to assign task: ' + (error.message || error));
                } else {
                    Toast.success('Task assigned successfully!');
                    closeAssignModal();
                    await initProjectTasks(lead, isLead, isMember, isMentorOrAdmin);
                    const container = document.getElementById('project-tab-tasks-content');
                    if (container) {
                        container.innerHTML = renderTasksPage(lead, isLead, isMember, isMentorOrAdmin);
                        bindProjectTasksEvents(lead, isLead, isMember, isMentorOrAdmin);
                    }
                }
            };
        }

        // 4. Open Finish Task Modal
        const finishModal = document.getElementById('finish-task-modal');
        const closeFinishBtn = document.getElementById('close-finish-task-modal');
        const cancelFinishBtn = document.getElementById('cancel-finish-task-btn');
        const finishEditor = document.getElementById('finish-task-editor');

        const closeFinishModal = () => {
            if (finishModal) finishModal.classList.add('hidden');
            activeCompletingTaskId = null;
            if (finishEditor) finishEditor.innerHTML = '';
        };
        if (closeFinishBtn) closeFinishBtn.onclick = closeFinishModal;
        if (cancelFinishBtn) cancelFinishBtn.onclick = closeFinishModal;

        document.querySelectorAll('.open-finish-task-modal-btn').forEach(btn => {
            btn.onclick = () => {
                const taskId = btn.dataset.taskId;
                const taskTitle = btn.dataset.taskTitle;
                activeCompletingTaskId = taskId;

                const titleEl = document.getElementById('finish-task-modal-title');
                if (titleEl) titleEl.textContent = 'Task: ' + taskTitle;

                if (finishModal) finishModal.classList.remove('hidden');

                if (finishEditor) {
                    finishEditor.innerHTML = '';
                    bindRichEditorToolbar('finish-task-toolbar', finishEditor);
                    setTimeout(() => finishEditor.focus(), 100);
                }
            };
        });

        // 5. Submit Finish Task Form
        const finishForm = document.getElementById('finish-task-form');
        if (finishForm) {
            finishForm.onsubmit = async (e) => {
                e.preventDefault();
                if (!activeCompletingTaskId) return;

                const content = finishEditor ? finishEditor.innerHTML.trim() : '';
                const plainText = finishEditor ? (finishEditor.innerText || finishEditor.textContent || '').trim() : '';

                if (!plainText) {
                    Toast.error('Please describe what you have done to complete this task.');
                    return;
                }

                const submitBtn = document.getElementById('submit-finish-task-btn');
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Completing...'; }

                const { data, error } = await ICCSupabase.completeProjectTask(activeCompletingTaskId, content, lead.id);

                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Mark Completed'; }

                if (error) {
                    Toast.error('Failed to complete task: ' + (error.message || error));
                } else {
                    Toast.success('🎉 Task completed successfully!');
                    closeFinishModal();
                    await initProjectTasks(lead, isLead, isMember, isMentorOrAdmin);
                    const container = document.getElementById('project-tab-tasks-content');
                    if (container) {
                        container.innerHTML = renderTasksPage(lead, isLead, isMember, isMentorOrAdmin);
                        bindProjectTasksEvents(lead, isLead, isMember, isMentorOrAdmin);
                    }
                }
            };
        }

        // 6. Delete Task (Mentor / Admin)
        document.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.onclick = async () => {
                const taskId = btn.dataset.taskId;
                if (!confirm('Are you sure you want to delete this task?')) return;

                const { error } = await ICCSupabase.deleteProjectTask(taskId, lead.id);
                if (error) {
                    Toast.error('Failed to delete task: ' + (error.message || error));
                } else {
                    Toast.success('Task deleted.');
                    await initProjectTasks(lead, isLead, isMember, isMentorOrAdmin);
                    const container = document.getElementById('project-tab-tasks-content');
                    if (container) {
                        container.innerHTML = renderTasksPage(lead, isLead, isMember, isMentorOrAdmin);
                        bindProjectTasksEvents(lead, isLead, isMember, isMentorOrAdmin);
                    }
                }
            };
        });
    }

    function renderMentorChatPage(lead, isLead, isMember) {
        const isMentorUser = typeof ICCSupabase.isMentor === 'function' && ICCSupabase.isMentor();
        const isAdminUser = typeof ICCSupabase.isAdmin === 'function' && ICCSupabase.isAdmin();
        const canAccess = isMember || isLead || isMentorUser || isAdminUser;

        if (!canAccess) {
            return `
            <div class="glass-card rounded-2xl p-8 sm:p-12 border border-zinc-800/80 bg-zinc-950/70 text-center max-w-2xl mx-auto space-y-4 my-8">
                <div class="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                    <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                </div>
                <h3 class="font-heading font-bold text-lg sm:text-xl text-white">Mentor Chat is Restricted</h3>
                <p class="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                    This dedicated discussion channel is reserved exclusively for approved team members of <span class="text-white font-semibold">${escapeHtml(lead.project_name || lead.team)}</span> and verified ICC Mentors.
                </p>
                ${!ICCSupabase.getUser() ? `
                    <div class="pt-2">
                        <a href="#login" class="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20">
                            Sign in to Access
                        </a>
                    </div>
                ` : (!isMember && !isLead ? `
                    <div class="pt-2">
                        <button type="button" onclick="document.getElementById('team-join-btn')?.click()" class="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/20 cursor-pointer">
                            Apply to Join Team
                        </button>
                    </div>
                ` : '')}
            </div>`;
        }

        return `
        <div class="glass-card rounded-2xl border border-zinc-800/80 bg-zinc-950/70 overflow-hidden shadow-2xl flex flex-col h-[75vh] min-h-[550px] max-h-[850px]" id="project-mentor-chat-wrapper">
            <!-- Chat Header -->
            <div class="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between gap-3 flex-shrink-0">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 shadow-sm">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                        </svg>
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <h2 class="font-heading font-bold text-sm sm:text-base text-white truncate">Mentor & Team Discussion</h2>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
                                ${ICC_CONFIG.MENTOR_TICK}
                                <span>Mentor Channel</span>
                            </span>
                        </div>
                        <p class="text-[11px] text-zinc-400 truncate">Direct collaboration between ${escapeHtml(lead.team)} members and ICC Mentors</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button type="button" id="refresh-mentor-chat-btn" class="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition-colors cursor-pointer" title="Refresh messages">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </button>
                </div>
            </div>

            <!-- Messages Stream Container -->
            <div id="project-mentor-messages-container" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 custom-scrollbar bg-zinc-950/40">
                <div class="flex items-center justify-center py-16" id="mentor-chat-spinner">
                    <div class="spinner w-7 h-7"></div>
                </div>
            </div>

            <!-- Reply Target Bar (Hidden by default, revealed when user clicks Reply) -->
            <div id="mentor-chat-reply-bar" class="hidden px-4 py-2 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between text-xs animate-slide-up">
                <div class="flex items-center gap-2 min-w-0 pr-2">
                    <svg class="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                    <span class="text-zinc-400 flex-shrink-0">Replying to <span id="mentor-reply-target-author" class="text-white font-semibold"></span>:</span>
                    <span id="mentor-reply-target-text" class="text-zinc-400 truncate italic"></span>
                </div>
                <button type="button" id="cancel-mentor-reply-btn" class="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer" title="Cancel Reply">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Chat Input Form -->
            <form id="project-mentor-chat-form" class="p-3 sm:p-4 bg-zinc-900/80 border-t border-zinc-800 flex items-end gap-2.5 flex-shrink-0">
                <div class="flex-1 min-w-0 relative">
                    <textarea id="project-mentor-chat-input" rows="1" placeholder="Share project update or ask mentors for guidance... (Press Enter to send)" class="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-amber-500/60 rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 outline-none resize-none max-h-32 leading-relaxed transition-all"></textarea>
                </div>
                <button type="submit" id="project-mentor-send-btn" class="px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50">
                    <span>Send</span>
                    <svg class="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </button>
            </form>
        </div>
        `;
    }

    async function initMentorChat(lead, isLead, isMember) {
        const container = document.getElementById('project-mentor-messages-container');
        if (!container) return;

        const isMentorUser = typeof ICCSupabase.isMentor === 'function' && ICCSupabase.isMentor();
        const isAdminUser = typeof ICCSupabase.isAdmin === 'function' && ICCSupabase.isAdmin();
        const canAccess = isMember || isLead || isMentorUser || isAdminUser;
        if (!canAccess) return;

        // Cleanup any existing subscription
        if (typeof mentorChatUnsubscribe === 'function') {
            mentorChatUnsubscribe();
            mentorChatUnsubscribe = null;
        }

        container.innerHTML = `
            <div class="flex items-center justify-center py-16" id="mentor-chat-spinner">
                <div class="spinner w-7 h-7"></div>
            </div>`;

        // Fetch messages
        const res = await ICCSupabase.fetchProjectMentorMessages(lead.id);
        currentMentorMessages = res?.data || [];
        renderMentorMessagesList(lead, isLead, true);

        // Bind form and action events
        bindMentorChatEvents(lead, isLead);

        // Realtime subscription
        try {
            mentorChatUnsubscribe = ICCSupabase.subscribeToProjectMentorChat(lead.id, (event) => {
                if (event.type === 'INSERT' && event.message) {
                    if (!currentMentorMessages.some(m => m.id === event.message.id)) {
                        currentMentorMessages.push(event.message);
                        renderMentorMessagesList(lead, isLead, true);
                    }
                } else if (event.type === 'DELETE' && event.messageId) {
                    currentMentorMessages = currentMentorMessages.filter(m => m.id !== event.messageId);
                    renderMentorMessagesList(lead, isLead, false);
                }
            });
        } catch (err) {
            console.warn('Realtime mentor chat subscription warning:', err);
        }
    }

    function renderMentorMessagesList(lead, isLead, shouldScrollBottom = true) {
        const container = document.getElementById('project-mentor-messages-container');
        if (!container) return;

        const myUser = ICCSupabase.getUser();
        const myId = myUser?.id;
        const isMentorUser = typeof ICCSupabase.isMentor === 'function' && ICCSupabase.isMentor();
        const isAdminUser = typeof ICCSupabase.isAdmin === 'function' && ICCSupabase.isAdmin();

        if (!currentMentorMessages || currentMentorMessages.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto space-y-3">
                    <div class="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-1 shadow-sm">
                        <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                        </svg>
                    </div>
                    <h3 class="font-heading font-bold text-base text-white">Welcome to Mentor Chat!</h3>
                    <p class="text-xs text-zinc-400 leading-relaxed">
                        No messages in this project channel yet. Team members of <span class="text-zinc-200 font-semibold">${escapeHtml(lead.team)}</span> and verified ICC Mentors can exchange updates, milestone guidance, and feedback here.
                    </p>
                </div>`;
            return;
        }

        container.innerHTML = currentMentorMessages.map(m => {
            const isMe = m.sender_id === myId;
            const prof = m.profiles || {};
            const senderRole = (prof.role || (isMe ? ICCSupabase.getProfile()?.role : '') || '').toLowerCase();
            const isSenderMentor = senderRole === 'mentor' || Boolean(prof.is_mentor) || senderRole === 'super_admin' || senderRole === 'superadmin' || (isMe && isMentorUser);
            const isSenderLead = prof.id === lead.lead_user_id || senderRole === 'lead';
            const canDelete = isMe || isMentorUser || isAdminUser || (isLead && !isSenderMentor);

            let timeStr = '';
            try {
                timeStr = typeof formatTimeAgo === 'function' ? formatTimeAgo(m.created_at) : new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                timeStr = '';
            }

            // Find reply target if present
            let replyHtml = '';
            if (m.reply_to_id) {
                const targetMsg = currentMentorMessages.find(x => x.id === m.reply_to_id);
                if (targetMsg) {
                    const targetAuthor = targetMsg.profiles?.full_name || targetMsg.profiles?.username || 'User';
                    const targetIsMentor = targetMsg.profiles?.role === 'mentor';
                    replyHtml = `
                    <div class="mb-2 px-3 py-1.5 rounded-lg bg-zinc-950/60 border-l-2 ${targetIsMentor ? 'border-amber-400' : 'border-emerald-400'} text-[11px] text-zinc-400 flex items-center gap-1.5 truncate">
                        <svg class="w-3 h-3 flex-shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                        <span class="font-bold text-zinc-300">@${escapeHtml(targetAuthor)}:</span>
                        <span class="truncate italic text-zinc-400">${escapeHtml(targetMsg.message)}</span>
                    </div>`;
                }
            }

            return `
            <div class="flex ${isMe ? 'justify-end' : 'justify-start'} group/msg animate-slide-up" data-msg-id="${m.id}">
                <div class="flex max-w-[90%] sm:max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start gap-2.5">
                    <!-- Avatar -->
                    <div class="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden mt-0.5 border ${isSenderMentor ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-zinc-700'} shadow-sm cursor-pointer open-user-profile" data-id="${prof.id || m.sender_id}">
                        ${prof.avatar_url
                            ? `<img src="${prof.avatar_url}" class="w-full h-full object-cover">`
                            : `<div class="w-full h-full flex items-center justify-center text-[10px] font-bold ${isSenderMentor ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-300'}">${(prof.full_name || prof.username || '?').charAt(0).toUpperCase()}</div>`}
                    </div>

                    <!-- Bubble Container -->
                    <div class="min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                        <!-- Author & Badges Header -->
                        <div class="flex items-center gap-1.5 mb-1 text-[11px] flex-wrap">
                            <span class="font-bold text-zinc-300 hover:text-white cursor-pointer open-user-profile inline-flex items-center" data-id="${prof.id || m.sender_id}">
                                ${escapeHtml(prof.full_name || prof.username || (isMe ? 'You' : 'Anonymous User'))}
                            </span>
                            ${isSenderMentor
                                ? `${ICC_CONFIG.MENTOR_TICK}<span class="text-[9px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.2 rounded-full border border-amber-500/20">Mentor</span>`
                                : (isSenderLead
                                    ? `${ICC_CONFIG.VERIFIED_TICK}<span class="text-[9px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.2 rounded-full border border-emerald-500/20">Lead</span>`
                                    : `<span class="text-[9px] text-zinc-500">Member</span>`)}
                            <span class="text-[10px] text-zinc-500 ml-1">${timeStr}</span>
                        </div>

                        <!-- Message Box -->
                        <div class="relative flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}">
                            <div class="p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words shadow-md transition-all ${
                                isMe
                                    ? (isSenderMentor
                                        ? 'bg-amber-600/90 text-white rounded-tr-none shadow-amber-600/20 border border-amber-400/40 font-medium'
                                        : 'bg-emerald-600 text-white rounded-tr-none shadow-emerald-600/15')
                                    : (isSenderMentor
                                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-100 rounded-tl-none shadow-amber-500/5'
                                        : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none')
                            }">
                                ${replyHtml}
                                <div class="whitespace-pre-wrap">${escapeHtml(m.message)}</div>
                            </div>

                            <!-- Actions (Reply & Delete) -->
                            <div class="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity flex-shrink-0">
                                <button type="button" class="mentor-reply-msg-btn p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer" data-msg-id="${m.id}" title="Reply to this message">
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                                </button>
                                ${canDelete ? `
                                <button type="button" class="mentor-delete-msg-btn p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer" data-msg-id="${m.id}" title="Delete message">
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        // Delegate profile opening
        container.querySelectorAll('.open-user-profile').forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                const uid = el.dataset.id;
                if (uid && typeof UserProfileModal !== 'undefined') {
                    UserProfileModal.open(uid);
                }
            };
        });

        // Bind delete buttons
        container.querySelectorAll('.mentor-delete-msg-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const msgId = btn.dataset.msgId;
                if (!msgId) return;

                showConfirmationPopup({
                    title: 'Delete Message?',
                    message: 'Are you sure you want to delete this message from Mentor Chat?',
                    confirmText: 'Delete Message',
                    cancelText: 'Cancel',
                    isDanger: true,
                    onConfirm: async () => {
                        btn.disabled = true;
                        const { error } = await ICCSupabase.deleteProjectMentorMessage(msgId, lead.id);
                        if (error) {
                            Toast.error('Failed to delete message: ' + (error.message || 'Unknown error'));
                            btn.disabled = false;
                        } else {
                            currentMentorMessages = currentMentorMessages.filter(x => x.id !== msgId);
                            renderMentorMessagesList(lead, isLead, false);
                            Toast.success('Message deleted');
                        }
                    }
                });
            };
        });

        // Bind reply buttons
        container.querySelectorAll('.mentor-reply-msg-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const msgId = btn.dataset.msgId;
                const targetMsg = currentMentorMessages.find(x => x.id === msgId);
                if (!targetMsg) return;

                mentorReplyTarget = targetMsg;
                const replyBar = document.getElementById('mentor-chat-reply-bar');
                const replyAuthor = document.getElementById('mentor-reply-target-author');
                const replyText = document.getElementById('mentor-reply-target-text');
                const input = document.getElementById('project-mentor-chat-input');

                if (replyBar && replyAuthor && replyText) {
                    replyAuthor.textContent = targetMsg.profiles?.full_name || targetMsg.profiles?.username || 'User';
                    replyText.textContent = targetMsg.message;
                    replyBar.classList.remove('hidden');
                }
                if (input) {
                    input.focus();
                }
            };
        });

        if (shouldScrollBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function bindMentorChatEvents(lead, isLead) {
        const form = document.getElementById('project-mentor-chat-form');
        const input = document.getElementById('project-mentor-chat-input');
        const sendBtn = document.getElementById('project-mentor-send-btn');
        const cancelReplyBtn = document.getElementById('cancel-mentor-reply-btn');
        const refreshBtn = document.getElementById('refresh-mentor-chat-btn');

        if (cancelReplyBtn) {
            cancelReplyBtn.onclick = () => {
                mentorReplyTarget = null;
                const replyBar = document.getElementById('mentor-chat-reply-bar');
                if (replyBar) replyBar.classList.add('hidden');
            };
        }

        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                refreshBtn.classList.add('animate-spin');
                const res = await ICCSupabase.fetchProjectMentorMessages(lead.id);
                refreshBtn.classList.remove('animate-spin');
                if (res?.data) {
                    currentMentorMessages = res.data;
                    renderMentorMessagesList(lead, isLead, false);
                }
            };
        }

        if (input) {
            input.oninput = () => {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            };

            input.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (form) form.requestSubmit();
                }
            };
        }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                if (!input) return;
                const text = input.value.trim();
                if (!text || form.dataset.sending === 'true') return;

                form.dataset.sending = 'true';
                if (sendBtn) sendBtn.disabled = true;

                const replyToId = mentorReplyTarget ? mentorReplyTarget.id : null;
                const { data, error } = await ICCSupabase.sendProjectMentorMessage(lead.id, text, replyToId);

                form.dataset.sending = 'false';
                if (sendBtn) sendBtn.disabled = false;

                if (error) {
                    Toast.error('Failed to send message: ' + (error.message || 'Unknown error'));
                    return;
                }

                input.value = '';
                input.style.height = 'auto';

                mentorReplyTarget = null;
                const replyBar = document.getElementById('mentor-chat-reply-bar');
                if (replyBar) replyBar.classList.add('hidden');

                if (data && !currentMentorMessages.some(x => x.id === data.id)) {
                    currentMentorMessages.push(data);
                    renderMentorMessagesList(lead, isLead, true);
                }
            };
        }
    }

    function renderDetail(lead) {
        const user = ICCSupabase.getUser();
        const profile = ICCSupabase.getProfile();
        const isMember = Boolean(
            (Array.isArray(profile?.memberships) && profile.memberships.map(Number).includes(Number(lead.id))) ||
            (profile?.team_id && Number(profile.team_id) === Number(lead.id)) ||
            (user && Array.isArray(teamMembers) && teamMembers.some(m => String(m.id) === String(user.id)))
        );
        const isPending = profile?.pending_teams?.map(Number).includes(Number(lead.id));
        const isLead = isLeadForTeam(lead.id, lead, teamMembers);
        const canSeeCode = Boolean(lead.project_code && (isLead || isMember || ICCSupabase.isMentor() || ICCSupabase.isAdmin()));
        const memberTags = getMemberTags(lead.id);

        const validLinks = getProjectLinks(lead);
        const githubLink = validLinks.find(l => detectLinkType(l.url, l.type) === 'github');
        const youtubeLink = validLinks.find(l => detectLinkType(l.url, l.type) === 'youtube');
        const customLinks = validLinks.filter(l => l !== githubLink && l !== youtubeLink);

        return `
        <section class="min-h-screen relative pb-16 w-full overflow-x-hidden" id="team-detail-section">
            <!-- Floating Quick-Back Button: stays accessible even when scrolled down -->
            <button id="team-floating-back-btn" onclick="TeamsView.goBack(event)" class="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-[#17212b]/95 hover:bg-[#242f3d] text-white text-xs font-bold rounded-full border border-[#2b394a] shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer group" title="Go Back">
                <svg class="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                <span>Back</span>
            </button>

            <!-- Top Section: Full screen container on laptop & mobile -->
            <div class="w-full max-w-[1760px] mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 xl:px-10 pt-3 sm:pt-5 pb-12">
                <!-- Top Navigation Bar with Back Button & Mentor/Admin Actions -->
                <div class="flex items-center justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
                    <button id="team-back-btn" onclick="TeamsView.goBack(event)" class="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 rounded-xl text-xs font-semibold text-white border border-zinc-800 transition-all cursor-pointer shadow-md active:scale-95">
                        <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        <span>Back</span>
                    </button>
                    ${(ICCSupabase.isMentor() || ICCSupabase.isAdmin()) ? `
                        <button onclick="TeamsView.deleteCurrentProject(${lead.id}, '${escapeHtml(lead.project_name || lead.team).replace(/'/g, "\\'")}')" class="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-md active:scale-95" title="Permanently delete this project">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            <span>Delete Project</span>
                        </button>
                    ` : ''}
                </div>

                <!-- Constant Project Header: Project Avatar, Name, Team Name, Code, and Tab Switcher (Constant at the top) -->
                <div class="glass-card rounded-2xl p-4 sm:p-5 lg:p-6 border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl shadow-xl mb-5">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <!-- Project Identity & Team Name (Constant at the top) -->
                        <div class="flex items-center gap-3.5 sm:gap-4 min-w-0">
                            <div class="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-2xl bg-zinc-900 ring-2 ring-zinc-800/80 shadow-xl flex items-center justify-center overflow-hidden flex-shrink-0 ${lead.avatar_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}" ${lead.avatar_url ? `data-full-image="${lead.avatar_url}"` : ''}>
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
                                                <span class="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                                                    <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                    <span>${isLead ? "Team Leader" : "Team Member"}</span>
                                                </span>
                                                <button id="open-team-chat-btn" class="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-800 hover:border-emerald-500/40 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95">
                                                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                                                    <span>Team Chat</span>
                                                </button>
                                            </div>`;
                                        if (isPending) return `
                                            <div class="inline-flex items-center gap-2">
                                                <span class="inline-flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                                                    <svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                    <span>Pending</span>
                                                </span>
                                                <button id="team-cancel-btn" class="text-xs text-zinc-500 hover:text-red-400 transition-colors underline decoration-dotted cursor-pointer">Cancel</button>
                                            </div>`;

                                        return `<button id="team-join-btn" class="join-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all hover:shadow-lg hover:shadow-red-600/30 cursor-pointer shadow-md active:scale-95 flex-shrink-0">
                                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                                            <span>Join Team</span>
                                        </button>`;
                                    })()}
                                </div>
                                <div class="flex items-center flex-wrap gap-3 mt-1.5 text-xs">
                                    <span class="text-xs font-medium text-zinc-400">Team: <span class="text-zinc-200 font-bold">${lead.team}</span></span>
                                    ${canSeeCode ? `
                                        <span class="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5" title="Unique Project Code (Visible to Project Lead, Members, Mentors, and Admins)">
                                            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
                                            <span>Code: ${escapeHtml(lead.project_code)}</span>
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Page Selection Navigation (Directly below project name, styled like reference image) -->
                    <div class="mt-4 pt-2 border-t border-zinc-800/80 -mb-1">
                        <nav class="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
                            <button id="project-tab-overview-btn" type="button" class="project-tab-btn group relative inline-flex items-center gap-2 pb-2.5 pt-1 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${currentProjectTab === 'overview' ? 'text-emerald-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'}">
                                <svg class="w-4 h-4 transition-colors ${currentProjectTab === 'overview' ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 14l3-3"/>
                                    <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
                                </svg>
                                <span>Overview</span>
                                <span class="tab-indicator absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all ${currentProjectTab === 'overview' ? 'bg-emerald-500' : 'bg-transparent'}"></span>
                            </button>

                            <button id="project-tab-tasks-btn" type="button" class="project-tab-btn group relative inline-flex items-center gap-2 pb-2.5 pt-1 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${currentProjectTab === 'tasks' ? 'text-sky-400 font-bold' : 'text-zinc-400 hover:text-sky-400'}">
                                <svg class="w-4 h-4 transition-colors ${currentProjectTab === 'tasks' ? 'text-sky-400' : 'text-zinc-500 group-hover:text-sky-400'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9 11l3 3L22 4"/>
                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                </svg>
                                <span>Tasks</span>
                                <span id="project-tasks-tab-badge" class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 ${projectTasks.length > 0 ? '' : 'hidden'}">${projectTasks.length}</span>
                                <span class="tab-indicator absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all ${currentProjectTab === 'tasks' ? 'bg-sky-400' : 'bg-transparent'}"></span>
                            </button>

                            <button id="project-tab-mentor-btn" type="button" class="project-tab-btn group relative inline-flex items-center gap-2 pb-2.5 pt-1 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${currentProjectTab === 'mentor_chat' ? 'text-amber-400 font-bold' : 'text-zinc-400 hover:text-amber-400'}">
                                <svg class="w-4 h-4 transition-colors ${currentProjectTab === 'mentor_chat' ? 'text-amber-400' : 'text-zinc-500 group-hover:text-amber-400'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                                </svg>
                                <span>Mentor Chat</span>
                                <span class="w-1.5 h-1.5 rounded-full ${currentProjectTab === 'mentor_chat' ? 'bg-amber-400' : 'bg-amber-500/70'}"></span>
                                <span class="tab-indicator absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all ${currentProjectTab === 'mentor_chat' ? 'bg-amber-400' : 'bg-transparent'}"></span>
                            </button>
                        </nav>
                    </div>
                </div>

                <!-- Page 1: Overview Tab Container -->
                <div id="project-tab-overview-content" class="${currentProjectTab === 'overview' ? '' : 'hidden'}">
                    <!-- 2-Column Main Workspace Grid: Full Screen Edge-to-Edge Utilization -->
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 xl:gap-7 items-start w-full">
                    
                    <!-- Left Column (lg:col-span-8 xl:col-span-8 2xl:col-span-9): Project Header -> About the Project -> Project Progress -> Project Links -->
                    <div class="lg:col-span-8 xl:col-span-8 2xl:col-span-9 space-y-5 w-full min-w-0">
                        
                        <!-- 2. "About the Project" Section (Shifted to top, below project name and team name) -->
                        <div class="glass-card rounded-2xl p-4 sm:p-5 lg:p-6 border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl space-y-4" id="about-project-card">
                            
                            <!-- Clean Preview Container (Default view) -->
                            <div id="about-project-view-container" class="space-y-4">
                                <div class="flex items-center justify-between gap-3">
                                    <h3 class="font-heading font-semibold text-xs uppercase tracking-wider text-zinc-400">About the Project</h3>
                                    ${isLead ? `
                                    <div class="flex items-center gap-2">
                                        <button id="manage-links-header-btn" type="button" class="flex items-center gap-1.5 px-3 py-1 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 border border-zinc-800 hover:border-emerald-500/40 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95" title="Manage Project Links">
                                            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                                            </svg>
                                            <span>${validLinks.length > 0 ? 'Links (' + validLinks.length + ')' : '+ Links'}</span>
                                        </button>
                                        <button id="edit-about-btn" class="flex items-center gap-1.5 px-3 py-1 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 border border-zinc-800 hover:border-emerald-500/40 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95" title="Edit About the Project">
                                            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                            </svg>
                                            <span>Edit</span>
                                        </button>
                                    </div>
                                    ` : ''}
                                </div>

                                <!-- Clean Rendered Content Display -->
                                <div id="about-project-display" class="prose-clean text-sm text-zinc-300 leading-relaxed break-words">
                                    ${sanitizeRichText(lead.bio) || '<span class="text-zinc-500 italic">No project description provided yet.</span>'}
                                </div>

                                <div>
                                    <h3 class="font-heading font-semibold text-xs uppercase tracking-wider text-zinc-400 mb-2">Specialties & Tech Stack</h3>
                                    <div class="flex flex-wrap gap-2">
                                        ${(lead.specialties || []).map(s => `<span class="specialty-pill text-xs text-zinc-400 font-medium">${s}</span>`).join('<span class="text-zinc-600 mx-1">•</span>')}
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

                        <!-- 4. Project Links & Resources Section (Below Project Progress) -->
                        ${renderProjectLinksSection(lead, isLead)}

                    </div>

                    <!-- Right Column (lg:col-span-4 xl:col-span-4 2xl:col-span-3): Active Workforce, Pending & Lead Config -->
                    <div class="lg:col-span-4 xl:col-span-4 2xl:col-span-3 space-y-5 w-full min-w-0">
                        
                        <!-- Active Workforce Section (At top, 3 in a column, naturally filling right column) -->
                        <div class="w-full" id="workforce-section">
                            <div class="glass-card rounded-2xl p-4 sm:p-5 lg:p-6 border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl">
                                <div class="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-zinc-800/60">
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-heading font-bold text-sm text-white tracking-tight">Active Workforce</h3>
                                        <span id="team-member-count" class="text-xs font-bold text-red-400">(${teamMembers.length})</span>
                                    </div>
                                    <div class="flex items-center gap-1.5 flex-shrink-0">
                                        <span class="relative flex h-2 w-2">
                                            <span class="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span class="relative rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        <span class="text-[10px] text-zinc-400 font-medium">Live Roster</span>
                                    </div>
                                </div>

                                <!-- 3 profiles in a column (grid-cols-3) -->
                                <div id="team-roster" class="grid grid-cols-3 gap-y-3.5 sm:gap-y-4 gap-x-2 sm:gap-x-3 justify-items-center">
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
                                            <span class="text-[10px] font-bold uppercase tracking-wider text-red-400">${m.disc_tag || 'No Tag'}</span>
                                            <span class="text-[10px] text-zinc-500 italic">DISC Personality</span>
                                        </div>
                                        <p class="text-[11px] text-zinc-400 leading-relaxed italic bg-zinc-900/30 p-2 rounded-lg">"${m.summary || 'No summary provided.'}"</p>
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
                                    <div class="pt-1">
                                        <button type="button" id="manage-links-config-btn" class="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:text-emerald-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                                            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                                            <span>Manage GitHub, YouTube & Links</span>
                                        </button>
                                    </div>
                                    <button type="submit" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold mt-2 transition-all shadow-lg shadow-emerald-600/20">Save Project Configuration</button>
                                </form>
                            </div>
                        </div>
                        ` : ''}

                    </div>

                </div>
                </div>

                <!-- Page 2: Mentor Chat Tab Container -->
                <div id="project-tab-tasks-content" class="${currentProjectTab === 'tasks' ? '' : 'hidden'}">
                    ${renderTasksPage(lead, isLead, isMember, ICCSupabase.isMentor() || ICCSupabase.isAdmin())}
                </div>

                <div id="project-tab-mentor-content" class="${currentProjectTab === 'mentor_chat' ? '' : 'hidden'}">
                    ${renderMentorChatPage(lead, isLead, isMember)}
                </div>
            </div>

            ${isLead ? `
            <!-- Manage Links Modal -->
            <div id="links-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm hidden">
                <div class="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-zoom-in">
                    <div class="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                            </div>
                            <div>
                                <h3 class="font-heading font-bold text-base text-white">Project Links & Resources</h3>
                                <p class="text-[11px] text-zinc-400">Add or edit your GitHub repo, YouTube demos, and custom links</p>
                            </div>
                        </div>
                        <button id="close-links-modal" type="button" class="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>

                    <form id="manage-links-form" class="p-4 sm:p-5 max-h-[70vh] overflow-y-auto space-y-4">
                        <!-- GitHub Field -->
                        <div class="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                                <label class="text-xs font-bold text-zinc-200">GitHub Repository</label>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input type="text" id="link-github-name" placeholder="Name (e.g. GitHub Repo)" class="form-input text-xs px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white" value="${escapeHtml(githubLink?.name || 'GitHub Repository')}">
                                <input type="text" id="link-github-url" placeholder="https://github.com/..." class="form-input text-xs sm:col-span-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white" value="${escapeHtml(githubLink?.url || '')}">
                            </div>
                        </div>

                        <!-- YouTube Field -->
                        <div class="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                <label class="text-xs font-bold text-zinc-200">YouTube Video / Demo</label>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input type="text" id="link-youtube-name" placeholder="Name (e.g. Project Demo)" class="form-input text-xs px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white" value="${escapeHtml(youtubeLink?.name || 'Demo Video')}">
                                <input type="text" id="link-youtube-url" placeholder="https://youtube.com/watch?v=..." class="form-input text-xs sm:col-span-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white" value="${escapeHtml(youtubeLink?.url || '')}">
                            </div>
                        </div>

                        <!-- Custom Links Section -->
                        <div class="space-y-2.5 pt-1">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-zinc-300">Custom Links (Website, Docs, Figma)</span>
                                <button type="button" id="add-custom-link-row-btn" class="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors">
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                    <span>Add Link</span>
                                </button>
                            </div>

                            <div id="custom-links-container" class="space-y-2">
                                ${customLinks.map(c => `
                                <div class="custom-link-row flex items-center gap-2 p-2 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                                    <input type="text" class="custom-link-name form-input text-xs w-1/3 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white" placeholder="Link Name (e.g. Docs)" value="${escapeHtml(c.name || '')}">
                                    <input type="text" class="custom-link-url form-input text-xs flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white" placeholder="https://..." value="${escapeHtml(c.url || '')}">
                                    <button type="button" class="remove-link-row-btn p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer" title="Remove Link">
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                            <button type="button" id="cancel-links-modal" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button type="submit" id="save-links-submit-btn" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer">
                                Save Links
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            ` : ''}
        </section>`;
    }

    async function mount(container, teamId, initialTab = 'overview') {
        if (teamId) {
            currentTeamId = parseInt(teamId);
            currentProjectTab = initialTab || 'overview';
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
                                            <span class="text-[10px] font-bold uppercase tracking-wider text-red-400">${m.disc_tag || 'No Tag'}</span>
                                            <span class="text-[10px] text-zinc-500 italic">DISC Personality</span>
                                        </div>
                                        <p class="text-[11px] text-zinc-400 leading-relaxed italic bg-zinc-900/30 p-2 rounded-lg">"${m.summary || 'No summary provided.'}"</p>
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
        const linksModal = document.getElementById('links-modal');
        if (linksModal && !linksModal.classList.contains('hidden')) {
            linksModal.classList.add('hidden');
            return;
        }
        const progressModal = document.getElementById('progress-modal');
        if (progressModal && !progressModal.classList.contains('hidden')) {
            progressModal.classList.add('hidden');
            return;
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

        const isLead = isLeadForTeam(lead.id, lead, teamMembers);
        const profile = ICCSupabase.getProfile();
        const user = ICCSupabase.getUser();
        const isMember = Boolean(
            (Array.isArray(profile?.memberships) && profile.memberships.map(Number).includes(Number(lead.id))) ||
            (profile?.team_id && Number(profile.team_id) === Number(lead.id)) ||
            (user && Array.isArray(teamMembers) && teamMembers.some(m => String(m.id) === String(user.id)))
        );

        // Tab Switchers (Overview, Tasks, Mentor Chat)
        const overviewTabBtn = document.getElementById('project-tab-overview-btn');
        const tasksTabBtn = document.getElementById('project-tab-tasks-btn');
        const mentorTabBtn = document.getElementById('project-tab-mentor-btn');
        const overviewContent = document.getElementById('project-tab-overview-content');
        const tasksContent = document.getElementById('project-tab-tasks-content');
        const mentorContent = document.getElementById('project-tab-mentor-content');
        const isMentorOrAdmin = ICCSupabase.isMentor() || ICCSupabase.isAdmin();

        const switchTab = (tab) => {
            currentProjectTab = tab;
            const overviewIcon = overviewTabBtn?.querySelector('svg');
            const overviewIndicator = overviewTabBtn?.querySelector('.tab-indicator');
            const tasksIcon = tasksTabBtn?.querySelector('svg');
            const tasksIndicator = tasksTabBtn?.querySelector('.tab-indicator');
            const mentorIcon = mentorTabBtn?.querySelector('svg');
            const mentorIndicator = mentorTabBtn?.querySelector('.tab-indicator');

            // Reset all 3 tabs to inactive styling
            overviewTabBtn?.classList.remove('text-emerald-400', 'font-bold');
            overviewTabBtn?.classList.add('text-zinc-400', 'hover:text-zinc-200');
            overviewIcon?.classList.remove('text-emerald-400');
            overviewIcon?.classList.add('text-zinc-500', 'group-hover:text-zinc-300');
            overviewIndicator?.classList.remove('bg-emerald-500');
            overviewIndicator?.classList.add('bg-transparent');

            tasksTabBtn?.classList.remove('text-sky-400', 'font-bold');
            tasksTabBtn?.classList.add('text-zinc-400', 'hover:text-sky-400');
            tasksIcon?.classList.remove('text-sky-400');
            tasksIcon?.classList.add('text-zinc-500', 'group-hover:text-sky-400');
            tasksIndicator?.classList.remove('bg-sky-400');
            tasksIndicator?.classList.add('bg-transparent');

            mentorTabBtn?.classList.remove('text-amber-400', 'font-bold');
            mentorTabBtn?.classList.add('text-zinc-400', 'hover:text-amber-400');
            mentorIcon?.classList.remove('text-amber-400');
            mentorIcon?.classList.add('text-zinc-500', 'group-hover:text-amber-400');
            mentorIndicator?.classList.remove('bg-amber-400');
            mentorIndicator?.classList.add('bg-transparent');

            // Hide all tab contents
            overviewContent?.classList.add('hidden');
            tasksContent?.classList.add('hidden');
            mentorContent?.classList.add('hidden');

            if (tab === 'overview') {
                overviewTabBtn?.classList.remove('text-zinc-400', 'hover:text-zinc-200');
                overviewTabBtn?.classList.add('text-emerald-400', 'font-bold');
                overviewIcon?.classList.remove('text-zinc-500', 'group-hover:text-zinc-300');
                overviewIcon?.classList.add('text-emerald-400');
                overviewIndicator?.classList.remove('bg-transparent');
                overviewIndicator?.classList.add('bg-emerald-500');
                overviewContent?.classList.remove('hidden');
            } else if (tab === 'tasks') {
                tasksTabBtn?.classList.remove('text-zinc-400', 'hover:text-sky-400');
                tasksTabBtn?.classList.add('text-sky-400', 'font-bold');
                tasksIcon?.classList.remove('text-zinc-500', 'group-hover:text-sky-400');
                tasksIcon?.classList.add('text-sky-400');
                tasksIndicator?.classList.remove('bg-transparent');
                tasksIndicator?.classList.add('bg-sky-400');
                tasksContent?.classList.remove('hidden');
                initProjectTasks(lead, isLead, isMember, isMentorOrAdmin);
            } else {
                mentorTabBtn?.classList.remove('text-zinc-400', 'hover:text-amber-400');
                mentorTabBtn?.classList.add('text-amber-400', 'font-bold');
                mentorIcon?.classList.remove('text-zinc-500', 'group-hover:text-amber-400');
                mentorIcon?.classList.add('text-amber-400');
                mentorIndicator?.classList.remove('bg-transparent');
                mentorIndicator?.classList.add('bg-amber-400');
                mentorContent?.classList.remove('hidden');
                initMentorChat(lead, isLead, isMember);
            }
        };

        if (overviewTabBtn) overviewTabBtn.onclick = () => switchTab('overview');
        if (tasksTabBtn) tasksTabBtn.onclick = () => switchTab('tasks');
        if (mentorTabBtn) mentorTabBtn.onclick = () => switchTab('mentor_chat');

        // Initial setup for tasks badge & tasks data
        initProjectTasks(lead, isLead, isMember, isMentorOrAdmin);

        if (currentProjectTab === 'mentor_chat') {
            initMentorChat(lead, isLead, isMember);
        } else if (currentProjectTab === 'tasks') {
            switchTab('tasks');
        }
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

        // Project Links Modal Events
        const openLinksModal = () => {
            const modal = document.getElementById('links-modal');
            if (modal) {
                modal.classList.remove('hidden');
                try {
                    if (!window.history.state?.modalOpen) {
                        window.history.pushState({ modalOpen: true, modal: 'links' }, '');
                    }
                } catch (e) {}
            }
        };

        const closeLinksModal = () => {
            document.getElementById('links-modal')?.classList.add('hidden');
        };

        document.getElementById('manage-links-btn')?.addEventListener('click', openLinksModal);
        document.getElementById('manage-links-header-btn')?.addEventListener('click', openLinksModal);
        document.getElementById('manage-links-config-btn')?.addEventListener('click', openLinksModal);
        document.getElementById('close-links-modal')?.addEventListener('click', closeLinksModal);
        document.getElementById('cancel-links-modal')?.addEventListener('click', closeLinksModal);

        // Add custom link row
        document.getElementById('add-custom-link-row-btn')?.addEventListener('click', () => {
            const container = document.getElementById('custom-links-container');
            if (container) {
                const wrapper = document.createElement('div');
                wrapper.innerHTML = `
                <div class="custom-link-row flex items-center gap-2 p-2 bg-zinc-950/60 border border-zinc-800 rounded-xl">
                    <input type="text" class="custom-link-name form-input text-xs w-1/3 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white" placeholder="Link Name (e.g. Docs)" value="">
                    <input type="text" class="custom-link-url form-input text-xs flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white" placeholder="https://..." value="">
                    <button type="button" class="remove-link-row-btn p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer" title="Remove Link">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>`;
                const row = wrapper.firstElementChild;
                container.appendChild(row);
                row.querySelector('.custom-link-name')?.focus();
            }
        });

        // Delegate remove custom link row
        document.getElementById('custom-links-container')?.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-link-row-btn');
            if (removeBtn) {
                removeBtn.closest('.custom-link-row')?.remove();
            }
        });

        // Submit Links Form
        document.getElementById('manage-links-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('save-links-submit-btn');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

            const allLinks = [];

            // 1. GitHub
            const ghUrl = document.getElementById('link-github-url')?.value.trim();
            const ghName = document.getElementById('link-github-name')?.value.trim() || 'GitHub Repository';
            if (ghUrl) {
                allLinks.push({ type: 'github', name: ghName, url: ghUrl });
            }

            // 2. YouTube
            const ytUrl = document.getElementById('link-youtube-url')?.value.trim();
            const ytName = document.getElementById('link-youtube-name')?.value.trim() || 'Demo Video';
            if (ytUrl) {
                allLinks.push({ type: 'youtube', name: ytName, url: ytUrl });
            }

            // 3. Custom links
            document.querySelectorAll('.custom-link-row').forEach(row => {
                const nameInput = row.querySelector('.custom-link-name');
                const urlInput = row.querySelector('.custom-link-url');
                const url = urlInput ? urlInput.value.trim() : '';
                const name = nameInput ? nameInput.value.trim() : '';
                if (url) {
                    allLinks.push({
                        type: detectLinkType(url, 'custom'),
                        name: name || 'Project Resource',
                        url: url
                    });
                }
            });

            const { error } = await ICCSupabase.updateLead(lead.id, { links: allLinks });

            if (error) {
                Toast.error('Failed to save links: ' + error.message);
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Links'; }
            } else {
                Toast.success('Project links updated!');
                closeLinksModal();
                await loadLeads();
                const c = document.getElementById('app');
                mount(c, lead.id);
            }
        });
    }

    
    async function deleteCurrentProject(leadId, leadTitle) {
        if (!ICCSupabase.isMentor() && !ICCSupabase.isAdmin()) {
            Toast.error('Unauthorized: Only Mentors and Admins can delete projects.');
            return;
        }

        if (!confirm(`Are you sure you want to permanently delete project "${leadTitle || 'Project'}"? All team memberships and project data will be removed.`)) {
            return;
        }

        const { error } = await ICCSupabase.deleteLead(leadId);
        if (error) {
            Toast.error('Failed to delete project: ' + (error.message || 'Unknown error'));
            return;
        }

        Toast.success('Project deleted successfully');
        await loadLeads();
        window.location.hash = '#teams';
    }

    function unmount() {
        if (currentTeamId) ICCSupabase?.unsubscribeChannel?.(`team-${currentTeamId}`);
        currentTeamId = null; teamMembers = [];
        const floatingBtn = document.getElementById('team-floating-back-btn');
        if (floatingBtn) floatingBtn.remove();
        const workforceModal = document.getElementById('workforce-action-modal');
        if (workforceModal) workforceModal.remove();
    }

    return {
        mount,
        unmount,
        goBack,
        handleMemberActionClick,
        openMemberActionModal,
        openCreateProjectModal,
        openMyApplicationsModal,
        getMemberTags,
        isLeadForTeam,
        deleteCurrentProject
    };
})();
