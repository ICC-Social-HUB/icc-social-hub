/* ============================================
   ICC Social Hub — Core Space View
   Administrative headquarters, governance,
   and Minutes of Meeting (MoM) management
   ============================================ */

const CoreSpaceView = (() => {
    let allMoms = [];
    let searchQuery = '';
    let editingMom = null; // null = closed, {} = new, { id: ... } = edit
    let isSaving = false;
    let expandedMoms = new Set();

    function sanitizeRichHtml(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        // Strip dangerous scripts or event attributes
        temp.querySelectorAll('script, iframe, object, embed, style').forEach(el => el.remove());
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on') || attr.value.trim().toLowerCase().startsWith('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return temp.innerHTML;
    }

    function renderRichEditorToolbar(toolbarId) {
        return `
        <div class="flex flex-wrap items-center gap-1 p-1.5 bg-zinc-900 border border-zinc-800 rounded-xl select-none" id="${toolbarId}">
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

            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="createLink" title="Insert Link">
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
                editorElement.focus();
            });
        });

        // Rich paste handling
        editorElement.addEventListener('paste', (e) => {
            const html = e.clipboardData?.getData('text/html');
            if (html) {
                e.preventDefault();
                const cleaned = sanitizeRichHtml(html);
                document.execCommand('insertHTML', false, cleaned);
            }
        });
    }

    function renderPermissionDenied() {
        return `
        <div class="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div class="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-400 text-2xl font-bold mb-4 shadow-xl">
                🔒
            </div>
            <h2 class="text-xl font-heading font-bold text-white mb-2">Access Restricted to Core Team</h2>
            <p class="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
                Core Space is exclusively reserved for Administrators and Mentors. If you believe you should have access, please contact a Super Administrator.
            </p>
            <a href="#dashboard" class="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-all">
                Back to Home
            </a>
        </div>`;
    }

    function render() {
        const user = ICCSupabase.getUser();
        const profile = ICCSupabase.getProfile();
        const isAdmin = ICCSupabase.isAdmin();
        const isMentor = ICCSupabase.isMentor();
        const isSuper = ICCSupabase.isSuperAdmin();
        const canManage = ICCSupabase.canManageMom();

        if (!user || (!isAdmin && !isMentor)) {
            return renderPermissionDenied();
        }

        // Filter MoMs by query
        const query = searchQuery.trim().toLowerCase();
        const filteredMoms = allMoms.filter(m => {
            if (!query) return true;
            const titleMatch = (m.title || '').toLowerCase().includes(query);
            const contentMatch = (m.content || '').toLowerCase().includes(query);
            const authorMatch = (m.author_name || m.profiles?.full_name || '').toLowerCase().includes(query);
            const dateMatch = (m.meeting_date || '').toLowerCase().includes(query);
            const attendeesMatch = (m.attendees || '').toLowerCase().includes(query);
            return titleMatch || contentMatch || authorMatch || dateMatch || attendeesMatch;
        });

        return `
        <div class="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6 pb-24 animate-fade-in">
            
            <!-- Core Space Hero Header -->
            <div class="relative overflow-hidden glass-card rounded-3xl p-6 sm:p-8 border border-zinc-800/80 shadow-2xl bg-gradient-to-br from-zinc-950 via-zinc-900/60 to-zinc-950">
                <!-- Atmospheric background glow -->
                <div class="absolute -top-24 -right-24 w-80 h-80 bg-red-600/10 rounded-full blur-[90px] pointer-events-none"></div>
                <div class="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-600/10 rounded-full blur-[90px] pointer-events-none"></div>

                <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div class="space-y-2">
                        <div class="flex items-center gap-2.5 flex-wrap">
                            <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                                Core Space
                            </span>
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                                ${isSuper ? '🛡️ Super Admin Access' : (isAdmin ? '👑 Administrator Portal' : '🎓 Mentor Portal')}
                            </span>
                        </div>
                        <h1 class="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                            Core Space · Executive Nerve Center
                        </h1>
                        <p class="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
                            Internal collaboration, high-level milestone alignment, strategic decision logs, and official Minutes of Meeting (MoM).
                        </p>
                    </div>

                    <!-- Quick Action / Status -->
                    <div class="flex items-center gap-3 flex-shrink-0 flex-wrap">
                        ${canManage ? `
                            <button id="open-create-mom-btn" class="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-red-950/40 transition-all flex items-center gap-2 active:scale-95 cursor-pointer">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                <span>Log Minutes of Meeting</span>
                            </button>
                        ` : `
                            <div class="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[11px] text-zinc-400 flex items-center gap-1.5">
                                <span>👁️ View-Only Access</span>
                            </div>
                        `}
                        <a href="#admin" class="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-medium transition-colors border border-zinc-800 flex items-center gap-1.5">
                            <span>⚙️ Admin Panel</span>
                        </a>
                    </div>
                </div>

                <!-- Stats summary strip -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-zinc-800/60">
                    <div class="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800/80">
                        <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Meeting Logs</span>
                        <div class="flex items-baseline gap-1 mt-0.5">
                            <span class="text-xl font-bold text-white">${allMoms.length}</span>
                            <span class="text-[10px] text-zinc-500">records</span>
                        </div>
                    </div>
                    <div class="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800/80">
                        <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Latest Session</span>
                        <div class="mt-0.5">
                            <span class="text-xs font-semibold text-zinc-200">${allMoms[0]?.meeting_date || 'No logs yet'}</span>
                        </div>
                    </div>
                    <div class="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800/80">
                        <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Your MoM Role</span>
                        <div class="mt-0.5">
                            <span class="text-xs font-bold ${canManage ? 'text-emerald-400' : 'text-zinc-400'}">
                                ${canManage ? '✓ Full Manage (Edit/Delete)' : 'Read-Only Viewer'}
                            </span>
                        </div>
                    </div>
                    <div class="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800/80">
                        <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Governance</span>
                        <div class="mt-0.5">
                            <span class="text-xs font-semibold text-amber-400">Super Admin Managed</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SECTION: MINUTES OF MEETING (MoM) -->
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 class="font-heading font-bold text-lg text-white flex items-center gap-2">
                            <span>📝 Minutes of Meeting (MoM)</span>
                            <span class="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full text-xs font-mono">${filteredMoms.length}</span>
                        </h2>
                        <p class="text-xs text-zinc-400">Official chronological record of core meetings, agendas, action items, and executive agreements.</p>
                    </div>

                    <!-- Search Input Bar -->
                    <div class="relative w-full sm:w-72">
                        <input type="text" id="mom-search-input" value="${escapeHtml(searchQuery)}" placeholder="Search meetings by keyword, title, date..." 
                               class="w-full pl-9 pr-8 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:border-red-500 outline-none transition-colors">
                        <svg class="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        ${searchQuery ? `
                            <button id="clear-mom-search-btn" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs">✕</button>
                        ` : ''}
                    </div>
                </div>

                <!-- MoM Cards List -->
                ${filteredMoms.length === 0 ? `
                    <div class="glass-card rounded-2xl p-12 text-center border border-zinc-800 space-y-3">
                        <div class="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 text-2xl mx-auto">
                            📝
                        </div>
                        <h3 class="font-heading font-bold text-base text-white">${searchQuery ? 'No matching meetings found' : 'No Minutes of Meeting recorded yet'}</h3>
                        <p class="text-xs text-zinc-400 max-w-sm mx-auto">
                            ${searchQuery ? 'Try clearing your search query to see all logs.' : 'Log the first Minutes of Meeting to preserve discussion points, action items, and decisions for all admins and mentors.'}
                        </p>
                        ${canManage && !searchQuery ? `
                            <div class="pt-2">
                                <button id="empty-create-mom-btn" class="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer">
                                    + Log First Minutes of Meeting
                                </button>
                            </div>
                        ` : ''}
                    </div>
                ` : `
                    <div class="space-y-4">
                        ${filteredMoms.map(mom => {
                            const author = mom.profiles || {};
                            const authorName = mom.author_name || author.full_name || 'Core Administrator';
                            const authorRole = (author.role || '').toLowerCase();
                            const isExpanded = expandedMoms.has(mom.id);
                            const rawContent = mom.content || '';
                            const isLong = rawContent.length > 500;

                            return `
                            <div class="glass-card rounded-2xl p-5 sm:p-6 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-4" data-mom-id="${mom.id}">
                                <!-- Card Header -->
                                <div class="flex items-start justify-between gap-4 flex-wrap">
                                    <div class="space-y-1.5 flex-1 min-w-0">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="px-2.5 py-1 bg-red-500/15 border border-red-500/30 text-red-300 rounded-lg text-[11px] font-bold font-mono inline-flex items-center gap-1.5">
                                                <span>📅</span> ${escapeHtml(mom.meeting_date || 'Undated')}
                                            </span>
                                            ${mom.meeting_time ? `
                                                <span class="px-2.5 py-1 bg-zinc-800/80 text-zinc-300 rounded-lg text-[11px] font-mono inline-flex items-center gap-1">
                                                    <span>🕒</span> ${escapeHtml(mom.meeting_time)}
                                                </span>
                                            ` : ''}
                                            ${mom.attendees ? `
                                                <span class="px-2.5 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-lg text-[11px] inline-flex items-center gap-1">
                                                    <span>👥</span> ${escapeHtml(mom.attendees)}
                                                </span>
                                            ` : ''}
                                        </div>
                                        <h3 class="font-heading font-bold text-lg sm:text-xl text-white break-words">
                                            ${escapeHtml(mom.title)}
                                        </h3>
                                    </div>

                                    <!-- Action Buttons -->
                                    <div class="flex items-center gap-1.5 flex-shrink-0">
                                        <button class="copy-mom-btn p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer" data-id="${mom.id}" title="Copy Meeting Notes to Clipboard">
                                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                        </button>
                                        ${canManage ? `
                                            <button class="edit-mom-btn p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer" data-id="${mom.id}" title="Edit Meeting">
                                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                            </button>
                                            <button class="delete-mom-btn p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer" data-id="${mom.id}" title="Delete Meeting Log">
                                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>

                                <!-- Meeting Content Box -->
                                <div class="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4 sm:p-5 relative ${(!isExpanded && isLong) ? 'max-h-72 overflow-hidden' : ''}">
                                    <div class="prose-clean prose-invert text-sm text-zinc-300 leading-relaxed font-sans space-y-2">
                                        ${sanitizeRichHtml(mom.content)}
                                    </div>
                                    ${(!isExpanded && isLong) ? `
                                        <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none"></div>
                                    ` : ''}
                                </div>

                                <!-- Footer: Expand button + Author meta -->
                                <div class="flex items-center justify-between pt-1 text-xs text-zinc-400 flex-wrap gap-2">
                                    <div class="flex items-center gap-2">
                                        <div class="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                                            ${authorName.charAt(0).toUpperCase()}
                                        </div>
                                        <span class="text-zinc-300 font-medium">${escapeHtml(authorName)}</span>
                                        ${authorRole === 'super_admin' || authorRole === 'superadmin' ? `
                                            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300">🛡️ Super Admin</span>
                                        ` : (authorRole === 'mentor' ? `
                                            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400">🎓 Mentor</span>
                                        ` : `
                                            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/15 text-blue-300">👑 Admin</span>
                                        `)}
                                    </div>

                                    ${isLong ? `
                                        <button class="toggle-expand-mom-btn text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-1" data-id="${mom.id}">
                                            <span>${isExpanded ? 'Show Less ▴' : 'Show Full Notes ▾'}</span>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                `}
            </div>

            <!-- MODAL: CREATE / EDIT MINUTES OF MEETING -->
            ${editingMom ? renderMomModal(editingMom) : ''}
        </div>`;
    }

    function renderMomModal(mom) {
        const isEditing = !!mom.id;
        const defaultDate = mom.meeting_date || new Date().toISOString().split('T')[0];
        const defaultTime = mom.meeting_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
        <div id="mom-modal-overlay" class="fixed inset-0 z-[2500] bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
            <div class="glass-card w-full max-w-3xl rounded-3xl p-5 sm:p-7 border border-zinc-700/80 shadow-2xl my-auto space-y-4 max-h-[92vh] flex flex-col animate-slide-up" onclick="event.stopPropagation()">
                
                <!-- Modal Header -->
                <div class="flex items-center justify-between pb-3 border-b border-zinc-800 flex-shrink-0">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center text-lg">
                            📝
                        </div>
                        <div>
                            <h3 class="font-heading font-bold text-base sm:text-lg text-white">
                                ${isEditing ? 'Edit Minutes of Meeting' : 'Log Minutes of Meeting (MoM)'}
                            </h3>
                            <p class="text-[11px] text-zinc-400">All Core Admins and Mentors will be able to read these minutes.</p>
                        </div>
                    </div>
                    <button id="close-mom-modal-btn" class="text-zinc-400 hover:text-white p-1 rounded-lg">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <!-- Modal Body Form -->
                <form id="mom-form" class="space-y-4 flex-1 overflow-y-auto pr-1 no-scrollbar">
                    
                    <!-- Title -->
                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                            <span>Meeting Title / Subject <span class="text-red-400">*</span></span>
                            <span class="text-[10px] text-zinc-500 font-normal">Required</span>
                        </label>
                        <input type="text" id="mom-title-input" value="${escapeHtml(mom.title || '')}" 
                               placeholder="e.g. Core Team Strategy Sync #14 · Hackathon Finalization"
                               class="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:border-red-500 outline-none transition-colors" required>
                    </div>

                    <!-- Date & Time Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                                Meeting Date <span class="text-red-400">*</span>
                            </label>
                            <input type="date" id="mom-date-input" value="${escapeHtml(defaultDate)}"
                                   class="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:border-red-500 outline-none transition-colors" required>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                                Meeting Time <span class="text-red-400">*</span>
                            </label>
                            <input type="text" id="mom-time-input" value="${escapeHtml(defaultTime)}" placeholder="e.g. 10:30 AM or 17:00"
                                   class="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:border-red-500 outline-none transition-colors" required>
                        </div>
                    </div>

                    <!-- Attendees / Key Participants -->
                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                            <span>Attendees & Teams Present</span>
                            <span class="text-[10px] text-zinc-500 font-normal">Optional</span>
                        </label>
                        <input type="text" id="mom-attendees-input" value="${escapeHtml(mom.attendees || '')}"
                               placeholder="e.g. Core Leads, Mentors, Faculty Advisor, Tech Team"
                               class="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:border-red-500 outline-none transition-colors">
                    </div>

                    <!-- Formatted Editor -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <label class="block text-xs font-semibold text-zinc-300">
                                Meeting Minutes, Agendas & Action Items <span class="text-red-400">*</span>
                            </label>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="text-[10px] text-zinc-500">Insert Template:</span>
                                <button type="button" class="template-chip-btn px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-medium transition-colors" data-type="standard">
                                    📋 Standard
                                </button>
                                <button type="button" class="template-chip-btn px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-medium transition-colors" data-type="project">
                                    🚀 Project Audit
                                </button>
                            </div>
                        </div>

                        <!-- Rich Editor Toolbar -->
                        ${renderRichEditorToolbar('mom-editor-toolbar')}

                        <!-- Contenteditable Rich Text Area -->
                        <div id="mom-content-editor"
                             contenteditable="true"
                             class="prose-clean min-h-[240px] max-h-[380px] overflow-y-auto p-4 bg-zinc-950 border border-zinc-800 focus:border-red-500/80 rounded-xl text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-red-500/40 transition-all leading-relaxed"
                             placeholder="Type or paste formatted meeting minutes: agenda items, discussions, decisions made, and assigned tasks..."></div>
                        
                        <p class="text-[10px] text-zinc-500">
                            💡 You can copy/paste directly from Google Docs, Notion, or Word. Text formatting and lists are preserved.
                        </p>
                    </div>

                    <!-- Modal Actions -->
                    <div class="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2 flex-shrink-0">
                        <button type="button" id="cancel-mom-btn" class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl text-xs transition-colors cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" id="save-mom-btn" class="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold rounded-xl text-xs shadow-lg shadow-red-950/50 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95" ${isSaving ? 'disabled' : ''}>
                            ${isSaving ? '<div class="spinner spinner-sm mx-auto"></div> Saving...' : (isEditing ? 'Save Changes' : 'Save Minutes of Meeting 🚀')}
                        </button>
                    </div>
                </form>
            </div>
        </div>`;
    }

    function applyTemplate(type) {
        const editor = document.getElementById('mom-content-editor');
        if (!editor) return;

        let templateHtml = '';
        if (type === 'standard') {
            templateHtml = `
            <h3>1. Agenda & Objective</h3>
            <ul>
                <li>Review progress on upcoming club initiatives and hackathon deadlines.</li>
                <li>Core leadership synchronization and operational blockers.</li>
            </ul>
            <h3>2. Key Discussion Points</h3>
            <ul>
                <li>Discussion item A: Technical workshops timeline.</li>
                <li>Discussion item B: Resource allocation and logistics.</li>
            </ul>
            <h3>3. Decisions & Agreed Outcomes</h3>
            <ul>
                <li>Approved final event dates and budget ceiling.</li>
            </ul>
            <h3>4. Action Items & Assignees</h3>
            <ul>
                <li><b>[Assignee Name]</b>: Task details (Target Deadline: DD/MM/YYYY)</li>
                <li><b>[Assignee Name]</b>: Coordinate sponsor reachout and design posters</li>
            </ul>`;
        } else if (type === 'project') {
            templateHtml = `
            <h3>1. Project Progress & Milestone Audit</h3>
            <ul>
                <li>Reviewed current milestone status across active student teams.</li>
            </ul>
            <h3>2. Technical Roadblocks & Team Queries</h3>
            <ul>
                <li>Identified hardware component shortages for IoT and Robotics tracks.</li>
            </ul>
            <h3>3. Mentor Guidance & Action Plan</h3>
            <ul>
                <li>Mentors to conduct targeted review sessions with teams next Tuesday.</li>
            </ul>`;
        }

        if (editor.innerHTML.trim() && !confirm('Insert template and overwrite current editor content?')) {
            editor.innerHTML += templateHtml;
        } else {
            editor.innerHTML = templateHtml;
        }
        editor.focus();
    }

    async function mount(container) {
        const user = ICCSupabase.getUser();
        const isAdmin = ICCSupabase.isAdmin();
        const isMentor = ICCSupabase.isMentor();

        if (!user || (!isAdmin && !isMentor)) {
            container.innerHTML = renderPermissionDenied();
            return;
        }

        // Fetch fresh MoM logs
        allMoms = await ICCSupabase.fetchMinutesOfMeeting();
        container.innerHTML = render();
        bindEvents(container);
    }

    function bindEvents(container) {
        // Search
        const searchInput = document.getElementById('mom-search-input');
        searchInput?.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            container.innerHTML = render();
            bindEvents(container);
            const input = document.getElementById('mom-search-input');
            if (input) {
                input.focus();
                input.selectionStart = input.selectionEnd = input.value.length;
            }
        });

        document.getElementById('clear-mom-search-btn')?.addEventListener('click', () => {
            searchQuery = '';
            container.innerHTML = render();
            bindEvents(container);
        });

        // Open create modal
        const openCreate = () => {
            editingMom = {};
            container.innerHTML = render();
            bindEvents(container);
            initEditor();
        };

        document.getElementById('open-create-mom-btn')?.addEventListener('click', openCreate);
        document.getElementById('empty-create-mom-btn')?.addEventListener('click', openCreate);

        // Edit MoM
        container.querySelectorAll('.edit-mom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const mom = allMoms.find(m => m.id === id);
                if (mom) {
                    editingMom = { ...mom };
                    container.innerHTML = render();
                    bindEvents(container);
                    initEditor(mom.content);
                }
            });
        });

        // Delete MoM
        container.querySelectorAll('.delete-mom-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const mom = allMoms.find(m => m.id === id);
                const title = mom ? mom.title : 'this meeting';

                if (!confirm(`Are you sure you want to permanently delete Minutes of Meeting for "${title}"?`)) return;

                btn.disabled = true;
                const { error } = await ICCSupabase.deleteMinutesOfMeeting(id);
                if (error) {
                    Toast.error('Failed to delete MoM: ' + error.message);
                    btn.disabled = false;
                } else {
                    Toast.success('Minutes of Meeting deleted.');
                    allMoms = await ICCSupabase.fetchMinutesOfMeeting();
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        });

        // Toggle Expand Content
        container.querySelectorAll('.toggle-expand-mom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (expandedMoms.has(id)) expandedMoms.delete(id);
                else expandedMoms.add(id);
                container.innerHTML = render();
                bindEvents(container);
            });
        });

        // Copy MoM text
        container.querySelectorAll('.copy-mom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const mom = allMoms.find(m => m.id === id);
                if (!mom) return;

                const temp = document.createElement('div');
                temp.innerHTML = mom.content || '';
                const plainText = temp.innerText || temp.textContent || '';

                const summary = `📝 MINUTES OF MEETING: ${mom.title}\n📅 Date: ${mom.meeting_date || ''} ${mom.meeting_time ? '· ' + mom.meeting_time : ''}\n👥 Attendees: ${mom.attendees || 'Core Team'}\n\n${plainText.trim()}`;

                navigator.clipboard.writeText(summary).then(() => {
                    Toast.success('Meeting summary copied to clipboard!');
                }).catch(() => {
                    Toast.info('Unable to copy automatically.');
                });
            });
        });

        // Modal Events
        if (editingMom) {
            const closeModal = () => {
                editingMom = null;
                isSaving = false;
                container.innerHTML = render();
                bindEvents(container);
            };

            document.getElementById('close-mom-modal-btn')?.addEventListener('click', closeModal);
            document.getElementById('cancel-mom-btn')?.addEventListener('click', closeModal);
            document.getElementById('mom-modal-overlay')?.addEventListener('click', (e) => {
                if (e.target.id === 'mom-modal-overlay') closeModal();
            });

            // Template chips
            container.querySelectorAll('.template-chip-btn').forEach(chip => {
                chip.addEventListener('click', () => {
                    applyTemplate(chip.dataset.type);
                });
            });

            // Submit MoM Form
            document.getElementById('mom-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('mom-title-input')?.value.trim();
                const meeting_date = document.getElementById('mom-date-input')?.value;
                const meeting_time = document.getElementById('mom-time-input')?.value.trim();
                const attendees = document.getElementById('mom-attendees-input')?.value.trim();
                const editor = document.getElementById('mom-content-editor');
                const content = editor ? editor.innerHTML.trim() : '';

                if (!title) {
                    Toast.error('Please enter a meeting title.');
                    return;
                }
                if (!content || content === '<br>' || content.length < 10) {
                    Toast.error('Please enter descriptive meeting notes / minutes (at least 10 characters).');
                    return;
                }

                isSaving = true;
                const submitBtn = document.getElementById('save-mom-btn');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<div class="spinner spinner-sm mx-auto"></div> Saving...';
                }

                let res;
                if (editingMom.id) {
                    res = await ICCSupabase.updateMinutesOfMeeting(editingMom.id, {
                        title,
                        meeting_date,
                        meeting_time,
                        attendees,
                        content
                    });
                } else {
                    res = await ICCSupabase.createMinutesOfMeeting({
                        title,
                        meeting_date,
                        meeting_time,
                        attendees,
                        content
                    });
                }

                if (res.error) {
                    Toast.error('Failed to save MoM: ' + (res.error.message || res.error));
                    isSaving = false;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Save Minutes of Meeting 🚀';
                    }
                } else {
                    Toast.success(editingMom.id ? 'Minutes of Meeting updated!' : 'Minutes of Meeting saved!');
                    editingMom = null;
                    isSaving = false;
                    allMoms = await ICCSupabase.fetchMinutesOfMeeting();
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        }
    }

    function initEditor(initialContent = '') {
        const editor = document.getElementById('mom-content-editor');
        if (!editor) return;
        bindRichEditorToolbar('mom-editor-toolbar', editor);
        if (initialContent) {
            editor.innerHTML = initialContent;
        }
    }

    return {
        mount
    };
})();
