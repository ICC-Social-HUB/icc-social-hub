/* ============================================
   ICC Social Hub — Join Team Modal
   Collects summary and DISC tag for join requests
   ============================================ */
const JoinTeamModal = (() => {
    let isOpen = false;
    let loading = false;
    let currentTeam = null;

    function open(team) { 
        isOpen = true; 
        loading = false; 
        currentTeam = team;
        try {
            if (!window.history.state?.modalOpen) {
                window.history.pushState({ modalOpen: true, modal: 'join-team' }, '');
            }
        } catch (e) {}
        mount(); 
        document.body.style.overflow = 'hidden'; 
    }

    function close() {
        isOpen = false;
        const root = document.getElementById('modal-root');
        if (root) root.innerHTML = '';
        document.body.style.overflow = '';
    }

    function render() {
        if (!isOpen || !currentTeam) return '';
        return `
        <div class="modal-backdrop fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4" id="join-team-overlay">
            <div class="modal-content bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                <div class="p-6">
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">Project Application</span>
                            <h3 class="font-heading font-bold text-xl text-white">${currentTeam.project_name || currentTeam.team}</h3>
                            <p class="text-zinc-400 text-xs mt-1">Team: <span class="text-zinc-300 font-semibold">${currentTeam.team}</span> · Lead: <span class="text-zinc-300 font-medium">${currentTeam.name}${ICC_CONFIG.VERIFIED_TICK}</span></p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" id="join-modal-back-btn" class="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer" title="Go Back">
                                <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                                <span>Back</span>
                            </button>
                            <button type="button" id="join-modal-close" class="p-2 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer" title="Close">
                                <svg class="w-5 h-5 text-zinc-500 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                    </div>

                    <form id="join-team-form" class="space-y-5">
                        <!-- Summary -->
                        <div>
                            <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Short Summary (Compulsory)</label>
                            <textarea id="join-summary" required placeholder="Tell us about your skills, interests, and why you want to join..." 
                                class="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white placeholder-zinc-700 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 outline-none transition-all resize-none h-32"></textarea>
                        </div>

                        <!-- DISC Tag -->
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">DISC Personality (Choose One)</label>
                                <a href="https://share.google/NP4CxZ5kDxJoMuxd0" target="_blank" class="text-[10px] text-red-400 hover:text-red-300 underline underline-offset-2">Source: DISC Personality Testing</a>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <label class="disc-option relative">
                                    <input type="radio" name="disc-tag" value="Dominant" required class="peer sr-only">
                                    <div class="p-3 border border-zinc-800 rounded-xl text-center cursor-pointer hover:bg-zinc-800/50 peer-checked:border-red-500 peer-checked:bg-red-500/10 transition-all">
                                        <p class="text-xs font-bold text-zinc-300 peer-checked:text-red-400">Dominant</p>
                                        <p class="text-[9px] text-zinc-600">Active / Task-oriented</p>
                                    </div>
                                </label>
                                <label class="disc-option relative">
                                    <input type="radio" name="disc-tag" value="Inspiring" class="peer sr-only">
                                    <div class="p-3 border border-zinc-800 rounded-xl text-center cursor-pointer hover:bg-zinc-800/50 peer-checked:border-red-500 peer-checked:bg-red-500/10 transition-all">
                                        <p class="text-xs font-bold text-zinc-300 peer-checked:text-red-400">Inspiring</p>
                                        <p class="text-[9px] text-zinc-600">Active / People-oriented</p>
                                    </div>
                                </label>
                                <label class="disc-option relative">
                                    <input type="radio" name="disc-tag" value="Supportive" class="peer sr-only">
                                    <div class="p-3 border border-zinc-800 rounded-xl text-center cursor-pointer hover:bg-zinc-800/50 peer-checked:border-red-500 peer-checked:bg-red-500/10 transition-all">
                                        <p class="text-xs font-bold text-zinc-300 peer-checked:text-red-400">Supportive</p>
                                        <p class="text-[9px] text-zinc-600">Thoughtful / People-oriented</p>
                                    </div>
                                </label>
                                <label class="disc-option relative">
                                    <input type="radio" name="disc-tag" value="Cautious" class="peer sr-only">
                                    <div class="p-3 border border-zinc-800 rounded-xl text-center cursor-pointer hover:bg-zinc-800/50 peer-checked:border-red-500 peer-checked:bg-red-500/10 transition-all">
                                        <p class="text-xs font-bold text-zinc-300 peer-checked:text-red-400">Cautious</p>
                                        <p class="text-[9px] text-zinc-600">Thoughtful / Task-oriented</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <button type="submit" id="join-submit-btn" class="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 transition-all active:scale-[0.98] disabled:opacity-50" ${loading ? 'disabled' : ''}>
                            ${loading ? '<div class="spinner spinner-sm mx-auto"></div>' : `Send Project Application`}
                        </button>
                    </form>
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
        document.getElementById('join-modal-back-btn')?.addEventListener('click', close);
        document.getElementById('join-modal-close')?.addEventListener('click', close);
        document.getElementById('join-team-overlay')?.addEventListener('click', e => { if (e.target.id === 'join-team-overlay') close(); });

        const form = document.getElementById('join-team-form');
        form?.addEventListener('submit', handleSubmit);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const summary = document.getElementById('join-summary').value.trim();
        const discTag = document.querySelector('input[name="disc-tag"]:checked')?.value;

        if (!summary) { Toast.error('Please provide a small summary'); return; }
        if (!discTag) { Toast.error('Please select your DISC personality tag'); return; }

        loading = true;
        mount();

        const { error } = await ICCSupabase.joinTeam(currentTeam.id, summary, discTag);
        
        if (error) {
            Toast.error('Failed to send request: ' + error.message);
            loading = false;
            mount();
        } else {
            Toast.success(`Project application sent! The Project Lead will review it shortly.`);
            close();
            // Refresh the teams view
            const app = document.getElementById('app');
            if (window.TeamsView) {
                window.TeamsView.mount(app, currentTeam.id);
            }
        }
    }

    return { open, close };
})();
