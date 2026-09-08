/* ============================================
   ICC Social Hub — Create Post Modal
   Image upload from device + camera
   ============================================ */
const CreatePostModal = (() => {
    let isOpen = false;
    let loading = false;
    let selectedFile = null;
    let previewUrl = '';

    function open() {
        isOpen = true; loading = false; selectedFile = null; previewUrl = ''; mount(); document.body.style.overflow = 'hidden';
        if (typeof AndroidNavigation !== 'undefined') AndroidNavigation.pushModalState();
    }
    function close() {
        isOpen = false;
        selectedFile = null;
        if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = '';
        document.body.style.overflow = '';
        if (typeof AndroidNavigation !== 'undefined') AndroidNavigation.onModalClose();
    }

    function render() {
        if (!isOpen) return '';
        const profile = ICCSupabase.getProfile();
        return `
        <div class="modal-backdrop fixed inset-0 z-[100] flex items-end sm:items-center justify-center" id="create-post-overlay">
            <div class="modal-content bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto">
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
                    <textarea id="post-caption" rows="3" placeholder="Share your idea, project, or thought..." class="w-full bg-transparent text-sm text-white placeholder-zinc-600 resize-none focus:outline-none mb-4" maxlength="1000"></textarea>

                    <!-- Image Upload -->
                    <div class="mb-4">
                        ${previewUrl ? `
                        <div class="relative rounded-xl overflow-hidden border border-zinc-800 mb-3">
                            <img src="${previewUrl}" class="w-full max-h-64 object-cover">
                            <button id="remove-image" class="absolute top-2 right-2 w-8 h-8 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white transition-colors">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>` : `
                        <div class="border-2 border-dashed border-zinc-800 rounded-xl p-6 text-center cursor-pointer hover:border-zinc-600 transition-colors" id="upload-drop-zone">
                            <input type="file" id="post-image-file" accept="image/*" class="hidden">
                            <div class="flex flex-col items-center gap-2">
                                <div class="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center">
                                    <svg class="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/>
                                    </svg>
                                </div>
                                <p class="text-sm font-medium text-zinc-400">Tap to add a photo</p>
                                <p class="text-[11px] text-zinc-600">JPG, PNG, GIF — Max 5MB</p>
                            </div>
                        </div>`}
                    </div>

                    <!-- Community Request Toggle -->
                    <div class="mb-4 p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl">
                        <label class="flex items-center justify-between cursor-pointer">
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                                <span class="text-xs font-semibold text-zinc-300">Community Request</span>
                            </div>
                            <input type="checkbox" id="post-is-request" class="sr-only peer">
                            <div class="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600 peer-checked:after:bg-white relative"></div>
                        </label>
                        <div id="request-options" class="hidden mt-3 space-y-2 animate-slide-down">
                            <label class="block text-[10px] uppercase font-bold text-zinc-500">Request Category</label>
                            <select id="post-request-type" class="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white">
                                <option value="Component Request">Component Request</option>
                                <option value="Technical Help">Technical Help</option>
                                <option value="Resource Ask">Resource Ask</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <!-- Team Tag -->
                    <div>
                        <label class="block text-xs font-medium text-zinc-400 mb-1.5">Team Tag <span class="text-zinc-600">(optional)</span></label>
                        <select id="post-team-tag" class="form-input w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs">
                            <option value="">No team tag</option>
                            ${CORE_LEADS.map(l => `<option value="${l.id}" ${profile?.team_id === l.id ? 'selected' : ''}>${l.team}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function mount() {
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = render();
        if (isOpen) bindEvents();
    }

    function bindEvents() {
        document.getElementById('create-post-close')?.addEventListener('click', close);
        document.getElementById('create-post-overlay')?.addEventListener('click', e => { if (e.target.id === 'create-post-overlay') close(); });

        // Request toggle logic
        const requestToggle = document.getElementById('post-is-request');
        const requestOptions = document.getElementById('request-options');
        requestToggle?.addEventListener('change', () => {
            if (requestToggle.checked) requestOptions.classList.remove('hidden');
            else requestOptions.classList.add('hidden');
        });

        // File upload
        const fileInput = document.getElementById('post-image-file');
        const dropZone = document.getElementById('upload-drop-zone');

        dropZone?.addEventListener('click', () => fileInput?.click());

        fileInput?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { Toast.error('Image must be under 5MB'); return; }
            if (!file.type.startsWith('image/')) { Toast.error('Please select an image file'); return; }
            selectedFile = file;
            previewUrl = URL.createObjectURL(file);
            mount();
        });

        // Remove image
        document.getElementById('remove-image')?.addEventListener('click', () => {
            selectedFile = null;
            if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
            mount();
        });

        // Submit
        document.getElementById('create-post-submit')?.addEventListener('click', handleSubmit);

        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape' && isOpen) { close(); document.removeEventListener('keydown', esc); }
        });
    }

    async function handleSubmit() {
        const caption = document.getElementById('post-caption')?.value?.trim();

        if (!caption && !selectedFile) { Toast.error('Add a caption or image'); return; }

        loading = true;
        const submitBtn = document.getElementById('create-post-submit');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<div class="spinner spinner-sm"></div>'; }

        let imageUrl = null;

        // Upload image to Supabase Storage if a file was selected
        if (selectedFile) {
            Toast.info('Uploading image...');
            const { url, error: uploadError } = await ICCSupabase.uploadImage('posts', selectedFile);
            if (uploadError) {
                Toast.error('Image upload failed: ' + uploadError.message);
                loading = false;
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Post'; }
                return;
            }
            imageUrl = url;
        }

        const fields = { 
            caption: caption || null, 
            image_url: imageUrl,
            is_request: document.getElementById('post-is-request')?.checked || false
        };
        
        if (fields.is_request) {
            fields.request_type = document.getElementById('post-request-type')?.value;
        }

        const teamTag = document.getElementById('post-team-tag')?.value;
        if (teamTag) fields.team_tag = parseInt(teamTag);

        const { data, error } = await ICCSupabase.createPost(fields);
        loading = false;

        if (error) { Toast.error('Failed to create post: ' + error.message); close(); }
        else { 
            Toast.success('Post shared! 🎉'); 
            
            // Notification logic
            const user = ICCSupabase.getUser();
            
            // Notify everyone about the new post
            ICCSupabase.getAllProfiles().then(profiles => {
                profiles.forEach(p => {
                    if (p.id !== user.id) {
                        ICCSupabase.createNotification({
                            userId: p.id,
                            type: 'post',
                            actorId: user.id,
                            referenceId: data.id,
                            body: fields.caption || 'Shared a new post'
                        });
                    }
                });
            });
            
            close(); 
            window.dispatchEvent(new Event('hashchange')); 
        }
    }

    return { open, close, mount };
})();
