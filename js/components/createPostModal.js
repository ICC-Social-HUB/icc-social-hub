/* ============================================
   ICC Social Hub — Create Post Modal
   ============================================ */
const CreatePostModal = (() => {
    let isOpen = false;
    let loading = false;
    let imagePreview = '';

    function open() { isOpen = true; loading = false; imagePreview = ''; mount(); document.body.style.overflow = 'hidden'; }
    function close() { isOpen = false; mount(); document.body.style.overflow = ''; }

    function render() {
        if (!isOpen) return '';
        const profile = ICCSupabase.getProfile();
        return `
        <div class="modal-backdrop fixed inset-0 z-[100] flex items-end sm:items-center justify-center" id="create-post-overlay">
            <div class="modal-content bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between p-4 border-b border-zinc-800">
                    <button id="create-post-close" class="text-sm text-zinc-500 hover:text-white transition-colors">Cancel</button>
                    <h3 class="font-heading font-bold text-sm">New Post</h3>
                    <button id="create-post-submit" class="px-4 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold transition-all disabled:opacity-50" ${loading ? 'disabled' : ''}>
                        ${loading ? '<div class="spinner spinner-sm"></div>' : 'Post'}
                    </button>
                </div>
                <div class="p-4">
                    <div class="flex gap-3 mb-4">
                        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                            ${profile?.avatar_url ? `<img src="${profile.avatar_url}" class="w-full h-full object-cover">` : (profile?.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1">
                            <p class="text-sm font-semibold">${profile?.username || profile?.full_name || 'You'}</p>
                            <p class="text-[11px] text-zinc-500">Posting to ICC</p>
                        </div>
                    </div>
                    <textarea id="post-caption" rows="4" placeholder="Share your idea, project, or thought..." class="w-full bg-transparent text-sm text-white placeholder-zinc-600 resize-none focus:outline-none mb-4" maxlength="1000"></textarea>
                    <div class="space-y-3">
                        <div>
                            <label class="block text-xs font-medium text-zinc-400 mb-1.5">Image URL <span class="text-zinc-600">(optional)</span></label>
                            <input type="url" id="post-image-url" placeholder="https://example.com/image.jpg" class="form-input w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs placeholder-zinc-600">
                        </div>
                        ${imagePreview ? `<div class="rounded-xl overflow-hidden border border-zinc-800"><img src="${imagePreview}" class="w-full max-h-48 object-cover" onerror="this.parentElement.style.display='none'"></div>` : ''}
                        <div>
                            <label class="block text-xs font-medium text-zinc-400 mb-1.5">Team Tag <span class="text-zinc-600">(optional)</span></label>
                            <select id="post-team-tag" class="form-input w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs">
                                <option value="">No team tag</option>
                                ${CORE_LEADS.map(l => `<option value="${l.id}" ${profile?.team_id === l.id ? 'selected' : ''}>${l.team}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function mount() {
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML += render();
        if (isOpen) bindEvents();
    }

    function bindEvents() {
        document.getElementById('create-post-close')?.addEventListener('click', close);
        document.getElementById('create-post-overlay')?.addEventListener('click', e => { if (e.target.id === 'create-post-overlay') close(); });

        document.getElementById('post-image-url')?.addEventListener('blur', e => {
            imagePreview = e.target.value;
            // Re-render preview only
            const container = document.getElementById('create-post-overlay');
            if (container) { close(); open(); }
        });

        document.getElementById('create-post-submit')?.addEventListener('click', handleSubmit);

        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape' && isOpen) { close(); document.removeEventListener('keydown', esc); }
        });
    }

    async function handleSubmit() {
        const caption = document.getElementById('post-caption')?.value?.trim();
        const imageUrl = document.getElementById('post-image-url')?.value?.trim();
        const teamTag = document.getElementById('post-team-tag')?.value;

        if (!caption && !imageUrl) { Toast.error('Add a caption or image'); return; }

        loading = true;
        const submitBtn = document.getElementById('create-post-submit');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<div class="spinner spinner-sm"></div>'; }

        const fields = { caption: caption || null, image_url: imageUrl || null };
        if (teamTag) fields.team_tag = parseInt(teamTag);

        const profile = ICCSupabase.getProfile();
        if (profile?.role === 'lead' || profile?.role === 'admin') {
            fields.is_announcement = false; // Can be toggled
        }

        const { data, error } = await ICCSupabase.createPost(fields);
        loading = false;

        if (error) { Toast.error('Failed to create post: ' + error.message); close(); }
        else { Toast.success('Post shared! 🎉'); close(); window.dispatchEvent(new Event('hashchange')); }
    }

    return { open, close, mount };
})();
