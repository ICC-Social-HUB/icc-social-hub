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

        return `
        <article class="post-card mb-4" data-post-id="${post.id}">
            <div class="flex items-center gap-3 p-4 pb-2">
                <button class="user-link w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden" data-user-id="${p.id || post.user_id}">
                    ${p.avatar_url ? `<img src="${p.avatar_url}" class="w-full h-full object-cover" alt="">` : (p.full_name || 'U').charAt(0).toUpperCase()}
                </button>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <button class="user-link font-semibold text-sm hover:text-red-400 transition-colors truncate" data-user-id="${p.id || post.user_id}">${p.username || p.full_name || 'Anonymous'}</button>
                        ${(p.role === 'lead' || p.role === 'admin') ? `<span class="px-1.5 py-0.5 bg-red-600/15 text-red-400 rounded text-[10px] font-bold uppercase">${p.role}</span>` : ''}
                        ${isAnnounce ? '<span class="announcement-badge">Official</span>' : ''}
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[11px] text-zinc-500">${timeAgo}</span>
                        ${teamLead ? `<a href="#teams/${post.team_tag}" class="text-[11px] text-zinc-500 hover:text-red-400 transition-colors">• ${teamLead.team}</a>` : ''}
                    </div>
                </div>
            </div>

            ${post.image_url ? `<div class="post-image-container"><img src="${post.image_url}" alt="Post image" loading="lazy" onerror="this.parentElement.style.display='none'"></div>` : ''}

            <div class="px-4 pt-3 pb-2">
                ${post.caption ? `<p class="text-sm text-zinc-200 leading-relaxed mb-3 whitespace-pre-wrap">${escapeHtml(post.caption)}</p>` : ''}
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
                btn.classList.toggle('liked');
                const svg = btn.querySelector('svg');
                svg.setAttribute('fill', wasLiked ? 'none' : 'currentColor');
                btn.classList.toggle('text-red-500'); btn.classList.toggle('text-zinc-500');
                countEl.textContent = parseInt(countEl.textContent) + (wasLiked ? -1 : 1);
                if (!wasLiked) btn.classList.add('animate-heart-burst');
                await ICCSupabase.toggleLike(postId);
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

        section.innerHTML = `
        <div class="p-4 space-y-3 max-h-64 overflow-y-auto">
            ${comments.length === 0 ? '<p class="text-xs text-zinc-600 text-center">No comments yet</p>' :
            comments.map(c => {
                const cp = c.profiles || {};
                return `<div class="flex gap-2">
                    <div class="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">${(cp.full_name||'?').charAt(0).toUpperCase()}</div>
                    <div class="flex-1 min-w-0">
                        <span class="text-xs font-semibold text-zinc-300">${cp.username||cp.full_name||'Anon'}</span>
                        <p class="text-xs text-zinc-400 mt-0.5">${escapeHtml(c.content)}</p>
                    </div>
                </div>`;
            }).join('')}
        </div>
        ${user ? `<form class="comment-form flex gap-2 p-3 border-t border-zinc-800/50" data-post-id="${postId}">
            <input type="text" placeholder="Add a comment..." class="form-input flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600" required>
            <button type="submit" class="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold transition-colors">Post</button>
        </form>` : ''}`;

        // Comment submit
        section.querySelector('.comment-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const input = e.target.querySelector('input');
            const content = input.value.trim();
            if (!content) return;
            input.value = '';
            const { error } = await ICCSupabase.addComment(postId, content);
            if (error) Toast.error('Failed to comment');
            else await loadComments(postId, section);
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
