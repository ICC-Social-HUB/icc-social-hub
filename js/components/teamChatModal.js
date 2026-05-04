/* ============================================
   ICC Social Hub — Team Chat Modal (Refined)
   ============================================ */
const TeamChatModal = (() => {
    let currentTeamId = null;
    let messages = [];
    let subscriptionName = null;

    function render(team) {
        return `
        <div id="team-chat-modal" class="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div class="modal-content glass-card w-full max-w-lg h-[80vh] flex flex-col overflow-hidden animate-zoom-in">
                <!-- Header -->
                <div class="p-4 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br ${team.gradient} flex items-center justify-center text-xs font-bold text-white shadow-lg">
                            ${team.initials}
                        </div>
                        <div>
                            <h2 class="font-heading font-bold text-sm leading-tight">${team.team} Chat</h2>
                            <p class="text-[10px] text-zinc-500 font-medium">Team Only Room</p>
                        </div>
                    </div>
                    <button id="close-team-chat" class="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 cursor-pointer">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <!-- Messages Container -->
                <div id="team-chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-zinc-950/20">
                    <div class="flex items-center justify-center py-12" id="team-chat-loading-spinner">
                        <div class="spinner w-6 h-6"></div>
                    </div>
                </div>

                <!-- Input Area -->
                <form id="team-chat-form" class="p-4 bg-zinc-900/50 border-t border-zinc-800/50">
                    <div class="relative flex items-center gap-2">
                        <input type="text" id="team-chat-input" placeholder="Message team..." class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600/50 transition-all" autocomplete="off">
                        <button type="submit" id="team-chat-send-btn" class="w-12 h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </form>
            </div>
        </div>`;
    }

    async function open(teamId) {
        if (currentTeamId) return; // Prevent double open
        
        const team = CORE_LEADS.find(l => l.id === parseInt(teamId));
        if (!team) return;
        currentTeamId = teamId;

        // 1. Inject into Modal Root for better layer management
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot) {
            modalRoot.innerHTML = render(team);
        } else {
            document.body.insertAdjacentHTML('beforeend', render(team));
        }
        
        const container = document.getElementById('team-chat-messages');
        const form = document.getElementById('team-chat-form');
        const input = document.getElementById('team-chat-input');
        const closeBtn = document.getElementById('close-team-chat');

        // 2. IMMEDIATE EVENT BINDING (Fixes the "Won't close" issue)
        closeBtn.onclick = close;
        
        const handleSend = async (e) => {
            if (e) e.preventDefault();
            const content = input.value.trim();
            if (!content || form.dataset.loading === 'true') return;
            
            form.dataset.loading = 'true';
            const sendBtn = document.getElementById('team-chat-send-btn');
            const originalIcon = sendBtn.innerHTML;
            sendBtn.innerHTML = '<div class="spinner w-4 h-4 border-white/30 border-t-white"></div>';
            sendBtn.disabled = true;
            
            try {
                const { error } = await ICCSupabase.sendTeamMessage(teamId, content);
                if (error) {
                    Toast.error("Couldn't send: " + (error.message || "Permission Denied"));
                } else {
                    input.value = '';
                }
            } catch (err) {
                Toast.error("System Error: Could not reach chat server.");
            } finally {
                form.dataset.loading = 'false';
                sendBtn.innerHTML = originalIcon;
                sendBtn.disabled = false;
                input.focus();
            }
        };

        form.onsubmit = handleSend;

        // 3. LOAD DATA
        try {
            messages = await ICCSupabase.fetchTeamMessages(teamId);
            renderMessages(container);
            
            // Subscribe for live updates
            subscriptionName = ICCSupabase.subscribeToTeamChat(teamId, (newMsg) => {
                if (currentTeamId === teamId) {
                    messages.push(newMsg);
                    renderMessages(container);
                }
            });
        } catch (err) {
            console.error('Chat load error:', err);
            renderMessages(container); // Fallback to empty state
        }

        input.focus();
    }

    function renderMessages(container) {
        if (!container) return;
        const myId = ICCSupabase.getUser()?.id;

        // Remove loading spinner
        const spinner = document.getElementById('team-chat-loading-spinner');
        if (spinner) spinner.remove();

        if (!messages || messages.length === 0) {
            container.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-center">
                <div class="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-3">
                    <svg class="w-6 h-6 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/></svg>
                </div>
                <p class="text-zinc-500 text-sm">No messages yet. Start the conversation!</p>
            </div>`;
            return;
        }

        container.innerHTML = messages.map(m => {
            const isMe = m.sender_id === myId;
            const p = m.profiles || {};
            // Better role detection: check if they are an admin or lead
            const userRole = p.role || 'user';
            const isVerified = userRole === 'lead' || userRole === 'admin';
            const canDelete = isMe || ICCSupabase.isAdmin();
            
            let timeStr = '';
            try { 
                timeStr = typeof formatTimeAgo === 'function' ? formatTimeAgo(m.created_at) : ''; 
            } catch(e) { timeStr = ''; }

            return `
            <div class="flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up group">
                <div class="flex max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-2">
                    <div class="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden mt-1 border border-zinc-700 shadow-sm">
                        ${p.avatar_url ? `<img src="${p.avatar_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-400">${(p.full_name || p.username || '?').charAt(0).toUpperCase()}</div>`}
                    </div>
                    <div class="min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                        <p class="text-[10px] text-zinc-500 mb-1 flex items-center gap-1 font-semibold">
                            ${p.full_name || p.username || 'Anonymous User'}
                            ${isVerified ? `<span class="text-emerald-400" title="Verified Member">${ICC_CONFIG.VERIFIED_TICK}</span>` : ''}
                        </p>
                        <div class="relative flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}">
                            <div class="px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-emerald-600 text-white rounded-tr-none shadow-lg shadow-emerald-600/10' : 'bg-zinc-800 text-zinc-200 rounded-tl-none'} break-words">
                                ${m.content}
                            </div>
                            ${canDelete ? `
                            <button class="delete-team-msg opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-500 transition-all rounded-lg hover:bg-zinc-800/30 cursor-pointer" data-msg-id="${m.id}" title="Delete message">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>` : ''}
                        </div>
                        <p class="text-[8px] text-zinc-600 mt-1">${timeStr}</p>
                    </div>
                </div>
            </div>`;
        }).join('');
        
        // Bind delete events
        container.querySelectorAll('.delete-team-msg').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                if (!confirm('Delete this message?')) return;
                const msgId = btn.dataset.msgId;
                const { error } = await ICCSupabase.deleteTeamMessage(msgId);
                if (error) {
                    Toast.error("Failed to delete: " + error.message);
                } else {
                    // Local remove
                    messages = messages.filter(m => m.id !== msgId);
                    renderMessages(container);
                }
            };
        });

        container.scrollTop = container.scrollHeight;
    }

    function close() {
        const modal = document.getElementById('team-chat-modal');
        if (modal) {
            modal.classList.add('fade-out');
            setTimeout(() => {
                modal.remove();
                // Clean up root if used
                const root = document.getElementById('modal-root');
                if (root && root.contains(modal)) root.innerHTML = '';
                
                if (subscriptionName) {
                    ICCSupabase.unsubscribeChannel(subscriptionName);
                }
                subscriptionName = null;
                currentTeamId = null;
                messages = [];
            }, 300);
        }
    }

    return { open };
})();
