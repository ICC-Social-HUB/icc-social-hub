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
                        <button id="top-approve-project-btn" onclick="MentorDashboardView.approveApplication('${app.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95 flex items-center gap-1.5">
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

    async function approveApplication(appId) {
        if (!confirm('Are you sure you want to approve this project application? It will immediately become live in the public Projects directory with a unique project code, and the applicant will be appointed as Project Lead.')) {
            return;
        }

        if (isSubmitting) return;
        isSubmitting = true;
        const topBtn = document.getElementById('top-approve-project-btn');
        if (topBtn) {
            topBtn.disabled = true;
            topBtn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> <span>Approving...</span>`;
        }

        const res = await ICCSupabase.approveProjectApplication(appId);
        isSubmitting = false;

        if (res.error) {
            Toast.error('Failed to approve project: ' + (res.error.message || res.error));
            if (topBtn) {
                topBtn.disabled = false;
                topBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> <span>Approve Project</span>`;
            }
        } else {
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
        approveApplication,
        showRequestChangesBox
    };
})();
