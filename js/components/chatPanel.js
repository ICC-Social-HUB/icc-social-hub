/* ============================================
   ICC Social Hub — Chat Panel Component
   ============================================ */
const ChatPanel = (() => {
    let currentPartnerId = null;
    let messages = [];
    let partnerProfile = null;

    function render() {
        if (!partnerProfile) return '';
        const userId = ICCSupabase.getUser()?.id;
        return `
        <div class="flex flex-col h-full">
            <div class="flex items-center gap-3 p-4 border-b border-zinc-800/50 bg-zinc-900/80 backdrop-blur-sm">
                <button id="chat-back-btn" class="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors md:hidden">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <button class="user-link w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden ${partnerProfile.avatar_url ? 'cursor-pointer' : ''}" data-user-id="${partnerProfile.id}">
                    ${partnerProfile.avatar_url ? `<img src="${partnerProfile.avatar_url}" class="w-full h-full object-cover" data-full-image="${partnerProfile.avatar_url}">` : (partnerProfile.full_name || '?').charAt(0).toUpperCase()}
                </button>
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-sm truncate">${partnerProfile.username || partnerProfile.full_name || 'User'}</p>
                    <p class="text-[11px] text-zinc-500">${partnerProfile.team_id ? getTeamName(partnerProfile.team_id) : 'ICC Member'}</p>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-2" id="chat-messages">
                ${messages.length === 0 ? '<div class="empty-state"><p class="text-sm text-zinc-600">Start the conversation! 💬</p></div>' :
                messages.map(m => {
                    const isSent = m.sender_id === userId;
                    const time = new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                    return `<div class="flex ${isSent ? 'justify-end' : 'justify-start'} group" id="msg-${m.id || m.temp_id}">
                        ${isSent ? `<button type="button" class="delete-msg-btn opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-500 transition-all mr-2 self-center" data-msg-id="${m.id || m.temp_id}" title="Delete Message">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>` : ''}
                        <div class="chat-bubble ${isSent ? 'chat-bubble-sent' : 'chat-bubble-received'}">
                            <p>${escapeHtml(m.content)}</p>
                            <p class="text-[10px] ${isSent ? 'text-white/50' : 'text-zinc-500'} mt-1 text-right">${time}</p>
                        </div>
                    </div>`;
                }).join('')}
            </div>
            <form class="chat-input-bar p-3 flex gap-2" id="chat-send-form">
                <input type="text" id="chat-input" placeholder="Type a message..." class="form-input flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600" autocomplete="off">
                <button type="submit" class="w-10 h-10 bg-red-600 hover:bg-red-500 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>
                </button>
            </form>
        </div>`;
    }

    async function mount(container, partnerId) {
        currentPartnerId = partnerId;
        container.innerHTML = '<div class="flex items-center justify-center h-full"><div class="spinner"></div></div>';
        partnerProfile = await ICCSupabase.fetchUserById(partnerId);
        messages = await ICCSupabase.fetchMessages(partnerId);
        await ICCSupabase.markAsRead(partnerId);
        container.innerHTML = render();
        scrollToBottom();
        bindEvents(container);
        // Realtime
        ICCSupabase.subscribeToConversation(partnerId, msg => {
            if (!messages.find(m => m.id === msg.id)) {
                messages.push(msg);
                appendMessage(msg);
                ICCSupabase.markAsRead(partnerId);
            }
        }, deletedMsgId => {
            removeMessage(deletedMsgId);
        });
    }

    function removeMessage(id) {
        messages = messages.filter(m => m.id !== id && m.temp_id !== id);
        const el = document.getElementById(`msg-${id}`);
        if (el) el.remove();
        // If empty, show empty state
        if (messages.length === 0) {
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages && !chatMessages.querySelector('.empty-state')) {
                chatMessages.innerHTML = '<div class="empty-state"><p class="text-sm text-zinc-600">Start the conversation! 💬</p></div>';
            }
        }
    }

    function bindEvents(container) {
        document.getElementById('chat-send-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const content = input.value.trim();
            if (!content) return;
            input.value = '';
            // Optimistic
            const temp_id = 'temp_' + Date.now();
            const tempMsg = { temp_id, sender_id: ICCSupabase.getUser().id, content, created_at: new Date().toISOString() };
            messages.push(tempMsg);
            appendMessage(tempMsg);
            const { data, error } = await ICCSupabase.sendMessage(currentPartnerId, content);
            if (error) {
                Toast.error('Failed to send');
                removeMessage(temp_id);
            } else {
                const idx = messages.findIndex(m => m.temp_id === temp_id);
                if (idx > -1) messages[idx] = data;
                const msgEl = document.getElementById(`msg-${temp_id}`);
                if (msgEl) {
                    msgEl.id = `msg-${data.id}`;
                    const btn = msgEl.querySelector('.delete-msg-btn');
                    if (btn) btn.dataset.msgId = data.id;
                }
                // Notification is now handled by ICCSupabase.sendMessage internally
            }
        });
        document.getElementById('chat-messages')?.addEventListener('click', async e => {
            const delBtn = e.target.closest('.delete-msg-btn');
            if (delBtn) {
                const msgId = delBtn.dataset.msgId;
                if (msgId && msgId.startsWith('temp_')) return;
                if (confirm('Delete this message?')) {
                    const el = document.getElementById(`msg-${msgId}`);
                    if (el) el.style.opacity = '0.5';
                    const { error } = await ICCSupabase.deleteMessage(msgId);
                    if (error) {
                        if (window.Toast) Toast.error('Failed to delete message');
                        if (el) el.style.opacity = '1';
                    } else {
                        removeMessage(msgId);
                    }
                }
            }
        });
        document.getElementById('chat-back-btn')?.addEventListener('click', () => {
            window.location.hash = '#chat';
        });
        container.querySelectorAll('.user-link').forEach(btn => {
            btn.addEventListener('click', () => UserProfileModal.open(btn.dataset.userId));
        });
    }

    function appendMessage(msg) {
        const el = document.getElementById('chat-messages');
        if (!el) return;
        const isSent = msg.sender_id === ICCSupabase.getUser()?.id;
        const time = new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const empty = el.querySelector('.empty-state');
        if (empty) empty.remove();
        const div = document.createElement('div');
        div.className = `flex ${isSent ? 'justify-end' : 'justify-start'} group`;
        div.id = `msg-${msg.id || msg.temp_id}`;
        div.innerHTML = `
            ${isSent ? `<button type="button" class="delete-msg-btn opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-500 transition-all mr-2 self-center" data-msg-id="${msg.id || msg.temp_id}" title="Delete Message">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>` : ''}
            <div class="chat-bubble ${isSent ? 'chat-bubble-sent' : 'chat-bubble-received'}"><p>${escapeHtml(msg.content)}</p><p class="text-[10px] ${isSent ? 'text-white/50' : 'text-zinc-500'} mt-1 text-right">${time}</p></div>`;
        el.appendChild(div);
        scrollToBottom();
    }

    function scrollToBottom() {
        const el = document.getElementById('chat-messages');
        if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
    }

    function unmount() {
        if (currentPartnerId) {
            ICCSupabase.unsubscribeChannel(`dm-${[ICCSupabase.getUser()?.id, currentPartnerId].sort().join('-')}`);
        }
        currentPartnerId = null; messages = []; partnerProfile = null;
    }

    return { mount, unmount, render };
})();
