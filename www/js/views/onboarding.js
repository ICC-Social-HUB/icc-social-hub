/* ============================================
   ICC Social Hub — Onboarding View
   Supports both Student and Mentor Onboarding
   ============================================ */
const OnboardingView = (() => {
    let step = 1;
    let formData = { username: '', full_name: '', designation: '', linkedin: '', bio: '', skills: [], avatar_url: '', year: '', branch: '' };
    let _avatarFile = null;
    let usernameError = '';
    let saving = false;

    const STUDENT_SKILL_OPTIONS = [
        'Web Development', 'Mobile Apps', 'UI/UX Design', 'Machine Learning',
        'Data Science', 'Cybersecurity', 'Cloud Computing', 'DevOps',
        'Content Writing', 'Video Editing', 'Photography', 'Marketing',
        'Event Management', 'Finance', 'Leadership', 'Public Speaking'
    ];

    const MENTOR_SKILL_OPTIONS = [
        'System Design', 'AI & Machine Learning', 'Cloud & DevOps', 'Web & Mobile Dev',
        'Startup & Pitching', 'Product Management', 'UI/UX Design', 'Data Science',
        'Cybersecurity', 'IoT & Hardware', 'Career Guidance', 'Project Management',
        'Research & Patents', 'Team Leadership', 'Fundraising', 'Technical Writing'
    ];

    function isMentorUser() {
        const prof = ICCSupabase.getProfile();
        const user = ICCSupabase.getUser();
        const role = (prof?.role || user?.user_metadata?.role || '').toLowerCase().trim();
        return role === 'mentor';
    }

    function render() {
        const profile = ICCSupabase.getProfile();
        const user = ICCSupabase.getUser();
        const isMentor = isMentorUser();
        const defaultName = formData.full_name || profile?.full_name || user?.user_metadata?.name || '';
        const defaultAvatar = formData.avatar_url || profile?.avatar_url || user?.user_metadata?.picture || '';
        if (defaultAvatar && !formData.avatar_url) formData.avatar_url = defaultAvatar;
        if (!formData.full_name && defaultName) formData.full_name = defaultName;
        if (!formData.bio && profile?.bio) formData.bio = profile.bio;
        if (!formData.designation && profile?.designation) formData.designation = profile.designation;
        if (!formData.linkedin && profile?.linkedin) formData.linkedin = profile.linkedin;
        if (Array.isArray(profile?.skills) && profile.skills.length > 0 && formData.skills.length === 0) {
            formData.skills = [...profile.skills];
        }

        return `
        <section class="min-h-screen flex items-center justify-center px-4 py-8" id="onboarding-section">
            <div class="w-full max-w-md">
                ${isMentor ? renderMentorHeader() : renderStudentHeader()}
                <div class="progress-bar mb-6">
                    <div class="progress-fill" style="width:${(step/3)*100}%; ${isMentor ? 'background: linear-gradient(90deg, #f59e0b, #d97706);' : ''}"></div>
                </div>

                ${step === 1 ? renderStep1(isMentor) : step === 2 ? renderStep2(isMentor) : renderStep3(isMentor)}
            </div>
        </section>`;
    }

    function renderMentorHeader() {
        return `
        <div class="text-center mb-6">
            <div class="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-lg shadow-amber-900/30">🎓</div>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 mb-2">
                <span>Official Mentor Setup</span>
            </div>
            <h1 class="font-heading font-bold text-2xl text-white">Mentor Profile Setup</h1>
            <p class="text-sm text-zinc-400 mt-1">Complete your mentor bio and expertise to guide innovators</p>
        </div>`;
    }

    function renderStudentHeader() {
        return `
        <div class="text-center mb-6">
            <div class="w-12 h-12 bg-gradient-to-br from-red-600 to-rose-700 rounded-xl flex items-center justify-center font-heading font-bold text-sm mx-auto mb-3">ICC</div>
            <h1 class="font-heading font-bold text-2xl">Welcome to ICC</h1>
            <p class="text-sm text-zinc-500 mt-1">Let's set up your student profile</p>
        </div>`;
    }

    function renderStep1(isMentor) {
        if (isMentor) {
            return `
            <div class="onboarding-step glass-card rounded-xl p-6 space-y-4">
                <div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                    <span class="text-lg leading-tight">🎓</span>
                    <div class="text-[11px] text-amber-200/90 leading-snug">
                        <span class="font-semibold text-amber-300">ICC Mentor Account:</span> Student academic requirements (USN, Academic Year & Branch) are waived for you.
                    </div>
                </div>

                <h2 class="font-heading font-semibold text-lg text-white">Mentor Identity</h2>
                
                <div>
                    <label class="block text-xs font-medium text-zinc-300 mb-1.5">Full Name *</label>
                    <input type="text" id="ob-name" value="${formData.full_name || ''}" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-amber-500" placeholder="e.g. Dr. Jane Smith or Alex Turner">
                </div>

                <div>
                    <label class="block text-xs font-medium text-zinc-300 mb-1.5">Username *</label>
                    <input type="text" id="ob-username" value="${formData.username || ''}" placeholder="mentor_username" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-amber-500" pattern="[a-zA-Z0-9_]+" minlength="3" maxlength="20">
                    <p class="text-[11px] text-zinc-500 mt-1">Letters, numbers, and underscore only</p>
                    ${usernameError ? `<p class="text-[11px] text-red-400 mt-1">${usernameError}</p>` : ''}
                </div>

                <div>
                    <label class="block text-xs font-medium text-zinc-300 mb-1.5">Professional Title / Designation *</label>
                    <input type="text" id="ob-designation" value="${formData.designation || ''}" placeholder="e.g. Senior Software Architect, AI Researcher, Professor" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-amber-500">
                    <p class="text-[11px] text-zinc-500 mt-1">Displays next to your name across project reviews & mentorship directory</p>
                </div>

                <button id="ob-next-1" class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20">
                    Continue to Bio & Focus &rarr;
                </button>
            </div>`;
        }

        return `
        <div class="onboarding-step glass-card rounded-xl p-6 space-y-4">
            <h2 class="font-heading font-semibold text-lg">Choose your identity</h2>
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Username *</label>
                <input type="text" id="ob-username" value="${formData.username || ''}" placeholder="your_username" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm" pattern="[a-zA-Z0-9_]+" minlength="3" maxlength="20">
                <p class="text-[11px] text-zinc-600 mt-1">Letters, numbers, underscore only</p>
                ${usernameError ? `<p class="text-[11px] text-red-400 mt-1">${usernameError}</p>` : ''}
            </div>
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Full Name</label>
                <input type="text" id="ob-name" value="${formData.full_name || ''}" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm" placeholder="Your full name">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-medium text-zinc-400 mb-1.5">Academic Year *</label>
                    <select id="ob-year" class="form-input w-full px-3 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs" required>
                        <option value="" disabled ${!formData.year ? 'selected' : ''}>Select Year</option>
                        ${['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => `<option value="${y}" ${formData.year === y ? 'selected' : ''}>${y}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-zinc-400 mb-1.5">Branch *</label>
                    <select id="ob-branch" class="form-input w-full px-3 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs" required>
                        <option value="" disabled ${!formData.branch ? 'selected' : ''}>Select Branch</option>
                        ${['AIML', 'CSE', 'Mech', 'ICB', 'CCE', 'CSD', 'ECE'].map(b => `<option value="${b}" ${formData.branch === b ? 'selected' : ''}>${b}</option>`).join('')}
                    </select>
                </div>
            </div>
            <button id="ob-next-1" class="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all">Continue</button>
        </div>`;
    }

    function renderStep2(isMentor) {
        if (isMentor) {
            return `
            <div class="onboarding-step glass-card rounded-xl p-6 space-y-4">
                <h2 class="font-heading font-semibold text-lg text-white">Mentor Bio & Focus Areas</h2>
                
                <div>
                    <label class="block text-xs font-medium text-zinc-300 mb-1.5">Mentor Bio / Professional Background *</label>
                    <textarea id="ob-bio" rows="4" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm resize-none focus:border-amber-500" placeholder="Briefly describe your professional journey, industry background, and how you can guide student innovators...">${formData.bio || ''}</textarea>
                    <p class="text-[11px] text-zinc-500 mt-1">This bio will be shown on your Mentor Card and Project Reviews.</p>
                </div>

                <div>
                    <label class="block text-xs font-medium text-zinc-300 mb-1.5">LinkedIn Profile URL <span class="text-zinc-500">(recommended)</span></label>
                    <input type="url" id="ob-linkedin" value="${formData.linkedin || ''}" placeholder="https://www.linkedin.com/in/yourprofile" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-amber-500">
                </div>

                <div>
                    <label class="block text-xs font-medium text-zinc-300 mb-2">Mentorship Focus & Domains</label>
                    <div class="flex flex-wrap gap-2" id="ob-skills">
                        ${MENTOR_SKILL_OPTIONS.map(s => `<button type="button" class="skill-chip ${formData.skills.includes(s) ? 'selected' : ''}" data-skill="${s}">${s}</button>`).join('')}
                    </div>
                </div>

                <div class="flex gap-2 pt-2">
                    <button id="ob-back-2" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors">Back</button>
                    <button id="ob-next-2" class="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20">Continue &rarr;</button>
                </div>
            </div>`;
        }

        return `
        <div class="onboarding-step glass-card rounded-xl p-6 space-y-4">
            <h2 class="font-heading font-semibold text-lg">Tell us about you</h2>
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Bio <span class="text-zinc-600">(optional)</span></label>
                <textarea id="ob-bio" rows="3" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm resize-none" placeholder="A short bio...">${formData.bio || ''}</textarea>
            </div>
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-2">Skills & Interests</label>
                <div class="flex flex-wrap gap-2" id="ob-skills">
                    ${STUDENT_SKILL_OPTIONS.map(s => `<button type="button" class="skill-chip ${formData.skills.includes(s) ? 'selected' : ''}" data-skill="${s}">${s}</button>`).join('')}
                </div>
            </div>
            <div class="flex gap-2">
                <button id="ob-back-2" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors">Back</button>
                <button id="ob-next-2" class="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all">Continue</button>
            </div>
        </div>`;
    }

    function renderStep3(isMentor) {
        const previewSrc = _avatarFile ? URL.createObjectURL(_avatarFile) : formData.avatar_url;
        return `
        <div class="onboarding-step glass-card rounded-xl p-6 space-y-4">
            <h2 class="font-heading font-semibold text-lg ${isMentor ? 'text-white' : ''}">${isMentor ? 'Mentor Profile Picture' : 'Profile picture'}</h2>
            <div class="flex flex-col items-center gap-4 py-2">
                <div class="relative cursor-pointer" id="ob-avatar-trigger">
                    <div class="avatar-ring ${isMentor ? 'border-amber-500/50' : ''}">
                        <div class="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-700" id="ob-avatar-preview">
                            ${previewSrc ? `<img src="${previewSrc}" class="w-full h-full object-cover">` : `<svg class="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>`}
                        </div>
                    </div>
                    <div class="absolute -bottom-1 -right-1 w-7 h-7 ${isMentor ? 'bg-amber-500 text-black' : 'bg-red-600 text-white'} rounded-full flex items-center justify-center shadow-lg font-bold">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    </div>
                    <input type="file" id="ob-avatar-file" accept="image/*" class="hidden">
                </div>
                <p class="text-sm text-zinc-300">${_avatarFile ? _avatarFile.name : 'Tap to upload a professional photo'}</p>
                <p class="text-[11px] text-zinc-500">Or continue &mdash; you can update it anytime in settings</p>
            </div>
            <div class="flex gap-2">
                <button id="ob-back-3" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors">Back</button>
                <button id="ob-finish" class="flex-1 py-3 ${isMentor ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold' : 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold'} rounded-xl text-sm transition-all disabled:opacity-50" ${saving ? 'disabled' : ''}>
                    ${saving ? '<div class="spinner spinner-sm mx-auto"></div>' : (isMentor ? 'Complete Mentor Setup 🎓' : 'Complete Setup 🚀')}
                </button>
            </div>
        </div>`;
    }

    function mount(container) {
        step = 1;
        const prof = ICCSupabase.getProfile();
        const user = ICCSupabase.getUser();
        formData = {
            username: prof?.username || '',
            full_name: prof?.full_name || user?.user_metadata?.name || '',
            designation: prof?.designation || '',
            linkedin: prof?.linkedin || '',
            bio: prof?.bio || '',
            skills: Array.isArray(prof?.skills) ? [...prof.skills] : [],
            avatar_url: prof?.avatar_url || user?.user_metadata?.picture || '',
            year: prof?.year || '',
            branch: prof?.branch || ''
        };
        usernameError = '';
        saving = false;
        _avatarFile = null;
        container.innerHTML = render();
        bindEvents(container);
    }

    function bindEvents(container) {
        const isMentor = isMentorUser();

        // Step 1
        document.getElementById('ob-next-1')?.addEventListener('click', async () => {
            const username = document.getElementById('ob-username')?.value?.trim().toLowerCase();
            const fullName = document.getElementById('ob-name')?.value?.trim();
            const designation = document.getElementById('ob-designation')?.value?.trim();
            const year = document.getElementById('ob-year')?.value;
            const branch = document.getElementById('ob-branch')?.value;

            if (!username || username.length < 3) {
                usernameError = 'Username must be at least 3 characters';
                container.innerHTML = render();
                bindEvents(container);
                return;
            }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                usernameError = 'Only letters, numbers, and underscore allowed';
                container.innerHTML = render();
                bindEvents(container);
                return;
            }

            if (isMentor) {
                if (!fullName || fullName.length < 2) {
                    usernameError = 'Please enter your Full Name';
                    container.innerHTML = render();
                    bindEvents(container);
                    return;
                }
            } else {
                if (!year || !branch) {
                    usernameError = 'Please select both your Year and Branch';
                    container.innerHTML = render();
                    bindEvents(container);
                    return;
                }
            }

            const user = ICCSupabase.getUser();
            const available = await ICCSupabase.checkUsernameAvailable(username, user?.email);
            if (!available) {
                usernameError = 'Username is already taken';
                container.innerHTML = render();
                bindEvents(container);
                return;
            }

            formData.username = username;
            formData.full_name = fullName;
            if (isMentor) {
                formData.designation = designation || '';
            } else {
                formData.year = year;
                formData.branch = branch;
            }
            usernameError = '';
            step = 2;
            container.innerHTML = render();
            bindEvents(container);
        });

        // Step 2 — Skills chips
        document.querySelectorAll('.skill-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const skill = chip.dataset.skill;
                if (formData.skills.includes(skill)) {
                    formData.skills = formData.skills.filter(s => s !== skill);
                    chip.classList.remove('selected');
                } else {
                    formData.skills.push(skill);
                    chip.classList.add('selected');
                }
            });
        });

        document.getElementById('ob-back-2')?.addEventListener('click', () => {
            step = 1;
            container.innerHTML = render();
            bindEvents(container);
        });

        document.getElementById('ob-next-2')?.addEventListener('click', () => {
            formData.bio = document.getElementById('ob-bio')?.value?.trim() || '';
            if (isMentor) {
                formData.linkedin = document.getElementById('ob-linkedin')?.value?.trim() || '';
            }
            step = 3;
            container.innerHTML = render();
            bindEvents(container);
        });

        // Step 3 — Avatar file upload
        document.getElementById('ob-avatar-trigger')?.addEventListener('click', () => {
            document.getElementById('ob-avatar-file')?.click();
        });

        document.getElementById('ob-avatar-file')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                Toast.error('Image must be under 5MB');
                return;
            }
            _avatarFile = file;
            container.innerHTML = render();
            bindEvents(container);
        });

        document.getElementById('ob-back-3')?.addEventListener('click', () => {
            step = 2;
            container.innerHTML = render();
            bindEvents(container);
        });

        document.getElementById('ob-finish')?.addEventListener('click', async () => {
            saving = true;
            container.innerHTML = render();
            bindEvents(container);

            let avatarUrl = formData.avatar_url || '';
            if (_avatarFile) {
                const { url, error: upErr } = await ICCSupabase.uploadImage('avatars', _avatarFile);
                if (upErr) {
                    Toast.error('Avatar upload failed: ' + upErr.message);
                    saving = false;
                    container.innerHTML = render();
                    bindEvents(container);
                    return;
                }
                avatarUrl = url;
            }

            const updatePayload = {
                username: formData.username,
                full_name: formData.full_name,
                bio: formData.bio,
                skills: formData.skills,
                avatar_url: avatarUrl
            };

            if (isMentor) {
                if (formData.designation) updatePayload.designation = formData.designation;
                if (formData.linkedin) updatePayload.linkedin = formData.linkedin;
            } else {
                updatePayload.year = formData.year;
                updatePayload.branch = formData.branch;
            }

            const { error } = await ICCSupabase.updateProfile(updatePayload);
            saving = false;

            if (error) {
                Toast.error('Setup failed: ' + (error.message || 'Unknown error'));
                container.innerHTML = render();
                bindEvents(container);
            } else {
                if (isMentor) {
                    Toast.success('Mentor profile ready! Welcome to ICC 🎓');
                    try {
                        ICCSupabase.createNotification({
                            userId: ICCSupabase.getUser()?.id,
                            type: 'welcome',
                            body: 'Welcome to ICC Innovation Hub as an Official Mentor! You can now guide student projects and connect with innovators.'
                        });
                    } catch (_) {}
                } else {
                    Toast.success('Profile ready! Welcome to ICC 🎉');
                    try {
                        ICCSupabase.createNotification({
                            userId: ICCSupabase.getUser()?.id,
                            type: 'welcome',
                            body: 'Welcome to ICC Innovation Hub! Explore projects, connect with teams, and share your ideas.'
                        });
                    } catch (_) {}
                }

                // If user is mentor, they can navigate to dashboard or teams
                window.location.hash = '#dashboard';
                if (typeof BottomNav !== 'undefined' && BottomNav.mount) {
                    BottomNav.mount();
                }
            }
        });
    }

    return { mount };
})();
