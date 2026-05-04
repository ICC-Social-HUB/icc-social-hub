/* ============================================
   ICC Social Hub — Team Chat Modal
   ============================================ */
const TeamChatModal = (() => {
    let currentTeamId = null;
    let messages = [];
    let subscription = null;

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
                    <button id="close-team-chat" class="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <!-- Messages -->
                <div id="team-chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    <div class="flex items-center justify-center py-8">
                        <div class="spinner w-6 h-6"></div>
                    </div>
                </div>

                <!-- Input -->
                <form id="team-chat-form" class="p-4 bg-zinc-900/50 border-t border-zinc-800/50">
                    <div class="relative flex items-center gap-2">
                        <input type="text" id="team-chat-input" placeholder="Message team members..." class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-600/50 transition-all" autocomplete="off">
                        <button type="submit" class="w-12 h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20 transition-all active:scale-95">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                </form>
            </div>
        </div>`;
    }

    async function open(teamId) {
        const team = CORE_LEADS.find(l => l.id === teamId);
        if (!team) return;
        currentTeamId = teamId;

        document.body.insertAdjacentHTML('beforeend', render(team));
        
        const container = document.getElementById('team-chat-messages');
        const form = document.getElementById('team-chat-form');
        const input = document.getElementById('team-chat-input');

        // Fetch initial messages with error fallback
        try {
            messages = await ICCSupabase.fetchTeamMessages(teamId);
        } catch (err) {
            console.error('Failed to load team messages:', err);
            messages = [];
        }
        renderMessages(container);

        // Subscribe to real-time
        subscription = ICCSupabase.subscribeToTeamChat(teamId, (newMsg) => {
            messages.push(newMsg);
            renderMessages(container);
        });

        // Close logic
        document.getElementById('close-team-chat').onclick = close;
        document.getElementById('team-chat-modal').onclick = (e) => {
            if (e.target.id === 'team-chat-modal') close();
        };

        // Send logic
        form.onsubmit = async (e) => {
            e.preventDefault();
            const content = input.value.trim();
            if (!content) return;
            input.value = '';
            
            const { error } = await ICCSupabase.sendTeamMessage(teamId, content);
            if (error) Toast.error("Couldn't send message: " + error.message);
        };

        input.focus();
    }

    function renderMessages(container) {
        if (!container) return;
        const myId = ICCSupabase.getUser()?.id;

        if (messages.length === 0) {
            container.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-center">
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
            return `
            <div class="flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up">
                <div class="flex max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-2">
                    ${!isMe ? `
                    <div class="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden mt-1 border border-zinc-700">
                        ${p.avatar_url ? `<img src="${p.avatar_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-[10px] font-bold text-zinc-500">${(p.full_name || '?').charAt(0).toUpperCase()}</div>`}
                    </div>` : ''}
                    <div>
                        ${!isMe ? `<p class="text-[10px] text-zinc-500 mb-1 ml-1 font-medium">${p.full_name || p.username || 'Anonymous'}</p>` : ''}
                        <div class="px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-emerald-600 text-white rounded-tr-none shadow-lg shadow-emerald-600/10' : 'bg-zinc-800 text-zinc-200 rounded-tl-none'}">
                            ${m.content}
                        </div>
                        <p class="text-[8px] text-zinc-600 mt-1 ${isMe ? 'text-right mr-1' : 'ml-1'}">${formatTimeAgo(m.created_at)}</p>
                    </div>
                </div>
            </div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
    }

    function close() {
        const modal = document.getElementById('team-chat-modal');
        if (modal) {
            modal.classList.add('fade-out');
            setTimeout(() => {
                modal.remove();
                if (subscription) ICCSupabase.unsubscribeChannel(subscription);
                subscription = null;
                currentTeamId = null;
                messages = [];
            }, 300);
        }
    }

    return { open };
})();
