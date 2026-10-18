/* ============================================
   ICC Social Hub — Profile Completion Modal (Mandatory Year & Branch)
   ============================================ */
const ProfileCompletionModal = (() => {
    let isOpen = false;
    let isSaving = false;

    const BRANCH_OPTIONS = [
        'AIML',
        'CSE',
        'Mech',
        'ICB',
        'CCE',
        'CSD',
        'ECE'
    ];

    const YEAR_OPTIONS = [
        '1st Year',
        '2nd Year',
        '3rd Year',
        '4th Year'
    ];

    function checkAndShow() {
        const user = ICCSupabase.getUser();
        const profile = ICCSupabase.getProfile();
        
        // Only check for logged-in users who have completed username onboarding
        if (!user || !profile || !profile.username) {
            close();
            return false;
        }

        // Mentors are advisors/faculty/industry guides, not students.
        // Super Admins are also administrative system accounts.
        // Neither mentors nor super admins should be prompted for student Year or Branch.
        const role = (profile.role || '').toLowerCase().trim();
        const isMentor = role === 'mentor' || profile.is_mentor === true;
        const isSuper = (typeof ICCSupabase.isSuperAdmin === 'function' && ICCSupabase.isSuperAdmin(profile));

        if (isMentor || isSuper) {
            close();
            return false;
        }

        // Check if year or branch is missing
        const missingYear = !profile.year || !profile.year.trim();
        const missingBranch = !profile.branch || !profile.branch.trim();

        if (missingYear || missingBranch) {
            open();
            return true;
        } else {
            close();
            return false;
        }
    }

    function open() {
        const profile = ICCSupabase.getProfile();
        const role = (profile?.role || '').toLowerCase().trim();
        const isMentor = role === 'mentor' || profile?.is_mentor === true;
        const isSuper = (typeof ICCSupabase.isSuperAdmin === 'function' && ICCSupabase.isSuperAdmin(profile));
        if (isMentor || isSuper) {
            close();
            return;
        }

        if (isOpen) return;
        isOpen = true;
        mount();
        document.body.style.overflow = 'hidden';
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        isSaving = false;
        const root = document.getElementById('profile-completion-modal-root');
        if (root) root.innerHTML = '';
        document.body.style.overflow = '';
    }

    function render() {
        if (!isOpen) return '';

        const profile = ICCSupabase.getProfile() || {};
        const currentYear = profile.year || '';
        const currentBranch = profile.branch || '';

        return `
        <div class="fixed inset-0 z-[9999] bg-zinc-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in" id="profile-completion-overlay">
            <div class="glass-card w-full max-w-md rounded-3xl p-6 md:p-8 border border-red-500/30 shadow-2xl shadow-red-950/40 relative overflow-hidden animate-slide-up">
                
                <!-- Background Accent Glow -->
                <div class="absolute -top-16 -right-16 w-40 h-40 bg-red-600/20 blur-[60px] pointer-events-none"></div>
                <div class="absolute -bottom-16 -left-16 w-40 h-40 bg-rose-600/10 blur-[60px] pointer-events-none"></div>

                <!-- Header -->
                <div class="text-center space-y-2 mb-6">
                    <div class="w-14 h-14 bg-gradient-to-br from-red-600 to-rose-700 rounded-2xl flex items-center justify-center font-heading font-bold text-lg text-white shadow-xl shadow-red-900/30 mx-auto mb-3">
                        <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                        </svg>
                    </div>
                    <h2 class="font-heading font-bold text-xl text-white">Action Required: Profile Details</h2>
                    <p class="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                        Please select your <span class="text-white font-semibold">Year</span> and <span class="text-white font-semibold">Branch</span> to access ICC Social Hub features.
                    </p>
                </div>

                <!-- Form -->
                <form id="profile-completion-form" class="space-y-4">
                    
                    <!-- Year Select -->
                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                            <span>Academic Year <span class="text-red-400">*</span></span>
                            <span class="text-[10px] text-zinc-500 font-normal">Required</span>
                        </label>
                        <select id="completion-year-select" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-red-500 transition-colors" required>
                            <option value="" disabled ${!currentYear ? 'selected' : ''}>-- Select Year --</option>
                            ${YEAR_OPTIONS.map(y => `<option value="${y}" ${currentYear === y ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Branch Select -->
                    <div>
                        <label class="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                            <span>Engineering Branch <span class="text-red-400">*</span></span>
                            <span class="text-[10px] text-zinc-500 font-normal">Required</span>
                        </label>
                        <select id="completion-branch-select" class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-red-500 transition-colors" required>
                            <option value="" disabled ${!currentBranch ? 'selected' : ''}>-- Select Branch --</option>
                            ${BRANCH_OPTIONS.map(b => `<option value="${b}" ${currentBranch === b ? 'selected' : ''}>${b}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Submit Button -->
                    <div class="pt-2">
                        <button type="submit" id="completion-submit-btn" class="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-semibold text-sm rounded-xl shadow-xl shadow-red-950/50 transition-all flex items-center justify-center gap-2" ${isSaving ? 'disabled' : ''}>
                            ${isSaving ? '<div class="spinner spinner-sm mx-auto"></div> Saving...' : 'Save & Continue to Hub 🚀'}
                        </button>
                    </div>
                </form>

            </div>
        </div>`;
    }

    function mount() {
        let root = document.getElementById('profile-completion-modal-root');
        if (!root) {
            root = document.createElement('div');
            root.id = 'profile-completion-modal-root';
            document.body.appendChild(root);
        }
        root.innerHTML = render();
        if (isOpen) bindEvents();
    }

    function bindEvents() {
        const form = document.getElementById('profile-completion-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const yearSelect = document.getElementById('completion-year-select');
            const branchSelect = document.getElementById('completion-branch-select');
            const submitBtn = document.getElementById('completion-submit-btn');

            const year = yearSelect ? yearSelect.value : '';
            const branch = branchSelect ? branchSelect.value : '';

            if (!year || !branch) {
                Toast.error('Please select both your Year and Branch.');
                return;
            }

            isSaving = true;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<div class="spinner spinner-sm mx-auto"></div> Saving...';
            }

            try {
                const { data, error } = await ICCSupabase.updateProfile({ year, branch });
                if (error) throw error;

                Toast.success('Profile details saved! Welcome to ICC Hub.');
                close();

                if (typeof BottomNav !== 'undefined' && BottomNav.mount) BottomNav.mount();
                if (window.location.hash === '#profile' && typeof ProfileView !== 'undefined' && ProfileView.mount) {
                    const container = document.getElementById('app');
                    if (container) ProfileView.mount(container);
                }
            } catch (err) {
                Toast.error('Failed to update profile: ' + err.message);
                isSaving = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Save & Continue to Hub 🚀';
                }
            }
        });
    }

    return {
        checkAndShow,
        open,
        close,
        BRANCH_OPTIONS,
        YEAR_OPTIONS
    };
})();
