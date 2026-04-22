/* ============================================
   ICC Social Hub — Auth Modal (Google + OTP)
   ============================================ */
const AuthModal = (() => {
    let isOpen = false;
    let step = 'main'; // main, otp-sent, verifying
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
                            <h2 class="font-heading font-bold text-lg">${step === 'main' ? 'Join ICC' : 'Verify Email'}</h2>
                            <p class="text-xs text-zinc-500">Innovation Social Hub</p>
                        </div>
                    </div>
                </div>
                <div class="px-6 pb-6">
                    ${step === 'main' ? renderMain() : renderOTP()}
                </div>
            </div>
        </div>`;
    }

    function renderMain() {
        return `
        <button id="google-login-btn" class="google-btn mb-4" ${loading ? 'disabled' : ''}>
            <svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
        </button>
        <div class="divider-or my-4">or</div>
        <form id="otp-email-form" class="space-y-3">
            <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1.5">Email address</label>
                <input type="email" id="auth-email" placeholder="you@example.com" required class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600">
            </div>
            ${errorMsg ? `<div class="px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-lg"><p class="text-sm text-red-400">${errorMsg}</p></div>` : ''}
            <button type="submit" class="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 border border-zinc-700" ${loading ? 'disabled' : ''}>
                ${loading ? '<div class="spinner spinner-sm"></div>' : 'Send Login Code'}
            </button>
        </form>
        <p class="text-[11px] text-zinc-600 text-center mt-4">By signing in, you agree to ICC's community guidelines</p>`;
    }

    function renderOTP() {
        return `
        <div class="text-center mb-5">
            <div class="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg class="w-6 h-6 text-crimson" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
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
                ${loading ? '<div class="spinner spinner-sm"></div>' : 'Verify & Sign In'}
            </button>
        </form>
        <button id="otp-back-btn" class="w-full mt-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Use a different email</button>`;
    }

    function mount() {
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = render();
        if (isOpen) bindEvents();
    }

    function bindEvents() {
        document.getElementById('auth-close')?.addEventListener('click', close);
        document.getElementById('auth-overlay')?.addEventListener('click', e => { if (e.target.id === 'auth-overlay') close(); });

        // Google login
        document.getElementById('google-login-btn')?.addEventListener('click', async () => {
            loading = true; mount();
            const { error } = await ICCSupabase.signInWithGoogle();
            if (error) { loading = false; errorMsg = error.message; mount(); }
        });

        // OTP email form
        document.getElementById('otp-email-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            email = document.getElementById('auth-email')?.value?.trim();
            if (!email) { errorMsg = 'Enter your email'; mount(); return; }
            loading = true; errorMsg = ''; mount();
            const { error } = await ICCSupabase.sendOTP(email);
            loading = false;
            if (error) { errorMsg = error.message; mount(); }
            else { step = 'otp-sent'; mount(); setupOTPInputs(); }
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
