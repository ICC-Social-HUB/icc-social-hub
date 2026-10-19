/* ========================================================
   ICC Social Hub — Registration Requests & Link Management
   Reusable Component for Admin Panel & Mentor Dashboard
   ======================================================== */
const RegistrationQueue = (() => {
    let activeSubTab = null; // 'pending_review' | 'awaiting_super_admin' | 'approved' | 'denied'
    let requests = [];
    let counts = { pending_review: 0, awaiting_super_admin: 0, approved: 0, denied: 0 };
    let linkData = null; // { id, is_active, expires_at, ... }
    let lastGeneratedToken = null;
    let isLoading = false;
    let branchFilter = '';
    let yearFilter = '';
    let searchQuery = '';
    let activeAuditRequestId = null;
    let activeActionRequestId = null;
    let actionModalType = null; // 'forward' | 'deny'

    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }

    function getBaseJoinUrl(token) {
        const origin = window.location.origin || '';
        return `${origin}/#join/${token}`;
    }

    async function initData() {
        isLoading = true;
        const isSuper = ICCSupabase.isSuperAdmin();
        if (!activeSubTab) {
            // Super Admin defaults to 'awaiting_super_admin', Mentor/Admin defaults to 'pending_review'
            activeSubTab = isSuper ? 'awaiting_super_admin' : 'pending_review';
        }

        try {
            // Fetch Link info if admin
            if (ICCSupabase.isAdmin()) {
                const linkRes = await ICCSupabase.getRegistrationLinkInfo();
                if (linkRes && linkRes.success) {
                    linkData = linkRes.link;
                }
            }

            // Fetch requests
            await fetchRequestsList();
        } catch (e) {
            console.error('Error initializing RegistrationQueue data:', e);
        } finally {
            isLoading = false;
        }
    }

    async function fetchRequestsList() {
        const res = await ICCSupabase.fetchRegistrationRequests({
            status: activeSubTab,
            branch: branchFilter,
            year: yearFilter,
            search: searchQuery
        });

        if (res && res.success) {
            requests = res.requests || [];
            counts = res.counts || counts;
        }
    }

    // --------------------------------------------------------
    // RENDER REGISTRATION LINK CARD (Super Admin & Admin Only)
    // --------------------------------------------------------
    function renderRegistrationLinkCard() {
        if (!ICCSupabase.isAdmin()) return '';

        const isSuper = ICCSupabase.isSuperAdmin();
        const hasActiveLink = linkData && linkData.is_active;
        const isExpired = linkData && linkData.expires_at && new Date(linkData.expires_at).getTime() < Date.now();
        const fullUrl = lastGeneratedToken ? getBaseJoinUrl(lastGeneratedToken) : null;

        return `
        <div class="glass-card rounded-2xl p-5 border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-zinc-900 to-zinc-900 shadow-xl mb-6 animate-fade-in">
            <div class="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-zinc-800/80">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center text-lg font-bold shadow-inner">
                        🔗
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-heading font-bold text-sm text-white">Private Registration Link</h3>
                            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${hasActiveLink && !isExpired ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}">
                                ${hasActiveLink && !isExpired ? 'Active' : (isExpired ? 'Expired' : 'Disabled')}
                            </span>
                        </div>
                        <p class="text-[11px] text-zinc-400 mt-0.5">
                            Share manually with prospective students. Link is protected by SHA-256 token hashing and blocked from public indexing.
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <button id="reg-link-generate-btn" class="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 cursor-pointer">
                        <span>⚡ ${linkData ? 'Regenerate Link' : 'Generate New Link'}</span>
                    </button>
                    ${linkData ? `
                        <button id="reg-link-toggle-btn" class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-all cursor-pointer">
                            ${hasActiveLink ? 'Disable Registrations' : 'Enable Registrations'}
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Link Display & Copy Control -->
            <div class="mt-4">
                ${fullUrl ? `
                    <div id="reg-link-container" class="p-3.5 bg-zinc-950/80 rounded-xl border border-sky-500/40 flex items-center justify-between gap-3 flex-wrap transition-all duration-300">
                        <div class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer group" id="copy-reg-link-bar" title="Click to copy link">
                            <span class="text-xs text-sky-400 font-mono font-bold">New Link:</span>
                            <span class="text-xs text-white font-mono truncate select-all group-hover:text-sky-300 transition-colors" id="active-join-url">${escapeHtml(fullUrl)}</span>
                            <span class="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">(click to copy)</span>
                        </div>
                        <button id="copy-reg-link-btn" data-url="${escapeHtml(fullUrl)}" class="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all duration-200 cursor-pointer flex-shrink-0 active:scale-95">
                            <svg class="w-3.5 h-3.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                            <span class="copy-label">Copy Link</span>
                        </button>
                    </div>
                    <div id="reg-link-copied-badge" class="hidden mt-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-fade-in">
                        <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        <span>Registration link copied to clipboard! You can now send it to the student.</span>
                    </div>
                    <p class="text-[10px] text-amber-400/90 mt-2">
                        ⚠️ Please copy this link now. For maximum security, the raw token is never stored in plain text and cannot be retrieved again once refreshed.
                    </p>
                ` : (linkData ? `
                    <div class="flex items-center justify-between gap-3 text-xs text-zinc-400 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/80">
                        <div class="flex items-center gap-2">
                            <span class="text-emerald-400 font-bold">●</span>
                            <span>Active Token Hash: <code class="text-zinc-500 font-mono text-[11px]">${linkData.id.slice(0, 16)}...</code></span>
                            <span class="text-zinc-600">·</span>
                            <span class="text-zinc-500">Created by ${escapeHtml(linkData.creator_name || 'Admin')} on ${formatDate(linkData.created_at)}</span>
                        </div>
                        <span class="text-[11px] text-zinc-500">Click "Regenerate" to create a new sharable URL</span>
                    </div>
                ` : `
                    <div class="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60 text-center">
                        <p class="text-xs text-zinc-400">No active registration link. Click <strong>Generate New Link</strong> above to create one.</p>
                    </div>
                `)}
            </div>
        </div>`;
    }

    // --------------------------------------------------------
    // RENDER REQUESTS AREA (Tabs, Filters, Table/Cards)
    // --------------------------------------------------------
    function renderRequestsArea() {
        const isSuper = ICCSupabase.isSuperAdmin();
        const isAdmin = ICCSupabase.isAdmin();
        const isMentor = ICCSupabase.isMentor();

        const tabs = [
            { id: 'pending_review', label: 'Pending Review', count: counts.pending_review, icon: '⏳' },
            { id: 'awaiting_super_admin', label: 'Awaiting Super Admin', count: counts.awaiting_super_admin, icon: '🛡️' },
            { id: 'approved', label: 'Approved', count: counts.approved, icon: '✓' },
            { id: 'denied', label: 'Denied', count: counts.denied, icon: '✕' }
        ];

        return `
        <div class="space-y-4 animate-fade-in" id="registration-requests-area">
            <!-- Tabs -->
            <div class="flex gap-2 overflow-x-auto pb-1 border-b border-zinc-800/80">
                ${tabs.map(t => `
                    <button class="req-subtab-btn flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeSubTab === t.id ? 'bg-[#3390ec] text-white shadow-md shadow-sky-600/20' : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800/80'}" data-tab="${t.id}">
                        <span>${t.icon}</span>
                        <span>${t.label}</span>
                        <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeSubTab === t.id ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'}">
                            ${t.count || 0}
                        </span>
                    </button>
                `).join('')}
            </div>

            <!-- Filters Bar -->
            <div class="flex items-center justify-between flex-wrap gap-3 pt-1">
                <div class="flex items-center gap-2">
                    <h4 class="font-heading font-semibold text-xs text-zinc-300">
                        ${requests.length} ${activeSubTab.replace(/_/g, ' ')} requests
                    </h4>
                </div>
                <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <select id="req-branch-filter" class="bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white px-2.5 py-2 outline-none focus:border-sky-500 cursor-pointer">
                        <option value="">All Branches</option>
                        <option value="AI" ${branchFilter === 'AI' ? 'selected' : ''}>AI & ML</option>
                        <option value="Computer Science" ${branchFilter === 'Computer Science' ? 'selected' : ''}>CSE</option>
                        <option value="Data Science" ${branchFilter === 'Data Science' ? 'selected' : ''}>Data Science</option>
                        <option value="Information Science" ${branchFilter === 'Information Science' ? 'selected' : ''}>ISE</option>
                        <option value="Electronics" ${branchFilter === 'Electronics' ? 'selected' : ''}>ECE</option>
                        <option value="Electrical" ${branchFilter === 'Electrical' ? 'selected' : ''}>EEE</option>
                        <option value="Mechanical" ${branchFilter === 'Mechanical' ? 'selected' : ''}>Mechanical</option>
                        <option value="Civil" ${branchFilter === 'Civil' ? 'selected' : ''}>Civil</option>
                    </select>

                    <select id="req-year-filter" class="bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white px-2.5 py-2 outline-none focus:border-sky-500 cursor-pointer">
                        <option value="">All Years</option>
                        <option value="1st Year" ${yearFilter === '1st Year' ? 'selected' : ''}>1st Year</option>
                        <option value="2nd Year" ${yearFilter === '2nd Year' ? 'selected' : ''}>2nd Year</option>
                        <option value="3rd Year" ${yearFilter === '3rd Year' ? 'selected' : ''}>3rd Year</option>
                        <option value="4th Year" ${yearFilter === '4th Year' ? 'selected' : ''}>4th Year</option>
                    </select>

                    <div class="relative flex-1 sm:w-64">
                        <input type="text" id="req-search-input" placeholder="Search by name, USN, email, phone..." class="form-input w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 outline-none focus:border-sky-500" value="${escapeHtml(searchQuery)}">
                        <svg class="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                </div>
            </div>

            <!-- Requests List -->
            <div class="space-y-3" id="requests-cards-container">
                ${isLoading ? `
                    <div class="p-12 text-center text-zinc-500 text-xs">
                        <div class="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Loading registration requests...
                    </div>
                ` : (requests.length === 0 ? `
                    <div class="p-8 text-center bg-zinc-950/40 border border-zinc-800/60 rounded-2xl">
                        <p class="text-xs text-zinc-400">No registration requests found in <strong>${activeSubTab.replace(/_/g, ' ')}</strong>.</p>
                    </div>
                ` : requests.map(req => renderRequestCard(req)).join(''))}
            </div>
        </div>

        <!-- Action / Note / Reason Modal -->
        ${renderActionModal()}
        <!-- Audit Trail Modal -->
        ${renderAuditModal()}`;
    }

    // --------------------------------------------------------
    // RENDER INDIVIDUAL REQUEST CARD
    // --------------------------------------------------------
    function renderRequestCard(r) {
        const isSuper = ICCSupabase.isSuperAdmin();
        const isAdmin = ICCSupabase.isAdmin();
        const isMentor = ICCSupabase.isMentor();

        // Step progression
        const isPending = r.status === 'pending_review';
        const isAwaitingSuper = r.status === 'awaiting_super_admin';
        const isApproved = r.status === 'approved';
        const isDenied = r.status === 'denied';

        return `
        <div class="glass-card rounded-2xl p-5 border border-zinc-800 hover:border-zinc-700 transition-all bg-gradient-to-b from-[#131b24] to-[#0e1621] shadow-lg" data-req-id="${r.id}">
            <!-- Header: Candidate Name, USN, Status & Step Progress -->
            <div class="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-zinc-800/60">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold text-sm">
                        ${(r.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="font-heading font-bold text-sm text-white">${escapeHtml(r.full_name)}</h4>
                            <span class="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
                                ${escapeHtml(r.usn)}
                            </span>
                            <span class="text-xs text-zinc-500">·</span>
                            <span class="text-xs text-zinc-300">${escapeHtml(r.branch)}</span>
                            <span class="text-xs text-zinc-500">(${escapeHtml(r.year)})</span>
                        </div>
                        <p class="text-[11px] text-zinc-500 mt-0.5 font-mono">
                            ${escapeHtml(r.email)} · ${escapeHtml(r.phone)}
                        </p>
                    </div>
                </div>

                <!-- Step Flow Indicator -->
                <div class="flex items-center gap-1.5 text-[10px] font-semibold">
                    <span class="px-2 py-0.5 rounded-full ${isPending ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-emerald-500/10 text-emerald-400'}">
                        1. Submitted
                    </span>
                    <span class="text-zinc-600">→</span>
                    <span class="px-2 py-0.5 rounded-full ${isAwaitingSuper ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' : (isApproved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-900 text-zinc-600')}">
                        2. Forwarded
                    </span>
                    <span class="text-zinc-600">→</span>
                    <span class="px-2 py-0.5 rounded-full ${isApproved ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : (isDenied ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-zinc-900 text-zinc-600')}">
                        ${isDenied ? '3. Denied' : '3. Approved'}
                    </span>
                </div>
            </div>

            <!-- Reviewer Notes & Context -->
            ${r.status === 'awaiting_super_admin' ? `
                <div class="my-3 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs flex items-start gap-2.5">
                    <span class="text-base flex-shrink-0">💬</span>
                    <div>
                        <span class="font-semibold text-amber-300">Forwarded by ${escapeHtml(r.first_reviewer_name || 'Admin')} (${escapeHtml(r.first_reviewer_role || 'Reviewer')}):</span>
                        <p class="text-zinc-300 mt-0.5">${escapeHtml(r.first_reviewer_note || 'No review notes provided.')}</p>
                        <span class="text-[10px] text-zinc-500 mt-1 block">${formatDate(r.first_reviewed_at)}</span>
                    </div>
                </div>
            ` : ''}

            ${r.status === 'approved' ? `
                <div class="my-3 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs flex items-center justify-between flex-wrap gap-2">
                    <div class="flex items-center gap-2">
                        <span class="text-emerald-400 font-bold">✓</span>
                        <span class="text-zinc-300">Final approval granted by <strong class="text-white">${escapeHtml(r.final_approver_name || 'Super Admin')}</strong> on ${formatDate(r.final_approved_at)}.</span>
                    </div>
                    ${r.first_reviewer_name ? `
                        <span class="text-[11px] text-zinc-400">Reviewed by ${escapeHtml(r.first_reviewer_name)} (${escapeHtml(r.first_reviewer_role)})</span>
                    ` : ''}
                </div>
            ` : ''}

            ${r.status === 'denied' ? `
                <div class="my-3 p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-xs">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-red-400 font-bold">✕</span>
                        <span class="text-red-300 font-semibold">Denied by ${escapeHtml(r.denied_by_name || 'Admin')} (${escapeHtml(r.denied_by_role)}) on ${formatDate(r.denied_at)}</span>
                    </div>
                    ${r.denial_reason ? `<p class="text-zinc-300 mt-0.5 pl-5">Reason: "${escapeHtml(r.denial_reason)}"</p>` : ''}
                </div>
            ` : ''}

            <!-- Bottom Row: Links, Date & Action Buttons -->
            <div class="mt-3 flex items-center justify-between flex-wrap gap-3 pt-2">
                <!-- Links & Submission Date -->
                <div class="flex items-center gap-3">
                    <span class="text-[11px] text-zinc-500">Submitted: ${formatDate(r.created_at)}</span>
                    ${r.linkedin ? `
                        <a href="${escapeHtml(r.linkedin)}" target="_blank" rel="noopener noreferrer" class="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium">
                            <span>LinkedIn</span> ↗
                        </a>
                    ` : ''}
                    ${r.github ? `
                        <a href="${escapeHtml(r.github)}" target="_blank" rel="noopener noreferrer" class="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-medium">
                            <span>GitHub</span> ↗
                        </a>
                    ` : ''}
                    ${r.other_link ? `
                        <a href="${escapeHtml(r.other_link)}" target="_blank" rel="noopener noreferrer" class="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium">
                            <span>Portfolio</span> ↗
                        </a>
                    ` : ''}
                    <button class="view-audit-btn text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer" data-id="${r.id}">
                        Audit Trail
                    </button>
                </div>

                <!-- Primary & Secondary Actions based on viewer role -->
                <div class="flex items-center gap-2">
                    ${isSuper ? `
                        <!-- Super Admin Actions -->
                        ${(isAwaitingSuper || isPending) ? `
                            <button class="approve-req-btn px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1 cursor-pointer" data-id="${r.id}">
                                <span>✓ Final Approve</span>
                            </button>
                            <button class="open-deny-modal-btn px-3 py-1.5 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer" data-id="${r.id}">
                                Deny
                            </button>
                        ` : ''}

                        ${isDenied ? `
                            <button class="reverse-deny-btn px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer" data-id="${r.id}">
                                Reopen & Approve
                            </button>
                        ` : ''}

                        ${isApproved ? `
                            <button class="resend-email-btn px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-all cursor-pointer" data-id="${r.id}">
                                Resend Email
                            </button>
                        ` : ''}
                    ` : `
                        <!-- Admin and Mentor Actions (First Stage Reviewers) -->
                        ${isPending ? `
                            <button class="open-forward-modal-btn px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-600/20 transition-all flex items-center gap-1 cursor-pointer" data-id="${r.id}">
                                <span>Forward to Super Admin →</span>
                            </button>
                            <button class="open-deny-modal-btn px-3 py-1.5 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer" data-id="${r.id}">
                                Deny
                            </button>
                        ` : ''}

                        ${isDenied ? `
                            <button class="open-forward-modal-btn px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium transition-all cursor-pointer" data-id="${r.id}">
                                Forward Denied to Super Admin
                            </button>
                        ` : ''}
                    `}
                </div>
            </div>
        </div>`;
    }

    // --------------------------------------------------------
    // RENDER AUDIT LOG MODAL
    // --------------------------------------------------------
    function renderAuditModal() {
        if (!activeAuditRequestId) return '';
        const req = requests.find(r => r.id === activeAuditRequestId);
        if (!req) return '';

        const logs = Array.isArray(req.audit_log) ? req.audit_log : [];

        return `
        <div class="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-[#0e1621]/80 backdrop-blur-md" id="audit-modal-overlay">
            <div class="bg-[#17212b] border border-[#242f3d] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
                <div class="p-5 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                        <h3 class="font-heading font-bold text-sm text-white">Application Audit Trail</h3>
                        <p class="text-xs text-zinc-400">${escapeHtml(req.full_name)} (${escapeHtml(req.usn)})</p>
                    </div>
                    <button id="close-audit-modal-btn" class="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">✕</button>
                </div>
                <div class="p-5 max-h-80 overflow-y-auto space-y-3">
                    ${logs.map((log, idx) => `
                        <div class="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl text-xs">
                            <div class="flex items-center justify-between mb-1">
                                <span class="font-bold text-sky-400 uppercase tracking-wider text-[10px]">${escapeHtml(log.action || 'action')}</span>
                                <span class="text-[10px] text-zinc-500">${formatDate(log.timestamp)}</span>
                            </div>
                            <p class="text-zinc-200 font-medium">By: ${escapeHtml(log.actor_name || log.actor || 'System')} <span class="text-zinc-500">(${escapeHtml(log.actor_role || '')})</span></p>
                            ${log.note ? `<p class="text-zinc-400 text-[11px] mt-1">Note: "${escapeHtml(log.note)}"</p>` : ''}
                            ${log.reason ? `<p class="text-red-300 text-[11px] mt-1">Reason: "${escapeHtml(log.reason)}"</p>` : ''}
                            ${log.details ? `<p class="text-zinc-400 text-[11px] mt-1">${escapeHtml(log.details)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>`;
    }

    // --------------------------------------------------------
    // RENDER ACTION MODAL (Forward Note / Denial Reason)
    // --------------------------------------------------------
    function renderActionModal() {
        if (!actionModalType || !activeActionRequestId) return '';
        const isForward = actionModalType === 'forward';
        const req = requests.find(r => r.id === activeActionRequestId);
        if (!req) return '';

        return `
        <div class="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-[#0e1621]/80 backdrop-blur-md" id="action-modal-overlay">
            <div class="bg-[#17212b] border border-[#242f3d] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up p-5">
                <h3 class="font-heading font-bold text-base text-white mb-1">
                    ${isForward ? 'Forward to Super Admin' : 'Deny Registration Request'}
                </h3>
                <p class="text-xs text-zinc-400 mb-4">
                    Candidate: <strong class="text-white">${escapeHtml(req.full_name)}</strong> (${escapeHtml(req.usn)})
                </p>

                <div class="space-y-3">
                    <div>
                        <label class="block text-xs font-medium text-zinc-300 mb-1">
                            ${isForward ? 'Optional Note for Super Admin' : 'Reason for Denial (Included in student email)'}
                        </label>
                        <textarea id="action-modal-text" rows="3" placeholder="${isForward ? 'Add details or context for the Super Admin...' : 'Explain why the request is not approved...'}"
                            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 outline-none focus:border-sky-500"></textarea>
                    </div>

                    <div class="flex items-center gap-2 pt-2">
                        <button id="confirm-action-modal-btn" class="flex-1 py-2.5 ${isForward ? 'bg-sky-600 hover:bg-sky-500' : 'bg-red-600 hover:bg-red-500'} text-white rounded-xl text-xs font-semibold transition-all shadow-md">
                            ${isForward ? 'Forward Request' : 'Confirm Denial'}
                        </button>
                        <button id="cancel-action-modal-btn" class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-all">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // --------------------------------------------------------
    // BIND EVENTS FOR TABS, ACTIONS & MODALS
    // --------------------------------------------------------
    function bindEvents(container, refreshCallback) {
        if (!container) return;

        // Subtabs
        container.querySelectorAll('.req-subtab-btn').forEach(btn => {
            btn.addEventListener('click', async e => {
                const tab = btn.dataset.tab;
                if (tab && tab !== activeSubTab) {
                    activeSubTab = tab;
                    isLoading = true;
                    if (refreshCallback) refreshCallback();
                    await fetchRequestsList();
                    isLoading = false;
                    if (refreshCallback) refreshCallback();
                }
            });
        });

        // Filters
        const branchSelect = document.getElementById('req-branch-filter');
        if (branchSelect) {
            branchSelect.addEventListener('change', async e => {
                branchFilter = e.target.value;
                await fetchRequestsList();
                if (refreshCallback) refreshCallback();
            });
        }

        const yearSelect = document.getElementById('req-year-filter');
        if (yearSelect) {
            yearSelect.addEventListener('change', async e => {
                yearFilter = e.target.value;
                await fetchRequestsList();
                if (refreshCallback) refreshCallback();
            });
        }

        const searchInput = document.getElementById('req-search-input');
        if (searchInput) {
            let debounceTimer = null;
            searchInput.addEventListener('input', e => {
                searchQuery = e.target.value;
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    await fetchRequestsList();
                    if (refreshCallback) refreshCallback();
                }, 300);
            });
        }

        // Generate / Regenerate Link
        const generateBtn = document.getElementById('reg-link-generate-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', async () => {
                if (linkData && !confirm('Regenerating the link will immediately invalidate the previous link. Continue?')) {
                    return;
                }
                const res = await ICCSupabase.generateRegistrationLink();
                if (res && res.success) {
                    lastGeneratedToken = res.token;
                    linkData = res.link;
                    if (window.Toast) Toast.show('New registration link generated!', 'success');
                    if (refreshCallback) refreshCallback();
                } else {
                    if (window.Toast) Toast.show(res?.error || 'Failed to generate link', 'error');
                }
            });
        }

        // Toggle Link
        const toggleBtn = document.getElementById('reg-link-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', async () => {
                if (!linkData) return;
                const newActiveState = !linkData.is_active;
                const res = await ICCSupabase.toggleRegistrationLink(newActiveState);
                if (res && res.success) {
                    linkData.is_active = newActiveState;
                    if (window.Toast) Toast.show(newActiveState ? 'Registrations enabled' : 'Registrations disabled', 'success');
                    if (refreshCallback) refreshCallback();
                } else {
                    if (window.Toast) Toast.show(res?.error || 'Failed to toggle link', 'error');
                }
            });
        }

        // Copy Link with Rich Visual Feedback
        const copyBtn = document.getElementById('copy-reg-link-btn');
        const copyBar = document.getElementById('copy-reg-link-bar');
        const linkContainer = document.getElementById('reg-link-container');
        const copiedBadge = document.getElementById('reg-link-copied-badge');
        let copyFeedbackTimer = null;

        const performCopyFeedback = async (url) => {
            if (!url) return;
            try {
                await navigator.clipboard.writeText(url);
            } catch {
                try {
                    const fallbackInput = document.createElement('textarea');
                    fallbackInput.value = url;
                    fallbackInput.style.position = 'fixed';
                    fallbackInput.style.opacity = '0';
                    document.body.appendChild(fallbackInput);
                    fallbackInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(fallbackInput);
                } catch {
                    prompt('Copy this registration link:', url);
                    return;
                }
            }

            // Visual feedback: Button transformation
            if (copyBtn) {
                copyBtn.classList.remove('bg-sky-500', 'hover:bg-sky-400');
                copyBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-500', 'shadow-emerald-500/30', 'scale-105');
                copyBtn.innerHTML = `
                    <svg class="w-3.5 h-3.5 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span class="copy-label font-bold text-white">Copied!</span>
                `;
            }

            // Visual feedback: Highlight link container
            if (linkContainer) {
                linkContainer.classList.add('ring-2', 'ring-emerald-500/80', 'border-emerald-500', 'bg-emerald-950/30');
                linkContainer.classList.remove('border-sky-500/40', 'bg-zinc-950/80');
            }

            // Visual feedback: Reveal confirmation badge
            if (copiedBadge) {
                copiedBadge.classList.remove('hidden');
            }

            if (window.Toast) {
                Toast.show('Registration link copied to clipboard!', 'success');
            }

            // Reset visual feedback smoothly after 2.5 seconds
            clearTimeout(copyFeedbackTimer);
            copyFeedbackTimer = setTimeout(() => {
                if (copyBtn) {
                    copyBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500', 'shadow-emerald-500/30', 'scale-105');
                    copyBtn.classList.add('bg-sky-500', 'hover:bg-sky-400');
                    copyBtn.innerHTML = `
                        <svg class="w-3.5 h-3.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                        <span class="copy-label">Copy Link</span>
                    `;
                }
                if (linkContainer) {
                    linkContainer.classList.remove('ring-2', 'ring-emerald-500/80', 'border-emerald-500', 'bg-emerald-950/30');
                    linkContainer.classList.add('border-sky-500/40', 'bg-zinc-950/80');
                }
                if (copiedBadge) {
                    copiedBadge.classList.add('hidden');
                }
            }, 2500);
        };

        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                performCopyFeedback(copyBtn.dataset.url);
            });
        }

        if (copyBar && copyBtn) {
            copyBar.addEventListener('click', () => {
                performCopyFeedback(copyBtn.dataset.url);
            });
        }

        // Approve Request (Super Admin)
        container.querySelectorAll('.approve-req-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                btn.disabled = true;
                btn.innerHTML = '<div class="spinner spinner-sm"></div> Approving...';

                const res = await ICCSupabase.approveRegistrationRequest(id);
                if (res && res.success) {
                    if (window.Toast) Toast.show(res.message, 'success');
                    await fetchRequestsList();
                    if (refreshCallback) refreshCallback();
                } else {
                    if (window.Toast) Toast.show(res?.error || 'Failed to approve request', 'error');
                    await fetchRequestsList();
                    if (refreshCallback) refreshCallback();
                }
            });
        });

        // Reopen Denied & Approve (Super Admin)
        container.querySelectorAll('.reverse-deny-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const res = await ICCSupabase.reopenRegistrationRequest(id, 'approved');
                if (res && res.success) {
                    if (window.Toast) Toast.show(res.message, 'success');
                    await fetchRequestsList();
                    if (refreshCallback) refreshCallback();
                } else {
                    if (window.Toast) Toast.show(res?.error || 'Failed to reopen request', 'error');
                }
            });
        });

        // Resend Email (Super Admin)
        container.querySelectorAll('.resend-email-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const res = await ICCSupabase.resendRegistrationEmail(id);
                if (res && res.success) {
                    if (window.Toast) Toast.show('Email resent successfully', 'success');
                } else {
                    if (window.Toast) Toast.show(res?.error || 'Failed to resend email', 'error');
                }
            });
        });

        // Open Forward Modal
        container.querySelectorAll('.open-forward-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeActionRequestId = btn.dataset.id;
                actionModalType = 'forward';
                if (refreshCallback) refreshCallback();
            });
        });

        // Open Deny Modal
        container.querySelectorAll('.open-deny-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeActionRequestId = btn.dataset.id;
                actionModalType = 'deny';
                if (refreshCallback) refreshCallback();
            });
        });

        // Confirm Action Modal
        const confirmActionBtn = document.getElementById('confirm-action-modal-btn');
        if (confirmActionBtn) {
            confirmActionBtn.addEventListener('click', async () => {
                const textVal = document.getElementById('action-modal-text')?.value?.trim() || '';
                const isForward = actionModalType === 'forward';
                confirmActionBtn.disabled = true;

                let res;
                if (isForward) {
                    res = await ICCSupabase.forwardRegistrationRequest(activeActionRequestId, textVal);
                } else {
                    res = await ICCSupabase.denyRegistrationRequest(activeActionRequestId, textVal);
                }

                actionModalType = null;
                activeActionRequestId = null;

                if (res && res.success) {
                    if (window.Toast) Toast.show(res.message, 'success');
                } else {
                    if (window.Toast) Toast.show(res?.error || 'Action failed', 'error');
                }

                await fetchRequestsList();
                if (refreshCallback) refreshCallback();
            });
        }

        // Cancel Action Modal
        const cancelActionBtn = document.getElementById('cancel-action-modal-btn');
        if (cancelActionBtn) {
            cancelActionBtn.addEventListener('click', () => {
                actionModalType = null;
                activeActionRequestId = null;
                if (refreshCallback) refreshCallback();
            });
        }

        // Audit Trail Modal
        container.querySelectorAll('.view-audit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeAuditRequestId = btn.dataset.id;
                if (refreshCallback) refreshCallback();
            });
        });

        const closeAuditBtn = document.getElementById('close-audit-modal-btn');
        if (closeAuditBtn) {
            closeAuditBtn.addEventListener('click', () => {
                activeAuditRequestId = null;
                if (refreshCallback) refreshCallback();
            });
        }
    }

    return {
        initData,
        renderRegistrationLinkCard,
        renderRequestsArea,
        bindEvents
    };
})();
