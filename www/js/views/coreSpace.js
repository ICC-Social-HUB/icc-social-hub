/* ============================================
   ICC Social Hub — Core Space View
   Executive headquarters, governance,
   and Minutes of Meeting (MoM) management
   All administrators are referred to as "Core"
   ============================================ */

const CoreSpaceView = (() => {
    let allMoms = [];
    let coreProfiles = [];
    let searchQuery = '';
    let editingMom = null; // null = closed, {} = new, { id: ... } = edit
    let viewingMom = null; // null = closed, { ... } = viewing full MoM
    let isSaving = false;
    let selectedCoreIds = new Set();

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }

    function sanitizeRichHtml(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
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

    function parseAttendees(raw) {
        if (!raw) return { core_ids: [], others: '' };
        if (typeof raw === 'object' && raw !== null) {
            return {
                core_ids: Array.isArray(raw.core_ids) ? raw.core_ids : [],
                others: raw.others || ''
            };
        }
        const str = String(raw).trim();
        if (str.startsWith('{') && str.endsWith('}')) {
            try {
                const parsed = JSON.parse(str);
                return {
                    core_ids: Array.isArray(parsed.core_ids) ? parsed.core_ids : [],
                    others: parsed.others || ''
                };
            } catch (e) {}
        }
        return { core_ids: [], others: str };
    }

    function renderRichEditorToolbar(toolbarId) {
        return `
        <div class="flex flex-wrap items-center gap-1 p-1.5 bg-zinc-900 rounded-xl select-none" id="${toolbarId}">
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-bold transition-colors cursor-pointer active:scale-95" data-cmd="bold" title="Bold">
                <b>B</b>
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs italic font-serif transition-colors cursor-pointer active:scale-95" data-cmd="italic" title="Italic">
                <i>I</i>
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs underline transition-colors cursor-pointer active:scale-95" data-cmd="underline" title="Underline">
                <u>U</u>
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs line-through transition-colors cursor-pointer active:scale-95" data-cmd="strikeThrough" title="Strikethrough">
                <s>S</s>
            </button>

            <span class="w-[1px] h-4 bg-zinc-700 mx-1"></span>

            <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-semibold transition-colors cursor-pointer active:scale-95" data-cmd="formatBlock" data-val="<h3>" title="Heading">
                H1
            </button>
            <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-semibold transition-colors cursor-pointer active:scale-95" data-cmd="formatBlock" data-val="<h4>" title="Subheading">
                H2
            </button>

            <span class="w-[1px] h-4 bg-zinc-700 mx-1"></span>

            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="insertUnorderedList" title="Bulleted List">
                • List
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="insertOrderedList" title="Numbered List">
                1. List
            </button>

            <span class="w-[1px] h-4 bg-zinc-700 mx-1"></span>

            <button type="button" class="toolbar-btn px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="createLink" title="Insert Link">
                🔗 Link
            </button>
            <button type="button" class="toolbar-btn px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="removeFormat" title="Clear Formatting">
                ⌫ Clear
            </button>
        </div>`;
    }

    function bindRichEditorToolbar(toolbarId, editorElement) {
        const toolbar = document.getElementById(toolbarId);
        if (!toolbar || !editorElement) return;

        toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('mousedown', (e) => e.preventDefault());
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                const val = btn.dataset.val || null;

                if (cmd === 'createLink') {
                    const url = prompt('Enter link URL:', 'https://');
                    if (url && url.trim()) {
                        let validUrl = url.trim();
                        if (!/^https?:\/\//i.test(validUrl)) validUrl = 'https://' + validUrl;
                        document.execCommand('createLink', false, validUrl);
                    }
                } else {
                    document.execCommand(cmd, false, val);
                }
                editorElement.focus();
            });
        });

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
            <div class="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-400 text-2xl font-bold mb-4 shadow-xl">
                🔒
            </div>
            <h2 class="text-xl font-heading font-bold text-white mb-2">Access Restricted to Core Team</h2>
            <p class="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
                Core Space is exclusively reserved for Core team members. If you believe you should have access, please contact Super Core.
            </p>
            <a href="#dashboard" class="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-all">
                Back to Home
            </a>
        </div>`;
    }

    function render() {
        const user = ICCSupabase.getUser();
        const isAdmin = ICCSupabase.isAdmin();
        const isMentor = ICCSupabase.isMentor();
        const isSuper = ICCSupabase.isSuperAdmin();
        const canManage = ICCSupabase.canManageMom();

        if (!user || (!isAdmin && !isMentor)) {
            return renderPermissionDenied();
        }

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
        <div class="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6 pb-24 animate-fade-in">
            
            <!-- Core Space Hero Header -->
            <div class="relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-2xl bg-gradient-to-br from-zinc-950 via-zinc-900/60 to-zinc-950">
                <div class="absolute -top-24 -right-24 w-80 h-80 bg-red-600/10 rounded-full blur-[90px] pointer-events-none"></div>
                <div class="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-600/10 rounded-full blur-[90px] pointer-events-none"></div>

                <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div class="space-y-2">
                        <div class="flex items-center gap-2.5 flex-wrap">
                            <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                                Core Space
                            </span>
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                                ${isSuper ? '🛡️ Super Core Access' : '👥 Core Team Access'}
                            </span>
                        </div>
                        <h1 class="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                            Core Space
                        </h1>
                        <p class="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
                            Official chronological record of core meetings, agendas, action items, and executive agreements.
                        </p>
                    </div>

                    <!-- Quick Action -->
                    <div class="flex items-center gap-3 flex-shrink-0 flex-wrap">
                        ${canManage ? `
                            <button id="open-create-mom-btn" class="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-red-950/40 transition-all flex items-center gap-2 active:scale-95 cursor-pointer">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                <span>Log Minutes of Meeting</span>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Stats summary strip without borders -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5">
                    <div class="bg-zinc-950/50 rounded-xl p-3">
                        <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Meeting Logs</span>
                        <div class="flex items-baseline gap-1 mt-0.5">
                            <span class="text-xl font-bold text-white">${allMoms.length}</span>
                            <span class="text-[10px] text-zinc-500">sessions</span>
                        </div>
                    </div>
                    <div class="bg-zinc-950/50 rounded-xl p-3">
                        <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Latest Session</span>
                        <div class="mt-0.5">
                            <span class="text-xs font-semibold text-zinc-200">${allMoms[0]?.meeting_date || 'No logs yet'}</span>
                        </div>
                    </div>
                    <div class="bg-zinc-950/50 rounded-xl p-3">
                        <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Core Team</span>
                        <div class="mt-0.5">
                            <span class="text-xs font-semibold text-emerald-400">${coreProfiles.length} Members</span>
                        </div>
                    </div>
                    <div class="bg-zinc-950/50 rounded-xl p-3">
                        <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Your Core Role</span>
                        <div class="mt-0.5">
                            <span class="text-xs font-bold ${canManage ? 'text-rose-400' : 'text-zinc-400'}">
                                ${canManage ? 'Full Manage (Edit/Delete)' : 'Core Reader'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SECTION: MINUTES OF MEETING (MoM) -->
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 class="font-heading font-bold text-lg text-white flex items-center gap-2">
                            <span>📝 Minutes of Meeting</span>
                            <span class="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full text-xs font-mono">${filteredMoms.length}</span>
                        </h2>
                        <p class="text-xs text-zinc-400">Click any MoM subject to read the full meeting notes.</p>
                    </div>

                    <!-- Search Input Bar without heavy border -->
                    <div class="relative w-full sm:w-72">
                        <input type="text" id="mom-search-input" value="${escapeHtml(searchQuery)}" placeholder="Search meeting subjects or dates..." 
                               class="w-full pl-9 pr-8 py-2 bg-zinc-900 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-red-500 transition-colors">
                        <svg class="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        ${searchQuery ? `
                            <button id="clear-mom-search-btn" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs">✕</button>
                        ` : ''}
                    </div>
                </div>

                <!-- MoM Subjects List (Displaying subject; clicking opens full MoM) -->
                ${filteredMoms.length === 0 ? `
                    <div class="rounded-2xl p-12 text-center bg-zinc-900/40 space-y-3">
                        <div class="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-500 text-2xl mx-auto">
                            📝
                        </div>
                        <h3 class="font-heading font-bold text-base text-white">${searchQuery ? 'No matching meetings found' : 'No Minutes of Meeting recorded yet'}</h3>
                        <p class="text-xs text-zinc-400 max-w-sm mx-auto">
                            ${searchQuery ? 'Try clearing your search query to see all logs.' : 'Log the first Minutes of Meeting to preserve discussion points, action items, and decisions for the Core team.'}
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
                    <div class="space-y-2.5">
                        ${filteredMoms.map(mom => {
                            const author = mom.profiles || {};
                            const authorName = mom.author_name || author.full_name || 'Core Member';
                            const parsed = parseAttendees(mom.attendees);
                            const presentCoreMembers = coreProfiles.filter(p => parsed.core_ids.includes(p.id));
                            const coreCount = presentCoreMembers.length;

                            return `
                            <div class="mom-list-card p-4 sm:p-5 rounded-2xl bg-zinc-900/50 hover:bg-zinc-900/90 transition-all cursor-pointer group flex items-center justify-between gap-4" data-id="${mom.id}">
                                <div class="min-w-0 flex-1 space-y-1.5">
                                    <div class="flex items-center gap-2 text-[11px] text-zinc-400 flex-wrap">
                                        <span class="font-mono text-zinc-300 font-semibold">${escapeHtml(mom.meeting_date || 'Undated')}</span>
                                        ${mom.meeting_time ? `<span>·</span><span>${escapeHtml(mom.meeting_time)}</span>` : ''}
                                        <span>·</span>
                                        <span>Logged by <strong class="text-zinc-200">${escapeHtml(authorName)}</strong> (Core)</span>
                                    </div>
                                    
                                    <!-- MoM Subject -->
                                    <h3 class="font-heading font-bold text-base sm:text-lg text-white group-hover:text-red-400 transition-colors break-words leading-snug">
                                        ${escapeHtml(mom.title)}
                                    </h3>

                                    <!-- Attendees Summary -->
                                    <div class="flex items-center gap-2 pt-0.5 flex-wrap">
                                        ${coreCount > 0 ? `
                                            <div class="flex items-center -space-x-1.5 overflow-hidden">
                                                ${presentCoreMembers.slice(0, 5).map(m => `
                                                    <div class="w-5 h-5 rounded-full bg-zinc-800 ring-1 ring-zinc-950 flex items-center justify-center overflow-hidden text-[9px] font-bold text-zinc-300" title="${escapeHtml(m.full_name || m.username)}">
                                                        ${m.avatar_url ? `<img src="${m.avatar_url}" class="w-full h-full object-cover">` : (m.full_name || 'C')[0]}
                                                    </div>
                                                `).join('')}
                                            </div>
                                            <span class="text-[11px] text-zinc-400 font-medium">${coreCount} Core present</span>
                                        ` : ''}
                                        ${parsed.others ? `
                                            <span class="text-[11px] text-zinc-500 font-normal truncate max-w-xs">• ${escapeHtml(parsed.others)}</span>
                                        ` : ''}
                                    </div>
                                </div>

                                <!-- Read Button -->
                                <div class="flex items-center gap-3 flex-shrink-0">
                                    <div class="flex items-center gap-1 text-xs font-semibold text-zinc-400 group-hover:text-white transition-colors">
                                        <span>Read</span>
                                        <svg class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                                    </div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                `}
            </div>

            <!-- MODAL: FULL MOM VIEWER (Strictly no borders for text) -->
            ${viewingMom ? renderMomViewModal(viewingMom, canManage) : ''}

            <!-- MODAL: CREATE / EDIT MINUTES OF MEETING -->
            ${editingMom ? renderMomEditModal(editingMom) : ''}
        </div>`;
    }

    // Modal to view full MoM cleanly without any borders around the text
    function renderMomViewModal(mom, canManage) {
        const author = mom.profiles || {};
        const authorName = mom.author_name || author.full_name || 'Core Member';
        const parsed = parseAttendees(mom.attendees);
        const presentCore = coreProfiles.filter(p => parsed.core_ids.includes(p.id));

        return `
        <div id="mom-view-modal-overlay" class="fixed inset-0 z-[2500] bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
            <div class="w-full max-w-3xl rounded-3xl p-6 sm:p-8 bg-zinc-950 shadow-2xl my-auto space-y-6 max-h-[92vh] flex flex-col animate-slide-up" onclick="event.stopPropagation()">
                
                <!-- Header with Back & Action buttons -->
                <div class="flex items-center justify-between pb-3 flex-shrink-0 gap-3 flex-wrap">
                    <button id="close-mom-view-btn" class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer">
                        <svg class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        <span>Back to List</span>
                    </button>

                    <div class="flex items-center gap-2">
                        <button id="copy-view-mom-btn" class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5" title="Copy text">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                            <span>Copy</span>
                        </button>
                        ${canManage ? `
                            <button id="edit-view-mom-btn" class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5" title="Edit">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                <span>Edit</span>
                            </button>
                            <button id="delete-view-mom-btn" class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5" title="Delete">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                <span>Delete</span>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Subject Title (No borders) -->
                <div class="space-y-2 flex-shrink-0">
                    <h1 class="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight leading-tight break-words">
                        ${escapeHtml(mom.title)}
                    </h1>
                    <div class="flex items-center gap-2.5 text-xs text-zinc-400 flex-wrap">
                        <span class="font-mono text-zinc-200 font-semibold">${escapeHtml(mom.meeting_date || 'Undated')}</span>
                        ${mom.meeting_time ? `<span>·</span><span>${escapeHtml(mom.meeting_time)}</span>` : ''}
                        <span>·</span>
                        <span>Logged by <strong class="text-zinc-200">${escapeHtml(authorName)}</strong> (Core)</span>
                    </div>
                </div>

                <!-- Attendees Section (Clean, without borders) -->
                <div class="space-y-2.5 pt-2 flex-shrink-0">
                    <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Core Members Present:</span>
                    ${presentCore.length > 0 ? `
                        <div class="flex items-center gap-2 flex-wrap">
                            ${presentCore.map(m => `
                                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 text-xs text-zinc-200 font-medium">
                                    <div class="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden text-[9px] font-bold">
                                        ${m.avatar_url ? `<img src="${m.avatar_url}" class="w-full h-full object-cover">` : (m.full_name || 'C')[0]}
                                    </div>
                                    <span>${escapeHtml(m.full_name || m.username)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <p class="text-xs text-zinc-500 italic">No specific core profiles marked present.</p>
                    `}

                    ${parsed.others ? `
                        <div class="pt-1">
                            <span class="text-xs text-zinc-400">Other Attendees: </span>
                            <span class="text-xs text-zinc-300 font-medium">${escapeHtml(parsed.others)}</span>
                        </div>
                    ` : ''}
                </div>

                <!-- Meeting Content Body (Strictly no borders, natural typography) -->
                <div class="flex-1 overflow-y-auto pr-2 no-scrollbar pt-3">
                    <div class="prose-clean text-sm sm:text-base text-zinc-200 leading-relaxed font-sans space-y-3">
                        ${sanitizeRichHtml(mom.content)}
                    </div>
                </div>
            </div>
        </div>`;
    }

    // Modal to create or edit MoM
    function renderMomEditModal(mom) {
        const isEditing = !!mom.id;
        const defaultDate = mom.meeting_date || new Date().toISOString().split('T')[0];
        const defaultTime = mom.meeting_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const parsed = parseAttendees(mom.attendees);

        return `
        <div id="mom-modal-overlay" class="fixed inset-0 z-[2500] bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
            <div class="w-full max-w-3xl rounded-3xl p-5 sm:p-7 bg-zinc-950 shadow-2xl my-auto space-y-4 max-h-[92vh] flex flex-col animate-slide-up" onclick="event.stopPropagation()">
                
                <!-- Modal Header -->
                <div class="flex items-center justify-between pb-3 flex-shrink-0">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center text-lg">
                            📝
                        </div>
                        <div>
                            <h3 class="font-heading font-bold text-base sm:text-lg text-white">
                                ${isEditing ? 'Edit Minutes of Meeting' : 'Log Minutes of Meeting (MoM)'}
                            </h3>
                            <p class="text-[11px] text-zinc-400">All Core members will be able to read these minutes.</p>
                        </div>
                    </div>
                    <button id="close-mom-modal-btn" class="text-zinc-400 hover:text-white p-1 rounded-lg">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <!-- Modal Body Form -->
                <form id="mom-form" class="space-y-4 flex-1 overflow-y-auto pr-1 no-scrollbar">
                    
                    <!-- Subject Title -->
                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                            <span>Meeting Subject <span class="text-red-400">*</span></span>
                            <span class="text-[10px] text-zinc-500 font-normal">Required</span>
                        </label>
                        <input type="text" id="mom-title-input" value="${escapeHtml(mom.title || '')}" 
                               placeholder="e.g. Core Team Strategy Sync #14 · Hackathon Finalization"
                               class="w-full px-3.5 py-2.5 bg-zinc-900 rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-red-500 transition-colors" required>
                    </div>

                    <!-- Date & Time Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                                Meeting Date <span class="text-red-400">*</span>
                            </label>
                            <input type="date" id="mom-date-input" value="${escapeHtml(defaultDate)}"
                                   class="w-full px-3.5 py-2.5 bg-zinc-900 rounded-xl text-sm text-white outline-none focus:ring-1 focus:ring-red-500 transition-colors" required>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                                Meeting Time <span class="text-red-400">*</span>
                            </label>
                            <input type="text" id="mom-time-input" value="${escapeHtml(defaultTime)}" placeholder="e.g. 10:30 AM or 17:00"
                                   class="w-full px-3.5 py-2.5 bg-zinc-900 rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-red-500 transition-colors" required>
                        </div>
                    </div>

                    <!-- Core Members Present (Selectable Profiles) -->
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label class="block text-xs font-semibold text-zinc-300">
                                Core Members Present <span class="text-zinc-500 font-normal">(${coreProfiles.length} Core available)</span>
                            </label>
                            <div class="flex items-center gap-2">
                                <button type="button" id="select-all-core-btn" class="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer font-medium">Select All</button>
                                <span class="text-zinc-600">·</span>
                                <button type="button" id="clear-all-core-btn" class="text-[11px] text-zinc-400 hover:text-zinc-300 cursor-pointer font-medium">Clear</button>
                            </div>
                        </div>

                        <!-- Core Profiles Selection Grid -->
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 no-scrollbar" id="core-members-selector">
                            ${coreProfiles.map(m => {
                                const isSelected = selectedCoreIds.has(m.id);
                                const avatar = m.avatar_url;
                                const name = m.full_name || m.username || 'Core Member';
                                const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                                return `
                                <div class="core-profile-chip flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all select-none ${isSelected ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}" data-id="${m.id}">
                                    <div class="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0 text-[10px] font-bold ${isSelected ? 'ring-2 ring-emerald-400' : ''}">
                                        ${avatar ? `<img src="${avatar}" class="w-full h-full object-cover">` : initials}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p class="text-xs font-semibold truncate leading-tight">${escapeHtml(name)}</p>
                                        <span class="text-[9px] text-zinc-500 font-medium">Core</span>
                                    </div>
                                    <div class="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-500 text-black text-[10px] font-bold' : 'border border-zinc-700 text-transparent'}">
                                        ✓
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Other Attendees (Optional) -->
                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                            <span>Other Attendees <span class="text-zinc-500 font-normal">(Optional — Faculty, guests, non-core)</span></span>
                        </label>
                        <input type="text" id="mom-other-attendees-input" value="${escapeHtml(parsed.others || '')}"
                               placeholder="e.g. Prof. Sharma (Faculty Advisor), Tech Team Leads"
                               class="w-full px-3.5 py-2.5 bg-zinc-900 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-red-500 transition-colors">
                    </div>

                    <!-- Formatted Editor -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <label class="block text-xs font-semibold text-zinc-300">
                                Meeting Notes & Agendas <span class="text-red-400">*</span>
                            </label>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="text-[10px] text-zinc-500">Template:</span>
                                <button type="button" class="template-chip-btn px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-medium transition-colors" data-type="standard">
                                    📋 Standard
                                </button>
                                <button type="button" class="template-chip-btn px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-medium transition-colors" data-type="decision">
                                    🎯 Strategic
                                </button>
                            </div>
                        </div>

                        ${renderRichEditorToolbar('mom-editor-toolbar')}

                        <!-- Content Editable Area (Without enclosing box border) -->
                        <div id="mom-content-editor" contenteditable="true" 
                             class="w-full min-h-[160px] max-h-[300px] overflow-y-auto px-4 py-3 bg-zinc-900 rounded-xl text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-red-500 transition-colors font-sans leading-relaxed"
                             placeholder="Type, format, paste meeting minutes, agendas, key decisions, and next steps..."></div>
                    </div>

                    <!-- Modal Actions -->
                    <div class="flex items-center justify-end gap-3 pt-3 flex-shrink-0">
                        <button type="button" id="cancel-mom-btn" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" id="save-mom-btn" class="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2">
                            <span>Save Minutes of Meeting</span>
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
        if (type === 'decision') {
            templateHtml = `
            <h3>🎯 Executive Strategy & Governance</h3>
            <p><strong>Primary Objective:</strong> Clarify agenda, policy changes, and next operational phases.</p>
            <h4>Key Decisions Approved:</h4>
            <ul>
                <li>Decision 1: Approved resource allocation and milestones.</li>
                <li>Decision 2: Approved deadlines and assigned ownership.</li>
            </ul>
            <h4>Action Items & Ownership:</h4>
            <ul>
                <li><strong>Core Lead 1:</strong> Implementation and follow-up.</li>
                <li><strong>Core Lead 2:</strong> Verification and documentation.</li>
            </ul>`;
        } else {
            templateHtml = `
            <h3>Agenda & Discussion Points</h3>
            <ul>
                <li>Review of previous session action items.</li>
                <li>Key project milestones, timelines, and roadblocks.</li>
                <li>Open floor for feedback and alignment.</li>
            </ul>
            <h4>Agreed Next Steps:</h4>
            <ol>
                <li>Finalize milestone deliverables before upcoming review.</li>
                <li>Sync with core teams on deliverables.</li>
            </ol>`;
        }

        if (editor.innerHTML && editor.innerHTML.trim().length > 15) {
            if (confirm('Replace current editor content with this template?')) {
                editor.innerHTML = templateHtml;
            }
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

        // Fetch fresh MoM logs and Core team profiles
        const [moms, profiles] = await Promise.all([
            ICCSupabase.fetchMinutesOfMeeting(),
            ICCSupabase.fetchCoreProfiles()
        ]);

        allMoms = moms || [];
        coreProfiles = profiles || [];

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

        // Open full MoM viewer when clicking card
        container.querySelectorAll('.mom-list-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const mom = allMoms.find(m => m.id === id);
                if (mom) {
                    viewingMom = mom;
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        });

        // Open create modal
        const openCreate = () => {
            editingMom = {};
            selectedCoreIds = new Set();
            container.innerHTML = render();
            bindEvents(container);
            initEditor();
        };

        document.getElementById('open-create-mom-btn')?.addEventListener('click', openCreate);
        document.getElementById('empty-create-mom-btn')?.addEventListener('click', openCreate);

        // View Modal Events
        if (viewingMom) {
            const closeViewer = () => {
                viewingMom = null;
                container.innerHTML = render();
                bindEvents(container);
            };

            document.getElementById('close-mom-view-btn')?.addEventListener('click', closeViewer);
            document.getElementById('mom-view-modal-overlay')?.addEventListener('click', (e) => {
                if (e.target.id === 'mom-view-modal-overlay') closeViewer();
            });

            document.getElementById('copy-view-mom-btn')?.addEventListener('click', () => {
                const temp = document.createElement('div');
                temp.innerHTML = viewingMom.content || '';
                const plainText = temp.innerText || temp.textContent || '';
                const text = `📝 ${viewingMom.title}\n📅 ${viewingMom.meeting_date || ''} ${viewingMom.meeting_time || ''}\n\n${plainText.trim()}`;
                navigator.clipboard.writeText(text).then(() => {
                    Toast.success('Meeting notes copied to clipboard!');
                }).catch(() => Toast.info('Could not copy automatically.'));
            });

            document.getElementById('edit-view-mom-btn')?.addEventListener('click', () => {
                const mom = viewingMom;
                viewingMom = null;
                editingMom = { ...mom };
                const parsed = parseAttendees(mom.attendees);
                selectedCoreIds = new Set(parsed.core_ids || []);
                container.innerHTML = render();
                bindEvents(container);
                initEditor(mom.content);
            });

            document.getElementById('delete-view-mom-btn')?.addEventListener('click', async () => {
                if (!confirm(`Are you sure you want to permanently delete Minutes of Meeting for "${viewingMom.title}"?`)) return;
                const { error } = await ICCSupabase.deleteMinutesOfMeeting(viewingMom.id);
                if (error) {
                    Toast.error('Failed to delete MoM: ' + error.message);
                } else {
                    Toast.success('Minutes of Meeting deleted.');
                    viewingMom = null;
                    allMoms = await ICCSupabase.fetchMinutesOfMeeting();
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        }

        // Edit Modal Events
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

            // Core Profile Chips toggle
            container.querySelectorAll('.core-profile-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const id = chip.dataset.id;
                    if (selectedCoreIds.has(id)) {
                        selectedCoreIds.delete(id);
                    } else {
                        selectedCoreIds.add(id);
                    }
                    // Re-render chip styling without tearing down editor
                    container.querySelectorAll('.core-profile-chip').forEach(c => {
                        const cid = c.dataset.id;
                        const isSel = selectedCoreIds.has(cid);
                        c.className = `core-profile-chip flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all select-none ${isSel ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`;
                        const badge = c.querySelector('div:last-child');
                        if (badge) {
                            badge.className = `w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${isSel ? 'bg-emerald-500 text-black text-[10px] font-bold' : 'border border-zinc-700 text-transparent'}`;
                        }
                    });
                });
            });

            // Select All / Clear Core
            document.getElementById('select-all-core-btn')?.addEventListener('click', () => {
                coreProfiles.forEach(p => selectedCoreIds.add(p.id));
                container.querySelectorAll('.core-profile-chip').forEach(c => {
                    c.className = 'core-profile-chip flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all select-none bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50';
                    const badge = c.querySelector('div:last-child');
                    if (badge) badge.className = 'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-500 text-black text-[10px] font-bold';
                });
            });

            document.getElementById('clear-all-core-btn')?.addEventListener('click', () => {
                selectedCoreIds.clear();
                container.querySelectorAll('.core-profile-chip').forEach(c => {
                    c.className = 'core-profile-chip flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all select-none bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200';
                    const badge = c.querySelector('div:last-child');
                    if (badge) badge.className = 'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border border-zinc-700 text-transparent';
                });
            });

            // Template chips
            container.querySelectorAll('.template-chip-btn').forEach(chip => {
                chip.addEventListener('click', () => applyTemplate(chip.dataset.type));
            });

            // Submit MoM Form
            document.getElementById('mom-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('mom-title-input')?.value.trim();
                const meeting_date = document.getElementById('mom-date-input')?.value;
                const meeting_time = document.getElementById('mom-time-input')?.value.trim();
                const otherAttendees = document.getElementById('mom-other-attendees-input')?.value.trim();
                const editor = document.getElementById('mom-content-editor');
                const content = editor ? editor.innerHTML.trim() : '';

                if (!title) {
                    Toast.error('Please enter a meeting subject.');
                    return;
                }
                if (!content || content === '<br>' || content.length < 5) {
                    Toast.error('Please enter meeting minutes / notes.');
                    return;
                }

                isSaving = true;
                const submitBtn = document.getElementById('save-mom-btn');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<div class="spinner spinner-sm mx-auto"></div> Saving...';
                }

                // Pack attendees as structured JSON with core_ids and others
                const attendeesPayload = JSON.stringify({
                    core_ids: Array.from(selectedCoreIds),
                    others: otherAttendees || ''
                });

                let res;
                if (editingMom.id) {
                    res = await ICCSupabase.updateMinutesOfMeeting(editingMom.id, {
                        title,
                        meeting_date,
                        meeting_time,
                        attendees: attendeesPayload,
                        content
                    });
                } else {
                    res = await ICCSupabase.createMinutesOfMeeting({
                        title,
                        meeting_date,
                        meeting_time,
                        attendees: attendeesPayload,
                        content
                    });
                }

                if (res.error) {
                    Toast.error('Failed to save MoM: ' + (res.error.message || res.error));
                    isSaving = false;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Save Minutes of Meeting';
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
