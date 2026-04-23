/* ============================================
   ICC Social Hub — Auth Modal (OTP Signup, Password Login)
   Access restricted to approved emails.
   ============================================ */
const AuthModal = (() => {
    let isOpen = false;
    let step = 'main'; // main, otp-sent, set-password
    let authMode = 'login'; // login, signup
    let email = '';
    let loading = false;
    let errorMsg = '';

    function open() {
        isOpen = true; step = 'main'; email = ''; loading = false; errorMsg = '';
        mount(); document.body.style.overflow = 'hidden';
    }
    function close() {
        isOpen = false; errorMsg = ''; loading = false;
        mount(); document.body.style.overflow = '';
    }

    function render() {
        if (!isOpen) return '';
        let title = 'Join ICC';
        if (step === 'otp-sent') title = 'Verify Email';
        if (step === 'set-password') title = 'Create Password';

        return `
        <div class="modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4" id="auth-overlay">
            <div class="modal-content bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div class="relative p-6 pb-4">
                    <button id="auth-close" class="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    <div class="flex items-center gap-3 mb-1">
                        <div class="w-10 h-10 bg-gradient-to-br from-red-600 to-rose-700 rounded-xl flex items-center justify-center font-heading font-bold text-sm">ICC</div>
                        <div>
                            <h2 class="font-heading font-bold text-lg">${title}</h2>
                            <p class="text-xs text-zinc-500">Innovation Social Hub</p>
                        </div>
                    </div>
                </div>
                <div class="px-6 pb-6">
                    ${renderContent()}
                </div>
            </div>
        </div>`;
    }

    function renderContent() {
        if (step === 'otp-sent') return renderOTP();
        if (step === 'set-password') return renderSetPassword();
        return renderMain();
    }

    function renderMain() {
        return `
        <div class="flex gap-2 mb-4 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button type="button" id="tab-login" class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${authMode === 'login' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}">Log In</button>
            <button type="button" id="tab-signup" class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${authMode === 'signup' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}">Sign Up</button>
        </div>
        <div class="px-3 py-2.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl mb-4">
            <p class="text-[11px] text-zinc-400 text-center">🔒 Access is restricted to approved ICC members only</p>
        </div>
        <form id="auth-form" class="space-y-3">
            ${authMode === 'signup' ? `
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Full Name</label>
                <input type="text" id="auth-name" placeholder="John Doe" required class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600">
            </div>
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Username</label>
                <input type="text" id="auth-username" placeholder="johndoe" required pattern="[a-zA-Z0-9_]+" minlength="3" maxlength="20" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600">
            </div>` : ''}
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Email address</label>
                <input type="email" id="auth-email" placeholder="you@example.com" value="${email}" required class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600">
            </div>
            ${authMode === 'login' ? `
            <div>
                <div class="flex items-center justify-between mb-1.5">
                    <label class="block text-xs font-medium text-zinc-400">Password</label>
                    <button type="button" class="text-[10px] text-zinc-500 hover:text-white transition-colors" onclick="Toast.info('Contact admin to reset password')">Forgot?</button>
                </div>
                <input type="password" id="auth-password" placeholder="••••••••" required class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600">
            </div>` : ''}
            ${errorMsg ? `<div class="px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-lg"><p class="text-sm text-red-400">${errorMsg}</p></div>` : ''}
            <button type="submit" class="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 border border-zinc-700" ${loading ? 'disabled' : ''}>
                ${loading ? '<div class="spinner spinner-sm"></div>' : (authMode === 'login' ? 'Sign In' : 'Send Code')}
            </button>
        </form>
        <p class="text-[11px] text-zinc-600 text-center mt-4">By signing in, you agree to ICC's community guidelines</p>`;
    }

    function renderOTP() {
        return `
        <div class="text-center mb-5">
            <div class="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <p class="text-sm text-zinc-400">We sent a 6-digit code to</p>
            <p class="text-sm font-semibold text-white mt-1">${email}</p>
        </div>
        <form id="otp-verify-form" class="space-y-4">
            <div class="flex justify-center gap-2" id="otp-inputs">
                ${[0,1,2,3,4,5].map(i => `<input type="text" maxlength="1" class="otp-input" data-idx="${i}" inputmode="numeric" autocomplete="one-time-code">`).join('')}
            </div>
            ${errorMsg ? `<div class="px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-lg"><p class="text-sm text-red-400">${errorMsg}</p></div>` : ''}
            <button type="submit" class="w-full py-3 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50" ${loading ? 'disabled' : ''}>
                ${loading ? '<div class="spinner spinner-sm"></div>' : 'Verify Code'}
            </button>
        </form>
        <button id="otp-back-btn" class="w-full mt-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Go back</button>`;
    }

    function renderSetPassword() {
        return `
        <div class="text-center mb-5">
            <div class="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg class="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
            <p class="text-sm text-zinc-400">One last step!</p>
            <p class="text-xs text-zinc-500 mt-1">Create a password for your next login</p>
        </div>
        <form id="set-password-form" class="space-y-3">
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">New Password</label>
                <input type="password" id="new-password" placeholder="Min 6 characters" required minlength="6" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm">
            </div>
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Confirm Password</label>
                <input type="password" id="confirm-password" placeholder="Re-type password" required minlength="6" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm">
            </div>
            ${errorMsg ? `<div class="px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-lg"><p class="text-sm text-red-400">${errorMsg}</p></div>` : ''}
            <button type="submit" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50" ${loading ? 'disabled' : ''}>
                ${loading ? '<div class="spinner spinner-sm"></div>' : 'Set Password & Finish'}
            </button>
        </form>`;
    }

    function mount() {
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = render();
        if (isOpen) bindEvents();
    }

    function bindEvents() {
        document.getElementById('auth-close')?.addEventListener('click', close);
        document.getElementById('auth-overlay')?.addEventListener('click', e => { if (e.target.id === 'auth-overlay') close(); });

        document.getElementById('tab-login')?.addEventListener('click', () => { authMode = 'login'; errorMsg=''; mount(); });
        document.getElementById('tab-signup')?.addEventListener('click', () => { authMode = 'signup'; errorMsg=''; mount(); });

        // Main Auth Form (Login or Send OTP for Signup)
        document.getElementById('auth-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            email = document.getElementById('auth-email')?.value?.trim().toLowerCase();
            if (!email) { errorMsg = 'Enter your email'; mount(); return; }

            // Allowlist check
            if (!isEmailAllowed(email)) {
                errorMsg = 'This email is not registered for ICC access. Contact your admin.';
                mount();
                return;
            }

            if (authMode === 'login') {
                const password = document.getElementById('auth-password')?.value;
                if (!password) { errorMsg = 'Enter your password'; mount(); return; }
                loading = true; errorMsg = ''; mount();
                const { error } = await ICCSupabase.signInWithPassword(email, password);
                loading = false;
                if (error) { 
                    errorMsg = error.message; 
                    if (error.message.includes('Invalid login credentials')) {
                        errorMsg = 'Invalid email or password. If you haven\'t signed up yet, use the Sign Up tab.';
                    }
                    mount(); 
                }
                else { close(); handleAuthSuccess(); }
            } else {
                // Signup: Send OTP
                const name = document.getElementById('auth-name')?.value?.trim();
                const username = document.getElementById('auth-username')?.value?.trim().toLowerCase();
                if (!name || !username) { errorMsg = 'Fill all fields'; mount(); return; }
                
                loading = true; errorMsg = ''; mount();
                
                // Check if user already exists
                const existingProfile = await ICCSupabase.fetchProfileByEmail(email);
                if (existingProfile && existingProfile.username) {
                    // They already have an account!
                    if (username !== existingProfile.username.toLowerCase()) {
                        errorMsg = `You already have an account with username "${existingProfile.username}". Please use that to sign up/reset or just log in.`;
                        loading = false; mount(); return;
                    }
                    // If it matches, we can proceed to OTP (to reset password)
                } else {
                    // New user or missing username: check availability
                    const available = await ICCSupabase.checkUsernameAvailable(username, email);
                    if (!available) { errorMsg = 'Username is already taken by another member'; loading=false; mount(); return; }
                }
                
                const metadata = { full_name: name, username: username };
                const { error } = await ICCSupabase.sendOTP(email, metadata);
                loading = false;
                if (error) { errorMsg = error.message; mount(); }
                else { step = 'otp-sent'; mount(); setupOTPInputs(); }
            }
        });

        // OTP verify form
        document.getElementById('otp-verify-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const inputs = document.querySelectorAll('.otp-input');
            const code = Array.from(inputs).map(i => i.value).join('');
            if (code.length !== 6) { errorMsg = 'Enter the 6-digit code'; mount(); return; }
            
            loading = true; errorMsg = ''; mount();
            const { error } = await ICCSupabase.verifyOTP(email, code);
            loading = false;
            if (error) { errorMsg = error.message; mount(); setupOTPInputs(); }
            else { step = 'set-password'; mount(); }
        });

        // Set Password form
        document.getElementById('set-password-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const p1 = document.getElementById('new-password').value;
            const p2 = document.getElementById('confirm-password').value;
            if (p1 !== p2) { errorMsg = 'Passwords do not match'; mount(); return; }
            if (p1.length < 6) { errorMsg = 'Password must be at least 6 characters'; mount(); return; }

            loading = true; errorMsg = ''; mount();
            const { error } = await ICCSupabase.updatePassword(p1);
            loading = false;
            if (error) { errorMsg = error.message; mount(); }
            else { close(); handleAuthSuccess(); }
        });

        // Back to email
        document.getElementById('otp-back-btn')?.addEventListener('click', () => {
            step = 'main'; errorMsg = ''; mount();
        });

        // ESC key
        const escFn = e => { if (e.key === 'Escape' && isOpen) { close(); document.removeEventListener('keydown', escFn); } };
        document.addEventListener('keydown', escFn);

        if (step === 'otp-sent') setupOTPInputs();
    }

    function setupOTPInputs() {
        const inputs = document.querySelectorAll('.otp-input');
        inputs.forEach((inp, i) => {
            inp.addEventListener('input', e => {
                if (e.target.value && i < 5) inputs[i + 1].focus();
            });
            inp.addEventListener('keydown', e => {
                if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus();
            });
            inp.addEventListener('paste', e => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text').trim();
                for (let j = 0; j < Math.min(text.length, 6); j++) { inputs[j].value = text[j]; }
                if (text.length >= 6) inputs[5].focus();
            });
        });
        inputs[0]?.focus();
    }

    function handleAuthSuccess() {
        BottomNav.mount();
        if (ICCSupabase.needsOnboarding()) {
            window.location.hash = '#onboarding';
        } else {
            window.dispatchEvent(new Event('hashchange'));
        }
        Toast.success('Welcome to ICC! 🚀');
    }

    return { open, close, mount };
})();

