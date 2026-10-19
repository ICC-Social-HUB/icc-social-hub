/* ============================================
   ICC Social Hub — Mentor Dashboard View
   Full Project Application Approvals & 360° Project Audits
   ============================================ */
const MentorDashboardView = (() => {
    let activeTab = 'applications'; // 'applications' | 'all_projects'
    let applicationFilter = 'all'; // 'all' | 'Pending Review' | 'Changes Requested' | 'Approved'
    let searchQuery = '';
    let summary = { pending: 0, changesRequested: 0, approved: 0, totalProjects: 0, totalApplications: 0 };
    let applications = [];
    let projects = [];
    let allTasks = [];
    let taskFilter = 'all'; // 'all' | 'pending' | 'not_completed' | 'completed'
    let taskProjectFilter = 'all';
    let mentorMessages = [];
    let activeChatProjectId = null;
    let activeChatMessages = [];
    let activeChatUnsubscribe = null;
    let activeReplyTarget = null;
    let chatSearchQuery = '';
    let selectedAppDetail = null;
    let selectedProjectAudit = null;
    let isLoading = false;
    let isSubmitting = false;
    let isSendingChat = false;

    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function sanitizeRichText(html) {
        if (!html) return '';
        const str = String(html).trim();
        if (!str) return '';

        const hasTags = /<[a-z][\s\S]*>/i.test(str);
        if (!hasTags) {
            return escapeHtml(str).replace(/\n/g, '<br>');
        }

        const temp = document.createElement('div');
        temp.innerHTML = str;

        const dangerous = temp.querySelectorAll('script, style, iframe, object, embed, form, input, button, textarea, meta, link');
        dangerous.forEach(el => el.remove());

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

    function getTaskStatus(task) {
        if (!task) return 'pending';
        if (task.status === 'completed') return 'completed';
        if (task.deadline) {
            const today = new Date().toISOString().split('T')[0];
            const taskDl = String(task.deadline).split('T')[0];
            if (today > taskDl) return 'not_completed';
        }
        return 'pending';
    }

    function formatDeadlineDate(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    function formatTimeAgo(dateStr) {
        if (!dateStr) return 'recently';
        try {
            const diffMs = Date.now() - new Date(dateStr).getTime();
            const diffSec = Math.floor(diffMs / 1000);
            if (diffSec < 60) return 'just now';
            const diffMin = Math.floor(diffSec / 60);
            if (diffMin < 60) return diffMin + 'm ago';
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return diffHr + 'h ago';
            const diffDay = Math.floor(diffHr / 24);
            return diffDay + 'd ago';
        } catch (e) {
            return 'recently';
        }
    }

    async function loadData() {
        isLoading = true;
        try {
            const [sumRes, appsRes, leadsRes, msgsRes, tasksRes] = await Promise.all([
                ICCSupabase.fetchMentorDashboardSummary(),
                ICCSupabase.fetchAllProjectApplications(),
                ICCSupabase.fetchLeads(),
                typeof ICCSupabase.fetchAllProjectMentorMessages === 'function' ? ICCSupabase.fetchAllProjectMentorMessages() : { data: [] },
                typeof ICCSupabase.fetchAllProjectTasks === 'function' ? ICCSupabase.fetchAllProjectTasks() : []
            ]);

            if (sumRes.data) summary = sumRes.data;
            if (appsRes.data) applications = appsRes.data;
            if (leadsRes) projects = leadsRes;
            if (msgsRes?.data) mentorMessages = msgsRes.data;
            if (Array.isArray(tasksRes)) allTasks = tasksRes;

            if (activeChatProjectId) {
                const chatRes = await ICCSupabase.fetchProjectMentorMessages(activeChatProjectId);
                if (chatRes?.data) activeChatMessages = chatRes.data;
            }

            if (typeof RegistrationQueue !== 'undefined') {
                await RegistrationQueue.initData();
            }
        } catch (e) {
            console.error('MentorDashboardView loadData error:', e);
            Toast.error('Could not load mentor dashboard data');
        } finally {
            isLoading = false;
        }
    }

    function getFilteredApplications() {
        const query = searchQuery.trim().toLowerCase();
        return applications.filter(app => {
            const matchesFilter = applicationFilter === 'all' || app.status === applicationFilter;
            const searchTarget = `${app.project_name || ''} ${app.team_name || ''} ${app.applicant?.full_name || ''} ${app.applicant?.email || ''} ${app.project_code || ''}`.toLowerCase();
            const matchesSearch = !query || searchTarget.includes(query);
            return matchesFilter && matchesSearch;
        });
    }

    function getFilteredProjects() {
        const query = searchQuery.trim().toLowerCase();
        return projects.filter(p => {
            const searchTarget = `${p.project_name || ''} ${p.team || ''} ${p.name || ''} ${p.project_code || ''}`.toLowerCase();
            return !query || searchTarget.includes(query);
        });
    }

    function renderSummaryMetrics() {
        return `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <!-- Pending Review -->
            <div class="glass-card rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60 transition-all cursor-pointer group" onclick="MentorDashboardView.setFilter('Pending Review')">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Pending Review</span>
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                </div>
                <div class="flex items-baseline gap-1.5 mt-2">
                    <span class="text-2xl sm:text-3xl font-extrabold text-white">${summary.pending}</span>
                    <span class="text-xs text-amber-400/80">awaiting</span>
                </div>
            </div>

            <!-- Changes Requested -->
            <div class="glass-card rounded-2xl p-4 border border-orange-500/30 bg-orange-500/5 hover:border-orange-500/60 transition-all cursor-pointer group" onclick="MentorDashboardView.setFilter('Changes Requested')">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Changes Requested</span>
                    <span class="text-xs">🔄</span>
                </div>
                <div class="flex items-baseline gap-1.5 mt-2">
                    <span class="text-2xl sm:text-3xl font-extrabold text-white">${summary.changesRequested}</span>
                    <span class="text-xs text-orange-400/80">in revision</span>
                </div>
            </div>

            <!-- Approved Applications -->
            <div class="glass-card rounded-2xl p-4 border border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60 transition-all cursor-pointer group" onclick="MentorDashboardView.setFilter('Approved')">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Approved</span>
                    <span class="text-xs">✓</span>
                </div>
                <div class="flex items-baseline gap-1.5 mt-2">
                    <span class="text-2xl sm:text-3xl font-extrabold text-white">${summary.approved}</span>
                    <span class="text-xs text-emerald-400/80">applications</span>
                </div>
            </div>

            <!-- Total Active Projects -->
            <div class="glass-card rounded-2xl p-4 border border-sky-500/30 bg-sky-500/5 hover:border-sky-500/60 transition-all cursor-pointer group" onclick="MentorDashboardView.setActiveTab('all_projects')">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Total Projects</span>
                    <span class="text-xs">🚀</span>
                </div>
                <div class="flex items-baseline gap-1.5 mt-2">
                    <span class="text-2xl sm:text-3xl font-extrabold text-white">${summary.totalProjects}</span>
                    <span class="text-xs text-sky-400/80">active in hub</span>
                </div>
            </div>
        </div>
        `;
    }

    function renderStatusPill(status) {
        if (status === 'Pending Review') {
            return `<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>Pending Review</span>`;
        }
        if (status === 'Changes Requested') {
            return `<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400">⚠️ Changes Requested</span>`;
        }
        if (status === 'Approved') {
            return `<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">✓ Approved</span>`;
        }
        return `<span class="text-xs font-semibold text-zinc-400">${escapeHtml(status)}</span>`;
    }

    function renderApplicationCard(app) {
        const applicant = app.applicant || {};
        const appName = applicant.full_name || applicant.username || 'Applicant';
        const dateStr = app.created_at ? new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        const specialties = Array.isArray(app.specialties) ? app.specialties : [];

        return `
        <div class="p-4 sm:p-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 hover:border-zinc-700/80 transition-all space-y-3.5 group shadow-sm">
            <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <h4 class="font-heading font-bold text-base text-white group-hover:text-emerald-400 transition-colors break-words">${escapeHtml(app.project_name)}</h4>
                        ${renderStatusPill(app.status)}
                        <span class="text-xs font-mono text-zinc-400">Rev #${app.revision_number || 1}</span>
                        ${app.project_code ? `<span class="text-xs font-mono font-bold text-emerald-400">${escapeHtml(app.project_code)}</span>` : ''}
                    </div>
                    <p class="text-xs text-zinc-400">Team: <span class="text-zinc-200 font-semibold">${escapeHtml(app.team_name || app.project_name)}</span> · Submitted on ${dateStr}</p>
                </div>

                <button onclick="MentorDashboardView.openApplicationModal('${app.id}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5">
                    <span>Review Application</span>
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
            </div>

            <p class="text-xs text-zinc-300 leading-relaxed line-clamp-2 bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-800/60">${escapeHtml(app.description)}</p>

            <div class="flex items-center justify-between gap-3 pt-1 border-t border-zinc-800/60 flex-wrap text-xs text-zinc-400">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                        ${(appName || '?').charAt(0).toUpperCase()}
                    </div>
                    <span>Lead Applicant: <strong class="text-zinc-200 font-medium">${escapeHtml(appName)}</strong> (${escapeHtml(applicant.email || 'No email')})</span>
                </div>

                ${specialties.length > 0 ? `
                <div class="flex items-center gap-1.5 flex-wrap">
                    ${specialties.slice(0, 3).map(s => `<span class="text-[11px] text-zinc-400 font-medium">${escapeHtml(s)}</span>`).join('<span class="text-zinc-600">•</span>')}
                    ${specialties.length > 3 ? `<span class="text-[10px] text-zinc-500">+${specialties.length - 3}</span>` : ''}
                </div>
                ` : ''}
            </div>
        </div>
        `;
    }

    function renderProjectRow(project) {
        const milestones = project.milestones || {};
        const completedCount = Object.values(milestones).filter(Boolean).length;
        const progress = Math.round((completedCount / 8) * 100);

        return `
        <div class="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 hover:border-zinc-700/80 transition-all flex items-center justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-3.5 min-w-0 flex-1">
                <div class="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 font-heading font-bold text-base text-emerald-400 overflow-hidden shadow-inner">
                    ${project.avatar_url ? `<img src="${project.avatar_url}" class="w-full h-full object-cover">` : escapeHtml(project.initials || 'PRJ')}
                </div>
                <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <h4 class="font-heading font-bold text-sm sm:text-base text-white truncate">${escapeHtml(project.project_name || project.team)}</h4>
                        <span class="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-emerald-500/15 text-emerald-400">${escapeHtml(project.project_code || 'PRJ-2026-XXXX')}</span>
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-900/80 text-zinc-400">${escapeHtml(project.team)}</span>
                    </div>
                    <p class="text-xs text-zinc-400 mt-0.5">Project Lead: <span class="text-zinc-200 font-medium">${escapeHtml(project.name)}</span> · Milestone: <span class="text-emerald-400 font-semibold">${progress}%</span></p>
                </div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
                <button onclick="MentorDashboardView.goToProjectAudit(${project.id})" class="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 border border-zinc-800 hover:border-emerald-500/40 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95" title="Redirect to Project Page in Teams">
                    <span>360° Project Audit</span>
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </button>
                <button onclick="MentorDashboardView.deleteProject(${project.id}, '${escapeHtml(project.project_name || project.team).replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95" title="Permanently delete project">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    <span>Delete</span>
                </button>
            </div>
        </div>
        `;
    }

    function render() {
        const filteredApps = getFilteredApplications();
        const filteredProjects = getFilteredProjects();

        return `
        <div class="min-h-screen relative pb-16 w-full">
            <div class="w-full max-w-[1760px] mx-auto px-2.5 sm:px-4 md:px-6 lg:px-8 xl:px-10 pt-4 sm:pt-6 pb-12 space-y-6">
                <!-- Top Navigation & Title Bar -->
                <div class="flex items-center justify-between flex-wrap gap-4 border-b border-zinc-800/80 pb-5">
                    <div class="flex items-center gap-3">
                        <button onclick="window.location.hash='#dashboard'" class="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 rounded-xl text-xs font-semibold text-white border border-zinc-800 transition-all cursor-pointer shadow-md active:scale-95">
                            <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                            <span>Back to Hub</span>
                        </button>
                        <div>
                            <div class="flex items-center gap-2">
                                <h1 class="font-heading font-bold text-xl sm:text-2xl text-white tracking-tight">Mentor Dashboard</h1>
                                <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">Mentor & Super Admin</span>
                            </div>
                            <p class="text-xs text-zinc-400 mt-0.5">Project Application Approvals, Revision Tracking & Complete 360° Innovation Audits</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <button onclick="MentorDashboardView.refresh()" class="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 border border-zinc-800 rounded-xl transition-all cursor-pointer" title="Refresh Data">
                            <svg class="w-4 h-4 ${isLoading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Summary Overview -->
                ${renderSummaryMetrics()}

                <!-- Main Tabs & Controls -->
                <div class="glass-card rounded-2xl p-4 sm:p-5 border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl space-y-4">
                    <div class="flex items-center justify-between flex-wrap gap-3 border-b border-zinc-800/60 pb-3">
                        <div class="flex items-center gap-2 flex-wrap">
                            <button onclick="MentorDashboardView.setActiveTab('applications')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'applications' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}">
                                Project Applications (${applications.length})
                            </button>
                            <button onclick="MentorDashboardView.setActiveTab('all_projects')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'all_projects' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}">
                                All Live Projects (${projects.length})
                            </button>
                            <button onclick="MentorDashboardView.setActiveTab('mentor_chat')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'mentor_chat' ? 'bg-amber-500 text-zinc-950 font-extrabold shadow-md shadow-amber-500/25' : 'bg-zinc-900 text-zinc-400 hover:text-amber-400 border border-zinc-800'}">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                                <span>Mentor Chat</span>
                                ${mentorMessages.length > 0 ? `<span class="px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'mentor_chat' ? 'bg-zinc-950 text-amber-400 font-extrabold' : 'bg-amber-500/20 text-amber-400 font-bold'}">${mentorMessages.length}</span>` : ''}
                            </button>
                            <button onclick="MentorDashboardView.setActiveTab('tasks')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'tasks' ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M9 11l3 3L22 4"/>
                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                </svg>
                                <span>Track Tasks</span>
                                ${allTasks.length > 0 ? `<span class="px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'tasks' ? 'bg-white/20 text-white' : 'bg-sky-500/20 text-sky-400'} font-bold">${allTasks.length}</span>` : ''}
                            </button>
                            <button onclick="MentorDashboardView.setActiveTab('registration_requests')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'registration_requests' ? 'bg-[#3390ec] text-white shadow-md shadow-sky-600/25' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                                <span>Registration Requests</span>
                            </button>
                        </div>

                        <!-- Search Bar -->
                        <div class="relative w-full sm:w-72">
                            <input type="text" id="mentor-search-input" value="${escapeHtml(searchQuery)}" placeholder="Search by name, code, lead..." class="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-white placeholder-zinc-500 outline-none transition-colors">
                            <svg class="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                    </div>

                    ${activeTab === 'applications' ? `
                    <!-- Status Filter Pills for Applications -->
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <button onclick="MentorDashboardView.setFilter('all')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${applicationFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white bg-zinc-950/60'}">All (${applications.length})</button>
                        <button onclick="MentorDashboardView.setFilter('Pending Review')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${applicationFilter === 'Pending Review' ? 'bg-amber-500/15 text-amber-300' : 'text-zinc-400 hover:text-white bg-zinc-950/60'}">Pending Review (${summary.pending})</button>
                        <button onclick="MentorDashboardView.setFilter('Changes Requested')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${applicationFilter === 'Changes Requested' ? 'bg-orange-500/20 text-orange-300' : 'text-zinc-400 hover:text-white bg-zinc-950/60'}">Changes Requested (${summary.changesRequested})</button>
                        <button onclick="MentorDashboardView.setFilter('Approved')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${applicationFilter === 'Approved' ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-400 hover:text-white bg-zinc-950/60'}">Approved (${summary.approved})</button>
                    </div>

                    <!-- Applications List -->
                    <div class="space-y-3 pt-2">
                        ${isLoading ? `
                            <div class="p-12 text-center text-zinc-500 text-sm flex items-center justify-center gap-2">
                                <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                <span>Loading project applications...</span>
                            </div>
                        ` : filteredApps.length === 0 ? `
                            <div class="p-12 text-center bg-zinc-950/40 rounded-2xl border border-dashed border-zinc-800 text-zinc-500 text-sm">
                                <p class="text-base font-semibold text-zinc-400 mb-1">No applications found</p>
                                <p class="text-xs">No project submissions match the current filter criteria.</p>
                            </div>
                        ` : filteredApps.map(app => renderApplicationCard(app)).join('')}
                    </div>
                    ` : (activeTab === 'all_projects' ? `
                    <!-- All Projects List -->
                    <div class="space-y-3 pt-2">
                        ${isLoading ? `
                            <div class="p-12 text-center text-zinc-500 text-sm flex items-center justify-center gap-2">
                                <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                <span>Loading live projects...</span>
                            </div>
                        ` : filteredProjects.length === 0 ? `
                            <div class="p-12 text-center bg-zinc-950/40 rounded-2xl border border-dashed border-zinc-800 text-zinc-500 text-sm">
                                <p class="text-base font-semibold text-zinc-400 mb-1">No projects found</p>
                                <p class="text-xs">No live innovation projects match your search query.</p>
                            </div>
                        ` : filteredProjects.map(p => renderProjectRow(p)).join('')}
                    </div>
                    ` : `
                    <!-- Tab Content Switcher -->
                    ${activeTab === 'mentor_chat' ? renderMentorChatHub() : (activeTab === 'registration_requests' ? (typeof RegistrationQueue !== 'undefined' ? `<div class="pt-2">${RegistrationQueue.renderRequestsArea()}</div>` : '') : renderTasksTrackerView())}
                    `)}
                </div>
            </div>

            <!-- Application Review Modal / Drawer Mount -->
            <div id="mentor-app-modal-root"></div>
            <!-- Project 360 Audit Modal Mount -->
            <div id="mentor-audit-modal-root"></div>
        </div>
        `;
    }

    function showRequestChangesBox() {
        const box = document.getElementById('request-changes-box');
        if (box) {
            box.classList.remove('hidden');
            box.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById('changes-comment-input')?.focus();
        }
    }

    async function openApplicationModal(appId) {
        const root = document.getElementById('mentor-app-modal-root');
        if (!root) return;

        root.innerHTML = `
        <div class="fixed inset-0 z-[2500] bg-zinc-950 text-white w-full h-full min-h-screen flex flex-col items-center justify-center animate-fade-in" id="mentor-modal-backdrop">
            <div class="flex flex-col items-center gap-3">
                <div class="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-xs text-zinc-400 font-medium">Loading Application Review Dossier...</p>
            </div>
        </div>
        `;

        const res = await ICCSupabase.fetchApplicationDetails(appId);
        if (res.error || !res.data) {
            Toast.error('Could not load application details: ' + (res.error?.message || 'Error'));
            root.innerHTML = '';
            return;
        }

        selectedAppDetail = res.data;
        renderApplicationModalContent();
    }

    function renderApplicationModalContent() {
        const root = document.getElementById('mentor-app-modal-root');
        if (!root || !selectedAppDetail) return;

        const { application: app, comments = [], history = [] } = selectedAppDetail;
        const applicant = app.applicant || {};
        const isApproved = app.status === 'Approved';
        const revisions = Array.isArray(app.revisions) ? app.revisions : [];

        root.innerHTML = `
        <div class="fixed inset-0 z-[2500] bg-zinc-950 text-white w-full h-full min-h-screen flex flex-col overflow-hidden animate-fade-in" id="mentor-modal-backdrop">
            <!-- Full Width Top Navigation Bar (h-16) -->
            <header class="h-16 px-4 sm:px-6 md:px-8 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 z-20">
                <div class="flex items-center gap-3 min-w-0">
                    <button onclick="MentorDashboardView.closeModal()" type="button" class="flex items-center gap-2 px-3.5 py-1.5 text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm" title="Back to Review Queue">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                        <span>Back</span>
                    </button>
                    <div class="h-5 w-px bg-zinc-800 hidden sm:block"></div>
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400 flex-shrink-0">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h1 class="font-heading font-bold text-sm sm:text-base text-white truncate max-w-xs sm:max-w-md">${escapeHtml(app.project_name)}</h1>
                                ${renderStatusPill(app.status)}
                                <span class="text-xs font-mono text-zinc-400">Rev #${app.revision_number || 1}</span>
                            </div>
                            <p class="text-[11px] text-zinc-400 truncate">Applicant: <strong class="text-zinc-200">${escapeHtml(applicant.full_name || 'Applicant')}</strong> (${escapeHtml(applicant.email || '')})</p>
                        </div>
                    </div>
                </div>

                <!-- Top Navigation Actions -->
                <div class="flex items-center gap-2.5 flex-shrink-0">
                    ${!isApproved ? `
                        <button id="top-request-changes-btn" onclick="MentorDashboardView.showRequestChangesBox()" class="px-3.5 py-2 bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            <span class="hidden sm:inline">Request Changes</span>
                        </button>
                        <button id="top-approve-project-btn" onclick="MentorDashboardView.showApproveConfirmModal('${app.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95 flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                            <span>Approve Project</span>
                        </button>
                    ` : `
                        <div class="px-3.5 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>Live (Code: ${escapeHtml(app.project_code || '')})</span>
                        </div>
                    `}
                    <button onclick="MentorDashboardView.closeModal()" class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer" title="Close Page">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            </header>

            <!-- 2-Column Full Screen Body -->
            <div class="flex-1 h-[calc(100vh-64px)] grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                
                <!-- Left Column: Applicant & Proposal Dossier (lg:col-span-7) -->
                <div class="lg:col-span-7 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-950">
                    
                    <!-- Changes Request Form Card (Appears at top of dossier when toggled) -->
                    <div id="request-changes-box" class="hidden p-5 rounded-2xl border border-rose-500/40 bg-zinc-900 space-y-3 animate-fade-in shadow-xl">
                        <div class="flex items-center justify-between border-b border-zinc-800 pb-2">
                            <h3 class="text-xs font-bold text-rose-400 flex items-center gap-2 uppercase tracking-wider">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                                <span>Specify Required Changes & Revisions</span>
                            </h3>
                            <button onclick="document.getElementById('request-changes-box').classList.add('hidden')" class="text-xs text-zinc-400 hover:text-white cursor-pointer">Cancel</button>
                        </div>
                        <p class="text-xs text-zinc-300">Explain clearly what improvements the applicant must make before approval. This will transition status to "Changes Requested" and notify the applicant to resubmit.</p>
                        <textarea id="changes-comment-input" rows="4" placeholder="Detail the requested changes: technical architecture clarifications, repo link requirements, security considerations..." class="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-rose-500 rounded-xl text-xs text-white placeholder-zinc-500 outline-none resize-none leading-relaxed"></textarea>
                        <div class="flex justify-end gap-2 pt-1">
                            <button type="button" onclick="document.getElementById('request-changes-box').classList.add('hidden')" class="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer">
                                Dismiss
                            </button>
                            <button id="submit-changes-btn" onclick="MentorDashboardView.confirmRequestChanges('${app.id}')" class="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5">
                                <span>Submit Request for Changes</span>
                            </button>
                        </div>
                    </div>

                    <!-- Existing Mentor Requested Changes Banner -->
                    ${app.status === 'Changes Requested' ? `
                        <div class="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-2 text-rose-300">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-rose-200 flex items-center gap-1.5 uppercase tracking-wider">
                                    <svg class="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                                    Changes Currently Requested:
                                </span>
                                ${([...history].reverse().find(h => (h.new_status || h.to_status) === 'Changes Requested')?.created_at) ? `<span class="text-[10px] text-zinc-400 font-mono">${new Date([...history].reverse().find(h => (h.new_status || h.to_status) === 'Changes Requested').created_at).toLocaleString()}</span>` : ''}
                            </div>
                            <div class="text-xs text-zinc-100 bg-zinc-950/80 p-3 rounded-xl italic whitespace-pre-wrap">
                                "${escapeHtml(([...history].reverse().find(h => (h.new_status || h.to_status) === 'Changes Requested' && (h.comment || h.notes))?.comment) || ([...comments].reverse().find(c => c.is_mentor_feedback && (c.content || c.comment))?.content) || 'A mentor requested revisions on this proposal. Waiting for the applicant to resubmit.')}"
                            </div>
                        </div>
                    ` : ''}

                    <!-- Applicant Profile Card -->
                    <div class="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-bold text-base flex items-center justify-center flex-shrink-0">
                                ${(applicant.full_name || 'A').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 class="font-bold text-sm text-white">${escapeHtml(applicant.full_name || 'Applicant')}</h3>
                                <p class="text-xs text-zinc-400">${escapeHtml(applicant.email || 'No email provided')}</p>
                                <span class="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800/80 text-zinc-300 mt-1 capitalize">${escapeHtml(applicant.role || 'Member')}</span>
                            </div>
                        </div>
                        <div class="text-right text-xs text-zinc-400 space-y-0.5">
                            <p class="text-[11px] text-zinc-500">Submitted On</p>
                            <p class="font-medium text-white">${app.created_at ? new Date(app.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'}</p>
                        </div>
                    </div>

                    <!-- Project Proposal Card -->
                    <div class="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-5">
                        <div class="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
                            <div>
                                <h2 class="font-heading font-bold text-lg text-white">${escapeHtml(app.project_name)}</h2>
                                <p class="text-xs text-zinc-400 mt-0.5">Team Name: <span class="text-zinc-200 font-semibold">${escapeHtml(app.team_name || app.project_name)}</span></p>
                            </div>
                            <div class="text-right">
                                <span class="text-[10px] text-zinc-500 block">Unique Project Code</span>
                                <span class="font-mono text-xs ${app.project_code ? 'text-emerald-400 font-bold' : 'text-zinc-500'}">${escapeHtml(app.project_code || 'Assigned upon approval')}</span>
                            </div>
                        </div>

                        <!-- Description -->
                        <div class="space-y-2">
                            <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Description & Project Vision</h3>
                            <div class="prose-clean text-xs sm:text-sm text-zinc-200 leading-relaxed bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80">
                                ${sanitizeRichText(app.description)}
                            </div>
                        </div>

                        <!-- Tech Stack / Specialties -->
                        ${Array.isArray(app.specialties) && app.specialties.length > 0 ? `
                            <div class="space-y-2 pt-2 border-t border-zinc-800/60">
                                <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tech Stack & Domains</h3>
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    ${app.specialties.map(s => `<span class="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800/80 text-zinc-200">${escapeHtml(s)}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Attached Links -->
                        ${Array.isArray(app.links) && app.links.length > 0 ? `
                            <div class="space-y-2 pt-2 border-t border-zinc-800/60">
                                <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Attached Links & Resources</h3>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    ${app.links.map(l => `
                                        <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="p-2.5 bg-zinc-950/70 hover:bg-zinc-800/70 border border-zinc-800 hover:border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-400 transition-colors group">
                                            <span class="truncate font-medium flex items-center gap-1.5">🔗 ${escapeHtml(l.name || l.url)}</span>
                                            <svg class="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                        </a>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Revision History -->
                    ${revisions.length > 1 ? `
                        <div class="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3">
                            <h3 class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Revision History (${revisions.length} iterations)</h3>
                            <div class="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                                ${revisions.map((rev, idx) => `
                                    <div class="p-3 bg-zinc-950/70 rounded-xl border border-zinc-800 text-xs space-y-1">
                                        <div class="flex items-center justify-between text-zinc-400 text-[11px]">
                                            <span class="font-bold text-white">Revision #${rev.revision || (idx + 1)}</span>
                                            <span>${rev.submitted_at ? new Date(rev.submitted_at).toLocaleString() : ''}</span>
                                        </div>
                                        <p class="text-zinc-300 italic line-clamp-2">"${escapeHtml(rev.description || '')}"</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Right Column: Discussion Thread & Audit Trail (lg:col-span-5) -->
                <div class="lg:col-span-5 h-full flex flex-col bg-zinc-900/30 overflow-hidden">
                    
                    <!-- Discussion Header -->
                    <div class="p-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between flex-shrink-0">
                        <div class="flex items-center gap-2">
                            <div class="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                            <h3 class="font-bold text-xs uppercase tracking-wider text-white">Discussion Thread</h3>
                        </div>
                        <span id="mentor-comments-count-pill" class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800/80 text-zinc-300">
                            ${comments.length} message${comments.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    <!-- Scrollable Comments Thread -->
                    <div id="mentor-comment-thread" class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                        ${comments.length === 0 ? `
                            <div class="p-6 text-center bg-zinc-900/20 rounded-xl text-xs text-zinc-500 italic">
                                No comments yet. Write guidance, clarifications, or requested changes below.
                            </div>
                        ` : comments.map(c => {
                            const isFeedback = c.is_mentor_feedback;
                            const isAuthorMe = c.author_id === ICCSupabase.getUser()?.id;
                            const authorName = c.author?.full_name || 'Applicant';
                            const roleBadge = isFeedback ? '🎓 Mentor' : 'Applicant';
                            return `
                            <div class="p-3.5 rounded-xl border ${isFeedback ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-950/70'} text-xs space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold ${isFeedback ? 'text-emerald-400' : 'text-white'}">${escapeHtml(authorName)}</span>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isFeedback ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}">${roleBadge}</span>
                                        ${isAuthorMe ? `<span class="text-[10px] text-zinc-500">(You)</span>` : ''}
                                    </div>
                                    <span class="text-[10px] text-zinc-500">${c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                                </div>
                                <p class="text-zinc-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(c.content || c.comment || '')}</p>
                            </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- Reply Box at bottom with Visual Feedback -->
                    <div class="p-4 border-t border-zinc-800 bg-zinc-900/70 flex-shrink-0 space-y-2">
                        <div class="flex items-end gap-2">
                            <textarea id="mentor-reply-input" rows="2" placeholder="Write feedback or guidance for the applicant..." class="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-white placeholder-zinc-500 outline-none resize-none leading-relaxed transition-colors"></textarea>
                            <button id="mentor-send-reply-btn" onclick="MentorDashboardView.sendComment('${app.id}')" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 flex-shrink-0">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                                <span>Send</span>
                            </button>
                        </div>
                    </div>

                    <!-- Status History Audit at bottom -->
                    ${history.length > 0 ? `
                        <div class="border-t border-zinc-800 bg-zinc-900/50 p-3.5 flex-shrink-0 max-h-36 overflow-y-auto">
                            <h4 class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Audit Trail</h4>
                            <div class="space-y-1.5 text-[11px]">
                                ${history.map(h => `
                                    <div class="flex items-center justify-between text-zinc-400 py-1 border-b border-zinc-800/40 last:border-0">
                                        <span class="text-zinc-300"><strong class="text-white">${escapeHtml(h.changer?.full_name || 'System')}</strong> → <span class="text-emerald-400 font-semibold">${escapeHtml(h.new_status)}</span></span>
                                        <span class="text-[10px] text-zinc-500">${h.created_at ? new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                </div>
            </div>
        </div>
        `;
    }

    async function sendComment(appId) {
        const input = document.getElementById('mentor-reply-input');
        const btn = document.getElementById('mentor-send-reply-btn');
        if (!input) return;
        const val = input.value.trim();
        if (!val) return;

        input.disabled = true;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> <span>Sending...</span>`;
        }

        const res = await ICCSupabase.addApplicationComment(appId, val, true);
        input.disabled = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg> <span>Send</span>`;
        }

        if (res.error) {
            Toast.error('Could not post comment: ' + res.error.message);
        } else {
            Toast.success('Reply sent to applicant');
            input.value = '';
            if (selectedAppDetail) {
                if (!Array.isArray(selectedAppDetail.comments)) selectedAppDetail.comments = [];
                selectedAppDetail.comments.push(res.data);
                renderApplicationModalContent();
                const thread = document.getElementById('mentor-comment-thread');
                if (thread) thread.scrollTop = thread.scrollHeight;
            }
        }
    }

    async function confirmRequestChanges(appId) {
        const input = document.getElementById('changes-comment-input');
        const btn = document.getElementById('submit-changes-btn');
        const comment = input ? input.value.trim() : '';
        if (!comment) {
            Toast.error('Please write an explanation for the requested changes.');
            input?.focus();
            return;
        }

        if (isSubmitting) return;
        isSubmitting = true;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> <span>Submitting...</span>`;
        }

        const res = await ICCSupabase.requestApplicationChanges(appId, comment);
        isSubmitting = false;

        if (res.error) {
            Toast.error('Failed to request changes: ' + (res.error.message || res.error));
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<span>Submit Request for Changes</span>`;
            }
        } else {
            Toast.success('⚠️ Status updated to "Changes Requested". Applicant notified.');
            if (selectedAppDetail?.application) {
                selectedAppDetail.application.status = 'Changes Requested';
                renderApplicationModalContent();
            } else {
                closeModal();
            }
            await loadData();
        }
    }

    function showApproveConfirmModal(appId) {
        const app = selectedAppDetail?.application || applications.find(a => a.id === appId) || {};
        const projectName = app.project_name || 'Project Application';
        const teamName = app.team_name || projectName;

        let modalRoot = document.getElementById('mentor-approve-confirm-modal-root');
        if (!modalRoot) {
            modalRoot = document.createElement('div');
            modalRoot.id = 'mentor-approve-confirm-modal-root';
            document.body.appendChild(modalRoot);
        }

        modalRoot.innerHTML = `
        <div class="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onclick="if(event.target === this) MentorDashboardView.closeApproveConfirmModal()">
            <div class="glass-card bg-zinc-950/95 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-scale-up" onclick="event.stopPropagation()">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div class="space-y-1 min-w-0 flex-1">
                        <h3 class="font-heading font-bold text-base text-white">Approve Project Application</h3>
                        <p class="text-xs text-zinc-400 truncate">Project: <strong class="text-white">${escapeHtml(projectName)}</strong></p>
                    </div>
                </div>

                <div class="text-xs sm:text-sm text-zinc-300 leading-relaxed bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/60">
                    Are you sure you want to approve this project application? It will immediately become live in the public Projects directory with a unique project code, and the applicant will be appointed as Project Lead.
                </div>

                <div class="flex items-center justify-end gap-3 pt-1">
                    <button type="button" onclick="MentorDashboardView.closeApproveConfirmModal()" class="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium text-xs transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button id="modal-confirm-approve-btn" type="button" onclick="MentorDashboardView.executeApprove('${appId}')" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center gap-2">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        <span>Confirm Approval</span>
                    </button>
                </div>
            </div>
        </div>
        `;
    }

    function closeApproveConfirmModal() {
        const modalRoot = document.getElementById('mentor-approve-confirm-modal-root');
        if (modalRoot) modalRoot.innerHTML = '';
    }

    async function executeApprove(appId) {
        if (isSubmitting) return;
        isSubmitting = true;
        const confirmBtn = document.getElementById('modal-confirm-approve-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> <span>Approving...</span>`;
        }

        const res = await ICCSupabase.approveProjectApplication(appId);
        isSubmitting = false;

        if (res.error) {
            Toast.error('Failed to approve project: ' + (res.error.message || res.error));
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> <span>Try Again</span>`;
            }
        } else {
            closeApproveConfirmModal();
            Toast.success(`🎉 Project approved! Generated Code: ${res.projectCode}`);
            if (selectedAppDetail?.application) {
                selectedAppDetail.application.status = 'Approved';
                selectedAppDetail.application.project_code = res.projectCode;
                renderApplicationModalContent();
            } else {
                closeModal();
            }
            await loadData();
        }
    }

    function approveApplication(appId) {
        showApproveConfirmModal(appId);
    }

    async function openProjectAuditModal(projectId) {
        const root = document.getElementById('mentor-audit-modal-root');
        if (!root) return;

        root.innerHTML = `
        <div class="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
            <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-zoom-in">
                <div class="p-6 border-b border-zinc-800 flex items-center justify-center text-zinc-400 text-sm gap-2">
                    <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Auditing 360° project records...</span>
                </div>
            </div>
        </div>
        `;

        const res = await ICCSupabase.fetchProjectForMentor(projectId);
        if (res.error || !res.data) {
            Toast.error('Could not load project audit: ' + (res.error?.message || 'Error'));
            root.innerHTML = '';
            return;
        }

        selectedProjectAudit = res.data;
        renderProjectAuditModalContent();
    }

    function renderProjectAuditModalContent() {
        const root = document.getElementById('mentor-audit-modal-root');
        if (!root || !selectedProjectAudit) return;

        const { project, leadUser, members, application, comments, history } = selectedProjectAudit;
        const leadName = leadUser?.full_name || project.name || 'Lead';
        const leadEmail = leadUser?.email || 'N/A';
        const leadPhone = leadUser?.phone || 'N/A';
        const leadUsn = leadUser?.usn || 'N/A';
        const leadBranch = leadUser?.branch || 'N/A';
        const leadYear = leadUser?.year || 'N/A';

        const milestones = project.milestones || {};
        const completedCount = Object.values(milestones).filter(Boolean).length;
        const progress = Math.round((completedCount / 8) * 100);

        root.innerHTML = `
        <div class="fixed inset-0 z-[150] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md" id="mentor-audit-backdrop">
            <div class="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl animate-zoom-in overflow-hidden" onclick="event.stopPropagation()">
                
                <!-- Audit Header -->
                <div class="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-900/60">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300">360° Mentor Audit</span>
                            <h3 class="font-heading font-bold text-lg text-white break-words">${escapeHtml(project.project_name || project.team)}</h3>
                            <span class="font-mono text-xs font-bold text-emerald-400">${escapeHtml(project.project_code || 'PRJ-2026-XXXX')}</span>
                        </div>
                        <p class="text-xs text-zinc-400 mt-0.5">Team: <strong class="text-white">${escapeHtml(project.team)}</strong> · Created: ${project.created_at ? new Date(project.created_at).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="MentorDashboardView.deleteProjectFromAudit(${project.id}, '${escapeHtml(project.project_name || project.team).replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95" title="Permanently delete project">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            <span>Delete Project</span>
                        </button>
                        <button onclick="MentorDashboardView.closeAuditModal()" class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white cursor-pointer" title="Close">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Audit Body -->
                <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
                    
                    <!-- 1. Project Lead Deep Profile (Exclusive Mentor Access) -->
                    <div class="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                        <h4 class="font-heading font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                            <span>👤 Project Lead Confidential Dossier</span>
                        </h4>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                            <div><span class="text-zinc-500 block text-[10px] uppercase font-semibold">Full Name</span><span class="text-white font-medium">${escapeHtml(leadName)}</span></div>
                            <div><span class="text-zinc-500 block text-[10px] uppercase font-semibold">Email</span><span class="text-white font-mono">${escapeHtml(leadEmail)}</span></div>
                            <div><span class="text-zinc-500 block text-[10px] uppercase font-semibold">Phone</span><span class="text-white font-mono">${escapeHtml(leadPhone)}</span></div>
                            <div><span class="text-zinc-500 block text-[10px] uppercase font-semibold">USN</span><span class="text-white font-mono">${escapeHtml(leadUsn)}</span></div>
                            <div><span class="text-zinc-500 block text-[10px] uppercase font-semibold">Branch</span><span class="text-white">${escapeHtml(leadBranch)}</span></div>
                            <div><span class="text-zinc-500 block text-[10px] uppercase font-semibold">Year</span><span class="text-white">${escapeHtml(leadYear)}</span></div>
                        </div>
                    </div>

                    <!-- 2. Full Member Roster with Contact Info -->
                    <div class="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                        <div class="flex items-center justify-between">
                            <h4 class="font-heading font-bold text-xs uppercase tracking-wider text-zinc-300">
                                Active Workforce (${members.length} contributors)
                            </h4>
                            <span class="text-[10px] text-zinc-500">Contact details restricted to mentors</span>
                        </div>

                        ${members.length === 0 ? `
                            <p class="text-zinc-500 italic py-2">No team members enrolled yet.</p>
                        ` : `
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="border-b border-zinc-800 text-[10px] font-semibold text-zinc-500 uppercase">
                                        <th class="py-2 pr-3">Member</th>
                                        <th class="py-2 pr-3">Email</th>
                                        <th class="py-2 pr-3">Phone</th>
                                        <th class="py-2 pr-3">USN</th>
                                        <th class="py-2">Joined</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-zinc-800/60">
                                    ${members.map(m => {
                                        const p = m.profile || {};
                                        return `
                                        <tr class="text-xs">
                                            <td class="py-2.5 pr-3 font-semibold text-white whitespace-nowrap">${escapeHtml(p.full_name || p.username || 'Anon')}</td>
                                            <td class="py-2.5 pr-3 font-mono text-zinc-400 whitespace-nowrap">${escapeHtml(p.email || 'N/A')}</td>
                                            <td class="py-2.5 pr-3 font-mono text-zinc-400 whitespace-nowrap">${escapeHtml(p.phone || 'N/A')}</td>
                                            <td class="py-2.5 pr-3 font-mono text-zinc-400 whitespace-nowrap">${escapeHtml(p.usn || 'N/A')}</td>
                                            <td class="py-2.5 text-zinc-500 whitespace-nowrap">${m.created_at ? new Date(m.created_at).toLocaleDateString() : 'N/A'}</td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        `}
                    </div>

                    <!-- 3. Original Application & Revisions -->
                    ${application ? `
                    <div class="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                        <h4 class="font-heading font-bold text-xs uppercase tracking-wider text-zinc-300">
                            Approved Application & Revisions
                        </h4>
                        <div class="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/60 space-y-2">
                            <div class="flex items-center justify-between text-zinc-400">
                                <span class="font-bold text-white">Application ID: <span class="font-mono">${escapeHtml(application.id)}</span></span>
                                <span>Approved on ${application.reviewed_at ? new Date(application.reviewed_at).toLocaleDateString() : 'N/A'}</span>
                            </div>
                            <div class="prose-clean text-xs text-zinc-300 leading-relaxed">${sanitizeRichText(application.description)}</div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- 4. Review History & Comments -->
                    ${comments.length > 0 || history.length > 0 ? `
                    <div class="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                        <h4 class="font-heading font-bold text-xs uppercase tracking-wider text-zinc-300">
                            Mentor Review Thread & Approval Audit Trail
                        </h4>
                        <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                            ${comments.map(c => `
                            <div class="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/60 text-xs">
                                <div class="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                                    <span class="font-bold text-white">${escapeHtml(c.author?.full_name || 'User')} (${c.is_mentor_feedback ? 'Mentor Feedback' : 'Applicant'})</span>
                                    <span>${c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                                </div>
                                <p class="text-zinc-300">${escapeHtml(c.content)}</p>
                            </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                </div>

                <!-- Footer -->
                <div class="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-end">
                    <button onclick="MentorDashboardView.closeAuditModal()" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-all">
                        Close Audit
                    </button>
                </div>

            </div>
        </div>
        `;
    }

    function closeModal() {
        const root = document.getElementById('mentor-app-modal-root');
        if (root) root.innerHTML = '';
        selectedAppDetail = null;
    }

    function closeAuditModal() {
        const root = document.getElementById('mentor-audit-modal-root');
        if (root) root.innerHTML = '';
        selectedProjectAudit = null;
    }

    function setActiveTab(tab) {
        activeTab = tab;
        const container = document.getElementById('app');
        if (container) {
            container.innerHTML = render();
            bindEvents(container);
        }
    }

    function setFilter(filt) {
        applicationFilter = filt;
        const container = document.getElementById('app');
        if (container) {
            container.innerHTML = render();
            bindEvents(container);
        }
    }

    async function refresh() {
        await loadData();
        const container = document.getElementById('app');
        if (container) {
            container.innerHTML = render();
            bindEvents(container);
        }
    }

    function bindEvents(container) {
        if (typeof RegistrationQueue !== 'undefined') {
            RegistrationQueue.bindEvents(container, () => {
                container.innerHTML = render();
                bindEvents(container);
            });
        }

        const searchInput = container.querySelector('#mentor-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', e => {
                searchQuery = e.target.value;
                container.innerHTML = render();
                bindEvents(container);
                const newSearch = container.querySelector('#mentor-search-input');
                if (newSearch) {
                    newSearch.focus();
                    newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
                }
            });
        }

        const chatFilterInput = container.querySelector('#mentor-chat-filter-input');
        if (chatFilterInput) {
            chatFilterInput.addEventListener('input', e => {
                chatSearchQuery = e.target.value;
                container.innerHTML = render();
                bindEvents(container);
                const newFilter = container.querySelector('#mentor-chat-filter-input');
                if (newFilter) {
                    newFilter.focus();
                    newFilter.setSelectionRange(newFilter.value.length, newFilter.value.length);
                }
            });
        }

        const chatTextarea = container.querySelector('#mentor-dash-chat-input');
        if (chatTextarea) {
            chatTextarea.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const form = container.querySelector('#mentor-dash-chat-form');
                    if (form) form.requestSubmit();
                }
            });
            chatTextarea.addEventListener('input', () => {
                chatTextarea.style.height = 'auto';
                chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 120) + 'px';
            });
        }
    }

    /* =========================================================================
       MENTOR CHAT HUB & DIRECT MESSAGING CONTROLLER (MENTOR DASHBOARD)
       ========================================================================= */
    function goToProjectAudit(projectId) {
        window.location.hash = '#teams/' + projectId;
    }

    function goToProjectModal(projectId) {
        window.location.hash = '#teams/' + projectId;
    }

    function getSortedChatProjects() {
        const query = chatSearchQuery.trim().toLowerCase();
        const list = projects.map(p => {
            const msgs = mentorMessages.filter(m => Number(m.project_id) === Number(p.id));
            const latestMsg = msgs[0] || null;
            return {
                project: p,
                messages: msgs,
                latestMsg: latestMsg,
                latestTime: latestMsg ? new Date(latestMsg.created_at).getTime() : 0
            };
        });

        // Projects with recent messages first
        list.sort((a, b) => {
            if (b.latestTime !== a.latestTime) {
                return b.latestTime - a.latestTime;
            }
            return (a.project.project_name || a.project.team || '').localeCompare(b.project.project_name || b.project.team || '');
        });

        if (!query) return list;
        return list.filter(item => {
            const p = item.project;
            const searchTarget = `${p.project_name || ''} ${p.team || ''} ${p.name || ''} ${p.project_code || ''} ${item.latestMsg?.message || ''}`.toLowerCase();
            return searchTarget.includes(query);
        });
    }

    function renderMentorChatHub() {
        const chatProjects = getSortedChatProjects();
        if (!activeChatProjectId && chatProjects.length > 0) {
            activeChatProjectId = chatProjects[0].project.id;
        }
        const selectedItem = chatProjects.find(cp => Number(cp.project.id) === Number(activeChatProjectId)) || chatProjects[0];
        const selectedProject = selectedItem ? selectedItem.project : null;

        return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full pt-1">
            <!-- Left Column (lg:col-span-5 xl:col-span-4): Team Channels & Messages List -->
            <div class="lg:col-span-5 xl:col-span-4 space-y-3 w-full">
                <div class="flex items-center justify-between gap-2 px-1">
                    <div>
                        <h3 class="font-heading font-bold text-xs sm:text-sm text-white">Team Discussions</h3>
                        <p class="text-[11px] text-zinc-400">All live project channels with teams</p>
                    </div>
                    <span class="text-[11px] px-2 py-0.5 rounded-lg font-semibold bg-zinc-900 border border-zinc-800 text-zinc-400">${chatProjects.length} Teams</span>
                </div>

                <!-- Search Channel / Message -->
                <div class="relative w-full">
                    <input type="text" id="mentor-chat-filter-input" value="${escapeHtml(chatSearchQuery)}" placeholder="Search team, message, code..." class="w-full pl-9 pr-3 py-2 bg-zinc-900/90 border border-zinc-800 focus:border-amber-500 rounded-xl text-xs text-white placeholder-zinc-500 outline-none transition-colors">
                    <svg class="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>

                <!-- Channel / Project Message Stream List -->
                <div class="space-y-2 max-h-[640px] overflow-y-auto custom-scrollbar pr-1">
                    ${chatProjects.length === 0 ? `
                        <div class="p-8 text-center text-zinc-500 text-xs bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
                            No matching team channels found.
                        </div>
                    ` : chatProjects.map(cp => {
                        const p = cp.project;
                        const isSelected = selectedProject && Number(p.id) === Number(selectedProject.id);
                        const lastMsg = cp.latestMsg;
                        const lastSender = lastMsg ? (lastMsg.profiles?.full_name || lastMsg.profiles?.username || 'Team Member') : '';
                        const isLastMentor = lastMsg ? (lastMsg.profiles?.role === 'mentor' || Boolean(lastMsg.profiles?.is_mentor)) : false;
                        const timeAgoStr = lastMsg ? (typeof formatTimeAgo === 'function' ? formatTimeAgo(lastMsg.created_at) : '') : '';

                        return `
                        <div onclick="MentorDashboardView.selectTeamChat(${p.id})" class="p-3.5 rounded-2xl border transition-all cursor-pointer group text-left ${isSelected ? 'bg-zinc-900/90 border-amber-500/50 ring-1 ring-amber-500/30 shadow-lg' : 'bg-zinc-950/50 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-700'}">
                            <div class="flex items-start gap-3">
                                <div class="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold font-heading text-emerald-400 overflow-hidden flex-shrink-0 mt-0.5 shadow-inner">
                                    ${p.avatar_url ? `<img src="${p.avatar_url}" class="w-full h-full object-cover">` : escapeHtml(p.initials || 'PRJ')}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center justify-between gap-1.5">
                                        <!-- Clicking project name redirects to teams modal! -->
                                        <button type="button" onclick="event.stopPropagation(); MentorDashboardView.goToProjectModal(${p.id})" class="font-heading font-bold text-xs sm:text-sm text-white hover:text-emerald-400 transition-colors truncate text-left group/pname cursor-pointer flex items-center gap-1" title="Open in Teams Modal">
                                            <span class="truncate">${escapeHtml(p.project_name || p.team)}</span>
                                            <svg class="w-3.5 h-3.5 text-zinc-500 group-hover/pname:text-emerald-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                        </button>
                                        <span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded flex-shrink-0">${escapeHtml(p.project_code || 'PRJ')}</span>
                                    </div>

                                    <div class="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                                        <span>Team: <strong class="text-zinc-300">${escapeHtml(p.team)}</strong></span>
                                        <span>·</span>
                                        <span class="text-zinc-500">${cp.messages.length} msg${cp.messages.length === 1 ? '' : 's'}</span>
                                    </div>

                                    <!-- Message snippet -->
                                    <div class="mt-2 text-xs flex items-center justify-between gap-2">
                                        <div class="truncate flex-1 min-w-0">
                                            ${lastMsg ? `
                                                <span class="font-semibold ${isLastMentor ? 'text-amber-400' : 'text-zinc-300'}">${escapeHtml(lastSender)}:</span>
                                                <span class="text-zinc-400 italic">${escapeHtml(lastMsg.message)}</span>
                                            ` : `
                                                <span class="text-zinc-500 italic text-[11px]">No messages yet · Click to chat</span>
                                            `}
                                        </div>
                                        ${lastMsg ? `<span class="text-[10px] text-zinc-500 flex-shrink-0">${timeAgoStr}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Right Column (lg:col-span-7 xl:col-span-8): Active Inline Team Chat -->
            <div class="lg:col-span-7 xl:col-span-8 w-full">
                ${selectedProject ? renderActiveChatPanel(selectedProject) : `
                    <div class="glass-card rounded-2xl p-12 border border-zinc-800/80 bg-zinc-950/60 text-center text-zinc-400 space-y-2">
                        <div class="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto text-amber-400">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                        </div>
                        <h4 class="font-heading font-bold text-white text-base">Select a Team Conversation</h4>
                        <p class="text-xs text-zinc-400">Click on any team from the list on the left to review messages and provide mentor guidance.</p>
                    </div>
                `}
            </div>
        </div>
        `;
    }

    function renderActiveChatPanel(selectedProject) {
        return `
        <div class="glass-card rounded-2xl border border-zinc-800/80 bg-zinc-950/70 overflow-hidden shadow-2xl flex flex-col h-[75vh] min-h-[550px] max-h-[850px]" id="mentor-dash-chat-wrapper">
            <!-- Active Chat Header -->
            <div class="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between gap-3 flex-shrink-0">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 font-bold overflow-hidden flex-shrink-0 shadow-sm">
                        ${selectedProject.avatar_url ? `<img src="${selectedProject.avatar_url}" class="w-full h-full object-cover">` : escapeHtml(selectedProject.initials || 'PRJ')}
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <!-- Clicking project name redirects to teams modal! -->
                            <button type="button" onclick="MentorDashboardView.goToProjectModal(${selectedProject.id})" class="font-heading font-bold text-sm sm:text-base text-white hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer text-left group" title="Redirect to Teams Modal">
                                <span class="truncate">${escapeHtml(selectedProject.project_name || selectedProject.team)}</span>
                                <span class="text-xs text-emerald-400 font-semibold group-hover:underline flex items-center gap-0.5 flex-shrink-0">
                                    <span>(Teams Modal)</span>
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                </span>
                            </button>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
                                ${ICC_CONFIG.MENTOR_TICK}
                                <span>Mentor Chat</span>
                            </span>
                        </div>
                        <p class="text-[11px] text-zinc-400 mt-0.5 truncate">Team: <strong class="text-zinc-200">${escapeHtml(selectedProject.team)}</strong> · Lead: <span class="text-zinc-300 font-medium">${escapeHtml(selectedProject.name)}</span> · Code: <span class="font-mono text-emerald-400">${escapeHtml(selectedProject.project_code || 'PRJ')}</span></p>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                    <button type="button" onclick="MentorDashboardView.refreshActiveChat()" class="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition-colors cursor-pointer" title="Refresh messages">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </button>
                    <button type="button" onclick="MentorDashboardView.goToProjectModal(${selectedProject.id})" class="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 border border-zinc-800 hover:border-emerald-500/40 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95" title="View Full Project Page in Teams">
                        <span>Open Teams Modal</span>
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                    </button>
                </div>
            </div>

            <!-- Live Messages Stream -->
            <div id="mentor-dash-messages-container" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 custom-scrollbar bg-zinc-950/40">
                ${renderDashMessagesList(selectedProject)}
            </div>

            <!-- Reply Target Bar (Hidden by default) -->
            <div id="mentor-dash-reply-bar" class="${activeReplyTarget ? '' : 'hidden'} px-4 py-2 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between text-xs animate-slide-up">
                <div class="flex items-center gap-2 min-w-0 pr-2">
                    <svg class="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                    <span class="text-zinc-400 flex-shrink-0">Replying to <span id="dash-reply-target-author" class="text-white font-semibold">${escapeHtml(activeReplyTarget?.author || '')}</span>:</span>
                    <span id="dash-reply-target-text" class="text-zinc-400 truncate italic">${escapeHtml(activeReplyTarget?.text || '')}</span>
                </div>
                <button type="button" onclick="MentorDashboardView.cancelReply()" class="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer" title="Cancel Reply">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <!-- Chat Input Form -->
            <form id="mentor-dash-chat-form" onsubmit="MentorDashboardView.handleSendChatMessage(event, ${selectedProject.id})" class="p-3 sm:p-4 bg-zinc-900/80 border-t border-zinc-800 flex items-end gap-2.5 flex-shrink-0">
                <div class="flex-1 min-w-0 relative">
                    <textarea id="mentor-dash-chat-input" rows="1" placeholder="Provide guidance or feedback to ${escapeHtml(selectedProject.team)} as a Mentor... (Press Enter to send)" class="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-amber-500/60 rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 outline-none resize-none max-h-32 leading-relaxed transition-all"></textarea>
                </div>
                <button type="submit" id="mentor-dash-send-btn" class="px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50">
                    <span>Send</span>
                    <svg class="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </button>
            </form>
        </div>
        `;
    }

    function renderDashMessagesList(selectedProject) {
        const myUser = ICCSupabase.getUser();
        const myId = myUser?.id;

        if (!activeChatMessages || activeChatMessages.length === 0) {
            return `
            <div class="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto space-y-3">
                <div class="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-1 shadow-sm">
                    <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                    </svg>
                </div>
                <h3 class="font-heading font-bold text-base text-white">Mentor Guidance for ${escapeHtml(selectedProject.team)}</h3>
                <p class="text-xs text-zinc-400 leading-relaxed">
                    No messages yet in this team channel. Send a message to initiate project guidance and review milestone progress!
                </p>
            </div>`;
        }

        return activeChatMessages.map(m => {
            const isMe = m.sender_id === myId;
            const prof = m.profiles || {};
            const senderRole = (prof.role || (isMe ? ICCSupabase.getProfile()?.role : '') || '').toLowerCase();
            const isSenderMentor = senderRole === 'mentor' || Boolean(prof.is_mentor) || senderRole === 'super_admin' || senderRole === 'superadmin' || isMe;
            const isSenderLead = prof.id === selectedProject.lead_user_id || senderRole === 'lead';

            let timeStr = '';
            try {
                timeStr = typeof formatTimeAgo === 'function' ? formatTimeAgo(m.created_at) : new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                timeStr = '';
            }

            let replyHtml = '';
            if (m.reply_to_id) {
                const targetMsg = activeChatMessages.find(x => x.id === m.reply_to_id);
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
                    <div class="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden mt-0.5 border ${isSenderMentor ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-zinc-700'} shadow-sm">
                        ${prof.avatar_url
                            ? `<img src="${prof.avatar_url}" class="w-full h-full object-cover">`
                            : `<div class="w-full h-full flex items-center justify-center text-[10px] font-bold ${isSenderMentor ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-300'}">${(prof.full_name || prof.username || '?').charAt(0).toUpperCase()}</div>`}
                    </div>

                    <!-- Bubble Container -->
                    <div class="min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                        <!-- Author & Badges Header -->
                        <div class="flex items-center gap-1.5 mb-1 text-[11px] flex-wrap">
                            <span class="font-bold text-zinc-300 inline-flex items-center">
                                ${escapeHtml(prof.full_name || prof.username || (isMe ? 'You (Mentor)' : 'Team Member'))}
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

                            <!-- Actions -->
                            <div class="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity flex-shrink-0">
                                <button type="button" onclick="MentorDashboardView.replyToMessage('${m.id}')" class="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer" title="Reply to this message">
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                                </button>
                                <button type="button" onclick="MentorDashboardView.deleteMessage('${m.id}')" class="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer" title="Delete message">
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    async function selectTeamChat(projectId) {
        activeChatProjectId = projectId;
        activeReplyTarget = null;
        if (typeof activeChatUnsubscribe === 'function') {
            activeChatUnsubscribe();
            activeChatUnsubscribe = null;
        }

        const res = await ICCSupabase.fetchProjectMentorMessages(projectId);
        activeChatMessages = res.data || [];

        const container = document.getElementById('app');
        if (container) {
            container.innerHTML = render();
            bindEvents(container);
            scrollChatToBottom();
        }

        try {
            activeChatUnsubscribe = ICCSupabase.subscribeToProjectMentorChat(projectId, (event) => {
                if (event.type === 'INSERT' && event.message) {
                    if (!activeChatMessages.some(m => m.id === event.message.id)) {
                        activeChatMessages.push(event.message);
                        if (!mentorMessages.some(m => m.id === event.message.id)) {
                            mentorMessages.unshift(event.message);
                        }
                        updateChatMessagesDOM();
                    }
                } else if (event.type === 'DELETE' && event.messageId) {
                    activeChatMessages = activeChatMessages.filter(m => m.id !== event.messageId);
                    mentorMessages = mentorMessages.filter(m => m.id !== event.messageId);
                    updateChatMessagesDOM();
                }
            });
        } catch (e) {
            console.warn('Realtime chat sub warning:', e);
        }
    }

    async function refreshActiveChat() {
        if (!activeChatProjectId) return;
        const res = await ICCSupabase.fetchProjectMentorMessages(activeChatProjectId);
        if (res.data) {
            activeChatMessages = res.data;
            updateChatMessagesDOM();
        }
    }

    async function handleSendChatMessage(e, projectId) {
        if (e) e.preventDefault();
        const input = document.getElementById('mentor-dash-chat-input');
        const sendBtn = document.getElementById('mentor-dash-send-btn');
        if (!input || isSendingChat) return;

        const text = input.value.trim();
        if (!text) return;

        isSendingChat = true;
        if (sendBtn) sendBtn.disabled = true;

        const replyToId = activeReplyTarget ? activeReplyTarget.id : null;
        const { data, error } = await ICCSupabase.sendProjectMentorMessage(projectId, text, replyToId);

        isSendingChat = false;
        if (sendBtn) sendBtn.disabled = false;

        if (error) {
            Toast.error('Failed to send message: ' + (error.message || 'Error'));
            return;
        }

        input.value = '';
        input.style.height = 'auto';
        activeReplyTarget = null;
        const replyBar = document.getElementById('mentor-dash-reply-bar');
        if (replyBar) replyBar.classList.add('hidden');

        if (data && !activeChatMessages.some(m => m.id === data.id)) {
            activeChatMessages.push(data);
            if (!mentorMessages.some(m => m.id === data.id)) {
                mentorMessages.unshift(data);
            }
            updateChatMessagesDOM();
        }
    }

    function replyToMessage(messageId) {
        const msg = activeChatMessages.find(m => m.id === messageId);
        if (!msg) return;
        const author = msg.profiles?.full_name || msg.profiles?.username || 'User';
        activeReplyTarget = { id: messageId, author, text: msg.message };

        const replyBar = document.getElementById('mentor-dash-reply-bar');
        const authorEl = document.getElementById('dash-reply-target-author');
        const textEl = document.getElementById('dash-reply-target-text');
        const input = document.getElementById('mentor-dash-chat-input');

        if (authorEl) authorEl.textContent = author;
        if (textEl) textEl.textContent = msg.message;
        if (replyBar) replyBar.classList.remove('hidden');
        if (input) input.focus();
    }

    function cancelReply() {
        activeReplyTarget = null;
        const replyBar = document.getElementById('mentor-dash-reply-bar');
        if (replyBar) replyBar.classList.add('hidden');
    }

    async function deleteMessage(messageId) {
        if (!confirm('Are you sure you want to delete this message?')) return;
        const { error } = await ICCSupabase.deleteProjectMentorMessage(messageId, activeChatProjectId);
        if (error) {
            Toast.error('Could not delete message: ' + (error.message || 'Error'));
            return;
        }
        activeChatMessages = activeChatMessages.filter(m => m.id !== messageId);
        mentorMessages = mentorMessages.filter(m => m.id !== messageId);
        updateChatMessagesDOM();
        Toast.success('Message deleted');
    }

    function updateChatMessagesDOM() {
        const streamContainer = document.getElementById('mentor-dash-messages-container');
        const selectedItem = projects.find(p => Number(p.id) === Number(activeChatProjectId));
        if (streamContainer && selectedItem) {
            streamContainer.innerHTML = renderDashMessagesList(selectedItem);
            scrollChatToBottom();
        }
    }

    function scrollChatToBottom() {
        const streamContainer = document.getElementById('mentor-dash-messages-container');
        if (streamContainer) {
            streamContainer.scrollTop = streamContainer.scrollHeight;
        }
    }

    async function mount(container, initialTab = null) {
        if (!ICCSupabase.isMentor()) {
            Toast.error('Access restricted: Only Mentors and Super Administrators can access the Mentor Dashboard.');
            window.location.hash = '#dashboard';
            return;
        }

        if (initialTab) {
            activeTab = initialTab;
        }

        container.innerHTML = `
        <div class="min-h-screen flex items-center justify-center text-zinc-500 text-sm gap-2">
            <div class="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading Mentor Dashboard...</span>
        </div>
        `;

        await loadData();

        // If on chat tab and have projects, select first project
        if (activeTab === 'mentor_chat' && projects.length > 0) {
            if (!activeChatProjectId) {
                const sorted = getSortedChatProjects();
                activeChatProjectId = sorted.length > 0 ? sorted[0].project.id : projects[0].id;
            }
            if (activeChatProjectId) {
                const chatRes = await ICCSupabase.fetchProjectMentorMessages(activeChatProjectId);
                if (chatRes?.data) activeChatMessages = chatRes.data;
            }
        }

        container.innerHTML = render();
        bindEvents(container);
        if (activeTab === 'mentor_chat') scrollChatToBottom();
    }

    
    async function deleteProject(projectId, projectName) {
        if (!confirm(`Are you sure you want to permanently delete project "${projectName || 'Project'}"? This action cannot be undone and will remove all project data and team memberships.`)) {
            return;
        }

        const { error } = await ICCSupabase.deleteLead(projectId);
        if (error) {
            Toast.error('Failed to delete project: ' + (error.message || 'Unknown error'));
            return;
        }

        Toast.success('Project deleted successfully');
        if (typeof loadLeads === 'function') {
            await loadLeads();
        }
        await loadData();
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = render();
            bindEvents(app);
        }
    }

    async function deleteProjectFromAudit(projectId, projectName) {
        closeAuditModal();
        await deleteProject(projectId, projectName);
    }


    function renderTasksTrackerView() {
        const totalCount = allTasks.length;
        const pendingList = allTasks.filter(t => getTaskStatus(t) === 'pending');
        const notCompletedList = allTasks.filter(t => getTaskStatus(t) === 'not_completed');
        const completedList = allTasks.filter(t => getTaskStatus(t) === 'completed');

        const query = searchQuery.trim().toLowerCase();
        const filteredTasks = allTasks.filter(t => {
            const st = getTaskStatus(t);
            if (taskFilter === 'pending' && st !== 'pending') return false;
            if (taskFilter === 'not_completed' && st !== 'not_completed') return false;
            if (taskFilter === 'completed' && st !== 'completed') return false;

            if (taskProjectFilter !== 'all' && String(t.project_id) !== String(taskProjectFilter)) return false;

            if (query) {
                const proj = projects.find(p => Number(p.id) === Number(t.project_id));
                const projName = proj ? (proj.project_name || proj.team || '') : '';
                const target = `${t.title || ''} ${t.description || ''} ${t.assigned_to_name || ''} ${t.created_by_name || ''} ${projName}`.toLowerCase();
                if (!target.includes(query)) return false;
            }

            return true;
        });

        return `
        <div class="space-y-4 pt-1">
            <!-- Summary Metric Cards for Task Tracker -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div onclick="MentorDashboardView.setTaskFilter('all')" class="glass-card rounded-2xl p-3.5 border ${taskFilter === 'all' ? 'border-sky-500/60 bg-sky-500/10' : 'border-zinc-800/80 bg-zinc-900/40'} hover:border-sky-500/40 transition-all cursor-pointer">
                    <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Tasks</span>
                    <p class="font-heading font-extrabold text-xl text-white mt-1">${totalCount}</p>
                </div>
                <div onclick="MentorDashboardView.setTaskFilter('pending')" class="glass-card rounded-2xl p-3.5 border ${taskFilter === 'pending' ? 'border-amber-500/60 bg-amber-500/10' : 'border-zinc-800/80 bg-zinc-900/40'} hover:border-amber-500/40 transition-all cursor-pointer">
                    <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pending Tasks</span>
                    <p class="font-heading font-extrabold text-xl text-amber-300 mt-1">${pendingList.length}</p>
                </div>
                <div onclick="MentorDashboardView.setTaskFilter('not_completed')" class="glass-card rounded-2xl p-3.5 border ${taskFilter === 'not_completed' ? 'border-rose-500/60 bg-rose-500/10' : 'border-zinc-800/80 bg-zinc-900/40'} hover:border-rose-500/40 transition-all cursor-pointer">
                    <span class="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Not Completed / Overdue</span>
                    <p class="font-heading font-extrabold text-xl text-rose-400 mt-1">${notCompletedList.length}</p>
                </div>
                <div onclick="MentorDashboardView.setTaskFilter('completed')" class="glass-card rounded-2xl p-3.5 border ${taskFilter === 'completed' ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-zinc-800/80 bg-zinc-900/40'} hover:border-emerald-500/40 transition-all cursor-pointer">
                    <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Completed</span>
                    <p class="font-heading font-extrabold text-xl text-emerald-300 mt-1">${completedList.length}</p>
                </div>
            </div>

            <!-- Filter Pills & Project Selector -->
            <div class="flex items-center justify-between gap-3 flex-wrap pt-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <button onclick="MentorDashboardView.setTaskFilter('all')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${taskFilter === 'all' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-white bg-zinc-950/60'}">All (${totalCount})</button>
                    <button onclick="MentorDashboardView.setTaskFilter('pending')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${taskFilter === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-white bg-zinc-950/60'}">Pending (${pendingList.length})</button>
                    <button onclick="MentorDashboardView.setTaskFilter('not_completed')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${taskFilter === 'not_completed' ? 'bg-rose-500/20 text-rose-300' : 'text-zinc-400 hover:text-white bg-zinc-950/60'}">Not Completed (${notCompletedList.length})</button>
                    <button onclick="MentorDashboardView.setTaskFilter('completed')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${taskFilter === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-white bg-zinc-950/60'}">Completed (${completedList.length})</button>
                </div>

                <!-- Project Selector Dropdown -->
                <div class="flex items-center gap-2">
                    <label class="text-xs text-zinc-400 font-medium hidden sm:inline">Project:</label>
                    <select id="mentor-task-project-select" onchange="MentorDashboardView.setTaskProjectFilter(this.value)" class="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white outline-none focus:border-sky-500 cursor-pointer">
                        <option value="all">All Projects (${projects.length})</option>
                        ${projects.map(p => `
                            <option value="${p.id}" ${String(taskProjectFilter) === String(p.id) ? 'selected' : ''}>
                                ${escapeHtml(p.project_name || p.team)} (${escapeHtml(p.project_code || 'PRJ')})
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <!-- Task List Rows -->
            <div class="space-y-3 pt-2">
                ${isLoading ? `
                    <div class="p-12 text-center text-zinc-500 text-sm flex items-center justify-center gap-2">
                        <div class="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading tracked tasks...</span>
                    </div>
                ` : filteredTasks.length === 0 ? `
                    <div class="p-12 text-center bg-zinc-950/40 rounded-2xl border border-dashed border-zinc-800 text-zinc-500 text-sm space-y-2">
                        <p class="text-base font-semibold text-zinc-400">No tasks found</p>
                        <p class="text-xs text-zinc-500">No tasks match the active status or project filter.</p>
                    </div>
                ` : filteredTasks.map(t => renderMentorTaskRow(t)).join('')}
            </div>
        </div>
        `;
    }

    function renderMentorTaskRow(task) {
        const taskStatus = getTaskStatus(task);
        const isCompleted = taskStatus === 'completed';
        const isNotCompleted = taskStatus === 'not_completed';
        const proj = projects.find(p => Number(p.id) === Number(task.project_id));
        const projName = proj ? (proj.project_name || proj.team) : 'Project #' + task.project_id;
        const projCode = proj ? proj.project_code : null;

        let badgeHtml = '';
        if (isCompleted) {
            badgeHtml = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 flex items-center gap-1"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Completed</span>`;
        } else if (isNotCompleted) {
            badgeHtml = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Not Completed (Overdue)</span>`;
        } else {
            badgeHtml = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>Pending</span>`;
        }

        return `
        <div class="p-4 sm:p-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 hover:border-zinc-700/80 transition-all space-y-3.5 group shadow-sm">
            <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <h4 class="font-heading font-bold text-base text-white group-hover:text-sky-400 transition-colors break-words">${escapeHtml(task.title)}</h4>
                        ${badgeHtml}
                    </div>
                    <div class="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
                        <span>Project:</span>
                        <a href="#teams/${task.project_id}" class="text-sky-400 hover:text-sky-300 font-semibold hover:underline flex items-center gap-1" title="Open Project in Teams">
                            <span>${escapeHtml(projName)}</span>
                            ${projCode ? `<span class="px-1.5 py-0.2 rounded font-mono text-[10px] bg-sky-500/15 text-sky-300 font-bold">${escapeHtml(projCode)}</span>` : ''}
                            <svg class="w-3 h-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        </a>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                    <a href="#teams/${task.project_id}" class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-sky-400 hover:text-sky-300 border border-zinc-800 hover:border-sky-500/40 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95" title="View Project Tasks">
                        <span>View in Project</span>
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </a>
                    <button onclick="MentorDashboardView.deleteTaskFromTracker('${task.id}', ${task.project_id})" class="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer" title="Delete Task">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </div>

            <p class="text-xs text-zinc-300 leading-relaxed bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/60 whitespace-pre-line">${escapeHtml(task.description)}</p>

            <!-- Meta info: Assigned to, Mentor, Deadline -->
            <div class="flex items-center justify-between gap-3 pt-1 border-t border-zinc-800/60 flex-wrap text-xs text-zinc-400">
                <div class="flex items-center gap-3 flex-wrap">
                    <div class="flex items-center gap-1.5">
                        <span class="text-zinc-500">Assigned To:</span>
                        <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
                            <div class="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-[9px]">
                                ${task.assigned_to_name ? task.assigned_to_name.charAt(0).toUpperCase() : 'M'}
                            </div>
                            <span class="font-medium text-zinc-200">${escapeHtml(task.assigned_to_name || 'Team Member')}</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-1 text-zinc-500">
                        <span>By:</span>
                        <strong class="text-zinc-300 font-medium">${escapeHtml(task.created_by_name || 'Mentor')}</strong>
                        <span class="text-zinc-600">(${formatTimeAgo(task.created_at)})</span>
                    </div>
                </div>

                ${task.deadline ? `
                    <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800">
                        <svg class="w-3.5 h-3.5 ${isNotCompleted ? 'text-rose-400' : 'text-zinc-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span class="text-zinc-400">Deadline:</span>
                        <span class="font-semibold ${isNotCompleted ? 'text-rose-400 font-bold' : 'text-zinc-200'}">
                            ${formatDeadlineDate(task.deadline)} ${isNotCompleted ? '(Overdue)' : ''}
                        </span>
                    </div>
                ` : ''}
            </div>

            ${isCompleted ? `
                <div class="p-3 bg-zinc-900/60 rounded-xl border border-emerald-500/20 text-xs text-zinc-300 space-y-1">
                    <div class="flex items-center justify-between text-emerald-400 font-semibold text-[11px]">
                        <span>✓ Member Work Submission:</span>
                        <span class="text-zinc-500 font-normal">Completed ${formatTimeAgo(task.completed_at)}</span>
                    </div>
                    <div class="prose-clean leading-relaxed break-words text-zinc-200">
                        ${sanitizeRichText(task.submission_content) || '<span class="text-zinc-500 italic">No notes provided.</span>'}
                    </div>
                </div>
            ` : ''}
        </div>
        `;
    }

    function setTaskFilter(filter) {
        taskFilter = filter;
        const container = document.getElementById('app');
        if (container) {
            container.innerHTML = render();
            bindEvents(container);
        }
    }

    function setTaskProjectFilter(projId) {
        taskProjectFilter = projId;
        const container = document.getElementById('app');
        if (container) {
            container.innerHTML = render();
            bindEvents(container);
        }
    }

    async function deleteTaskFromTracker(taskId, projectId) {
        if (!confirm('Are you sure you want to delete this task?')) return;
        const { error } = await ICCSupabase.deleteProjectTask(taskId, projectId);
        if (error) {
            Toast.error('Failed to delete task: ' + (error.message || error));
            return;
        }
        Toast.success('Task deleted successfully');
        allTasks = allTasks.filter(t => t.id !== taskId);
        const container = document.getElementById('app');
        if (container) {
            container.innerHTML = render();
            bindEvents(container);
        }
    }

    function unmount() {
        selectedAppDetail = null;
        selectedProjectAudit = null;
        if (typeof activeChatUnsubscribe === 'function') {
            activeChatUnsubscribe();
            activeChatUnsubscribe = null;
        }
    }

    return {
        mount,
        unmount,
        setActiveTab,
        setFilter,
        setTaskFilter,
        setTaskProjectFilter,
        deleteTaskFromTracker,
        refresh,
        refreshActiveChat,
        goToProjectAudit,
        goToProjectModal,
        selectTeamChat,
        handleSendChatMessage,
        replyToMessage,
        cancelReply,
        deleteMessage,
        openApplicationModal,
        closeModal,
        openProjectAuditModal,
        closeAuditModal,
        sendComment,
        confirmRequestChanges,
        approveApplication,
        showApproveConfirmModal,
        closeApproveConfirmModal,
        executeApprove,
        showRequestChangesBox,
        deleteProject,
        deleteProjectFromAudit
    };
})();
