/* ============================================
   ICC Social Hub — Core Space View
   Executive Headquarters & Minutes of Meeting (MoM)
   Non-gradient, professional, distraction-free UI
   All administrators are referred to as "Core"
   ============================================ */

const CoreSpaceView = (() => {
    let allMoms = [];
    let coreProfiles = [];
    let searchQuery = '';
    
    // View state: 'list' | 'detail' | 'edit'
    let currentMode = 'list';
    let selectedMomId = null;
    let editingMom = null; // null or object { id, title, meeting_date, meeting_time, attendees, content }
    let selectedCoreIds = new Set();
    let isSaving = false;

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
        <div class="flex flex-wrap items-center gap-1 p-1.5 bg-[#121924] border border-[#242f3d] rounded-xl select-none" id="${toolbarId}">
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-[#1c2736] hover:bg-[#253346] text-zinc-200 rounded-md text-xs font-bold transition-colors cursor-pointer active:scale-95" data-cmd="bold" title="Bold">
                <b>B</b>
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-[#1c2736] hover:bg-[#253346] text-zinc-200 rounded-md text-xs italic font-serif transition-colors cursor-pointer active:scale-95" data-cmd="italic" title="Italic">
                <i>I</i>
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-[#1c2736] hover:bg-[#253346] text-zinc-200 rounded-md text-xs underline transition-colors cursor-pointer active:scale-95" data-cmd="underline" title="Underline">
                <u>U</u>
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-[#1c2736] hover:bg-[#253346] text-zinc-200 rounded-md text-xs line-through transition-colors cursor-pointer active:scale-95" data-cmd="strikeThrough" title="Strikethrough">
                <s>S</s>
            </button>

            <span class="w-[1px] h-4 bg-[#2b394a] mx-1"></span>

            <button type="button" class="toolbar-btn px-2.5 py-1 bg-[#1c2736] hover:bg-[#253346] text-zinc-200 rounded-md text-xs font-semibold transition-colors cursor-pointer active:scale-95" data-cmd="formatBlock" data-val="<h3>" title="Main Heading">
                H1
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-[#1c2736] hover:bg-[#253346] text-zinc-200 rounded-md text-xs font-semibold transition-colors cursor-pointer active:scale-95" data-cmd="formatBlock" data-val="<h4>" title="Subheading">
                H2
            </button>

            <span class="w-[1px] h-4 bg-[#2b394a] mx-1"></span>

            <button type="button" class="toolbar-btn px-2.5 py-1 bg-[#1c2736] hover:bg-[#253346] text-zinc-200 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="insertUnorderedList" title="Bulleted List">
                • List
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-[#1c2736] hover:bg-[#253346] text-zinc-200 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="insertOrderedList" title="Numbered List">
                1. List
            </button>

            <span class="w-[1px] h-4 bg-[#2b394a] mx-1"></span>

            <button type="button" class="toolbar-btn px-2.5 py-1 bg-[#1c2736] hover:bg-[#253346] text-zinc-200 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="createLink" title="Insert Link">
                🔗 Link
            </button>
            <button type="button" class="toolbar-btn px-2.5 py-1 bg-[#1c2736] hover:bg-[#253346] text-zinc-400 hover:text-red-400 rounded-md text-xs transition-colors cursor-pointer active:scale-95" data-cmd="removeFormat" title="Clear Formatting">
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
                    const url = prompt('Enter website link URL:', 'https://');
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
        <div class="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
            <div class="w-16 h-16 bg-[#17212b] border border-[#2b394a] rounded-2xl flex items-center justify-center text-red-400 text-2xl font-bold mb-4 shadow-md">
                🔒
            </div>
            <h2 class="text-xl font-heading font-bold text-white mb-2">Access Restricted to Core Team</h2>
            <p class="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
                Core Space is exclusively reserved for Core team members. If you believe you should have access, please contact Super Core.
            </p>
            <a href="#dashboard" class="px-6 py-2.5 bg-[#17212b] hover:bg-[#242f3d] border border-[#2b394a] text-white rounded-xl text-xs font-semibold transition-all">
                Back to Dashboard
            </a>
        </div>`;
    }

    // ==========================================
    // 1. LIST VIEW (Default Mode)
    // ==========================================
    function renderListView(canManage, isSuper) {
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
        <div class="w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-24">
            
            <!-- Top Navigation & Title Bar (NON-GRADIENT, SOLID, CLEAN) -->
            <div class="bg-[#17212b] border border-[#242f3d] rounded-2xl p-5 sm:p-7 shadow-sm">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400">
                                Core Space
                            </span>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#121924] text-zinc-300">
                                ${isSuper ? 'Super Core' : 'Core Team'}
                            </span>
                        </div>
                        <h1 class="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                            Minutes of Meeting (MoM)
                        </h1>
                        <p class="text-xs sm:text-sm text-zinc-400 max-w-xl">
                            Official archives of Core meeting discussions, decisions, and governance notes.
                        </p>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-2.5 flex-shrink-0">
                        <button id="back-to-hub-btn" class="px-3.5 py-2 bg-[#121924] hover:bg-[#1a2332] text-zinc-300 hover:text-white border border-[#242f3d] rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95">
                            <svg class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                            <span>Back to Hub</span>
                        </button>
                        ${canManage ? `
                            <button id="open-create-mom-btn" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                <span>+ Log MoM</span>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Stats summary strip without borders -->
                <div class="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-[#242f3d]">
                    <div class="bg-[#121924] rounded-xl p-3">
                        <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Meeting Sessions</span>
                        <div class="flex items-baseline gap-1 mt-0.5">
                            <span class="text-xl font-bold text-white">${allMoms.length}</span>
                            <span class="text-[10px] text-zinc-400">recorded</span>
                        </div>
                    </div>
                    <div class="bg-[#121924] rounded-xl p-3">
                        <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Latest Session</span>
                        <div class="mt-0.5">
                            <span class="text-xs font-semibold text-zinc-200">${allMoms[0]?.meeting_date || 'No logs yet'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- List Section -->
            <div class="space-y-3.5">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 class="font-heading font-bold text-base sm:text-lg text-white">
                            All Meeting Sessions (${filteredMoms.length})
                        </h2>
                        <p class="text-xs text-zinc-400">Click any session to open the full notes.</p>
                    </div>

                    <!-- Search Input -->
                    <div class="relative w-full sm:w-72">
                        <input type="text" id="mom-search-input" value="${escapeHtml(searchQuery)}" placeholder="Search meeting subject or date..." 
                               class="w-full pl-9 pr-8 py-2 bg-[#17212b] border border-[#242f3d] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-red-500 transition-colors">
                        <svg class="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        ${searchQuery ? `
                            <button id="clear-mom-search-btn" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs">✕</button>
                        ` : ''}
                    </div>
                </div>

                <!-- MoM Subjects List -->
                ${filteredMoms.length === 0 ? `
                    <div class="rounded-2xl p-10 text-center bg-[#17212b] border border-[#242f3d] space-y-3">
                        <div class="w-12 h-12 bg-[#121924] rounded-xl flex items-center justify-center text-zinc-500 text-xl mx-auto">
                            📝
                        </div>
                        <h3 class="font-heading font-bold text-base text-white">${searchQuery ? 'No matching meetings found' : 'No Minutes of Meeting recorded yet'}</h3>
                        <p class="text-xs text-zinc-400 max-w-sm mx-auto">
                            ${searchQuery ? 'Clear your search query to see all logs.' : 'Log the first Minutes of Meeting to preserve discussion points, action items, and decisions.'}
                        </p>
                        ${canManage && !searchQuery ? `
                            <div class="pt-2">
                                <button id="empty-create-mom-btn" class="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer">
                                    + Log First MoM
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
                            <div class="mom-list-item p-4 sm:p-5 rounded-2xl bg-[#17212b] hover:bg-[#1e2a38] border border-[#242f3d] hover:border-[#38485c] transition-all cursor-pointer group flex items-center justify-between gap-4" data-id="${mom.id}">
                                <div class="min-w-0 flex-1 space-y-1.5">
                                    <div class="flex items-center gap-2 text-[11px] text-zinc-400 flex-wrap">
                                        <span class="font-mono text-zinc-200 font-semibold">${escapeHtml(mom.meeting_date || 'Undated')}</span>
                                        ${mom.meeting_time ? `<span>·</span><span>${escapeHtml(mom.meeting_time)}</span>` : ''}
                                        <span>·</span>
                                        <span>Logged by <strong class="text-zinc-200 font-medium">${escapeHtml(authorName)}</strong> (Core)</span>
                                    </div>
                                    
                                    <!-- MoM Subject -->
                                    <h3 class="font-heading font-bold text-base sm:text-lg text-white group-hover:text-red-400 transition-colors break-words leading-snug">
                                        ${escapeHtml(mom.title)}
                                    </h3>

                                    <!-- Attendees Summary -->
                                    <div class="flex items-center gap-2 pt-0.5 flex-wrap">
                                        ${coreCount > 0 ? `
                                            <div class="flex items-center -space-x-1.5 overflow-hidden">
                                                ${presentCoreMembers.slice(0, 6).map(m => `
                                                    <div class="w-5 h-5 rounded-full bg-[#121924] border border-[#242f3d] flex items-center justify-center overflow-hidden text-[9px] font-bold text-zinc-300" title="${escapeHtml(m.full_name || m.username)}">
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

                                <!-- Read Arrow -->
                                <div class="flex items-center gap-1 text-xs font-semibold text-zinc-400 group-hover:text-white transition-colors flex-shrink-0">
                                    <span>Read MoM</span>
                                    <svg class="w-4 h-4 group-hover:translate-x-0.5 transition-transform text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                `}
            </div>
        </div>`;
    }

    // ==========================================
    // 2. DETAIL VIEW (Full MoM in page flow, NO OVERLAPPING)
    // ==========================================
    function renderDetailView(mom, canManage) {
        const author = mom.profiles || {};
        const authorName = mom.author_name || author.full_name || 'Core Member';
        const parsed = parseAttendees(mom.attendees);
        const presentCore = coreProfiles.filter(p => parsed.core_ids.includes(p.id));

        return `
        <div class="w-full max-w-4xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-24">
            
            <!-- Top Bar with Back and Actions -->
            <div class="flex items-center justify-between gap-3 flex-wrap">
                <button id="back-to-list-btn" class="flex items-center gap-2 px-4 py-2 bg-[#17212b] hover:bg-[#202c3b] border border-[#242f3d] text-zinc-200 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95">
                    <svg class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    <span>Back to All Sessions</span>
                </button>

                <div class="flex items-center gap-2">
                    <button id="copy-mom-btn" class="px-3.5 py-2 bg-[#17212b] hover:bg-[#202c3b] border border-[#242f3d] text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5" title="Copy text">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        <span>Copy Notes</span>
                    </button>
                    ${canManage ? `
                        <button id="edit-mom-btn" class="px-3.5 py-2 bg-[#17212b] hover:bg-[#202c3b] border border-[#242f3d] text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                            <span>Edit</span>
                        </button>
                        <button id="delete-mom-btn" class="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            <span>Delete</span>
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Reading Canvas (Solid, clean, NO GRADIENTS) -->
            <div class="bg-[#17212b] border border-[#242f3d] rounded-2xl p-6 sm:p-10 space-y-6 shadow-sm">
                
                <!-- Meeting Subject Header -->
                <div class="space-y-2 border-b border-[#242f3d] pb-5">
                    <h1 class="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight leading-snug break-words">
                        ${escapeHtml(mom.title)}
                    </h1>
                    <div class="flex items-center gap-2.5 text-xs text-zinc-400 flex-wrap">
                        <span class="font-mono text-zinc-200 font-semibold">📅 ${escapeHtml(mom.meeting_date || 'Undated')}</span>
                        ${mom.meeting_time ? `<span>·</span><span>🕒 ${escapeHtml(mom.meeting_time)}</span>` : ''}
                        <span>·</span>
                        <span>Logged by <strong class="text-zinc-200 font-medium">${escapeHtml(authorName)}</strong> (Core)</span>
                    </div>
                </div>

                <!-- Attendees Section -->
                <div class="space-y-2.5 border-b border-[#242f3d] pb-5">
                    <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Core Members Present:</span>
                    ${presentCore.length > 0 ? `
                        <div class="flex items-center gap-2 flex-wrap">
                            ${presentCore.map(m => `
                                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121924] border border-[#242f3d] text-xs text-zinc-200 font-medium">
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
                        <div class="pt-1 text-xs">
                            <span class="text-zinc-400 font-medium">Other Attendees: </span>
                            <span class="text-zinc-200">${escapeHtml(parsed.others)}</span>
                        </div>
                    ` : ''}
                </div>

                <!-- Full Meeting Text (STRICTLY NO ENCLOSING BORDER) -->
                <div class="prose-clean text-sm sm:text-base text-zinc-200 leading-relaxed font-sans space-y-4 pt-2">
                    ${sanitizeRichHtml(mom.content)}
                </div>
            </div>
        </div>`;
    }

    // ==========================================
    // 3. EDIT / CREATE VIEW (In page flow, NO OVERLAPPING)
    // ==========================================
    function renderEditView() {
        const isEditing = !!editingMom?.id;
        const defaultDate = editingMom?.meeting_date || new Date().toISOString().split('T')[0];
        const defaultTime = editingMom?.meeting_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const parsed = parseAttendees(editingMom?.attendees);

        return `
        <div class="w-full max-w-4xl mx-auto px-3 sm:px-6 py-6 space-y-6 pb-24">
            
            <!-- Top Bar -->
            <div class="flex items-center justify-between gap-3 flex-wrap">
                <button id="cancel-edit-btn" class="flex items-center gap-2 px-4 py-2 bg-[#17212b] hover:bg-[#202c3b] border border-[#242f3d] text-zinc-200 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95">
                    <svg class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    <span>Cancel & Back</span>
                </button>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-zinc-400">All Core members will be able to read these minutes.</span>
                </div>
            </div>

            <!-- Form Card (Solid, clean, NO GRADIENTS) -->
            <div class="bg-[#17212b] border border-[#242f3d] rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm">
                <div class="border-b border-[#242f3d] pb-4">
                    <h2 class="font-heading font-extrabold text-xl sm:text-2xl text-white">
                        ${isEditing ? 'Edit Minutes of Meeting' : 'Log New Minutes of Meeting (MoM)'}
                    </h2>
                </div>

                <form id="mom-form" class="space-y-5">
                    <!-- Meeting Subject -->
                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                            Meeting Subject <span class="text-red-400">*</span>
                        </label>
                        <input type="text" id="mom-title-input" value="${escapeHtml(editingMom?.title || '')}" 
                               placeholder="e.g. Core Team Strategy Sync #14 · Hackathon Finalization"
                               class="w-full px-4 py-2.5 bg-[#121924] border border-[#242f3d] rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:border-red-500 transition-colors" required>
                    </div>

                    <!-- Date & Time Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                                Meeting Date <span class="text-red-400">*</span>
                            </label>
                            <input type="date" id="mom-date-input" value="${escapeHtml(defaultDate)}"
                                   class="w-full px-4 py-2.5 bg-[#121924] border border-[#242f3d] rounded-xl text-sm text-white outline-none focus:border-red-500 transition-colors" required>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-zinc-300 mb-1.5">
                                Meeting Time <span class="text-red-400">*</span>
                            </label>
                            <input type="text" id="mom-time-input" value="${escapeHtml(defaultTime)}" placeholder="e.g. 10:30 AM or 17:00"
                                   class="w-full px-4 py-2.5 bg-[#121924] border border-[#242f3d] rounded-xl text-sm text-white placeholder-zinc-500 outline-none focus:border-red-500 transition-colors" required>
                        </div>
                    </div>

                    <!-- Core Members Present (Selectable Profiles) -->
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label class="block text-xs font-semibold text-zinc-300">
                                Core Members Present <span class="text-zinc-500 font-normal">(${coreProfiles.length} Core available)</span>
                            </label>
                            <div class="flex items-center gap-2">
                                <button type="button" id="select-all-core-btn" class="text-xs text-red-400 hover:text-red-300 cursor-pointer font-semibold">Select All</button>
                                <span class="text-zinc-600">·</span>
                                <button type="button" id="clear-all-core-btn" class="text-xs text-zinc-400 hover:text-zinc-300 cursor-pointer font-medium">Clear</button>
                            </div>
                        </div>

                        <!-- Core Profiles Selection Grid -->
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-2 bg-[#121924] border border-[#242f3d] rounded-xl" id="core-members-selector">
                            ${coreProfiles.map(m => {
                                const isSelected = selectedCoreIds.has(m.id);
                                const avatar = m.avatar_url;
                                const name = m.full_name || m.username || 'Core Member';
                                const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                                return `
                                <div class="core-profile-chip flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all select-none ${isSelected ? 'bg-red-500/15 border border-red-500/40 text-white' : 'bg-[#17212b] border border-transparent text-zinc-400 hover:bg-[#202c3b] hover:text-zinc-200'}" data-id="${m.id}">
                                    <div class="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0 text-[10px] font-bold ${isSelected ? 'ring-2 ring-red-400' : ''}">
                                        ${avatar ? `<img src="${avatar}" class="w-full h-full object-cover">` : initials}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p class="text-xs font-semibold truncate leading-tight">${escapeHtml(name)}</p>
                                        <span class="text-[9px] text-zinc-500 font-medium">Core</span>
                                    </div>
                                    <div class="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-red-500 text-white text-[10px] font-bold' : 'border border-zinc-700 text-transparent'}">
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
                               class="w-full px-4 py-2.5 bg-[#121924] border border-[#242f3d] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-red-500 transition-colors">
                    </div>

                    <!-- Formatted Editor -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <label class="block text-xs font-semibold text-zinc-300">
                                Meeting Notes & Agendas <span class="text-red-400">*</span>
                            </label>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="text-[10px] text-zinc-500">Template:</span>
                                <button type="button" class="template-chip-btn px-2.5 py-1 bg-[#121924] hover:bg-[#1a2332] border border-[#242f3d] text-zinc-300 rounded-lg text-xs font-medium transition-colors" data-type="standard">
                                    📋 Standard
                                </button>
                                <button type="button" class="template-chip-btn px-2.5 py-1 bg-[#121924] hover:bg-[#1a2332] border border-[#242f3d] text-zinc-300 rounded-lg text-xs font-medium transition-colors" data-type="decision">
                                    🎯 Strategic
                                </button>
                            </div>
                        </div>

                        ${renderRichEditorToolbar('mom-editor-toolbar')}

                        <!-- Content Editable Area -->
                        <div id="mom-content-editor" contenteditable="true" 
                             class="w-full min-h-[220px] max-h-[480px] overflow-y-auto px-4 py-3 bg-[#121924] border border-[#242f3d] rounded-xl text-sm text-zinc-200 outline-none focus:border-red-500 transition-colors font-sans leading-relaxed"
                             placeholder="Type or paste meeting minutes, agendas, key decisions, and next steps..."></div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#242f3d]">
                        <button type="button" id="cancel-form-btn" class="px-5 py-2.5 bg-[#121924] hover:bg-[#1c2736] border border-[#242f3d] text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" id="save-mom-btn" class="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2">
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

    // ==========================================
    // 4. MAIN RENDER CONTROLLER
    // ==========================================
    function render() {
        const user = ICCSupabase.getUser();
        const isAdmin = ICCSupabase.isAdmin();
        const isMentor = ICCSupabase.isMentor();
        const isSuper = ICCSupabase.isSuperAdmin();
        const canManage = ICCSupabase.canManageMom();

        if (!user || (!isAdmin && !isMentor)) {
            return renderPermissionDenied();
        }

        if (currentMode === 'detail') {
            const mom = allMoms.find(m => m.id === selectedMomId);
            if (mom) {
                return renderDetailView(mom, canManage);
            }
            currentMode = 'list';
        }

        if (currentMode === 'edit') {
            return renderEditView();
        }

        return renderListView(canManage, isSuper);
    }

    // ==========================================
    // 5. MOUNT & EVENT BINDINGS
    // ==========================================
    async function mount(container) {
        const user = ICCSupabase.getUser();
        const isAdmin = ICCSupabase.isAdmin();
        const isMentor = ICCSupabase.isMentor();

        if (!user || (!isAdmin && !isMentor)) {
            container.innerHTML = renderPermissionDenied();
            return;
        }

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
        // --- LIST MODE EVENTS ---
        if (currentMode === 'list') {
            document.getElementById('back-to-hub-btn')?.addEventListener('click', () => {
                window.location.hash = '#dashboard';
            });

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

            const openCreate = () => {
                currentMode = 'edit';
                editingMom = {};
                selectedCoreIds = new Set();
                container.innerHTML = render();
                bindEvents(container);
                initEditor();
            };

            document.getElementById('open-create-mom-btn')?.addEventListener('click', openCreate);
            document.getElementById('empty-create-mom-btn')?.addEventListener('click', openCreate);

            container.querySelectorAll('.mom-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    selectedMomId = id;
                    currentMode = 'detail';
                    container.innerHTML = render();
                    bindEvents(container);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            });
        }

        // --- DETAIL MODE EVENTS ---
        if (currentMode === 'detail') {
            document.getElementById('back-to-list-btn')?.addEventListener('click', () => {
                currentMode = 'list';
                selectedMomId = null;
                container.innerHTML = render();
                bindEvents(container);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            const activeMom = allMoms.find(m => m.id === selectedMomId);

            document.getElementById('copy-mom-btn')?.addEventListener('click', () => {
                if (!activeMom) return;
                const temp = document.createElement('div');
                temp.innerHTML = activeMom.content || '';
                const plainText = temp.innerText || temp.textContent || '';
                const text = `📝 ${activeMom.title}\n📅 ${activeMom.meeting_date || ''} ${activeMom.meeting_time || ''}\n\n${plainText.trim()}`;
                navigator.clipboard.writeText(text).then(() => {
                    Toast.success('Meeting notes copied to clipboard!');
                }).catch(() => Toast.info('Could not copy automatically.'));
            });

            document.getElementById('edit-mom-btn')?.addEventListener('click', () => {
                if (!activeMom) return;
                currentMode = 'edit';
                editingMom = { ...activeMom };
                const parsed = parseAttendees(activeMom.attendees);
                selectedCoreIds = new Set(parsed.core_ids || []);
                container.innerHTML = render();
                bindEvents(container);
                initEditor(activeMom.content);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            document.getElementById('delete-mom-btn')?.addEventListener('click', async () => {
                if (!activeMom) return;
                if (!confirm(`Are you sure you want to permanently delete Minutes of Meeting for "${activeMom.title}"?`)) return;
                const { error } = await ICCSupabase.deleteMinutesOfMeeting(activeMom.id);
                if (error) {
                    Toast.error('Failed to delete MoM: ' + error.message);
                } else {
                    Toast.success('Minutes of Meeting deleted.');
                    allMoms = await ICCSupabase.fetchMinutesOfMeeting();
                    currentMode = 'list';
                    selectedMomId = null;
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        }

        // --- EDIT MODE EVENTS ---
        if (currentMode === 'edit') {
            const cancelEdit = () => {
                if (editingMom?.id) {
                    currentMode = 'detail';
                    selectedMomId = editingMom.id;
                } else {
                    currentMode = 'list';
                    selectedMomId = null;
                }
                editingMom = null;
                isSaving = false;
                container.innerHTML = render();
                bindEvents(container);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };

            document.getElementById('cancel-edit-btn')?.addEventListener('click', cancelEdit);
            document.getElementById('cancel-form-btn')?.addEventListener('click', cancelEdit);

            // Core Profile Chips toggle
            container.querySelectorAll('.core-profile-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const id = chip.dataset.id;
                    if (selectedCoreIds.has(id)) {
                        selectedCoreIds.delete(id);
                    } else {
                        selectedCoreIds.add(id);
                    }
                    container.querySelectorAll('.core-profile-chip').forEach(c => {
                        const cid = c.dataset.id;
                        const isSel = selectedCoreIds.has(cid);
                        c.className = `core-profile-chip flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all select-none ${isSel ? 'bg-red-500/15 border border-red-500/40 text-white' : 'bg-[#17212b] border border-transparent text-zinc-400 hover:bg-[#202c3b] hover:text-zinc-200'}`;
                        const badge = c.querySelector('div:last-child');
                        if (badge) {
                            badge.className = `w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${isSel ? 'bg-red-500 text-white text-[10px] font-bold' : 'border border-zinc-700 text-transparent'}`;
                        }
                    });
                });
            });

            document.getElementById('select-all-core-btn')?.addEventListener('click', () => {
                coreProfiles.forEach(p => selectedCoreIds.add(p.id));
                container.querySelectorAll('.core-profile-chip').forEach(c => {
                    c.className = 'core-profile-chip flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all select-none bg-red-500/15 border border-red-500/40 text-white';
                    const badge = c.querySelector('div:last-child');
                    if (badge) badge.className = 'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-red-500 text-white text-[10px] font-bold';
                });
            });

            document.getElementById('clear-all-core-btn')?.addEventListener('click', () => {
                selectedCoreIds.clear();
                container.querySelectorAll('.core-profile-chip').forEach(c => {
                    c.className = 'core-profile-chip flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all select-none bg-[#17212b] border border-transparent text-zinc-400 hover:bg-[#202c3b] hover:text-zinc-200';
                    const badge = c.querySelector('div:last-child');
                    if (badge) badge.className = 'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border border-zinc-700 text-transparent';
                });
            });

            container.querySelectorAll('.template-chip-btn').forEach(chip => {
                chip.addEventListener('click', () => applyTemplate(chip.dataset.type));
            });

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

                const attendeesPayload = JSON.stringify({
                    core_ids: Array.from(selectedCoreIds),
                    others: otherAttendees || ''
                });

                let res;
                if (editingMom?.id) {
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
                    Toast.success(editingMom?.id ? 'Minutes of Meeting updated!' : 'Minutes of Meeting saved!');
                    allMoms = await ICCSupabase.fetchMinutesOfMeeting();
                    const newId = editingMom?.id || res.data?.id;
                    currentMode = newId ? 'detail' : 'list';
                    selectedMomId = newId || null;
                    editingMom = null;
                    isSaving = false;
                    container.innerHTML = render();
                    bindEvents(container);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
