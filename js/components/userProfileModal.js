/* ============================================
   ICC Social Hub — User Profile Modal (Responsive Redesign)
   ============================================ */
const UserProfileModal = (() => {
    let isOpen = false;
    let profile = null;
    let posts = [];
    let projects = [];

    function getInitials(name) {
        if (!name) return '?';
        const parts = String(name).trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return String(name).slice(0, 2).toUpperCase();
    }

    async function open(userId) {
        if (!userId) return;
        isOpen = true;
        profile = null; 
        posts = []; 
        projects = [];
        mountLoading();
        document.body.style.overflow = 'hidden';

        try {
            if (!window.history.state?.modalOpen) {
                window.history.pushState({ modalOpen: true, modal: 'user-profile' }, '');
            }
        } catch (e) {}

        try {
            profile = await ICCSupabase.fetchUserById(userId);
            const [fetchedPosts, fetchedProjects] = await Promise.all([
                ICCSupabase.fetchPostsByUser(userId),
                (typeof ICCSupabase.fetchUserProjects === 'function') 
                    ? ICCSupabase.fetchUserProjects(userId) 
                    : []
            ]);
            posts = fetchedPosts || [];
            projects = fetchedProjects || [];
            if (isOpen) mount();
        } catch (e) {
            console.error('Error fetching user profile:', e);
            if (isOpen) close();
        }
    }

    function close() {
        isOpen = false; 
        profile = null; 
        posts = []; 
        projects = [];
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = '';
        document.body.style.overflow = '';
    }

    function mountLoading() {
        const root = document.getElementById('modal-root');
        if (!root) return;
        root.innerHTML = `
        <div class="fixed inset-0 z-[2000] bg-[#0e1621]/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <button id="user-profile-loading-back" class="absolute top-4 left-4 min-w-[44px] min-h-[44px] p-2.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-full transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec]" aria-label="Go back">
                <svg class="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
                <span>Back</span>
            </button>
            <div class="flex flex-col items-center gap-3">
                <div class="w-8 h-8 rounded-full border-2 border-[#3390ec] border-t-transparent animate-spin"></div>
                <p class="text-xs text-zinc-400 font-medium">Loading profile...</p>
            </div>
        </div>`;
        document.getElementById('user-profile-loading-back')?.addEventListener('click', close);
    }

    function render() {
        if (!isOpen || !profile) return '';

        const currentUserId = ICCSupabase.getUser()?.id;
        const isMe = currentUserId === profile.id;
        const initials = getInitials(profile.full_name || profile.username);

        const linkedinUrl = profile.linkedin ? (profile.linkedin.startsWith('http') ? profile.linkedin : 'https://' + profile.linkedin) : null;
        const githubUrl = profile.github ? (profile.github.startsWith('http') ? profile.github : 'https://' + profile.github) : null;
        const email = profile.email ? String(profile.email).trim() : null;
        const phone = profile.phone ? String(profile.phone).trim() : null;

        const roleTick = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.getRoleTick) 
            ? ICC_CONFIG.getRoleTick(profile) 
            : '';

        const bioText = profile.bio ? String(profile.bio).trim() : '';

        const skills = Array.isArray(profile.skills) 
            ? profile.skills 
            : (typeof profile.skills === 'string' ? profile.skills.split(',').map(s => s.trim()).filter(Boolean) : []);

        return `
        <div class="fixed inset-0 z-[2000] bg-[#0e1621] flex flex-col overflow-y-auto w-full h-full animate-fade-in text-zinc-200" id="user-profile-overlay" style="padding-left: env(safe-area-inset-left, 0px); padding-right: env(safe-area-inset-right, 0px); padding-bottom: env(safe-area-inset-bottom, 0px);">
            
            <!-- Top Sticky Navigation Bar -->
            <header class="sticky top-0 z-[2100] bg-[#0e1621]/85 backdrop-blur-xl px-4 sm:px-6 h-16 flex items-center justify-between border-b border-white/[0.06]" style="padding-top: env(safe-area-inset-top, 0px);">
                <button id="user-profile-close" class="min-w-[44px] min-h-[44px] px-2.5 py-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-full transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec]" aria-label="Go back" title="Back">
                    <svg class="w-5 h-5 text-zinc-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
                    <span class="text-xs font-bold uppercase tracking-wider hidden sm:inline text-zinc-300">Back</span>
                </button>
                <div class="text-center px-3 min-w-0 flex-1 max-w-[calc(100%-110px)]">
                    <h2 class="font-heading font-bold text-sm sm:text-base text-white truncate">
                        ${escapeHtml(profile.full_name || profile.username || 'Profile')}
                    </h2>
                </div>
                <div class="flex items-center justify-end">
                    ${!isMe ? `
                    <button id="user-msg-btn-header" class="min-w-[44px] min-h-[44px] p-2.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-full transition-colors flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec]" aria-label="Send message" title="Send message">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.84-.84c.162-.835.34-1.666.425-2.498A8.026 8.026 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>
                    </button>
                    ` : '<div class="w-11 h-11"></div>'}
                </div>
            </header>

            <!-- Responsive Page Container (1-Col on Mobile/Tablet, 2-Col on Desktop, Capped on Ultrawide) -->
            <div class="w-full max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-8 flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8">

                <!-- LEFT COLUMN: Profile Identity Card (Sticky on Large Screens) -->
                <aside class="w-full lg:w-[340px] xl:w-[380px] shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto space-y-5 bg-[#17212b]/60 lg:bg-[#17212b]/40 lg:border lg:border-white/[0.06] rounded-2xl p-4 sm:p-6 backdrop-blur-xs">
                    
                    <!-- Avatar Block -->
                    <div class="flex items-center justify-between">
                        <div class="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-[#17212b] ring-2 ring-white/10 overflow-hidden flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#3390ec] shadow-xl shrink-0 select-none">
                            ${profile.avatar_url ? 
                                `<img src="${profile.avatar_url}" alt="${escapeHtml(profile.full_name || profile.username || 'User')}'s avatar" class="w-full h-full object-cover">` : 
                                `<span>${escapeHtml(initials)}</span>`
                            }
                        </div>
                    </div>

                    <!-- Name, Verified Badge & Handle -->
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h1 class="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight break-words">
                                ${escapeHtml(profile.full_name || profile.username || 'User')}
                            </h1>
                            <span class="inline-flex items-center shrink-0">
                                ${roleTick || (profile.role === 'lead' ? (ICC_CONFIG.VERIFIED_TICK || '✔') : '')}
                            </span>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-zinc-300 font-medium flex-wrap">
                            <span class="text-zinc-300">@${escapeHtml(profile.username || 'user')}</span>
                            ${profile.role === 'mentor' ? `
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300">🎓 Mentor</span>
                            ` : ''}
                            ${profile.role === 'lead' ? `
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#3390ec]/15 text-[#3390ec]">Team Lead</span>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Bio Description (Collapsed when empty) -->
                    ${bioText ? `
                    <p class="text-sm text-zinc-300 leading-relaxed font-normal break-words">
                        ${escapeHtml(bioText)}
                    </p>
                    ` : ''}

                    <!-- Primary Action Button (Send Message / Edit Profile) -->
                    <div>
                        ${!isMe ? `
                        <button id="user-msg-btn" data-user-id="${profile.id}" class="w-full min-[400px]:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#3390ec] hover:bg-[#2b7bc5] active:bg-[#256bb0] text-white font-heading font-semibold rounded-full text-sm transition-all shadow-md active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1621]" aria-label="Send message to ${escapeHtml(profile.full_name || profile.username || 'user')}">
                            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.84-.84c.162-.835.34-1.666.425-2.498A8.026 8.026 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/></svg>
                            <span>Send Message</span>
                        </button>
                        ` : `
                        <button onclick="UserProfileModal.close(); window.location.hash='#profile';" class="w-full min-[400px]:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#17212b] hover:bg-[#242f3d] border border-white/10 text-white font-heading font-semibold rounded-full text-sm transition-all shadow-md active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1621]" aria-label="Edit your profile">
                            <svg class="w-4 h-4 text-zinc-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
                            <span>Edit Profile</span>
                        </button>
                        `}
                    </div>

                    <!-- Clickable Stats Row (Smooth-scrolls to sections) -->
                    <div class="flex items-center gap-6 py-2 border-y border-white/[0.06]">
                        <button type="button" class="user-profile-stat-btn flex items-baseline gap-1.5 hover:opacity-80 transition-opacity text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec] rounded-md px-1" data-target="#user-profile-projects" aria-label="Scroll to ${projects.length} projects">
                            <span class="text-base sm:text-lg font-heading font-extrabold ${projects.length > 0 ? 'text-white' : 'text-zinc-500'}">${projects.length}</span>
                            <span class="text-xs sm:text-sm font-medium text-zinc-400">Projects</span>
                        </button>
                        <button type="button" class="user-profile-stat-btn flex items-baseline gap-1.5 hover:opacity-80 transition-opacity text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec] rounded-md px-1" data-target="#user-profile-posts" aria-label="Scroll to ${posts.length} posts">
                            <span class="text-base sm:text-lg font-heading font-extrabold ${posts.length > 0 ? 'text-white' : 'text-zinc-500'}">${posts.length}</span>
                            <span class="text-xs sm:text-sm font-medium text-zinc-400">Posts</span>
                        </button>
                        ${(profile.branch || profile.year) ? `
                        <div class="flex items-baseline gap-1.5 ml-auto">
                            <span class="text-xs sm:text-sm font-heading font-bold text-[#3390ec]">${escapeHtml(profile.branch || '')}</span>
                            <span class="text-xs font-medium text-zinc-400">${escapeHtml(profile.year || '')}</span>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Contact & Social Chips (Wrapping, Non-truncated Email, Copy Confirmation) -->
                    ${(linkedinUrl || githubUrl || email || phone) ? `
                    <div class="space-y-2">
                        <div class="flex flex-wrap items-center gap-2">
                            ${linkedinUrl ? `
                                <a href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#17212b] border border-white/[0.06] hover:bg-[#202b38] hover:border-white/15 text-[#3390ec] text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec]" title="Open LinkedIn Profile">
                                    <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                                    <span>LinkedIn</span>
                                </a>
                            ` : ''}

                            ${githubUrl ? `
                                <a href="${githubUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#17212b] border border-white/[0.06] hover:bg-[#202b38] hover:border-white/15 text-zinc-200 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec]" title="Open GitHub Profile">
                                    <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
                                    <span>GitHub</span>
                                </a>
                            ` : ''}

                            ${email ? `
                                <div class="w-full sm:w-auto max-w-full inline-flex items-center justify-between sm:justify-start gap-1.5 px-3 py-1.5 rounded-full bg-[#17212b] border border-white/[0.06] hover:border-white/15 text-zinc-300 text-xs font-medium transition-all">
                                    <a href="mailto:${email}" class="inline-flex items-center gap-1.5 min-w-0 overflow-hidden text-zinc-200 hover:text-white" title="${escapeHtml(email)}">
                                        <svg class="w-3.5 h-3.5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                                        <span class="break-all [overflow-wrap:anywhere]">${escapeHtml(email)}</span>
                                    </a>
                                    <button type="button" class="user-profile-copy-btn p-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3390ec]" data-copy="${escapeHtml(email)}" aria-label="Copy email address" title="Copy email">
                                        <svg class="w-3.5 h-3.5 copy-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.849A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.599m7.332 0c.055.194.084.4.084.615v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.215.029-.421.084-.615m7.332 0A2.25 2.25 0 0118 6v13.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6a2.25 2.25 0 012.25-2.25h1.5"/></svg>
                                        <span class="copied-indicator hidden text-[10px] text-emerald-400 font-bold px-1">Copied!</span>
                                    </button>
                                </div>
                            ` : ''}

                            ${phone ? `
                                <div class="w-full sm:w-auto max-w-full inline-flex items-center justify-between sm:justify-start gap-1.5 px-3 py-1.5 rounded-full bg-[#17212b] border border-white/[0.06] hover:border-white/15 text-zinc-300 text-xs font-medium transition-all">
                                    <a href="tel:${phone}" class="inline-flex items-center gap-1.5 min-w-0 overflow-hidden text-zinc-200 hover:text-white" title="${escapeHtml(phone)}">
                                        <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
                                        <span class="break-all [overflow-wrap:anywhere]">${escapeHtml(phone)}</span>
                                    </a>
                                    <button type="button" class="user-profile-copy-btn p-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3390ec]" data-copy="${escapeHtml(phone)}" aria-label="Copy phone number" title="Copy phone">
                                        <svg class="w-3.5 h-3.5 copy-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.849A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.599m7.332 0c.055.194.084.4.084.615v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.215.029-.421.084-.615m7.332 0A2.25 2.25 0 0118 6v13.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6a2.25 2.25 0 012.25-2.25h1.5"/></svg>
                                        <span class="copied-indicator hidden text-[10px] text-emerald-400 font-bold px-1">Copied!</span>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Skills Section (Only shown if skills exist) -->
                    ${skills.length > 0 ? `
                    <div class="space-y-2 pt-1">
                        <p class="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Skills</p>
                        <div class="flex flex-wrap gap-2">
                            ${skills.map(s => `
                                <span class="px-3 py-1 rounded-lg bg-[#3390ec]/10 border border-[#3390ec]/25 text-[#3390ec] text-xs font-medium tracking-wide">
                                    ${escapeHtml(s)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                </aside>

                <!-- RIGHT COLUMN: Projects ("My Work") & Posts Grid -->
                <main class="flex-1 min-w-0 space-y-8 sm:space-y-10">

                    <!-- "My Work" Section -->
                    <section id="user-profile-projects" class="scroll-mt-24 space-y-4">
                        <div class="flex items-center justify-between pb-1">
                            <h2 class="font-heading font-bold text-lg sm:text-xl text-white">
                                My Work
                            </h2>
                            <span class="text-xs text-zinc-500 font-medium">${projects.length} Team${projects.length === 1 ? '' : 's'}</span>
                        </div>

                        ${projects.length > 0 ? `
                        <div class="grid gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))]">
                            ${projects.map(p => `
                            <a href="#teams/${p.id}" class="user-profile-project-card group flex flex-col justify-between bg-[#17212b] hover:bg-[#202b38] border border-white/[0.06] hover:border-white/15 rounded-2xl p-3.5 transition-all duration-200 hover:-translate-y-0.5 shadow-md active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec]" title="Open ${escapeHtml(p.name)}">
                                <div>
                                    <div class="aspect-[16/9] rounded-xl bg-gradient-to-br ${p.gradient || 'from-blue-600 to-indigo-600'} p-2.5 flex items-center justify-between shadow-inner relative overflow-hidden mb-3">
                                        <div class="w-8 h-8 rounded-lg bg-black/35 backdrop-blur-md flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                            ${p.initials}
                                        </div>
                                        <span class="text-[10px] font-bold uppercase tracking-wider text-white/95 bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-xs">
                                            ${p.is_lead ? 'Team Lead' : 'Project'}
                                        </span>
                                    </div>
                                    <h3 class="font-heading font-bold text-sm text-white group-hover:text-[#3390ec] transition-colors line-clamp-2 leading-snug">
                                        ${escapeHtml(p.name)}
                                    </h3>
                                </div>
                                <p class="text-[11px] text-zinc-400 truncate mt-2 pt-2 border-t border-white/[0.04]">
                                    ${p.lead_name ? `Lead: ${escapeHtml(p.lead_name)}` : 'Innovation Team'}
                                </p>
                            </a>
                            `).join('')}
                        </div>
                        ` : `
                        <div class="rounded-2xl border border-dashed border-white/10 bg-[#17212b]/40 py-10 px-6 text-center flex flex-col items-center justify-center gap-2">
                            <div class="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center text-zinc-400">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/></svg>
                            </div>
                            <p class="text-xs text-zinc-400 font-medium">No projects joined yet.</p>
                        </div>
                        `}
                    </section>

                    <!-- Posts Section -->
                    <section id="user-profile-posts" class="scroll-mt-24 space-y-4">
                        <div class="flex items-center justify-between pb-1">
                            <h2 class="font-heading font-bold text-lg sm:text-xl text-white">
                                Posts
                            </h2>
                            <span class="text-xs text-zinc-500 font-medium">${posts.length} Post${posts.length === 1 ? '' : 's'}</span>
                        </div>

                        ${posts.length > 0 ? `
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
                            ${posts.map(p => `
                            <a href="#post/${p.id}" class="user-profile-post-thumb group relative aspect-square bg-[#17212b] border border-white/[0.06] hover:border-white/20 rounded-xl overflow-hidden block transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec]" aria-label="View post: ${escapeHtml(p.caption || 'Post')}">
                                ${p.image_url ? `
                                    <img src="${p.image_url}" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center text-xs font-semibold text-white">
                                        View
                                    </div>
                                ` : `
                                    <div class="w-full h-full p-3 flex flex-col justify-between group-hover:bg-[#202b38] transition-colors">
                                        <p class="text-xs text-zinc-300 line-clamp-4 leading-relaxed">${escapeHtml(p.caption || 'Post')}</p>
                                        <span class="text-[10px] text-[#3390ec] font-semibold">Read →</span>
                                    </div>
                                `}
                            </a>
                            `).join('')}
                        </div>
                        ` : `
                        <div class="rounded-2xl border border-dashed border-white/10 bg-[#17212b]/40 py-10 px-6 text-center flex flex-col items-center justify-center gap-2">
                            <div class="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center text-zinc-400">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                            </div>
                            <p class="text-xs text-zinc-400 font-medium">No posts published yet.</p>
                        </div>
                        `}
                    </section>

                    <!-- Footer Credit -->
                    <footer class="py-6 text-center text-xs text-zinc-500">
                        <p class="text-[10px] uppercase tracking-[0.2em] font-medium mb-2 text-zinc-500">Crafted with ❤️ by</p>
                        <a href="https://saravanantm1920.wixsite.com/my-site-4" target="_blank" rel="noopener noreferrer" 
                           class="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#17212b] hover:bg-[#202b38] border border-white/[0.06] text-zinc-300 hover:text-white rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec]">
                            <span class="text-xs font-bold">T M Saravanan</span>
                        </a>
                    </footer>

                </main>
            </div>
        </div>`;
    }

    function mount() {
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = render();
        if (isOpen) bindEvents();
    }

    function bindEvents() {
        // Back / Close
        document.getElementById('user-profile-close')?.addEventListener('click', close);
        
        // Header Chat Button
        document.getElementById('user-msg-btn-header')?.addEventListener('click', () => {
            const userId = profile.id;
            close();
            window.location.hash = `#chat/${userId}`;
        });

        // Main Send Message Button
        document.getElementById('user-msg-btn')?.addEventListener('click', () => {
            const userId = profile.id;
            close();
            window.location.hash = `#chat/${userId}`;
        });

        // Clickable Project Cards
        document.querySelectorAll('.user-profile-project-card').forEach(card => {
            card.addEventListener('click', () => close());
        });

        // Clickable Posts
        document.querySelectorAll('.user-profile-post-thumb').forEach(thumb => {
            thumb.addEventListener('click', () => close());
        });

        // Clickable Stats Smooth-Scroll
        document.querySelectorAll('.user-profile-stat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.getAttribute('data-target');
                const target = targetId ? document.querySelector(targetId) : null;
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Copy-to-clipboard for Email & Phone Chips
        document.querySelectorAll('.user-profile-copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const text = btn.getAttribute('data-copy');
                if (!text) return;

                let copied = false;
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(text);
                        copied = true;
                    }
                } catch (err) {}

                if (!copied) {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = text;
                        ta.style.position = 'fixed';
                        ta.style.opacity = '0';
                        document.body.appendChild(ta);
                        ta.focus();
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        copied = true;
                    } catch (err) {}
                }

                if (copied) {
                    const icon = btn.querySelector('.copy-icon');
                    const indicator = btn.querySelector('.copied-indicator');
                    if (icon && indicator) {
                        icon.classList.add('hidden');
                        indicator.classList.remove('hidden');
                        setTimeout(() => {
                            icon.classList.remove('hidden');
                            indicator.classList.add('hidden');
                        }, 1800);
                    }
                }
            });
        });
    }

    return { open, close };
})();
