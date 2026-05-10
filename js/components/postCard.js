/* ============================================
   ICC Social Hub — Post Card Component
   ============================================ */
const PostCard = (() => {
    function render(post, userLikes = new Set()) {
        const p = post.profiles || {};
        const liked = userLikes.has(post.id);
        const teamLead = post.team_tag ? getLeadByTeamId(post.team_tag) : null;
        const timeAgo = formatTimeAgo(post.created_at);
        const isAnnounce = post.is_announcement;
        const currentUser = ICCSupabase.getUser();
        const canDelete = currentUser && (currentUser.id === post.user_id || ICCSupabase.isAdmin());
        const isRequest = post.is_request;
        const isResolved = post.status === 'resolved';
        const isAuthor = currentUser && currentUser.id === post.user_id;

        return `
        <article class="post-card mb-4 relative group ${isRequest ? 'request-card' : ''} ${isResolved ? 'resolved-dim' : ''}" data-post-id="${post.id}" data-owner-id="${post.user_id}">
            ${canDelete ? `
            <button class="delete-post-btn absolute top-3 right-3 p-2 text-zinc-600 hover:text-red-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-zinc-800/50 z-10" data-post-id="${post.id}" title="Delete post">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>` : ''}
            <div class="flex items-center gap-3 p-4 pb-2">
                <button class="user-link w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden ${p.avatar_url ? 'cursor-pointer' : ''}" data-user-id="${p.id || post.user_id}">
                    ${p.avatar_url ? `<img src="${p.avatar_url}" class="w-full h-full object-cover" alt="" data-full-image="${p.avatar_url}">` : (p.full_name || 'U').charAt(0).toUpperCase()}
                </button>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <button class="user-link font-semibold text-sm hover:text-red-400 transition-colors truncate" data-user-id="${p.id || post.user_id}">${p.username || p.full_name || 'Anonymous'}${(p.role === 'lead' || p.role === 'admin') ? ICC_CONFIG.VERIFIED_TICK : ''}</button>
                        ${(p.role === 'lead' || p.role === 'admin') ? `<span class="px-1.5 py-0.5 bg-red-600/15 text-red-400 rounded text-[10px] font-bold uppercase">${p.role}</span>` : ''}
                        ${isAnnounce ? '<span class="announcement-badge">Official</span>' : ''}
                        ${isRequest ? (isResolved ? '<span class="px-2 py-0.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[9px] font-black uppercase tracking-tighter animate-pulse">Resolved</span>' : '<span class="px-2 py-0.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-full text-[9px] font-black uppercase tracking-tighter">Request</span>') : ''}
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[11px] text-zinc-500">${timeAgo}</span>
                        ${teamLead ? `<a href="#teams/${post.team_tag}" class="text-[11px] text-zinc-500 hover:text-red-400 transition-colors">• ${teamLead.team}</a>` : ''}
                        ${isRequest ? `<span class="text-[10px] font-bold text-amber-500/80">• ${post.request_type}</span>` : ''}
                    </div>
                </div>
            </div>

            ${post.image_url ? `<div class="post-image-container"><img src="${post.image_url}" alt="Post image" loading="lazy" onerror="this.parentElement.style.display='none'"></div>` : ''}

            <div class="px-4 pt-3 pb-2">
                ${post.caption ? `<p class="text-sm text-zinc-200 leading-relaxed mb-3 whitespace-pre-wrap">${escapeHtml(post.caption)}</p>` : ''}
                
                ${isRequest && !isAuthor && !isResolved ? `
                <div class="mb-4 p-3 bg-amber-600/5 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3">
                    <p class="text-[11px] text-amber-500/80 font-medium">Can you help with this ${post.request_type.toLowerCase()}?</p>
                    <button class="message-requester-btn px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-lg shadow-amber-600/20" data-user-id="${post.user_id}">Message</button>
                </div>
                ` : ''}

                ${isRequest && isAuthor && !isResolved ? `
                <button class="resolve-request-btn w-full mb-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-2" data-post-id="${post.id}">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    Mark as Resolved
                </button>
                ` : ''}

                <div class="flex items-center gap-4">
                    <button class="like-btn flex items-center gap-1.5 text-sm transition-colors ${liked ? 'liked text-red-500' : 'text-zinc-500 hover:text-red-400'}" data-post-id="${post.id}">
                        <svg class="w-5 h-5" fill="${liked ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                        <span class="like-count">${post.likes_count || 0}</span>
                    </button>
                    <button class="comment-toggle flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors" data-post-id="${post.id}">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>
                        Comment
                    </button>
                </div>
            </div>
            <div class="comments-section hidden border-t border-zinc-800/50" data-comments-for="${post.id}"></div>
        </article>`;
    }

    function bindEvents(container) {
        // Likes
        container.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!ICCSupabase.getUser()) { AuthModal.open(); return; }
                const postId = btn.dataset.postId;
                const countEl = btn.querySelector('.like-count');
                const wasLiked = btn.classList.contains('liked');
                
                // Optimistic update
                const toggleUI = (isLiked) => {
                    btn.classList.toggle('liked', isLiked);
                    const svg = btn.querySelector('svg');
                    svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
                    btn.classList.toggle('text-red-500', isLiked);
                    btn.classList.toggle('text-zinc-500', !isLiked);
                    countEl.textContent = parseInt(countEl.textContent) + (isLiked ? (wasLiked ? 0 : 1) : (wasLiked ? -1 : 0));
                    // Note: the logic above for count is slightly flawed if we just toggle. 
                    // Let's do it cleaner:
                };

                const currentCount = parseInt(countEl.textContent);
                btn.classList.toggle('liked');
                const isNowLiked = btn.classList.contains('liked');
                const svg = btn.querySelector('svg');
                svg.setAttribute('fill', isNowLiked ? 'currentColor' : 'none');
                btn.classList.toggle('text-red-500', isNowLiked);
                btn.classList.toggle('text-zinc-500', !isNowLiked);
                countEl.textContent = isNowLiked ? currentCount + 1 : currentCount - 1;

                if (isNowLiked) btn.classList.add('animate-heart-burst');
                else btn.classList.remove('animate-heart-burst');

                const { error } = await ICCSupabase.toggleLike(postId);
                
                if (error) {
                    // Rollback
                    btn.classList.toggle('liked');
                    const revertedLiked = btn.classList.contains('liked');
                    svg.setAttribute('fill', revertedLiked ? 'currentColor' : 'none');
                    btn.classList.toggle('text-red-500', revertedLiked);
                    btn.classList.toggle('text-zinc-500', !revertedLiked);
                    countEl.textContent = currentCount;
                    Toast.error('Failed to update like');
                } else if (isNowLiked) {
                    // Create notification for the post owner (only on like, not unlike)
                    const postCard = btn.closest('.post-card');
                    const postOwnerId = postCard?.dataset?.ownerId;
                    if (postOwnerId && postOwnerId !== ICCSupabase.getUser().id) {
                        ICCSupabase.createNotification({
                            userId: postOwnerId,
                            type: 'like',
                            actorId: ICCSupabase.getUser().id,
                            referenceId: postId
                        });
                    }
                }
            });
        });

        // Resolve request
        container.querySelectorAll('.resolve-request-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const postId = btn.dataset.postId;
                const card = btn.closest('.post-card');
                
                btn.disabled = true;
                btn.innerHTML = '<div class="spinner spinner-sm"></div>';

                const { error } = await ICCSupabase.updatePostStatus(postId, 'resolved');
                if (error) {
                    Toast.error('Failed to resolve: ' + error.message);
                    btn.disabled = false;
                    btn.innerHTML = 'Mark as Resolved';
                } else {
                    Toast.success('Request resolved! ✨');
                    // We need to re-render the feed or just this card. 
                    // For simplicity, let's trigger a hashchange to refresh.
                    window.dispatchEvent(new Event('hashchange'));
                }
            });
        });

        // Message requester
        container.querySelectorAll('.message-requester-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.userId;
                if (userId) {
                    window.location.hash = `#chat/${userId}`;
                }
            });
        });

        // Comments toggle
        container.querySelectorAll('.comment-toggle').forEach(btn => {
            btn.addEventListener('click', async () => {
                const postId = btn.dataset.postId;
                const section = container.querySelector(`[data-comments-for="${postId}"]`);
                if (!section) return;
                if (section.classList.contains('hidden')) {
                    section.classList.remove('hidden');
                    await loadComments(postId, section);
                } else {
                    section.classList.add('hidden');
                }
            });
        });

        // Delete post
        container.querySelectorAll('.delete-post-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to delete this post?')) return;
                const postId = btn.dataset.postId;
                const card = btn.closest('.post-card');
                if (card) { card.style.opacity = '0.5'; card.style.pointerEvents = 'none'; }
                
                const { error } = await ICCSupabase.deletePost(postId);
                if (error) {
                    Toast.error('Failed to delete post: ' + error.message);
                    if (card) { card.style.opacity = '1'; card.style.pointerEvents = 'auto'; }
                } else {
                    Toast.success('Post deleted');
                    if (card) card.remove();
                }
            });
        });

        // User links
        container.querySelectorAll('.user-link').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.userId;
                if (userId) UserProfileModal.open(userId);
            });
        });
    }

    async function loadComments(postId, section) {
        section.innerHTML = '<div class="p-4 flex justify-center"><div class="spinner spinner-sm"></div></div>';
        const comments = await ICCSupabase.fetchComments(postId);
        const user = ICCSupabase.getUser();

        const postCard = section.closest('.post-card');
        const postOwnerId = postCard?.dataset?.ownerId;
        const isResolved = postCard?.classList.contains('resolved-dim');

        section.innerHTML = `
        <div class="p-4 space-y-3 max-h-64 overflow-y-auto">
            ${comments.length === 0 ? '<p class="text-xs text-zinc-600 text-center">No comments yet</p>' :
            comments.map(c => {
                const cp = c.profiles || {};
                const canDelete = user && (user.id === c.user_id || ICCSupabase.isAdmin() || user.id === postOwnerId);
                return `<div class="flex gap-2 group relative">
                    <div class="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">${(cp.full_name||'?').charAt(0).toUpperCase()}</div>
                    <div class="flex-1 min-w-0 pr-6">
                        <span class="text-xs font-semibold text-zinc-300">${cp.username||cp.full_name||'Anon'}${(cp.role === 'lead' || cp.role === 'admin') ? ICC_CONFIG.VERIFIED_TICK : ''}</span>
                        <p class="text-xs text-zinc-400 mt-0.5">${escapeHtml(c.content)}</p>
                    </div>
                    ${canDelete ? `<button class="delete-comment-btn absolute right-0 top-0 p-1.5 text-zinc-600 hover:text-red-500 transition-all rounded-lg hover:bg-zinc-800/50" data-comment-id="${c.id}" title="Delete comment">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>` : ''}
                </div>`;
            }).join('')}
        </div>
        ${user && !isResolved ? `<form class="comment-form flex gap-2 p-3 border-t border-zinc-800/50" data-post-id="${postId}">
            <input type="text" placeholder="Add a comment..." class="form-input flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600" required>
            <button type="submit" class="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold transition-colors">Post</button>
        </form>` : (isResolved ? '<p class="text-[10px] text-zinc-600 text-center py-2 italic">Comments are locked for this resolved request.</p>' : '')}`;

        // Comment submit
        section.querySelector('.comment-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const input = e.target.querySelector('input');
            const content = input.value.trim();
            if (!content) return;
            input.value = '';
            const { error } = await ICCSupabase.addComment(postId, content);
            if (error) Toast.error('Failed to comment');
            else {
                await loadComments(postId, section);
                // Create notification for post owner
                const postCard = section.closest('.post-card');
                const postOwnerLink = postCard?.querySelector('.user-link');
                const postOwnerId = postOwnerLink?.dataset?.userId;
                if (postOwnerId) {
                    ICCSupabase.createNotification({
                        userId: postOwnerId,
                        type: 'comment',
                        actorId: ICCSupabase.getUser().id,
                        referenceId: postId,
                        body: content
                    });
                }
            }
        });

        // Delete comment
        section.querySelectorAll('.delete-comment-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const commentId = btn.dataset.commentId;
                const commentEl = btn.closest('.flex');
                
                if (confirm('Delete this comment?')) {
                    if (commentEl) commentEl.style.opacity = '0.3';
                    const { error } = await ICCSupabase.deleteComment(commentId);
                    if (error) { 
                        console.error('Delete comment error:', error);
                        Toast.error('Failed to delete comment: ' + (error.message || 'Unknown error')); 
                        if (commentEl) commentEl.style.opacity = '1';
                    } else {
                        Toast.success('Comment deleted');
                        if (commentEl) commentEl.remove();
                        // Re-load to sync count/state
                        await loadComments(postId, section);
                    }
                }
            });
        });
    }

    return { render, bindEvents };
})();

function formatTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return date.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
