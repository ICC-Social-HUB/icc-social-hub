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
    let selectedAppDetail = null;
    let selectedProjectAudit = null;
    let isLoading = false;
    let isSubmitting = false;

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

    async function loadData() {
        isLoading = true;
        try {
            const [sumRes, appsRes, leadsRes] = await Promise.all([
                ICCSupabase.fetchMentorDashboardSummary(),
                ICCSupabase.fetchAllProjectApplications(),
                ICCSupabase.fetchLeads()
            ]);

            if (sumRes.data) summary = sumRes.data;
            if (appsRes.data) applications = appsRes.data;
            if (leadsRes) projects = leadsRes;
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
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>Pending Review</span>`;
        }
        if (status === 'Changes Requested') {
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30">⚠️ Changes Requested</span>`;
        }
        if (status === 'Approved') {
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">✓ Approved</span>`;
        }
        return `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400">${escapeHtml(status)}</span>`;
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
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-zinc-900 border border-zinc-800 text-zinc-400">Rev #${app.revision_number || 1}</span>
                        ${app.project_code ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">${escapeHtml(app.project_code)}</span>` : ''}
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
                    ${specialties.slice(0, 3).map(s => `<span class="px-2 py-0.5 rounded-md text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400">${escapeHtml(s)}</span>`).join('')}
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
                        <span class="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">${escapeHtml(project.project_code || 'PRJ-2026-XXXX')}</span>
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-400">${escapeHtml(project.team)}</span>
                    </div>
                    <p class="text-xs text-zinc-400 mt-0.5">Project Lead: <span class="text-zinc-200 font-medium">${escapeHtml(project.name)}</span> · Milestone: <span class="text-emerald-400 font-semibold">${progress}%</span></p>
                </div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
                <button onclick="MentorDashboardView.openProjectAuditModal(${project.id})" class="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 border border-zinc-800 hover:border-emerald-500/40 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95">
                    <span>360° Project Audit</span>
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
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
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Mentor & Super Admin</span>
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
                        <div class="flex items-center gap-2">
                            <button onclick="MentorDashboardView.setActiveTab('applications')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'applications' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}">
                                Project Applications (${applications.length})
                            </button>
                            <button onclick="MentorDashboardView.setActiveTab('all_projects')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'all_projects' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}">
                                All Live Projects (${projects.length})
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
                        <button onclick="MentorDashboardView.setFilter('all')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${applicationFilter === 'all' ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800/80'}">All (${applications.length})</button>
                        <button onclick="MentorDashboardView.setFilter('Pending Review')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${applicationFilter === 'Pending Review' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800/80'}">Pending Review (${summary.pending})</button>
                        <button onclick="MentorDashboardView.setFilter('Changes Requested')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${applicationFilter === 'Changes Requested' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800/80'}">Changes Requested (${summary.changesRequested})</button>
                        <button onclick="MentorDashboardView.setFilter('Approved')" class="px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${applicationFilter === 'Approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800/80'}">Approved (${summary.approved})</button>
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
                    ` : `
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
                    `}
                </div>
            </div>

            <!-- Application Review Modal / Drawer Mount -->
            <div id="mentor-app-modal-root"></div>
            <!-- Project 360 Audit Modal Mount -->
            <div id="mentor-audit-modal-root"></div>
        </div>
        `;
    }

    async function openApplicationModal(appId) {
        const root = document.getElementById('mentor-app-modal-root');
        if (!root) return;

        root.innerHTML = `
        <div class="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
            <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-zoom-in">
                <div class="p-4 border-b border-zinc-800 flex items-center justify-center text-zinc-400 text-sm gap-2">
                    <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading application review...</span>
                </div>
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

        const { application: app, comments, history } = selectedAppDetail;
        const applicant = app.applicant || {};
        const isApproved = app.status === 'Approved';
        const revisions = Array.isArray(app.revisions) ? app.revisions : [];

        root.innerHTML = `
        <div class="fixed inset-0 z-[150] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md" id="mentor-modal-backdrop">
            <div class="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl animate-zoom-in overflow-hidden" onclick="event.stopPropagation()">
                
                <!-- Header -->
                <div class="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-900/60">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="font-heading font-bold text-lg text-white break-words">${escapeHtml(app.project_name)}</h3>
                            ${renderStatusPill(app.status)}
                            <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">Revision #${app.revision_number || 1}</span>
                        </div>
                        <p class="text-xs text-zinc-400 mt-0.5">Applicant: <strong class="text-white">${escapeHtml(applicant.full_name || 'Applicant')}</strong> (${escapeHtml(applicant.email || 'No email')})</p>
                    </div>
                    <button onclick="MentorDashboardView.closeModal()" class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white cursor-pointer">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <!-- Modal Body (Scrollable) -->
                <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    
                    <!-- 1. Project Information -->
                    <div class="space-y-3 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/80">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Project Overview</h4>
                        <div class="prose-clean text-xs text-zinc-200 leading-relaxed">${sanitizeRichText(app.description)}</div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                            <div>
                                <span class="text-zinc-500 block text-[10px] uppercase font-semibold">Team Name</span>
                                <span class="text-white font-medium">${escapeHtml(app.team_name || 'Individual / Same as Project')}</span>
                            </div>
                            <div>
                                <span class="text-zinc-500 block text-[10px] uppercase font-semibold">Project Code</span>
                                <span class="font-mono ${app.project_code ? 'text-emerald-400 font-bold' : 'text-zinc-500'}">${escapeHtml(app.project_code || 'Generated upon mentor approval')}</span>
                            </div>
                        </div>

                        ${Array.isArray(app.specialties) && app.specialties.length > 0 ? `
                        <div class="pt-2">
                            <span class="text-zinc-500 block text-[10px] uppercase font-semibold mb-1">Tech Stack & Specialties</span>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                ${app.specialties.map(s => `<span class="px-2 py-0.5 rounded text-[10px] bg-zinc-900 border border-zinc-800 text-emerald-400">${escapeHtml(s)}</span>`).join('')}
                            </div>
                        </div>
                        ` : ''}

                        ${Array.isArray(app.links) && app.links.length > 0 ? `
                        <div class="pt-2">
                            <span class="text-zinc-500 block text-[10px] uppercase font-semibold mb-1">Attached Links & Resources</span>
                            <div class="space-y-1">
                                ${app.links.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" class="text-xs text-emerald-400 hover:underline block truncate">🔗 ${escapeHtml(l.name || l.url)} (${escapeHtml(l.url)})</a>`).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <!-- 2. Revisions History -->
                    ${revisions.length > 1 ? `
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                            <span>Revision History (${revisions.length} submissions)</span>
                        </h4>
                        <div class="space-y-2 max-h-40 overflow-y-auto pr-1">
                            ${revisions.map((rev, idx) => `
                            <div class="p-2.5 bg-zinc-900/50 rounded-xl border border-zinc-800/80 text-xs space-y-1">
                                <div class="flex items-center justify-between text-zinc-400 text-[10px]">
                                    <span class="font-bold text-white">Revision #${rev.revision || (idx + 1)}</span>
                                    <span>${rev.submitted_at ? new Date(rev.submitted_at).toLocaleString() : ''}</span>
                                </div>
                                <p class="text-zinc-300 line-clamp-1 italic">"${escapeHtml(rev.description || '')}"</p>
                            </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- 3. Status Transition History -->
                    ${history.length > 0 ? `
                    <div class="space-y-2">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400">Status History</h4>
                        <div class="space-y-2 max-h-36 overflow-y-auto pr-1">
                            ${history.map(h => `
                            <div class="flex items-center justify-between p-2 rounded-xl bg-zinc-900/30 border border-zinc-800/60 text-xs">
                                <div>
                                    <span class="font-semibold text-white">${escapeHtml(h.changer?.full_name || 'System')}</span>
                                    <span class="text-zinc-400">changed status to</span>
                                    <span class="font-bold text-emerald-400">${escapeHtml(h.new_status)}</span>
                                    ${h.comment ? `<p class="text-[11px] text-zinc-400 italic mt-0.5">"${escapeHtml(h.comment)}"</p>` : ''}
                                </div>
                                <span class="text-[10px] text-zinc-500">${h.created_at ? new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <!-- 4. Interactive Mentor-Applicant Comment Thread -->
                    <div class="space-y-3 pt-2 border-t border-zinc-800/80">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                            <span>Discussion & Feedback Thread (${comments.length})</span>
                            <span class="text-[10px] text-zinc-500 font-normal">Direct channel between applicant & mentors</span>
                        </h4>

                        <div class="space-y-2.5 max-h-48 overflow-y-auto pr-1" id="mentor-comment-thread">
                            ${comments.length === 0 ? `
                                <div class="p-4 text-center bg-zinc-900/20 rounded-xl text-xs text-zinc-500">
                                    No comments yet. Write guidance or requested changes below.
                                </div>
                            ` : comments.map(c => {
                                const isFeedback = c.is_mentor_feedback;
                                const isAuthorMe = c.author_id === ICCSupabase.getUser()?.id;
                                return `
                                <div class="p-3 rounded-xl border ${isFeedback ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/50'} text-xs space-y-1">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-1.5">
                                            <span class="font-bold ${isFeedback ? 'text-amber-400' : 'text-white'}">${escapeHtml(c.author?.full_name || 'User')}</span>
                                            ${isFeedback ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">Mentor</span>` : ''}
                                            ${isAuthorMe ? `<span class="text-[10px] text-zinc-500">(You)</span>` : ''}
                                        </div>
                                        <span class="text-[10px] text-zinc-500">${c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                                    </div>
                                    <p class="text-zinc-200 leading-relaxed whitespace-pre-wrap">${escapeHtml(c.content)}</p>
                                </div>
                                `;
                            }).join('')}
                        </div>

                        <!-- Post Reply Input -->
                        <div class="flex items-center gap-2 pt-1">
                            <input type="text" id="mentor-reply-input" placeholder="Type a message or review note..." class="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl text-xs text-white placeholder-zinc-500 outline-none">
                            <button onclick="MentorDashboardView.sendComment('${app.id}')" class="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer">
                                Reply
                            </button>
                        </div>
                    </div>

                    <!-- 5. Changes Requested Input Box (Shown if Request Changes button clicked) -->
                    <div id="request-changes-box" class="hidden p-4 rounded-xl border border-orange-500/40 bg-orange-500/5 space-y-3 animate-fade-in">
                        <div class="flex items-center justify-between">
                            <h5 class="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                                <span>⚠️ Specify Required Changes (Mandatory)</span>
                            </h5>
                            <button onclick="document.getElementById('request-changes-box').classList.add('hidden')" class="text-xs text-zinc-400 hover:text-white">Cancel</button>
                        </div>
                        <p class="text-[11px] text-zinc-400">Describe exactly what the applicant needs to modify. The status will transition to "Changes Requested" and they will be prompted to edit and resubmit.</p>
                        <textarea id="changes-comment-input" rows="3" placeholder="Explain the necessary updates (e.g. clarify technical architecture, provide repository link)..." class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-xl text-xs text-white placeholder-zinc-500 outline-none resize-none"></textarea>
                        <button onclick="MentorDashboardView.confirmRequestChanges('${app.id}')" class="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-98 cursor-pointer">
                            Submit Request for Changes
                        </button>
                    </div>

                </div>

                <!-- Footer Actions -->
                <div class="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-3 flex-wrap">
                    <button onclick="MentorDashboardView.closeModal()" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-all">
                        Close
                    </button>

                    ${!isApproved ? `
                    <div class="flex items-center gap-2">
                        <button onclick="document.getElementById('request-changes-box').classList.remove('hidden'); document.getElementById('changes-comment-input')?.focus();" class="px-4 py-2 bg-orange-600/20 hover:bg-orange-600 text-orange-300 hover:text-white border border-orange-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95">
                            ⚠️ Request Changes
                        </button>
                        <button onclick="MentorDashboardView.approveApplication('${app.id}')" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/25 cursor-pointer active:scale-95 flex items-center gap-1.5">
                            <span>✓ Approve Project</span>
                        </button>
                    </div>
                    ` : `
                    <span class="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        ✓ Live Project Activated (Code: ${escapeHtml(app.project_code || '')})
                    </span>
                    `}
                </div>

            </div>
        </div>
        `;
    }

    async function sendComment(appId) {
        const input = document.getElementById('mentor-reply-input');
        if (!input) return;
        const val = input.value.trim();
        if (!val) return;

        input.disabled = true;
        const res = await ICCSupabase.addApplicationComment(appId, val, true);
        input.disabled = false;

        if (res.error) {
            Toast.error('Could not post comment: ' + res.error.message);
        } else {
            input.value = '';
            if (selectedAppDetail) {
                selectedAppDetail.comments.push(res.data);
                renderApplicationModalContent();
                const thread = document.getElementById('mentor-comment-thread');
                if (thread) thread.scrollTop = thread.scrollHeight;
            }
        }
    }

    async function confirmRequestChanges(appId) {
        const input = document.getElementById('changes-comment-input');
        const comment = input ? input.value.trim() : '';
        if (!comment) {
            Toast.error('Please write an explanation for the requested changes.');
            input?.focus();
            return;
        }

        if (isSubmitting) return;
        isSubmitting = true;
        Toast.info('Submitting changes request...');

        const res = await ICCSupabase.requestApplicationChanges(appId, comment);
        isSubmitting = false;

        if (res.error) {
            Toast.error('Failed to request changes: ' + (res.error.message || res.error));
        } else {
            Toast.success('⚠️ Status updated to "Changes Requested". Applicant notified.');
            closeModal();
            await refresh();
        }
    }

    async function approveApplication(appId) {
        if (!confirm('Are you sure you want to approve this project application? It will immediately become live in the public Projects directory with a unique project code, and the applicant will be appointed as Project Lead.')) {
            return;
        }

        if (isSubmitting) return;
        isSubmitting = true;
        Toast.info('Approving application and generating project code...');

        const res = await ICCSupabase.approveProjectApplication(appId);
        isSubmitting = false;

        if (res.error) {
            Toast.error('Failed to approve project: ' + (res.error.message || res.error));
        } else {
            Toast.success(`🎉 Project approved! Generated Code: ${res.projectCode}`);
            closeModal();
            await refresh();
        }
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
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">360° Mentor Audit</span>
                            <h3 class="font-heading font-bold text-lg text-white break-words">${escapeHtml(project.project_name || project.team)}</h3>
                            <span class="px-2.5 py-0.5 rounded-md font-mono text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">${escapeHtml(project.project_code || 'PRJ-2026-XXXX')}</span>
                        </div>
                        <p class="text-xs text-zinc-400 mt-0.5">Team: <strong class="text-white">${escapeHtml(project.team)}</strong> · Created: ${project.created_at ? new Date(project.created_at).toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <button onclick="MentorDashboardView.closeAuditModal()" class="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-white cursor-pointer">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
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
    }

    async function mount(container) {
        if (!ICCSupabase.isMentor()) {
            Toast.error('Access restricted: Only Mentors and Super Administrators can access the Mentor Dashboard.');
            window.location.hash = '#dashboard';
            return;
        }

        container.innerHTML = `
        <div class="min-h-screen flex items-center justify-center text-zinc-500 text-sm gap-2">
            <div class="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading Mentor Dashboard...</span>
        </div>
        `;

        await loadData();
        container.innerHTML = render();
        bindEvents(container);
    }

    function unmount() {
        selectedAppDetail = null;
        selectedProjectAudit = null;
    }

    return {
        mount,
        unmount,
        setActiveTab,
        setFilter,
        refresh,
        openApplicationModal,
        closeModal,
        openProjectAuditModal,
        closeAuditModal,
        sendComment,
        confirmRequestChanges,
        approveApplication
    };
})();
