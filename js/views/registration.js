/* ========================================================
   ICC Social Hub — Public Student Registration View
   Accessed strictly via unique admin tokenized link: #join/<token>
   Pure Registration Terminal — No App Chrome / High-Tech Theme
   ======================================================== */
const RegistrationView = (() => {
    let currentToken = '';
    let isValidating = true;
    let isLinkValid = false;
    let linkInvalidReason = ''; // 'invalid', 'expired', 'disabled'
    let assignedAdminName = '';
    let assignedAdminRole = 'Admin';
    let isSubmitted = false;
    let isSubmitting = false;
    let serverError = '';
    let formValues = {
        fullName: '',
        usn: '',
        branch: '',
        year: '',
        email: '',
        phone: '',
        linkedin: '',
        github: '',
        otherLink: '',
        hpCompany: ''
    };
    let fieldErrors = {};

    const USN_REGEX = /^1[A-Za-z]{2}\d{2}[A-Za-z]{2}\d{3}$/;
    const PHONE_REGEX = /^[6-9]\d{9}$/;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function setNoIndexMeta(enable) {
        let meta = document.querySelector('meta[name="robots"]');
        if (enable) {
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = 'robots';
                document.head.appendChild(meta);
            }
            meta.content = 'noindex, nofollow';
        } else if (meta) {
            meta.remove();
        }
    }

    async function mount(container, token) {
        // Enforce total isolation: hide all surrounding chrome
        document.body.classList.add('is-registration-mode');
        document.documentElement.classList.add('is-registration-mode');
        setNoIndexMeta(true);

        currentToken = token || '';
        isValidating = true;
        isLinkValid = false;
        linkInvalidReason = '';
        assignedAdminName = '';
        assignedAdminRole = 'Admin';
        isSubmitted = false;
        isSubmitting = false;
        serverError = '';
        fieldErrors = {};

        render(container);

        if (!currentToken) {
            isValidating = false;
            isLinkValid = false;
            linkInvalidReason = 'invalid';
            render(container);
            return;
        }

        try {
            const check = await ICCSupabase.validateRegistrationToken(currentToken);
            isValidating = false;
            if (check && check.valid) {
                isLinkValid = true;
                assignedAdminName = check.admin_name || '';
                assignedAdminRole = check.admin_role || 'Admin';
            } else {
                isLinkValid = false;
                linkInvalidReason = check?.reason || 'invalid';
                assignedAdminName = check?.admin_name || '';
            }
        } catch (e) {
            isValidating = false;
            isLinkValid = false;
            linkInvalidReason = 'error';
        }

        render(container);
    }

    function unmount() {
        document.body.classList.remove('is-registration-mode');
        document.documentElement.classList.remove('is-registration-mode');
        setNoIndexMeta(false);
    }

    function validateField(fieldName, value) {
        switch (fieldName) {
            case 'fullName':
                if (!value || value.trim().length < 2) return 'Full legal name is required.';
                return '';
            case 'usn':
                if (!value) return 'USN is required.';
                if (!USN_REGEX.test(value.trim().toUpperCase())) return 'Enter a valid USN (e.g. 1KS25AI109).';
                return '';
            case 'branch':
                if (!value) return 'Please select your academic branch.';
                return '';
            case 'year':
                if (!value) return 'Please select your academic year.';
                return '';
            case 'email':
                if (!value) return 'Email address is required.';
                if (!EMAIL_REGEX.test(value.trim())) return 'Enter a valid email address.';
                return '';
            case 'phone':
                if (!value) return 'Phone number is required.';
                const cleanPhone = value.replace(/[^0-9]/g, '');
                if (!PHONE_REGEX.test(cleanPhone)) return 'Enter a valid 10-digit Indian mobile number.';
                return '';
            case 'linkedin':
                if (value && !/^https?:\/\//i.test(value)) return 'Link must start with https://';
                return '';
            case 'github':
                if (value && !/^https?:\/\//i.test(value)) return 'Link must start with https://';
                return '';
            case 'otherLink':
                if (value && !/^https?:\/\//i.test(value)) return 'Link must start with https://';
                return '';
            default:
                return '';
        }
    }

    function render(container) {
        if (!container) return;

        // 1. VALIDATING TOKEN SCREEN
        if (isValidating) {
            container.innerHTML = `
            <div class="min-h-screen tech-grid-bg flex flex-col items-center justify-center p-6 text-center select-none">
                <div class="relative flex items-center justify-center mb-6">
                    <div class="w-16 h-16 rounded-2xl bg-[#0c1524] border border-cyan-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.25)]">
                        <div class="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
                <h3 class="font-mono text-sm tracking-widest text-cyan-400 uppercase mb-1">Authenticating Link Token</h3>
                <p class="font-mono text-xs text-zinc-500">Establishing encrypted handshake with ICC Social Hub...</p>
            </div>`;
            return;
        }

        // 2. INVALID / DISABLED LINK SCREEN
        if (!isLinkValid) {
            const isDeactivated = linkInvalidReason === 'disabled';
            container.innerHTML = `
            <div class="min-h-screen tech-grid-bg flex flex-col items-center justify-center p-6">
                <div class="w-full max-w-md bg-[#0a111c]/90 border border-cyan-500/20 rounded-2xl p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
                    <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 flex items-center justify-center text-2xl text-red-400 mb-5 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                        ✕
                    </div>
                    
                    <div class="font-mono text-xs tracking-widest text-red-400 uppercase mb-2">Access Denied</div>
                    <h2 class="font-heading font-bold text-xl text-white mb-3">
                        ${isDeactivated ? 'Registration Link Currently Disabled' : 'Invalid Registration Link'}
                    </h2>
                    
                    <p class="text-xs text-zinc-400 leading-relaxed font-sans mb-6">
                        ${isDeactivated 
                            ? `This registration link has been temporarily deactivated by the host administrator${assignedAdminName ? ` (<span class="text-cyan-300 font-mono">${escapeHtml(assignedAdminName)}</span>)` : ''}. Please contact them directly to request activation.` 
                            : 'This registration link does not exist, has expired, or was corrupted. Please verify the link or request a new permanent link from your club administrator.'}
                    </p>

                    ${assignedAdminName ? `
                    <div class="py-2.5 px-4 bg-[#060c16] rounded-xl border border-white/5 font-mono text-xs text-zinc-400 flex items-center justify-center gap-2 mb-6">
                        <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
                        <span>Host Admin: <strong class="text-white">${escapeHtml(assignedAdminName)}</strong></span>
                    </div>
                    ` : ''}

                    <a href="#feed" class="w-full inline-flex items-center justify-center py-3 bg-[#111e30] hover:bg-[#16273e] text-cyan-300 text-xs font-mono font-semibold tracking-wider rounded-xl transition-all border border-cyan-500/20 shadow-lg">
                        Return to Public Portal
                    </a>
                </div>
            </div>`;
            return;
        }

        // 3. SUBMISSION CONFIRMATION RECEIPT SCREEN
        if (isSubmitted) {
            container.innerHTML = `
            <div class="min-h-screen tech-grid-bg flex flex-col items-center justify-center p-4 sm:p-6">
                <div class="w-full max-w-xl bg-[#0a111c]/90 border border-cyan-500/25 rounded-2xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl relative overflow-hidden">
                    <div class="absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    <!-- Tech Header -->
                    <div class="flex items-center gap-4 mb-6 pb-5 border-b border-white/10">
                        <div class="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 flex items-center justify-center text-xl font-bold shadow-[0_0_20px_rgba(34,211,238,0.25)] flex-shrink-0">
                            ✓
                        </div>
                        <div>
                            <div class="font-mono text-[11px] tracking-widest text-cyan-400 uppercase">Application Transmitted</div>
                            <h2 class="font-heading font-extrabold text-xl text-white">Student Registration Received</h2>
                        </div>
                    </div>

                    <p class="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6 font-sans">
                        Candidate <strong class="text-white">${escapeHtml(formValues.fullName)}</strong> (<span class="font-mono text-cyan-300">${escapeHtml(formValues.usn)}</span>), your registration has been routed directly to your host administrator's review terminal.
                    </p>

                    ${assignedAdminName ? `
                    <div class="p-3.5 bg-[#060c16] rounded-xl border border-white/5 font-mono text-xs text-zinc-300 flex items-center justify-between mb-6">
                        <span class="text-zinc-500">ASSIGNED REVIEWER</span>
                        <span class="text-cyan-300 font-semibold">${escapeHtml(assignedAdminName)} (${escapeHtml(assignedAdminRole)})</span>
                    </div>
                    ` : ''}

                    <!-- Two-Stage Approval Pipeline -->
                    <div class="bg-[#060c16] border border-white/5 rounded-xl p-5 mb-6">
                        <div class="font-mono text-[11px] tracking-wider text-zinc-400 uppercase mb-4 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                            <span>Review Lifecycle Protocol</span>
                        </div>

                        <div class="space-y-4">
                            <!-- Stage 1 -->
                            <div class="flex items-start gap-3">
                                <div class="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 mt-0.5">
                                    01
                                </div>
                                <div>
                                    <h4 class="text-xs font-mono font-semibold text-white">Application Recorded</h4>
                                    <p class="text-[11px] text-zinc-400 mt-0.5">Submitted via host admin's direct link.</p>
                                </div>
                            </div>

                            <!-- Stage 2 -->
                            <div class="flex items-start gap-3">
                                <div class="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 mt-0.5">
                                    02
                                </div>
                                <div>
                                    <h4 class="text-xs font-mono font-semibold text-cyan-300">Host Admin First Review</h4>
                                    <p class="text-[11px] text-zinc-400 mt-0.5">${assignedAdminName ? escapeHtml(assignedAdminName) : 'Your host admin'} will review your credentials and forward to Super Admin.</p>
                                </div>
                            </div>

                            <!-- Stage 3 -->
                            <div class="flex items-start gap-3">
                                <div class="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-500 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 mt-0.5">
                                    03
                                </div>
                                <div>
                                    <h4 class="text-xs font-mono font-semibold text-zinc-400">Super Admin Final Approval</h4>
                                    <p class="text-[11px] text-zinc-500 mt-0.5">Access activation and student credentials delivered to <span class="font-mono text-zinc-300">${escapeHtml(formValues.email)}</span>.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <a href="#feed" class="w-full block py-3.5 bg-[#111e30] hover:bg-[#16273e] text-center text-cyan-300 font-mono text-xs font-bold tracking-wider rounded-xl transition-all border border-cyan-500/20 shadow-lg">
                        Return to Public ICC Portal
                    </a>
                </div>
            </div>`;
            return;
        }

        // 4. MAIN REGISTRATION FORM (Tech Themed, Isolated, No Bordered Badges)
        container.innerHTML = `
        <div class="min-h-screen tech-grid-bg py-8 sm:py-12 px-4 sm:px-6 flex flex-col justify-center items-center">
            <div class="w-full max-w-2xl">
                <!-- Sleek Tech Header -->
                <div class="mb-6 sm:mb-8 text-center sm:text-left">
                    <div class="flex items-center justify-center sm:justify-start gap-2.5 font-mono text-xs tracking-wider text-cyan-400 uppercase mb-2">
                        <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse"></span>
                        <span>ICC // CANDIDATE ONBOARDING TERMINAL</span>
                    </div>

                    <h1 class="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                        Student Member Registration
                    </h1>

                    <p class="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl font-sans">
                        Submit your verified student credentials to request access to the Innovators Creators Club and collaboration workforce.
                    </p>

                    ${assignedAdminName ? `
                    <div class="flex items-center justify-center sm:justify-start gap-2 text-xs font-mono text-zinc-400 mt-3">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>Direct Reviewer: <strong class="text-white font-medium">${escapeHtml(assignedAdminName)}</strong></span>
                        <span class="text-zinc-600">·</span>
                        <span class="text-cyan-400/80 font-mono">${escapeHtml(assignedAdminRole)}</span>
                    </div>
                    ` : ''}
                </div>

                ${serverError ? `
                <div class="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-3 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                    <span class="text-base flex-shrink-0">⚠️</span>
                    <div class="flex-1">
                        <strong class="font-mono font-semibold block mb-0.5">SUBMISSION ERROR</strong>
                        <span class="font-sans">${escapeHtml(serverError)}</span>
                    </div>
                </div>
                ` : ''}

                <!-- Registration Form -->
                <form id="public-registration-form" class="space-y-5">
                    <!-- Honeypot anti-spam field -->
                    <div style="position: absolute; left: -9999px; top: -9999px;" aria-hidden="true">
                        <input type="text" name="hp_company" id="hp-company" tabindex="-1" autocomplete="off" value="${escapeHtml(formValues.hpCompany)}">
                    </div>

                    <!-- Block 1: Candidate Identity -->
                    <div class="bg-[#0a111c]/90 border border-cyan-500/20 rounded-2xl p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                        <div class="font-mono text-xs font-semibold tracking-wider text-cyan-400 uppercase pb-3 mb-4 border-b border-white/5 flex items-center justify-between">
                            <span>// 01 · CANDIDATE IDENTITY</span>
                            <span class="text-[10px] text-zinc-500">MANDATORY</span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div class="sm:col-span-2">
                                <label class="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                                    FULL LEGAL NAME <span class="text-red-400">*</span>
                                </label>
                                <input type="text" id="reg-name" required placeholder="e.g. Aditi Sharma"
                                    class="w-full px-4 py-3 bg-[#060c16] border ${fieldErrors.fullName ? 'border-red-500 focus:border-red-500' : 'border-cyan-950 hover:border-cyan-800/80 focus:border-cyan-400'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-all font-mono focus:shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                                    value="${escapeHtml(formValues.fullName)}">
                                ${fieldErrors.fullName ? `<p class="text-[11px] text-red-400 font-mono mt-1">${escapeHtml(fieldErrors.fullName)}</p>` : ''}
                            </div>

                            <div>
                                <label class="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                                    EMAIL ADDRESS <span class="text-red-400">*</span>
                                </label>
                                <input type="email" id="reg-email" required placeholder="you@college.edu or personal"
                                    class="w-full px-4 py-3 bg-[#060c16] border ${fieldErrors.email ? 'border-red-500 focus:border-red-500' : 'border-cyan-950 hover:border-cyan-800/80 focus:border-cyan-400'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-all font-mono focus:shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                                    value="${escapeHtml(formValues.email)}">
                                ${fieldErrors.email ? `<p class="text-[11px] text-red-400 font-mono mt-1">${escapeHtml(fieldErrors.email)}</p>` : `<p class="text-[10px] text-zinc-500 font-mono mt-1">Official access credentials sent here</p>`}
                            </div>

                            <div>
                                <label class="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                                    MOBILE CONTACT <span class="text-red-400">*</span>
                                </label>
                                <input type="tel" id="reg-phone" required placeholder="10-digit number (e.g. 9876543210)" maxlength="10"
                                    class="w-full px-4 py-3 bg-[#060c16] border ${fieldErrors.phone ? 'border-red-500 focus:border-red-500' : 'border-cyan-950 hover:border-cyan-800/80 focus:border-cyan-400'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-all font-mono focus:shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                                    value="${escapeHtml(formValues.phone)}">
                                ${fieldErrors.phone ? `<p class="text-[11px] text-red-400 font-mono mt-1">${escapeHtml(fieldErrors.phone)}</p>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Block 2: Academic Credentials -->
                    <div class="bg-[#0a111c]/90 border border-cyan-500/20 rounded-2xl p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                        <div class="font-mono text-xs font-semibold tracking-wider text-cyan-400 uppercase pb-3 mb-4 border-b border-white/5 flex items-center justify-between">
                            <span>// 02 · ACADEMIC CREDENTIALS</span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                                    COLLEGE USN <span class="text-red-400">*</span>
                                </label>
                                <input type="text" id="reg-usn" required placeholder="e.g. 1KS25AI109" maxlength="10"
                                    class="w-full px-4 py-3 bg-[#060c16] border ${fieldErrors.usn ? 'border-red-500 focus:border-red-500' : 'border-cyan-950 hover:border-cyan-800/80 focus:border-cyan-400'} rounded-xl text-xs sm:text-sm text-cyan-300 placeholder-zinc-600 outline-none transition-all uppercase font-mono font-bold tracking-wider focus:shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                                    value="${escapeHtml(formValues.usn)}">
                                ${fieldErrors.usn ? `<p class="text-[11px] text-red-400 font-mono mt-1">${escapeHtml(fieldErrors.usn)}</p>` : ''}
                            </div>

                            <div>
                                <label class="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                                    DEPARTMENT <span class="text-red-400">*</span>
                                </label>
                                <select id="reg-branch" required
                                    class="w-full px-4 py-3 bg-[#060c16] border ${fieldErrors.branch ? 'border-red-500 focus:border-red-500' : 'border-cyan-950 hover:border-cyan-800/80 focus:border-cyan-400'} rounded-xl text-xs sm:text-sm text-white outline-none transition-all font-mono cursor-pointer focus:shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                                    <option value="" disabled ${!formValues.branch ? 'selected' : ''}>Select Branch</option>
                                    <option value="Artificial Intelligence & Machine Learning" ${formValues.branch === 'Artificial Intelligence & Machine Learning' ? 'selected' : ''}>AI & ML</option>
                                    <option value="Computer Science & Engineering" ${formValues.branch === 'Computer Science & Engineering' ? 'selected' : ''}>CSE</option>
                                    <option value="Computer Science & Data Science" ${formValues.branch === 'Computer Science & Data Science' ? 'selected' : ''}>CS - Data Science</option>
                                    <option value="Information Science & Engineering" ${formValues.branch === 'Information Science & Engineering' ? 'selected' : ''}>ISE</option>
                                    <option value="Electronics & Communication" ${formValues.branch === 'Electronics & Communication' ? 'selected' : ''}>ECE</option>
                                    <option value="Electrical & Electronics" ${formValues.branch === 'Electrical & Electronics' ? 'selected' : ''}>EEE</option>
                                    <option value="Mechanical Engineering" ${formValues.branch === 'Mechanical Engineering' ? 'selected' : ''}>Mechanical</option>
                                    <option value="Civil Engineering" ${formValues.branch === 'Civil Engineering' ? 'selected' : ''}>Civil</option>
                                    <option value="Other" ${formValues.branch === 'Other' ? 'selected' : ''}>Other</option>
                                </select>
                                ${fieldErrors.branch ? `<p class="text-[11px] text-red-400 font-mono mt-1">${escapeHtml(fieldErrors.branch)}</p>` : ''}
                            </div>

                            <div>
                                <label class="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                                    ACADEMIC YEAR <span class="text-red-400">*</span>
                                </label>
                                <select id="reg-year" required
                                    class="w-full px-4 py-3 bg-[#060c16] border ${fieldErrors.year ? 'border-red-500 focus:border-red-500' : 'border-cyan-950 hover:border-cyan-800/80 focus:border-cyan-400'} rounded-xl text-xs sm:text-sm text-white outline-none transition-all font-mono cursor-pointer focus:shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                                    <option value="" disabled ${!formValues.year ? 'selected' : ''}>Select Year</option>
                                    <option value="1st Year" ${formValues.year === '1st Year' ? 'selected' : ''}>1st Year</option>
                                    <option value="2nd Year" ${formValues.year === '2nd Year' ? 'selected' : ''}>2nd Year</option>
                                    <option value="3rd Year" ${formValues.year === '3rd Year' ? 'selected' : ''}>3rd Year</option>
                                    <option value="4th Year" ${formValues.year === '4th Year' ? 'selected' : ''}>4th Year</option>
                                </select>
                                ${fieldErrors.year ? `<p class="text-[11px] text-red-400 font-mono mt-1">${escapeHtml(fieldErrors.year)}</p>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Block 3: Verification & Portfolio -->
                    <div class="bg-[#0a111c]/90 border border-cyan-500/20 rounded-2xl p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                        <div class="font-mono text-xs font-semibold tracking-wider text-cyan-400 uppercase pb-3 mb-4 border-b border-white/5 flex items-center justify-between">
                            <span>// 03 · ONLINE PORTFOLIO & REPOSITORIES</span>
                            <span class="text-[10px] text-zinc-500">OPTIONAL</span>
                        </div>

                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-mono font-medium text-zinc-300 mb-1.5">LINKEDIN PROFILE</label>
                                <input type="url" id="reg-linkedin" placeholder="https://linkedin.com/in/username"
                                    class="w-full px-4 py-3 bg-[#060c16] border ${fieldErrors.linkedin ? 'border-red-500 focus:border-red-500' : 'border-cyan-950 hover:border-cyan-800/80 focus:border-cyan-400'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-all font-mono focus:shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                                    value="${escapeHtml(formValues.linkedin)}">
                                ${fieldErrors.linkedin ? `<p class="text-[11px] text-red-400 font-mono mt-1">${escapeHtml(fieldErrors.linkedin)}</p>` : ''}
                            </div>

                            <div>
                                <label class="block text-xs font-mono font-medium text-zinc-300 mb-1.5">GITHUB PROFILE</label>
                                <input type="url" id="reg-github" placeholder="https://github.com/username"
                                    class="w-full px-4 py-3 bg-[#060c16] border ${fieldErrors.github ? 'border-red-500 focus:border-red-500' : 'border-cyan-950 hover:border-cyan-800/80 focus:border-cyan-400'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-all font-mono focus:shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                                    value="${escapeHtml(formValues.github)}">
                                ${fieldErrors.github ? `<p class="text-[11px] text-red-400 font-mono mt-1">${escapeHtml(fieldErrors.github)}</p>` : ''}
                            </div>

                            <div>
                                <label class="block text-xs font-mono font-medium text-zinc-300 mb-1.5">PROJECT PORTFOLIO / PERSONAL SITE</label>
                                <input type="url" id="reg-other" placeholder="https://yourportfolio.dev"
                                    class="w-full px-4 py-3 bg-[#060c16] border ${fieldErrors.otherLink ? 'border-red-500 focus:border-red-500' : 'border-cyan-950 hover:border-cyan-800/80 focus:border-cyan-400'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-all font-mono focus:shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                                    value="${escapeHtml(formValues.otherLink)}">
                                ${fieldErrors.otherLink ? `<p class="text-[11px] text-red-400 font-mono mt-1">${escapeHtml(fieldErrors.otherLink)}</p>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Submission Action -->
                    <div class="pt-2">
                        <button type="submit" id="reg-submit-btn" ${isSubmitting ? 'disabled' : ''}
                            class="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-[0.99] text-white font-mono font-bold text-xs sm:text-sm tracking-wider uppercase transition-all shadow-[0_0_30px_rgba(34,211,238,0.35)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-cyan-400/30">
                            ${isSubmitting ? `
                                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>TRANSMITTING CREDENTIALS...</span>
                            ` : `
                                <span>SUBMIT REGISTRATION APPLICATION</span>
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            `}
                        </button>
                        <p class="text-[11px] font-mono text-zinc-500 text-center mt-3">
                            Direct Transmission Protocol · ICC Administrator Review System
                        </p>
                    </div>
                </form>
            </div>
        </div>`;

        bindFormEvents(container);
    }

    function bindFormEvents(container) {
        const form = document.getElementById('public-registration-form');
        if (!form) return;

        const bindInput = (id, prop, transform = null) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', e => {
                let val = e.target.value;
                if (transform) val = transform(val);
                formValues[prop] = val;
                if (fieldErrors[prop]) {
                    fieldErrors[prop] = validateField(prop, val);
                }
            });
            el.addEventListener('blur', e => {
                let val = e.target.value;
                if (transform) val = transform(val);
                fieldErrors[prop] = validateField(prop, val);
                render(container);
            });
        };

        bindInput('reg-name', 'fullName');
        bindInput('reg-usn', 'usn', v => v.toUpperCase().trim());
        bindInput('reg-branch', 'branch');
        bindInput('reg-year', 'year');
        bindInput('reg-email', 'email', v => v.toLowerCase().trim());
        bindInput('reg-phone', 'phone', v => v.replace(/[^0-9]/g, ''));
        bindInput('reg-linkedin', 'linkedin');
        bindInput('reg-github', 'github');
        bindInput('reg-other', 'otherLink');
        bindInput('hp-company', 'hpCompany');

        form.addEventListener('submit', async e => {
            e.preventDefault();
            serverError = '';

            fieldErrors.fullName = validateField('fullName', formValues.fullName);
            fieldErrors.usn = validateField('usn', formValues.usn);
            fieldErrors.branch = validateField('branch', formValues.branch);
            fieldErrors.year = validateField('year', formValues.year);
            fieldErrors.email = validateField('email', formValues.email);
            fieldErrors.phone = validateField('phone', formValues.phone);
            fieldErrors.linkedin = validateField('linkedin', formValues.linkedin);
            fieldErrors.github = validateField('github', formValues.github);
            fieldErrors.otherLink = validateField('otherLink', formValues.otherLink);

            const hasErrors = Object.values(fieldErrors).some(Boolean);
            if (hasErrors) {
                render(container);
                return;
            }

            isSubmitting = true;
            render(container);

            try {
                const response = await ICCSupabase.submitRegistration({
                    token: currentToken,
                    full_name: formValues.fullName.trim(),
                    usn: formValues.usn.trim().toUpperCase(),
                    branch: formValues.branch,
                    year: formValues.year,
                    email: formValues.email.trim().toLowerCase(),
                    phone: formValues.phone.trim(),
                    linkedin: formValues.linkedin.trim(),
                    github: formValues.github.trim(),
                    other_link: formValues.otherLink.trim(),
                    hp_company: formValues.hpCompany
                });

                isSubmitting = false;

                if (response && response.success) {
                    isSubmitted = true;
                    render(container);
                } else {
                    serverError = response?.error || 'Failed to submit registration request. Please check your information.';
                    render(container);
                }
            } catch (err) {
                isSubmitting = false;
                serverError = err.message || 'Network error occurred while submitting your request.';
                render(container);
            }
        });
    }

    return {
        mount,
        unmount
    };
})();
