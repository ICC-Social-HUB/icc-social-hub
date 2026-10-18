/* ============================================
   ICC Social Hub — Chat View
   ============================================ */
const ChatView = (() => {
    let conversations = [];
    let currentPartnerId = null;

    function renderList() {
        return `
        <section class="min-h-screen pb-4 bg-[#0e1621]" id="chat-section">
            <div class="sticky top-0 z-20 bg-[#17212b]/95 backdrop-blur-md border-b border-[#101921] px-4 py-3.5 mb-2">
                <div class="max-w-lg mx-auto flex flex-col items-center gap-3">
                    <div class="flex items-center justify-between w-full">
                        <h1 class="font-heading font-semibold text-lg tracking-tight text-white">Chats</h1>
                    </div>
                    <div class="flex items-center gap-2.5 w-full">
                        <div id="search-bar-wrapper" class="flex-1 relative">
                            <input type="text" id="user-search-input" placeholder="Search messages or users..." class="form-input w-full pl-9 pr-4 py-2 bg-[#242f3d] border border-[#2b394a] rounded-xl text-sm text-white placeholder-[#708499] focus:border-[#3390ec] transition-all">
                            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-[#708499]">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                            </div>
                        </div>
                        <button id="new-chat-btn" class="w-9 h-9 bg-[#3390ec] hover:bg-[#2b7cce] text-white rounded-full transition-all shadow-sm flex items-center justify-center flex-shrink-0" title="New message">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                        </button>
                    </div>
                    <div id="user-search-results" class="w-full space-y-1 hidden absolute top-[calc(100%+8px)] bg-[#17212b] border border-[#242f3d] rounded-xl p-2 shadow-2xl max-h-80 overflow-y-auto z-30"></div>
                </div>
            </div>
            <div class="max-w-lg mx-auto px-2">
                <div id="conversations-list">
                    ${conversations.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-state-icon"><svg class="w-7 h-7 text-[#3390ec]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg></div>
                        <h3 class="font-heading font-semibold text-base mb-1 text-white">No chats yet</h3>
                        <p class="text-sm text-[#708499]">Search for a member to start messaging</p>
                    </div>` :
                    conversations.map(c => {
                        const p = c.partner || {};
                        const lastMsg = c.lastMessage;
                        const preview = lastMsg?.content?.slice(0, 40) + (lastMsg?.content?.length > 40 ? '...' : '') || '';
                        const time = lastMsg ? formatTimeAgo(lastMsg.created_at) : '';
                        return `
                        <div class="conversation-item flex items-center gap-3 px-3 py-3 mb-1 hover:bg-[#17212b] rounded-xl transition-all" data-partner-id="${c.partnerId}">
                            <div class="w-12 h-12 rounded-full bg-[#3390ec] flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden text-white shadow-sm">
                                ${p.avatar_url ? `<img src="${p.avatar_url}" class="w-full h-full object-cover">` : (p.full_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div class="flex-1 min-w-0 border-b border-[#101921]/60 pb-2">
                                <div class="flex items-center justify-between">
                                    <p class="font-semibold text-sm text-white truncate flex items-center">${p.username || p.full_name || 'User'}${ICC_CONFIG.getRoleTick(p)}</p>
                                    <span class="text-[11px] text-[#708499] flex-shrink-0">${time}</span>
                                </div>
                                <p class="text-xs text-[#708499] truncate mt-0.5">${preview}</p>
                            </div>
                            ${c.unreadCount > 0 ? `<div class="w-5 h-5 bg-[#3390ec] text-white rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">${c.unreadCount}</div>` : ''}
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </section>`;
    }

    async function mount(container, partnerId) {
        if (!ICCSupabase.getUser()) {
            container.innerHTML = `<div class="empty-state min-h-screen bg-[#0e1621]"><div class="empty-state-icon"><svg class="w-7 h-7 text-[#3390ec]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg></div><h3 class="font-heading font-semibold text-lg mb-1 text-white">Sign in to chat</h3><p class="text-sm text-[#708499] mb-4">Connect with other ICC members</p><button onclick="AuthModal.open()" class="px-6 py-2.5 bg-[#3390ec] hover:bg-[#2b7cce] text-white rounded-xl text-sm font-semibold transition-all">Sign In</button></div>`;
            return;
        }
        if (partnerId) {
            currentPartnerId = partnerId;
            container.innerHTML = '<div class="h-[calc(100dvh-5rem)] flex flex-col w-full max-w-lg mx-auto" id="chat-thread-container"></div>';
            await ChatPanel.mount(document.getElementById('chat-thread-container'), partnerId);
        } else {
            currentPartnerId = null;
            container.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="spinner"></div></div>';
            conversations = await ICCSupabase.fetchConversations();
            container.innerHTML = renderList();
            bindListEvents();
        }
    }

    function bindListEvents() {
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                window.location.hash = `#chat/${item.dataset.partnerId}`;
            });
        });

        document.getElementById('new-chat-btn')?.addEventListener('click', () => {
            document.getElementById('user-search-input')?.focus();
        });

        let searchTimeout;
        document.getElementById('user-search-input')?.addEventListener('input', e => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                const query = e.target.value.trim();
                const results = document.getElementById('user-search-results');
                if (!results) return;
                if (query.length < 1) { results.innerHTML = ''; results.classList.add('hidden'); return; }

                const users = await ICCSupabase.searchUsers(query);
                const myId = ICCSupabase.getUser()?.id;
                const filtered = users.filter(u => u.id !== myId);
                
                if (filtered.length === 0) {
                    results.innerHTML = '<p class="text-xs text-zinc-600 p-2">No users found</p>';
                    results.classList.remove('hidden');
                    return;
                }

                results.innerHTML = filtered.map(u => `
                    <div class="conversation-item flex items-center gap-3 px-3 py-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors" data-partner-id="${u.id}">
                        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden">
                            ${u.avatar_url ? `<img src="${u.avatar_url}" class="w-full h-full object-cover">` : (u.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold truncate flex items-center">${u.full_name || u.username || 'User'}${ICC_CONFIG.getRoleTick(u)}</p>
                            <p class="text-[11px] text-zinc-500 truncate">@${u.username || 'anon'}</p>
                        </div>
                    </div>
                `).join('');
                results.classList.remove('hidden');
                
                // Re-bind results
                results.querySelectorAll('.conversation-item').forEach(item => {
                    item.addEventListener('click', () => {
                        window.location.hash = `#chat/${item.dataset.partnerId}`;
                    });
                });
            }, 300);
        });
    }

    function unmount() {
        if (currentPartnerId) ChatPanel.unmount();
        currentPartnerId = null;
    }

    return { mount, unmount };
})();
