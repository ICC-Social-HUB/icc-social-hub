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
                <button class="user-link w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden" data-user-id="${partnerProfile.id}">
                    ${partnerProfile.avatar_url ? `<img src="${partnerProfile.avatar_url}" class="w-full h-full object-cover">` : (partnerProfile.full_name || '?').charAt(0).toUpperCase()}
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
                    return `<div class="flex ${isSent ? 'justify-end' : 'justify-start'}">
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
            messages.push(msg);
            appendMessage(msg);
            ICCSupabase.markAsRead(partnerId);
        });
    }

    function bindEvents(container) {
        document.getElementById('chat-send-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const content = input.value.trim();
            if (!content) return;
            input.value = '';
            // Optimistic
            const tempMsg = { sender_id: ICCSupabase.getUser().id, content, created_at: new Date().toISOString() };
            messages.push(tempMsg);
            appendMessage(tempMsg);
            const { error } = await ICCSupabase.sendMessage(currentPartnerId, content);
            if (error) Toast.error('Failed to send');
            else {
                // Notify the recipient
                ICCSupabase.createNotification({
                    userId: currentPartnerId,
                    type: 'message',
                    actorId: ICCSupabase.getUser().id,
                    body: content
                });
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
        div.className = `flex ${isSent ? 'justify-end' : 'justify-start'}`;
        div.innerHTML = `<div class="chat-bubble ${isSent ? 'chat-bubble-sent' : 'chat-bubble-received'}"><p>${escapeHtml(msg.content)}</p><p class="text-[10px] ${isSent ? 'text-white/50' : 'text-zinc-500'} mt-1 text-right">${time}</p></div>`;
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
