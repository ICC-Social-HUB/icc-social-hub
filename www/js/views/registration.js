/* ========================================================
   ICC Social Hub — Public Student Registration View
   Accessed strictly via private tokenized link: #join/<token>
   ======================================================== */
const RegistrationView = (() => {
    let currentToken = '';
    let isValidating = true;
    let isLinkValid = false;
    let linkInvalidReason = ''; // 'invalid', 'expired', 'disabled'
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
        setNoIndexMeta(true);
        currentToken = token || '';
        isValidating = true;
        isLinkValid = false;
        linkInvalidReason = '';
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
            } else {
                isLinkValid = false;
                linkInvalidReason = check?.reason || 'invalid';
            }
        } catch (e) {
            isValidating = false;
            isLinkValid = false;
            linkInvalidReason = 'error';
        }

        render(container);
    }

    function unmount() {
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

        if (isValidating) {
            container.innerHTML = `
            <div class="min-h-[85vh] flex flex-col items-center justify-center p-4">
                <div class="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                    <div class="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p class="text-xs text-zinc-400 font-mono tracking-wider">Verifying registration link...</p>
            </div>`;
            return;
        }

        if (!isLinkValid) {
            container.innerHTML = `
            <div class="min-h-[85vh] flex flex-col items-center justify-center p-4 text-center max-w-md mx-auto animate-fade-in">
                <div class="w-16 h-16 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center text-2xl text-zinc-400 mb-5 shadow-inner">
                    🔒
                </div>
                <h2 class="font-heading font-bold text-xl text-white mb-2">Registration Link Inactive</h2>
                <p class="text-sm text-zinc-400 leading-relaxed mb-6">
                    This registration link is not active. Please contact your admin.
                </p>
                <div class="p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80 text-xs text-zinc-500 w-full">
                    Invitation links may be single-use, disabled, or expired. Ask your club administrator or mentor for an updated registration link.
                </div>
                <a href="#feed" class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all">
                    Return to Public Portal
                </a>
            </div>`;
            return;
        }

        if (isSubmitted) {
            container.innerHTML = `
            <div class="min-h-[85vh] flex flex-col items-center justify-center p-4 max-w-lg mx-auto animate-fade-in">
                <div class="w-full bg-[#121820] border border-[#242f3d] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                    <div class="absolute -top-12 -right-12 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div class="flex items-center gap-3.5 mb-6">
                        <div class="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl font-bold">
                            ✓
                        </div>
                        <div>
                            <h2 class="font-heading font-bold text-xl text-white">Application Received</h2>
                            <p class="text-xs text-zinc-400">Innovators Creators Club (ICC)</p>
                        </div>
                    </div>

                    <p class="text-sm text-zinc-300 leading-relaxed mb-6">
                        Thank you, <strong class="text-white">${escapeHtml(formValues.fullName)}</strong>. Your registration details for USN <code class="text-sky-400 font-mono">${escapeHtml(formValues.usn)}</code> have been recorded.
                    </p>

                    <!-- What Happens Next Timeline -->
                    <div class="bg-[#0b1017] border border-[#1e293b] rounded-xl p-5 mb-6">
                        <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                            <span>⏱️</span> What Happens Next
                        </h3>
                        <div class="space-y-4 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800">
                            <!-- Step 1 -->
                            <div class="flex items-start gap-3 relative">
                                <div class="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0 z-10">
                                    ✓
                                </div>
                                <div class="pt-0.5">
                                    <h4 class="text-xs font-semibold text-white">1. Request submitted</h4>
                                    <p class="text-[11px] text-zinc-400 mt-0.5">Your application has been logged into the review queue.</p>
                                </div>
                            </div>

                            <!-- Step 2 -->
                            <div class="flex items-start gap-3 relative">
                                <div class="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center text-xs font-bold flex-shrink-0 z-10 animate-pulse">
                                    2
                                </div>
                                <div class="pt-0.5">
                                    <h4 class="text-xs font-semibold text-sky-300">2. Under review</h4>
                                    <p class="text-[11px] text-zinc-400 mt-0.5">Our review team will verify your student credentials.</p>
                                </div>
                            </div>

                            <!-- Step 3 -->
                            <div class="flex items-start gap-3 relative">
                                <div class="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 flex items-center justify-center text-xs font-bold flex-shrink-0 z-10">
                                    3
                                </div>
                                <div class="pt-0.5">
                                    <h4 class="text-xs font-semibold text-zinc-400">3. Final decision via email</h4>
                                    <p class="text-[11px] text-zinc-500 mt-0.5">You will receive an official notification at <span class="text-zinc-300 font-mono">${escapeHtml(formValues.email)}</span> with your login instructions.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="text-center">
                        <a href="#feed" class="w-full inline-block py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all">
                            Explore Public Community Feed
                        </a>
                    </div>
                </div>
            </div>`;
            return;
        }

        // Render Registration Form
        container.innerHTML = `
        <section class="min-h-screen py-10 px-4 sm:px-6">
            <div class="max-w-2xl mx-auto">
                <!-- Header -->
                <div class="mb-8 text-center sm:text-left">
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium mb-3">
                        <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
                        Private Member Registration
                    </div>
                    <h1 class="font-heading font-bold text-2xl sm:text-3xl text-white tracking-tight">Join Innovators Creators Club</h1>
                    <p class="text-xs sm:text-sm text-zinc-400 mt-1 max-w-lg">
                        Submit your student credentials to request access to the ICC Social Hub and project workforce.
                    </p>
                </div>

                ${serverError ? `
                <div class="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-3 animate-fade-in">
                    <span class="text-base flex-shrink-0">⚠️</span>
                    <div class="flex-1">
                        <strong class="font-semibold block mb-0.5">Submission Error</strong>
                        <span>${escapeHtml(serverError)}</span>
                    </div>
                </div>
                ` : ''}

                <!-- Registration Form -->
                <form id="public-registration-form" class="space-y-6">
                    <!-- Honeypot anti-spam field -->
                    <div style="position: absolute; left: -9999px; top: -9999px;" aria-hidden="true">
                        <input type="text" name="hp_company" id="hp-company" tabindex="-1" autocomplete="off" value="${escapeHtml(formValues.hpCompany)}">
                    </div>

                    <!-- Section 1: Personal Details -->
                    <div class="bg-[#121820] border border-[#242f3d] rounded-2xl p-5 sm:p-6 shadow-sm">
                        <div class="flex items-center gap-2.5 pb-4 mb-4 border-b border-zinc-800/80">
                            <span class="w-6 h-6 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center text-xs font-bold">1</span>
                            <h2 class="font-heading font-semibold text-sm text-white">Personal Details</h2>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div class="sm:col-span-2">
                                <label class="block text-xs font-medium text-zinc-300 mb-1.5">
                                    Full Legal Name <span class="text-red-400">*</span>
                                </label>
                                <input type="text" id="reg-name" required placeholder="e.g. Aditi Sharma"
                                    class="w-full px-3.5 py-2.5 bg-[#0b1017] border ${fieldErrors.fullName ? 'border-red-500 focus:border-red-500' : 'border-[#1e293b] focus:border-sky-500'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                                    value="${escapeHtml(formValues.fullName)}">
                                ${fieldErrors.fullName ? `<p class="text-[11px] text-red-400 mt-1">${escapeHtml(fieldErrors.fullName)}</p>` : ''}
                            </div>

                            <div>
                                <label class="block text-xs font-medium text-zinc-300 mb-1.5">
                                    Email Address <span class="text-red-400">*</span>
                                </label>
                                <input type="email" id="reg-email" required placeholder="you@college.edu or personal"
                                    class="w-full px-3.5 py-2.5 bg-[#0b1017] border ${fieldErrors.email ? 'border-red-500 focus:border-red-500' : 'border-[#1e293b] focus:border-sky-500'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                                    value="${escapeHtml(formValues.email)}">
                                ${fieldErrors.email ? `<p class="text-[11px] text-red-400 mt-1">${escapeHtml(fieldErrors.email)}</p>` : `<p class="text-[10px] text-zinc-500 mt-1">Decision and login details will be sent here</p>`}
                            </div>

                            <div>
                                <label class="block text-xs font-medium text-zinc-300 mb-1.5">
                                    Phone Number (10 digits) <span class="text-red-400">*</span>
                                </label>
                                <input type="tel" id="reg-phone" required placeholder="e.g. 9876543210" maxlength="10"
                                    class="w-full px-3.5 py-2.5 bg-[#0b1017] border ${fieldErrors.phone ? 'border-red-500 focus:border-red-500' : 'border-[#1e293b] focus:border-sky-500'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-colors font-mono"
                                    value="${escapeHtml(formValues.phone)}">
                                ${fieldErrors.phone ? `<p class="text-[11px] text-red-400 mt-1">${escapeHtml(fieldErrors.phone)}</p>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Section 2: Academic Details -->
                    <div class="bg-[#121820] border border-[#242f3d] rounded-2xl p-5 sm:p-6 shadow-sm">
                        <div class="flex items-center gap-2.5 pb-4 mb-4 border-b border-zinc-800/80">
                            <span class="w-6 h-6 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center text-xs font-bold">2</span>
                            <h2 class="font-heading font-semibold text-sm text-white">Academic Details</h2>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-xs font-medium text-zinc-300 mb-1.5">
                                    College USN <span class="text-red-400">*</span>
                                </label>
                                <input type="text" id="reg-usn" required placeholder="e.g. 1KS25AI109" maxlength="10"
                                    class="w-full px-3.5 py-2.5 bg-[#0b1017] border ${fieldErrors.usn ? 'border-red-500 focus:border-red-500' : 'border-[#1e293b] focus:border-sky-500'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-colors uppercase font-mono tracking-wider font-semibold"
                                    value="${escapeHtml(formValues.usn)}">
                                ${fieldErrors.usn ? `<p class="text-[11px] text-red-400 mt-1">${escapeHtml(fieldErrors.usn)}</p>` : `<p class="text-[10px] text-zinc-500 mt-1">Official VTU / College ID</p>`}
                            </div>

                            <div>
                                <label class="block text-xs font-medium text-zinc-300 mb-1.5">
                                    Branch / Department <span class="text-red-400">*</span>
                                </label>
                                <select id="reg-branch" required
                                    class="w-full px-3.5 py-2.5 bg-[#0b1017] border ${fieldErrors.branch ? 'border-red-500 focus:border-red-500' : 'border-[#1e293b] focus:border-sky-500'} rounded-xl text-xs sm:text-sm text-white outline-none transition-colors cursor-pointer">
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
                                ${fieldErrors.branch ? `<p class="text-[11px] text-red-400 mt-1">${escapeHtml(fieldErrors.branch)}</p>` : ''}
                            </div>

                            <div>
                                <label class="block text-xs font-medium text-zinc-300 mb-1.5">
                                    Current Year <span class="text-red-400">*</span>
                                </label>
                                <select id="reg-year" required
                                    class="w-full px-3.5 py-2.5 bg-[#0b1017] border ${fieldErrors.year ? 'border-red-500 focus:border-red-500' : 'border-[#1e293b] focus:border-sky-500'} rounded-xl text-xs sm:text-sm text-white outline-none transition-colors cursor-pointer">
                                    <option value="" disabled ${!formValues.year ? 'selected' : ''}>Select Year</option>
                                    <option value="1st Year" ${formValues.year === '1st Year' ? 'selected' : ''}>1st Year</option>
                                    <option value="2nd Year" ${formValues.year === '2nd Year' ? 'selected' : ''}>2nd Year</option>
                                    <option value="3rd Year" ${formValues.year === '3rd Year' ? 'selected' : ''}>3rd Year</option>
                                    <option value="4th Year" ${formValues.year === '4th Year' ? 'selected' : ''}>4th Year</option>
                                </select>
                                ${fieldErrors.year ? `<p class="text-[11px] text-red-400 mt-1">${escapeHtml(fieldErrors.year)}</p>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Section 3: Links (Optional) -->
                    <div class="bg-[#121820] border border-[#242f3d] rounded-2xl p-5 sm:p-6 shadow-sm">
                        <div class="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800/80">
                            <div class="flex items-center gap-2.5">
                                <span class="w-6 h-6 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center text-xs font-bold">3</span>
                                <h2 class="font-heading font-semibold text-sm text-white">Online Profiles</h2>
                            </div>
                            <span class="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Optional</span>
                        </div>

                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-medium text-zinc-300 mb-1.5">LinkedIn Profile</label>
                                <input type="url" id="reg-linkedin" placeholder="https://linkedin.com/in/username"
                                    class="w-full px-3.5 py-2.5 bg-[#0b1017] border ${fieldErrors.linkedin ? 'border-red-500 focus:border-red-500' : 'border-[#1e293b] focus:border-sky-500'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                                    value="${escapeHtml(formValues.linkedin)}">
                                ${fieldErrors.linkedin ? `<p class="text-[11px] text-red-400 mt-1">${escapeHtml(fieldErrors.linkedin)}</p>` : ''}
                            </div>

                            <div>
                                <label class="block text-xs font-medium text-zinc-300 mb-1.5">GitHub Profile</label>
                                <input type="url" id="reg-github" placeholder="https://github.com/username"
                                    class="w-full px-3.5 py-2.5 bg-[#0b1017] border ${fieldErrors.github ? 'border-red-500 focus:border-red-500' : 'border-[#1e293b] focus:border-sky-500'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                                    value="${escapeHtml(formValues.github)}">
                                ${fieldErrors.github ? `<p class="text-[11px] text-red-400 mt-1">${escapeHtml(fieldErrors.github)}</p>` : ''}
                            </div>

                            <div>
                                <label class="block text-xs font-medium text-zinc-300 mb-1.5">Portfolio or Other Link</label>
                                <input type="url" id="reg-other" placeholder="https://yourportfolio.dev"
                                    class="w-full px-3.5 py-2.5 bg-[#0b1017] border ${fieldErrors.otherLink ? 'border-red-500 focus:border-red-500' : 'border-[#1e293b] focus:border-sky-500'} rounded-xl text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                                    value="${escapeHtml(formValues.otherLink)}">
                                ${fieldErrors.otherLink ? `<p class="text-[11px] text-red-400 mt-1">${escapeHtml(fieldErrors.otherLink)}</p>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Submit Button -->
                    <div class="pt-2">
                        <button type="submit" id="reg-submit-btn" ${isSubmitting ? 'disabled' : ''}
                            class="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:scale-[0.99] text-white font-heading font-semibold text-sm transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                            ${isSubmitting ? `
                                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Submitting Application...</span>
                            ` : `
                                <span>Submit Registration Request</span>
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            `}
                        </button>
                        <p class="text-[11px] text-zinc-500 text-center mt-3">
                            🔒 Your submitted details are kept confidential and used solely for ICC club administration.
                        </p>
                    </div>
                </form>
            </div>
        </section>`;

        bindFormEvents(container);
    }

    function bindFormEvents(container) {
        const form = document.getElementById('public-registration-form');
        if (!form) return;

        // Two-way sync on input
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

            // Run validation on all fields
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
