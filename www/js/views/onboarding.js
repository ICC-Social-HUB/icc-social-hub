/* ============================================
   ICC Social Hub — Onboarding View
   ============================================ */
const OnboardingView = (() => {
    let step = 1;
    let formData = { username: '', bio: '', skills: [], avatar_url: '' };
    let _avatarFile = null;
    let usernameError = '';
    let saving = false;

    const SKILL_OPTIONS = [
        'Web Development', 'Mobile Apps', 'UI/UX Design', 'Machine Learning',
        'Data Science', 'Cybersecurity', 'Cloud Computing', 'DevOps',
        'Content Writing', 'Video Editing', 'Photography', 'Marketing',
        'Event Management', 'Finance', 'Leadership', 'Public Speaking'
    ];

    function render() {
        const profile = ICCSupabase.getProfile();
        const googleName = profile?.full_name || ICCSupabase.getUser()?.user_metadata?.name || '';
        const googleAvatar = profile?.avatar_url || ICCSupabase.getUser()?.user_metadata?.picture || '';
        if (googleAvatar && !formData.avatar_url) formData.avatar_url = googleAvatar;

        return `
        <section class="min-h-screen flex items-center justify-center px-4 py-8" id="onboarding-section">
            <div class="w-full max-w-md">
                <div class="text-center mb-6">
                    <div class="w-12 h-12 bg-gradient-to-br from-red-600 to-rose-700 rounded-xl flex items-center justify-center font-heading font-bold text-sm mx-auto mb-3">ICC</div>
                    <h1 class="font-heading font-bold text-2xl">Welcome to ICC</h1>
                    <p class="text-sm text-zinc-500 mt-1">Let's set up your profile</p>
                </div>
                <div class="progress-bar mb-6"><div class="progress-fill" style="width:${(step/3)*100}%"></div></div>

                ${step === 1 ? renderStep1(googleName) : step === 2 ? renderStep2() : renderStep3()}
            </div>
        </section>`;
    }

    function renderStep1(defaultName) {
        return `
        <div class="onboarding-step glass-card rounded-xl p-6 space-y-4">
            <h2 class="font-heading font-semibold text-lg">Choose your identity</h2>
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Username *</label>
                <input type="text" id="ob-username" value="${formData.username}" placeholder="your_username" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm" pattern="[a-zA-Z0-9_]+" minlength="3" maxlength="20">
                <p class="text-[11px] text-zinc-600 mt-1">Letters, numbers, underscore only</p>
                ${usernameError ? `<p class="text-[11px] text-red-400 mt-1">${usernameError}</p>` : ''}
            </div>
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Full Name</label>
                <input type="text" id="ob-name" value="${formData.full_name || defaultName}" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm" placeholder="Your full name">
            </div>
            <button id="ob-next-1" class="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all">Continue</button>
        </div>`;
    }

    function renderStep2() {
        return `
        <div class="onboarding-step glass-card rounded-xl p-6 space-y-4">
            <h2 class="font-heading font-semibold text-lg">Tell us about you</h2>
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Bio <span class="text-zinc-600">(optional)</span></label>
                <textarea id="ob-bio" rows="3" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm resize-none" placeholder="A short bio...">${formData.bio}</textarea>
            </div>
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-2">Skills & Interests</label>
                <div class="flex flex-wrap gap-2" id="ob-skills">
                    ${SKILL_OPTIONS.map(s => `<button type="button" class="skill-chip ${formData.skills.includes(s) ? 'selected' : ''}" data-skill="${s}">${s}</button>`).join('')}
                </div>
            </div>
            <div class="flex gap-2">
                <button id="ob-back-2" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors">Back</button>
                <button id="ob-next-2" class="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all">Continue</button>
            </div>
        </div>`;
    }

    function renderStep3() {
        const previewSrc = _avatarFile ? URL.createObjectURL(_avatarFile) : formData.avatar_url;
        return `
        <div class="onboarding-step glass-card rounded-xl p-6 space-y-4">
            <h2 class="font-heading font-semibold text-lg">Profile picture</h2>
            <div class="flex flex-col items-center gap-4">
                <div class="relative cursor-pointer" id="ob-avatar-trigger">
                    <div class="avatar-ring"><div class="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden" id="ob-avatar-preview">
                        ${previewSrc ? `<img src="${previewSrc}" class="w-full h-full object-cover">` : `<svg class="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>`}
                    </div></div>
                    <div class="absolute -bottom-1 -right-1 w-7 h-7 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                        <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    </div>
                    <input type="file" id="ob-avatar-file" accept="image/*" class="hidden">
                </div>
                <p class="text-sm text-zinc-400">${_avatarFile ? _avatarFile.name : 'Tap to upload a photo'}</p>
                <p class="text-[11px] text-zinc-600">Or skip — you can add one later</p>
            </div>
            <div class="flex gap-2">
                <button id="ob-back-3" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors">Back</button>
                <button id="ob-finish" class="flex-1 py-3 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 rounded-xl text-sm font-semibold transition-all disabled:opacity-50" ${saving ? 'disabled' : ''}>
                    ${saving ? '<div class="spinner spinner-sm mx-auto"></div>' : 'Complete Setup 🚀'}
                </button>
            </div>
        </div>`;
    }

    function mount(container) {
        step = 1; formData = { username: '', bio: '', skills: [], avatar_url: '' }; usernameError = ''; saving = false; _avatarFile = null;
        container.innerHTML = render();
        bindEvents(container);
    }

    function bindEvents(container) {
        // Step 1
        document.getElementById('ob-next-1')?.addEventListener('click', async () => {
            const username = document.getElementById('ob-username')?.value?.trim().toLowerCase();
            const fullName = document.getElementById('ob-name')?.value?.trim();
            if (!username || username.length < 3) { usernameError = 'Username must be at least 3 characters'; container.innerHTML = render(); bindEvents(container); return; }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) { usernameError = 'Only letters, numbers, and underscore'; container.innerHTML = render(); bindEvents(container); return; }
            const user = ICCSupabase.getUser();
            const available = await ICCSupabase.checkUsernameAvailable(username, user?.email);
            if (!available) { usernameError = 'Username is taken'; container.innerHTML = render(); bindEvents(container); return; }
            formData.username = username;
            formData.full_name = fullName;
            usernameError = '';
            step = 2; container.innerHTML = render(); bindEvents(container);
        });
        // Step 2
        document.querySelectorAll('.skill-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const skill = chip.dataset.skill;
                if (formData.skills.includes(skill)) { formData.skills = formData.skills.filter(s => s !== skill); chip.classList.remove('selected'); }
                else { formData.skills.push(skill); chip.classList.add('selected'); }
            });
        });
        document.getElementById('ob-back-2')?.addEventListener('click', () => { step = 1; container.innerHTML = render(); bindEvents(container); });
        document.getElementById('ob-next-2')?.addEventListener('click', () => {
            formData.bio = document.getElementById('ob-bio')?.value?.trim() || '';
            step = 3; container.innerHTML = render(); bindEvents(container);
        });
        // Step 3 — Avatar file upload
        document.getElementById('ob-avatar-trigger')?.addEventListener('click', () => {
            document.getElementById('ob-avatar-file')?.click();
        });
        document.getElementById('ob-avatar-file')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { Toast.error('Image must be under 5MB'); return; }
            _avatarFile = file;
            container.innerHTML = render(); bindEvents(container);
        });
        document.getElementById('ob-back-3')?.addEventListener('click', () => { step = 2; container.innerHTML = render(); bindEvents(container); });
        document.getElementById('ob-finish')?.addEventListener('click', async () => {
            saving = true; container.innerHTML = render(); bindEvents(container);

            let avatarUrl = formData.avatar_url || '';
            // Upload avatar file if selected
            if (_avatarFile) {
                const { url, error: upErr } = await ICCSupabase.uploadImage('avatars', _avatarFile);
                if (upErr) { Toast.error('Avatar upload failed'); saving = false; container.innerHTML = render(); bindEvents(container); return; }
                avatarUrl = url;
            }

            const { error } = await ICCSupabase.updateProfile({
                username: formData.username,
                full_name: formData.full_name,
                bio: formData.bio,
                skills: formData.skills,
                avatar_url: avatarUrl
            });
            saving = false;
            if (error) { Toast.error('Setup failed: ' + error.message); container.innerHTML = render(); bindEvents(container); }
            else { 
                Toast.success('Profile ready! Welcome to ICC 🎉'); 
                // Create welcome notification
                ICCSupabase.createNotification({
                    userId: ICCSupabase.getUser().id,
                    type: 'welcome',
                    body: 'Welcome to ICC Innovation Hub! Explore projects, connect with teams, and share your ideas.'
                });
                window.location.hash = '#dashboard'; 
                BottomNav.mount(); 
            }
        });
    }

    return { mount };
})();
