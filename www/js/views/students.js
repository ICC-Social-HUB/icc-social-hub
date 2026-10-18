/* ============================================
   ICC Social Hub — Students Directory View
   ============================================ */
const StudentsView = (() => {
    let container = null;
    let students = [];
    let mentors = [];
    let mentorTotalCount = 0;
    let totalCount = 0;
    let availableProjects = [];
    let isLoading = false;
    let errorMsg = null;
    let searchTimeout = null;

    // State initialized from URL query params or localStorage
    let state = {
        activeTab: 'students', // 'students' | 'mentors'
        mentorSearch: '',
        mentorDomainFilter: 'all',
        viewMode: 'list', // 'list' | 'grid'
        search: '',
        selectedProjects: [], // array of project IDs (strings/numbers)
        hasLinkedin: 'all', // 'all' | 'yes' | 'no'
        projectCount: 'all', // 'all' | '0' | '1' | '2' | '3+'
        branch: '',
        year: '',
        sort: 'name_asc', // 'name_asc' | 'name_desc' | 'most_projects' | 'recent'
        page: 1,
        pageSize: 24,
        totalPages: 1,
        filterDrawerOpen: false
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }

    function initFromUrlAndStorage() {
        const hash = window.location.hash || '';
        const queryIndex = hash.indexOf('?');
        const params = new URLSearchParams(queryIndex !== -1 ? hash.slice(queryIndex + 1) : '');

        state.activeTab = params.get('tab') === 'mentors' ? 'mentors' : 'students';
        state.mentorSearch = params.get('mq') || '';
        state.mentorDomainFilter = params.get('domain') || 'all';
        const savedView = localStorage.getItem('icc_students_view_mode');
        state.viewMode = params.get('view') || savedView || 'list';
        state.search = params.get('q') || '';
        state.hasLinkedin = params.get('linkedin') || 'all';
        state.projectCount = params.get('pcount') || 'all';
        state.branch = params.get('branch') || '';
        state.year = params.get('year') || '';
        state.sort = params.get('sort') || 'name_asc';
        state.page = parseInt(params.get('page'), 10) || 1;

        const projParam = params.get('projects');
        if (projParam) {
            state.selectedProjects = projParam.split(',').map(s => s.trim()).filter(Boolean);
        } else {
            state.selectedProjects = [];
        }
    }

    function syncStateToUrl() {
        const params = new URLSearchParams();
        if (state.activeTab !== 'students') params.set('tab', state.activeTab);
        if (state.mentorSearch) params.set('mq', state.mentorSearch);
        if (state.mentorDomainFilter !== 'all') params.set('domain', state.mentorDomainFilter);
        if (state.viewMode !== 'list') params.set('view', state.viewMode);
        if (state.search) params.set('q', state.search);
        if (state.selectedProjects.length > 0) params.set('projects', state.selectedProjects.join(','));
        if (state.hasLinkedin !== 'all') params.set('linkedin', state.hasLinkedin);
        if (state.projectCount !== 'all') params.set('pcount', state.projectCount);
        if (state.branch) params.set('branch', state.branch);
        if (state.year) params.set('year', state.year);
        if (state.sort !== 'name_asc') params.set('sort', state.sort);
        if (state.page > 1) params.set('page', state.page);

        const queryString = params.toString();
        const newHash = '#students' + (queryString ? '?' + queryString : '');
        if (window.location.hash !== newHash) {
            window.history.replaceState(null, '', newHash);
        }
    }

    async function mount(targetContainer) {
        container = targetContainer;
        initFromUrlAndStorage();
        renderShell();
        await loadData();
    }

    function unmount() {
        container = null;
        if (searchTimeout) clearTimeout(searchTimeout);
    }

    async function loadData() {
        isLoading = true;
        errorMsg = null;
        renderContent();

        try {
            const [res, mentorsRes] = await Promise.all([
                ICCSupabase.fetchStudentsDirectory({
                search: state.search,
                projectFilter: state.selectedProjects,
                hasLinkedin: state.hasLinkedin,
                projectCountFilter: state.projectCount,
                branch: state.branch,
                year: state.year,
                sort: state.sort,
                page: state.page,
                pageSize: state.pageSize
            }),
                typeof ICCSupabase.fetchMentorsDirectory === 'function' ? ICCSupabase.fetchMentorsDirectory() : []
            ]);
            if (Array.isArray(mentorsRes)) {
                mentors = mentorsRes;
                mentorTotalCount = mentors.length;
            }

            if (res && res.success) {
                students = res.students || [];
                totalCount = res.totalCount || 0;
                state.totalPages = res.totalPages || 1;
                if (res.availableProjects && res.availableProjects.length > 0) {
                    availableProjects = res.availableProjects;
                } else if (typeof CORE_LEADS !== 'undefined') {
                    availableProjects = CORE_LEADS.map(l => ({ id: l.id, name: l.team, avatar_url: l.avatar_url, initials: l.initials }));
                }
            } else {
                errorMsg = res?.error || 'Failed to load students directory';
            }
        } catch (err) {
            console.error('Error in loadData:', err);
            errorMsg = err.message || 'Network error occurred while fetching students';
        } finally {
            isLoading = false;
            renderContent();
            updateResultsCount();
            renderActiveFilterChips();
        }
    }

    function renderShell() {
        if (!container) return;
        const isMentorsTab = state.activeTab === 'mentors';

        container.innerHTML = `
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 min-h-[calc(100vh-4rem)] flex flex-col gap-6">
            <!-- Header Bar with Integrated Tab Switcher -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#1c2a38]">
                <div>
                    <div class="flex items-center gap-3">
                        <h1 class="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight">
                            ${isMentorsTab ? 'Mentors & Project Guides' : 'Students Directory'}
                        </h1>
                        <span id="students-badge-count" class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${isMentorsTab ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-[#3390ec]/15 text-[#3390ec] border border-[#3390ec]/30'}">
                            ${isMentorsTab ? mentors.length : totalCount}
                        </span>
                    </div>
                    <p class="text-sm text-[#708499] mt-1">
                        ${isMentorsTab 
                            ? 'Faculty advisors, technical guides, and industry mentors driving student innovation projects and milestone reviews.'
                            : 'Explore and connect with innovators, builders, and creators across all club projects.'}
                    </p>
                </div>

                <!-- Top Segmented Tabs: Students vs Mentors -->
                <div class="flex items-center p-1 bg-[#17212b] rounded-2xl self-start md:self-auto shadow-sm" role="tablist">
                    <button id="tab-students-btn" onclick="StudentsView.setActiveTab('students')" role="tab" aria-selected="${!isMentorsTab}"
                        class="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${!isMentorsTab ? 'bg-[#3390ec] text-white shadow-md shadow-[#3390ec]/20' : 'text-[#708499] hover:text-white'}">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                        <span>Students</span>
                        <span id="students-tab-badge" class="px-1.5 py-0.2 rounded-full text-[10px] ${!isMentorsTab ? 'bg-white/20 text-white' : 'bg-[#0e1621] text-[#708499]'} font-semibold">${totalCount}</span>
                    </button>
                    <button id="tab-mentors-btn" onclick="StudentsView.setActiveTab('mentors')" role="tab" aria-selected="${isMentorsTab}"
                        class="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${isMentorsTab ? 'bg-amber-500 text-zinc-950 font-extrabold shadow-md shadow-amber-500/20' : 'text-[#708499] hover:text-amber-400'}">
                        <span>🎓</span>
                        <span>Mentors</span>
                        <span id="mentors-tab-badge" class="px-1.5 py-0.2 rounded-full text-[10px] ${isMentorsTab ? 'bg-zinc-950/20 text-zinc-950 font-extrabold' : 'bg-amber-500/15 text-amber-400'} font-semibold">${mentors.length}</span>
                    </button>
                </div>
            </div>

            ${!isMentorsTab ? `
            <!-- Search Bar & Controls Bar for Students -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <!-- Search Input Container -->
                <div class="relative flex-1 max-w-xl">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#708499]">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </div>
                    <input type="text" id="students-search-input" value="${escapeHtml(state.search)}" 
                        placeholder="Search by student name, email, or project..." 
                        class="w-full pl-10 pr-10 py-2.5 bg-[#17212b] border border-[#1c2a38] focus:border-[#3390ec] rounded-xl text-sm text-white placeholder-[#708499] focus:outline-none transition-all shadow-inner" 
                        oninput="StudentsView.onSearchInput(this.value)" 
                        aria-label="Search students">
                    <button id="students-search-clear" onclick="StudentsView.clearSearch()" 
                        class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#708499] hover:text-white transition-colors cursor-pointer ${state.search ? '' : 'hidden'}" 
                        title="Clear search" aria-label="Clear search">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Sort & View Controls -->
                <div class="flex items-center gap-2.5 justify-between sm:justify-end">
                    <div class="flex items-center gap-2">
                        <label for="students-sort-select" class="text-xs text-[#708499] font-medium hidden md:inline">Sort by:</label>
                        <div class="relative">
                            <select id="students-sort-select" onchange="StudentsView.setSort(this.value)" 
                                class="appearance-none pl-3 pr-8 py-2 bg-[#17212b] border border-[#1c2a38] hover:border-[#2b394a] rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-[#3390ec] transition-all cursor-pointer">
                                <option value="name_asc" ${state.sort === 'name_asc' ? 'selected' : ''}>Name A–Z</option>
                                <option value="name_desc" ${state.sort === 'name_desc' ? 'selected' : ''}>Name Z–A</option>
                                <option value="most_projects" ${state.sort === 'most_projects' ? 'selected' : ''}>Most Projects</option>
                                <option value="recent" ${state.sort === 'recent' || state.sort === 'recently_joined' ? 'selected' : ''}>Recently Joined</option>
                            </select>
                            <div class="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[#708499]">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
                            </div>
                        </div>
                    </div>

                    <!-- View Mode Toggle (List / Grid) -->
                    <div class="flex items-center p-1 bg-[#17212b] rounded-xl border border-[#1c2a38]" role="group" aria-label="View Mode">
                        <button id="view-mode-list-btn" onclick="StudentsView.setViewMode('list')" 
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${state.viewMode === 'list' ? 'bg-[#3390ec] text-white shadow-sm' : 'text-[#708499] hover:text-white'}" 
                            title="List View" aria-label="Switch to List View" aria-pressed="${state.viewMode === 'list'}">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                            <span class="hidden sm:inline">List</span>
                        </button>
                        <button id="view-mode-grid-btn" onclick="StudentsView.setViewMode('grid')" 
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${state.viewMode === 'grid' ? 'bg-[#3390ec] text-white shadow-sm' : 'text-[#708499] hover:text-white'}" 
                            title="Grid View" aria-label="Switch to Grid View" aria-pressed="${state.viewMode === 'grid'}">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
                            </svg>
                            <span class="hidden sm:inline">Grid</span>
                        </button>
                    </div>

                    <!-- Filter Toggle Button -->
                    <button id="filter-toggle-btn" onclick="StudentsView.toggleFilterDrawer()" 
                        class="flex items-center gap-2 px-3.5 py-2 bg-[#242f3d] hover:bg-[#2b394a] text-white rounded-xl border border-[#1c2a38] text-xs font-semibold transition-all cursor-pointer shadow-sm relative active:scale-95" 
                        aria-label="Toggle Filters">
                        <svg class="w-4 h-4 text-[#3390ec]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.539.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.378-1.007.917-1.096A48.32 48.32 0 0112 3z" />
                        </svg>
                        <span>Filters</span>
                        <span id="active-filter-indicator" class="hidden w-2 h-2 rounded-full bg-[#3390ec] animate-pulse"></span>
                    </button>
                </div>
            </div>

            <!-- Active Filter Chips Bar -->
            <div id="students-active-chips" class="flex flex-wrap items-center gap-2 min-h-[1.5rem]"></div>

            <!-- Filter Drawer / Modal Panel -->
            <div id="students-filter-drawer" class="hidden p-5 bg-[#17212b] rounded-2xl border border-[#1c2a38] shadow-xl flex-col gap-5 animate-fade-in">
                <div class="flex items-center justify-between border-b border-[#1c2a38] pb-3">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-[#3390ec]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/></svg>
                        <h3 class="font-heading font-semibold text-white text-sm">Filter Students</h3>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="StudentsView.clearAllFilters()" class="text-xs text-[#708499] hover:text-[#3390ec] transition-colors cursor-pointer font-medium">Clear all</button>
                        <button onclick="StudentsView.toggleFilterDrawer()" class="p-1 text-[#708499] hover:text-white rounded-lg hover:bg-[#242f3d] transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <!-- Project Multi-Select -->
                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-semibold text-[#708499] uppercase tracking-wider">Project</label>
                        <div id="filter-projects-list" class="max-h-44 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar border border-[#1c2a38] bg-[#0e1621] p-2 rounded-xl">
                            <!-- Injected dynamically -->
                        </div>
                    </div>

                    <!-- Has LinkedIn Filter -->
                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-semibold text-[#708499] uppercase tracking-wider">Has LinkedIn</label>
                        <div class="grid grid-cols-3 gap-1.5 p-1 bg-[#0e1621] rounded-xl border border-[#1c2a38]">
                            <button onclick="StudentsView.setLinkedinFilter('all')" class="py-1.5 rounded-lg text-xs font-medium transition-all ${state.hasLinkedin === 'all' ? 'bg-[#3390ec] text-white shadow-sm' : 'text-[#708499] hover:text-white'}">All</button>
                            <button onclick="StudentsView.setLinkedinFilter('yes')" class="py-1.5 rounded-lg text-xs font-medium transition-all ${state.hasLinkedin === 'yes' ? 'bg-[#3390ec] text-white shadow-sm' : 'text-[#708499] hover:text-white'}">Yes</button>
                            <button onclick="StudentsView.setLinkedinFilter('no')" class="py-1.5 rounded-lg text-xs font-medium transition-all ${state.hasLinkedin === 'no' ? 'bg-[#3390ec] text-white shadow-sm' : 'text-[#708499] hover:text-white'}">No</button>
                        </div>
                    </div>

                    <!-- Project Count Filter -->
                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-semibold text-[#708499] uppercase tracking-wider">Projects Count</label>
                        <div class="grid grid-cols-4 gap-1 p-1 bg-[#0e1621] rounded-xl border border-[#1c2a38]">
                            <button onclick="StudentsView.setProjectCountFilter('all')" class="py-1.5 rounded-lg text-xs font-medium transition-all ${state.projectCount === 'all' ? 'bg-[#3390ec] text-white shadow-sm' : 'text-[#708499] hover:text-white'}">All</button>
                            <button onclick="StudentsView.setProjectCountFilter('0')" class="py-1.5 rounded-lg text-xs font-medium transition-all ${state.projectCount === '0' || state.projectCount === 'none' ? 'bg-[#3390ec] text-white shadow-sm' : 'text-[#708499] hover:text-white'}" title="No Projects">0</button>
                            <button onclick="StudentsView.setProjectCountFilter('1')" class="py-1.5 rounded-lg text-xs font-medium transition-all ${state.projectCount === '1' ? 'bg-[#3390ec] text-white shadow-sm' : 'text-[#708499] hover:text-white'}">1</button>
                            <button onclick="StudentsView.setProjectCountFilter('2')" class="py-1.5 rounded-lg text-xs font-medium transition-all ${state.projectCount === '2' ? 'bg-[#3390ec] text-white shadow-sm' : 'text-[#708499] hover:text-white'}">2</button>
                        </div>
                        <button onclick="StudentsView.setProjectCountFilter('3+')" class="py-1.5 px-3 rounded-lg text-xs font-medium transition-all text-center border border-[#1c2a38] ${state.projectCount === '3+' ? 'bg-[#3390ec] text-white' : 'bg-[#0e1621] text-[#708499] hover:text-white'}">3+ Projects</button>
                    </div>

                    <!-- Academic Branch & Year Filters -->
                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-semibold text-[#708499] uppercase tracking-wider">Academic Details</label>
                        <div class="space-y-2">
                            <input type="text" id="filter-branch-input" placeholder="Branch (e.g. CSE, ECE)" value="${escapeHtml(state.branch)}" 
                                onchange="StudentsView.setBranchFilter(this.value)" 
                                class="w-full px-3 py-1.5 bg-[#0e1621] border border-[#1c2a38] rounded-xl text-xs text-white placeholder-[#708499] focus:outline-none focus:border-[#3390ec]">
                            <input type="text" id="filter-year-input" placeholder="Year (e.g. 1st, 2nd, 3rd)" value="${escapeHtml(state.year)}" 
                                onchange="StudentsView.setYearFilter(this.value)" 
                                class="w-full px-3 py-1.5 bg-[#0e1621] border border-[#1c2a38] rounded-xl text-xs text-white placeholder-[#708499] focus:outline-none focus:border-[#3390ec]">
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#1c2a38]">
                    <button onclick="StudentsView.toggleFilterDrawer()" class="px-5 py-2 bg-[#3390ec] hover:bg-[#2b7cce] text-white text-xs font-semibold rounded-xl transition-all shadow-sm">Apply & Close</button>
                </div>
            </div>
            ` : `
            <!-- Mentors Controls Bar (Clean & Borderless) -->
            <div class="flex items-center gap-3">
                <div class="relative flex-1 max-w-md">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#708499]">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                    </div>
                    <input type="text" id="mentors-search-input" value="${escapeHtml(state.mentorSearch)}" 
                        placeholder="Search mentors..." 
                        class="w-full pl-10 pr-10 py-2.5 bg-[#17212b] rounded-xl text-sm text-white placeholder-[#708499] outline-none shadow-sm transition-all" 
                        oninput="StudentsView.onMentorSearchInput(this.value)">
                    <button onclick="StudentsView.clearMentorSearch()" 
                        class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#708499] hover:text-white transition-colors cursor-pointer ${state.mentorSearch ? '' : 'hidden'}" 
                        title="Clear search">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            `}

            <!-- Main Content Container (Students or Mentors) -->
            <div id="students-content-root" class="w-full flex-1 flex flex-col"></div>

            <!-- Pagination Bar (Only visible in students view) -->
            <div id="students-pagination-root" class="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-[#1c2a38] text-xs text-[#708499] ${isMentorsTab ? 'hidden' : ''}"></div>
        </section>
        `;

        if (!isMentorsTab) {
            renderProjectCheckboxes();
        }
    }

    function renderProjectCheckboxes() {
        const listEl = document.getElementById('filter-projects-list');
        if (!listEl) return;

        if (availableProjects.length === 0) {
            listEl.innerHTML = `<p class="text-xs text-[#708499] p-2">Loading projects...</p>`;
            return;
        }

        listEl.innerHTML = availableProjects.map(p => {
            const isChecked = state.selectedProjects.includes(String(p.id));
            return `
            <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#17212b] transition-colors cursor-pointer text-xs text-zinc-300">
                <input type="checkbox" value="${p.id}" ${isChecked ? 'checked' : ''} onchange="StudentsView.onToggleProjectFilter('${p.id}', this.checked)" class="rounded border-[#2b394a] text-[#3390ec] focus:ring-0 bg-[#17212b]">
                <span class="truncate">${escapeHtml(p.name)}</span>
            </label>
            `;
        }).join('');
    }

    function renderActiveFilterChips() {
        const root = document.getElementById('students-active-chips');
        const indicator = document.getElementById('active-filter-indicator');
        if (!root) return;

        const chips = [];

        if (state.search) {
            chips.push({
                label: `Search: "${state.search}"`,
                onRemove: `StudentsView.clearSearch()`
            });
        }

        if (state.hasLinkedin !== 'all') {
            chips.push({
                label: `LinkedIn: ${state.hasLinkedin === 'yes' ? 'Has Profile' : 'No Profile'}`,
                onRemove: `StudentsView.setLinkedinFilter('all')`
            });
        }

        if (state.projectCount !== 'all') {
            const countLabel = state.projectCount === '0' || state.projectCount === 'none' ? '0 projects' :
                state.projectCount === '3+' ? '3+ projects' : `${state.projectCount} project${state.projectCount === '1' ? '' : 's'}`;
            chips.push({
                label: `Count: ${countLabel}`,
                onRemove: `StudentsView.setProjectCountFilter('all')`
            });
        }

        if (state.branch) {
            chips.push({
                label: `Branch: ${state.branch}`,
                onRemove: `StudentsView.setBranchFilter('')`
            });
        }

        if (state.year) {
            chips.push({
                label: `Year: ${state.year}`,
                onRemove: `StudentsView.setYearFilter('')`
            });
        }

        state.selectedProjects.forEach(pid => {
            const proj = availableProjects.find(p => String(p.id) === String(pid));
            chips.push({
                label: `Project: ${proj ? proj.name : pid}`,
                onRemove: `StudentsView.onToggleProjectFilter('${pid}', false)`
            });
        });

        if (indicator) {
            if (chips.length > 0) indicator.classList.remove('hidden');
            else indicator.classList.add('hidden');
        }

        if (chips.length === 0) {
            root.innerHTML = '';
            return;
        }

        root.innerHTML = `
            <span class="text-xs text-[#708499] mr-1">Active filters:</span>
            ${chips.map(c => `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#1c2a38] text-white border border-[#2b394a]/80 shadow-sm">
                    <span>${escapeHtml(c.label)}</span>
                    <button onclick="${c.onRemove}" class="p-0.5 hover:text-[#ff3b30] rounded-full transition-colors cursor-pointer" aria-label="Remove filter">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </span>
            `).join('')}
            <button onclick="StudentsView.clearAllFilters()" class="text-xs text-[#3390ec] hover:underline font-semibold ml-2 cursor-pointer">
                Clear all filters
            </button>
        `;
    }

    function updateResultsCount() {
        const badge = document.getElementById('students-badge-count');
        if (badge) badge.textContent = totalCount;

        const pagRoot = document.getElementById('students-pagination-root');
        if (!pagRoot) return;

        if (totalCount === 0) {
            pagRoot.innerHTML = '';
            return;
        }

        const start = (state.page - 1) * state.pageSize + 1;
        const end = Math.min(state.page * state.pageSize, totalCount);

        pagRoot.innerHTML = `
            <div>
                Showing <span class="font-semibold text-white">${start}</span> to <span class="font-semibold text-white">${end}</span> of <span class="font-semibold text-white">${totalCount}</span> students
            </div>
            ${state.totalPages > 1 ? `
            <div class="flex items-center gap-1.5">
                <button onclick="StudentsView.goToPage(${state.page - 1})" ${state.page <= 1 ? 'disabled' : ''} 
                    class="px-3 py-1.5 rounded-lg border border-[#1c2a38] bg-[#17212b] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#242f3d] transition-all font-medium">
                    Previous
                </button>
                <div class="flex items-center gap-1 px-2 font-semibold text-white">
                    Page ${state.page} of ${state.totalPages}
                </div>
                <button onclick="StudentsView.goToPage(${state.page + 1})" ${state.page >= state.totalPages ? 'disabled' : ''} 
                    class="px-3 py-1.5 rounded-lg border border-[#1c2a38] bg-[#17212b] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#242f3d] transition-all font-medium">
                    Next
                </button>
            </div>
            ` : ''}
        `;
    }

    function renderContent() {
        const root = document.getElementById('students-content-root');
        if (!root) return;

        if (state.activeTab === 'mentors') {
            root.innerHTML = renderMentorsGrid();
            return;
        }

        if (isLoading) {
            root.innerHTML = state.viewMode === 'list' ? renderListSkeleton() : renderGridSkeleton();
            return;
        }

        if (errorMsg) {
            root.innerHTML = `
            <div class="flex flex-col items-center justify-center p-12 text-center bg-[#17212b] rounded-2xl border border-[#1c2a38] my-8 shadow-sm">
                <div class="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4">
                    <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                </div>
                <h3 class="text-lg font-heading font-bold text-white mb-1">Failed to Load Students</h3>
                <p class="text-sm text-[#708499] max-w-md mb-6">${escapeHtml(errorMsg)}</p>
                <button onclick="StudentsView.retry()" class="px-6 py-2.5 bg-[#3390ec] hover:bg-[#2b7cce] text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95">
                    Retry Loading
                </button>
            </div>
            `;
            return;
        }

        if (!students || students.length === 0) {
            root.innerHTML = `
            <div class="flex flex-col items-center justify-center p-12 text-center bg-[#17212b] rounded-2xl border border-[#1c2a38] my-8 shadow-sm">
                <div class="w-16 h-16 rounded-full bg-[#242f3d] border border-[#1c2a38] flex items-center justify-center text-[#708499] mb-4">
                    <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                </div>
                <h3 class="text-lg font-heading font-bold text-white mb-1">No students match your filters</h3>
                <p class="text-sm text-[#708499] max-w-sm mb-6">Try adjusting your search criteria, clearing selected filters, or searching for a different keyword.</p>
                <button onclick="StudentsView.clearAllFilters()" class="px-5 py-2.5 bg-[#242f3d] hover:bg-[#2b394a] text-white border border-[#2b394a] rounded-xl text-xs font-semibold transition-all">
                    Clear all filters
                </button>
            </div>
            `;
            return;
        }

        if (state.viewMode === 'list') {
            root.innerHTML = renderListView();
        } else {
            root.innerHTML = renderGridView();
        }
    }

    // ==================== LIST VIEW (TABLE + COLLAPSIBLE MOBILE) ====================
    function renderListView() {
        return `
        <!-- Desktop / Tablet Table View -->
        <div class="hidden sm:block w-full overflow-hidden bg-[#17212b] rounded-2xl border border-[#1c2a38] shadow-sm">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-[#1c2a38] bg-[#0e1621]/40 text-[#708499] text-[11px] font-semibold uppercase tracking-wider">
                            <th scope="col" class="py-3.5 pl-6 pr-4">Student</th>
                            <th scope="col" class="py-3.5 px-4">Email</th>
                            <th scope="col" class="py-3.5 px-4">LinkedIn</th>
                            <th scope="col" class="py-3.5 pl-4 pr-6">Projects</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1c2a38]">
                        ${students.map(s => renderListRow(s)).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Mobile Collapsed Card-Style View (No Horizontal Table Scrolling) -->
        <div class="sm:hidden flex flex-col gap-3">
            ${students.map(s => renderMobileListCard(s)).join('')}
        </div>
        `;
    }

    function renderListRow(s) {
        const initial = (s.full_name || '?').charAt(0).toUpperCase();
        const email = s.email || '';
        const linkedin = s.linkedin ? (s.linkedin.startsWith('http') ? s.linkedin : 'https://' + s.linkedin) : null;

        return `
        <tr tabindex="0" role="button" aria-label="View profile of ${escapeHtml(s.full_name)}" 
            onclick="StudentsView.navigateToProfile('${s.id}')" 
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();StudentsView.navigateToProfile('${s.id}');}" 
            class="group hover:bg-[#242f3d]/50 focus:outline-none focus:bg-[#242f3d]/70 transition-colors cursor-pointer">
            <!-- Student Column (Avatar + Name) -->
            <td class="py-3.5 pl-6 pr-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full overflow-hidden bg-[#242f3d] border border-[#2b394a] flex-shrink-0 flex items-center justify-center shadow-inner">
                        ${s.avatar_url ? 
                            `<img src="${s.avatar_url}" alt="${escapeHtml(s.full_name)}" class="w-full h-full object-cover">` : 
                            `<span class="font-heading font-bold text-sm text-[#3390ec]">${initial}</span>`
                        }
                    </div>
                    <div class="min-w-0">
                        <div class="font-heading font-semibold text-sm text-white group-hover:text-[#3390ec] transition-colors truncate">
                            ${escapeHtml(s.full_name)}
                        </div>
                        <div class="text-xs text-[#708499] truncate">
                            ${s.username ? `@${escapeHtml(s.username)}` : (s.branch ? `${escapeHtml(s.branch)}${s.year ? ' • ' + escapeHtml(s.year) : ''}` : 'Student Member')}
                        </div>
                    </div>
                </div>
            </td>

            <!-- Email Column -->
            <td class="py-3.5 px-4 whitespace-nowrap">
                ${email ? `
                    <a href="mailto:${escapeHtml(email)}" onclick="event.stopPropagation()" 
                        class="text-xs text-[#708499] hover:text-white transition-colors inline-flex items-center gap-1.5 group/link" 
                        title="Send email to ${escapeHtml(email)}">
                        <svg class="w-3.5 h-3.5 text-[#708499] group-hover/link:text-[#3390ec] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        <span class="truncate max-w-[200px]">${escapeHtml(email)}</span>
                    </a>
                ` : `<span class="text-xs text-[#708499]">—</span>`}
            </td>

            <!-- LinkedIn Column -->
            <td class="py-3.5 px-4 whitespace-nowrap">
                ${linkedin ? `
                    <a href="${linkedin}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" 
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0077b5]/15 text-[#0077b5] hover:bg-[#0077b5]/25 border border-[#0077b5]/30 text-xs font-medium transition-all" 
                        title="Open LinkedIn Profile">
                        <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                        </svg>
                        <span>LinkedIn</span>
                    </a>
                ` : `<span class="text-xs text-[#708499]">—</span>`}
            </td>

            <!-- Projects Avatar Stack Column -->
            <td class="py-3.5 pl-4 pr-6 whitespace-nowrap">
                ${renderProjectAvatarStack(s.projects, 'list')}
            </td>
        </tr>
        `;
    }

    function renderMobileListCard(s) {
        const initial = (s.full_name || '?').charAt(0).toUpperCase();
        const email = s.email || '';
        const linkedin = s.linkedin ? (s.linkedin.startsWith('http') ? s.linkedin : 'https://' + s.linkedin) : null;

        return `
        <div tabindex="0" role="button" aria-label="View profile of ${escapeHtml(s.full_name)}" 
            onclick="StudentsView.navigateToProfile('${s.id}')" 
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();StudentsView.navigateToProfile('${s.id}');}" 
            class="bg-[#17212b] rounded-xl p-4 border border-[#1c2a38] hover:border-[#3390ec]/40 focus:outline-none focus:ring-2 focus:ring-[#3390ec] transition-all cursor-pointer flex flex-col gap-3">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-11 h-11 rounded-full overflow-hidden bg-[#242f3d] border border-[#2b394a] flex-shrink-0 flex items-center justify-center shadow-inner">
                        ${s.avatar_url ? 
                            `<img src="${s.avatar_url}" alt="${escapeHtml(s.full_name)}" class="w-full h-full object-cover">` : 
                            `<span class="font-heading font-bold text-base text-[#3390ec]">${initial}</span>`
                        }
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-heading font-semibold text-sm text-white truncate">${escapeHtml(s.full_name)}</h4>
                        <p class="text-xs text-[#708499] truncate">${s.username ? `@${escapeHtml(s.username)}` : (s.branch || 'Student')}</p>
                    </div>
                </div>

                ${linkedin ? `
                    <a href="${linkedin}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" 
                        class="p-2 rounded-lg bg-[#0077b5]/15 text-[#0077b5] border border-[#0077b5]/30 hover:bg-[#0077b5]/25 transition-colors" 
                        title="LinkedIn Profile" aria-label="LinkedIn Profile">
                        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
                    </a>
                ` : ''}
            </div>

            <div class="flex items-center justify-between gap-2 pt-2 border-t border-[#1c2a38]/80 text-xs">
                <div class="truncate max-w-[55%]">
                    ${email ? `
                        <a href="mailto:${escapeHtml(email)}" onclick="event.stopPropagation()" class="text-[#708499] hover:text-white truncate flex items-center gap-1">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                            <span class="truncate">${escapeHtml(email)}</span>
                        </a>
                    ` : '<span class="text-[#708499]">—</span>'}
                </div>

                <div>
                    ${renderProjectAvatarStack(s.projects, 'card')}
                </div>
            </div>
        </div>
        `;
    }

    // ==================== GRID VIEW (RESPONSIVE CARDS: 4/2/1) ====================
    function renderGridView() {
        return `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            ${students.map(s => renderGridCard(s)).join('')}
        </div>
        `;
    }

    function renderGridCard(s) {
        const initial = (s.full_name || '?').charAt(0).toUpperCase();
        const email = s.email || '';
        const linkedin = s.linkedin ? (s.linkedin.startsWith('http') ? s.linkedin : 'https://' + s.linkedin) : null;

        return `
        <div tabindex="0" role="button" aria-label="View profile of ${escapeHtml(s.full_name)}" 
            onclick="StudentsView.navigateToProfile('${s.id}')" 
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();StudentsView.navigateToProfile('${s.id}');}" 
            class="group bg-[#17212b] hover:bg-[#242f3d]/70 rounded-2xl p-5 border border-[#1c2a38] hover:border-[#3390ec]/40 focus:outline-none focus:ring-2 focus:ring-[#3390ec] transition-all duration-200 shadow-sm flex flex-col justify-between cursor-pointer relative hover:-translate-y-1">
            
            <!-- Top Card Header: Avatar & LinkedIn Icon -->
            <div class="flex items-start justify-between gap-3 mb-4">
                <div class="relative">
                    <div class="w-14 h-14 rounded-2xl overflow-hidden bg-[#242f3d] border border-[#2b394a] flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-200">
                        ${s.avatar_url ? 
                            `<img src="${s.avatar_url}" alt="${escapeHtml(s.full_name)}" class="w-full h-full object-cover">` : 
                            `<span class="font-heading font-bold text-xl text-[#3390ec]">${initial}</span>`
                        }
                    </div>
                </div>

                <div>
                    ${linkedin ? `
                        <a href="${linkedin}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" 
                            class="w-8 h-8 rounded-xl bg-[#0077b5]/15 text-[#0077b5] hover:bg-[#0077b5]/25 border border-[#0077b5]/30 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-110 active:scale-95" 
                            title="Open LinkedIn Profile" aria-label="LinkedIn profile">
                            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
                        </a>
                    ` : `
                        <span class="w-8 h-8 rounded-xl bg-[#0e1621] text-[#708499] flex items-center justify-center text-xs font-semibold select-none opacity-40" title="No LinkedIn profile">—</span>
                    `}
                </div>
            </div>

            <!-- Student Name and Academic Subtitles -->
            <div class="mb-4">
                <h3 class="font-heading font-bold text-base text-white group-hover:text-[#3390ec] transition-colors truncate mb-0.5">
                    ${escapeHtml(s.full_name)}
                </h3>
                <p class="text-xs text-[#708499] truncate">
                    ${s.username ? `@${escapeHtml(s.username)}` : (s.branch ? `${escapeHtml(s.branch)}${s.year ? ' • ' + escapeHtml(s.year) : ''}` : 'Student Member')}
                </p>

                <!-- Email Link -->
                ${email ? `
                    <div class="mt-2.5">
                        <a href="mailto:${escapeHtml(email)}" onclick="event.stopPropagation()" 
                            class="text-xs text-[#708499] hover:text-white transition-colors inline-flex items-center gap-1.5 truncate max-w-full" 
                            title="Send email to ${escapeHtml(email)}">
                            <svg class="w-3.5 h-3.5 flex-shrink-0 text-[#708499]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                            <span class="truncate">${escapeHtml(email)}</span>
                        </a>
                    </div>
                ` : ''}
            </div>

            <!-- Bottom Card Footer: Projects Avatar Stack -->
            <div class="pt-3 border-t border-[#1c2a38] flex items-center justify-between gap-2">
                <span class="text-[11px] font-semibold text-[#708499] uppercase tracking-wider">Projects</span>
                <div>
                    ${renderProjectAvatarStack(s.projects, 'card')}
                </div>
            </div>
        </div>
        `;
    }

    // ==================== PROJECTS AVATAR STACK ====================
    function renderProjectAvatarStack(projects, context = 'list') {
        if (!projects || projects.length === 0) {
            return `<span class="text-xs text-[#708499] italic select-none">No projects</span>`;
        }

        const count = projects.length;
        const ringBorder = context === 'list' ? 'ring-2 ring-[#17212b]' : 'ring-2 ring-[#242f3d]';

        // Exactly 1 project: single circle, no overlap
        if (count === 1) {
            const p = projects[0];
            return `
            <div class="inline-flex items-center">
                ${renderSingleProjectCircle(p, ringBorder, 0)}
            </div>
            `;
        }

        // Up to 3 projects or 4+ projects with +N overflow circle
        const visibleProjects = projects.slice(0, 3);
        const remainingCount = count - 3;
        const hiddenProjects = remainingCount > 0 ? projects.slice(3) : [];
        const hiddenTooltip = hiddenProjects.map(p => escapeHtml(p.name)).join(', ');

        return `
        <div class="inline-flex items-center select-none" role="group" aria-label="Projects list">
            ${visibleProjects.map((p, idx) => {
                // Negative left margin for overlap (except first circle)
                const marginClass = idx === 0 ? '' : '-ml-2 sm:-ml-2.5';
                // Consistent stacking order: first circle on top
                const zIndexClass = `z-[${10 - idx}]`;
                return renderSingleProjectCircle(p, `${ringBorder} ${marginClass} ${zIndexClass}`, idx);
            }).join('')}

            ${remainingCount > 0 ? `
                <div onclick="event.stopPropagation()" 
                    class="-ml-2 sm:-ml-2.5 z-[1] w-7 h-7 sm:w-8 sm:h-8 rounded-full ${ringBorder} bg-[#242f3d] hover:bg-[#3390ec] text-white flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all cursor-default shadow-sm group/stack relative" 
                    title="Also in: ${hiddenTooltip}">
                    +${remainingCount}
                    <!-- Custom Tooltip for +N remaining projects -->
                    <div class="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover/stack:block bg-[#0e1621] text-white text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[#1c2a38] whitespace-nowrap shadow-xl z-50 pointer-events-none">
                        Also in: ${hiddenTooltip}
                    </div>
                </div>
            ` : ''}
        </div>
        `;
    }

    function renderSingleProjectCircle(p, extraClasses = '', idx = 0) {
        const initials = p.initials || (p.name ? p.name.replace(/Team\s*/i, '').slice(0, 2).toUpperCase() : 'PR');
        const bgGradient = p.gradient ? `bg-gradient-to-br ${p.gradient}` : (p.color ? `background-color: ${p.color};` : 'bg-gradient-to-br from-[#3390ec] to-indigo-600');
        const styleAttr = !p.gradient && p.color ? `style="${bgGradient}"` : '';
        const classAttr = p.gradient ? bgGradient : '';

        return `
        <button type="button" onclick="StudentsView.navigateToProject(${p.id}, event)" 
            class="${extraClasses} w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 transition-transform hover:scale-110 active:scale-95 cursor-pointer shadow-sm relative group/circle focus:outline-none focus:ring-2 focus:ring-[#3390ec]" 
            title="${escapeHtml(p.name)}" aria-label="Open ${escapeHtml(p.name)} project page">
            ${p.avatar_url ? `
                <img src="${p.avatar_url}" alt="${escapeHtml(p.name)}" class="w-full h-full object-cover">
            ` : `
                <div class="w-full h-full flex items-center justify-center ${classAttr}" ${styleAttr}>
                    <span class="text-[10px] sm:text-xs font-bold text-white tracking-wider">${initials}</span>
                </div>
            `}
            <!-- Tooltip -->
            <div class="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover/circle:block bg-[#0e1621] text-white text-[11px] font-medium px-2 py-0.5 rounded-lg border border-[#1c2a38] whitespace-nowrap shadow-xl z-50 pointer-events-none">
                ${escapeHtml(p.name)}
            </div>
        </button>
        `;
    }

    // ==================== SKELETON LOADERS ====================
    function renderListSkeleton() {
        return `
        <div class="w-full overflow-hidden bg-[#17212b] rounded-2xl border border-[#1c2a38] p-4 space-y-4">
            ${Array.from({ length: 8 }).map(() => `
                <div class="flex items-center justify-between gap-4 py-2 border-b border-[#1c2a38]/60 animate-pulse">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-[#242f3d]"></div>
                        <div class="space-y-1.5">
                            <div class="w-32 h-3.5 bg-[#242f3d] rounded"></div>
                            <div class="w-20 h-2.5 bg-[#242f3d]/60 rounded"></div>
                        </div>
                    </div>
                    <div class="w-40 h-3 bg-[#242f3d] rounded hidden sm:block"></div>
                    <div class="w-20 h-6 bg-[#242f3d] rounded-lg hidden sm:block"></div>
                    <div class="flex items-center -space-x-2">
                        <div class="w-7 h-7 rounded-full bg-[#242f3d] ring-2 ring-[#17212b]"></div>
                        <div class="w-7 h-7 rounded-full bg-[#242f3d]/80 ring-2 ring-[#17212b]"></div>
                        <div class="w-7 h-7 rounded-full bg-[#242f3d]/60 ring-2 ring-[#17212b]"></div>
                    </div>
                </div>
            `).join('')}
        </div>
        `;
    }

    function renderGridSkeleton() {
        return `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            ${Array.from({ length: 8 }).map(() => `
                <div class="bg-[#17212b] rounded-2xl p-5 border border-[#1c2a38] flex flex-col justify-between gap-4 animate-pulse">
                    <div class="flex items-start justify-between">
                        <div class="w-14 h-14 rounded-2xl bg-[#242f3d]"></div>
                        <div class="w-8 h-8 rounded-xl bg-[#242f3d]"></div>
                    </div>
                    <div class="space-y-2">
                        <div class="w-3/4 h-4 bg-[#242f3d] rounded"></div>
                        <div class="w-1/2 h-3 bg-[#242f3d]/60 rounded"></div>
                        <div class="w-2/3 h-2.5 bg-[#242f3d]/40 rounded mt-3"></div>
                    </div>
                    <div class="pt-3 border-t border-[#1c2a38] flex items-center justify-between">
                        <div class="w-12 h-2.5 bg-[#242f3d]/60 rounded"></div>
                        <div class="flex items-center -space-x-2">
                            <div class="w-7 h-7 rounded-full bg-[#242f3d]"></div>
                            <div class="w-7 h-7 rounded-full bg-[#242f3d]/80"></div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        `;
    }

    // ==================== INTERACTION HANDLERS ====================
    function setViewMode(mode) {
        if (state.viewMode === mode) return;
        state.viewMode = mode;
        try {
            localStorage.setItem('icc_students_view_mode', mode);
        } catch (e) {}
        syncStateToUrl();
        renderShell();
        renderContent();
        updateResultsCount();
        renderActiveFilterChips();
    }

    function onSearchInput(val) {
        state.search = val.trim();
        const clearBtn = document.getElementById('students-search-clear');
        if (clearBtn) {
            if (val) clearBtn.classList.remove('hidden');
            else clearBtn.classList.add('hidden');
        }

        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.page = 1;
            syncStateToUrl();
            loadData();
        }, 300);
    }

    function clearSearch() {
        state.search = '';
        const input = document.getElementById('students-search-input');
        if (input) input.value = '';
        const clearBtn = document.getElementById('students-search-clear');
        if (clearBtn) clearBtn.classList.add('hidden');
        state.page = 1;
        syncStateToUrl();
        loadData();
    }

    function setSort(sortValue) {
        state.sort = sortValue;
        state.page = 1;
        syncStateToUrl();
        loadData();
    }

    function setLinkedinFilter(val) {
        state.hasLinkedin = val;
        state.page = 1;
        syncStateToUrl();
        renderShell();
        loadData();
    }

    function setProjectCountFilter(val) {
        state.projectCount = val;
        state.page = 1;
        syncStateToUrl();
        renderShell();
        loadData();
    }

    function setBranchFilter(val) {
        state.branch = val.trim();
        state.page = 1;
        syncStateToUrl();
        renderShell();
        loadData();
    }

    function setYearFilter(val) {
        state.year = val.trim();
        state.page = 1;
        syncStateToUrl();
        renderShell();
        loadData();
    }

    function onToggleProjectFilter(projectId, isChecked) {
        const idStr = String(projectId);
        if (isChecked) {
            if (!state.selectedProjects.includes(idStr)) {
                state.selectedProjects.push(idStr);
            }
        } else {
            state.selectedProjects = state.selectedProjects.filter(id => id !== idStr);
        }
        state.page = 1;
        syncStateToUrl();
        renderActiveFilterChips();
        loadData();
    }

    function toggleFilterDrawer() {
        const drawer = document.getElementById('students-filter-drawer');
        if (!drawer) return;
        state.filterDrawerOpen = !state.filterDrawerOpen;
        if (state.filterDrawerOpen) {
            drawer.classList.remove('hidden');
            drawer.classList.add('flex');
            renderProjectCheckboxes();
        } else {
            drawer.classList.add('hidden');
            drawer.classList.remove('flex');
        }
    }

    function clearAllFilters() {
        state.search = '';
        state.selectedProjects = [];
        state.hasLinkedin = 'all';
        state.projectCount = 'all';
        state.branch = '';
        state.year = '';
        state.page = 1;
        syncStateToUrl();
        renderShell();
        loadData();
    }

    function goToPage(p) {
        if (p < 1 || p > state.totalPages) return;
        state.page = p;
        syncStateToUrl();
        loadData();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }


    function renderMentorsGrid() {
        const query = (state.mentorSearch || '').trim().toLowerCase();

        const filtered = mentors.filter(m => {
            if (query) {
                const target = `${m.full_name || ''} ${m.username || ''} ${m.email || ''} ${m.phone || ''}`.toLowerCase();
                if (!target.includes(query)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            return `
            <div class="flex flex-col items-center justify-center p-12 text-center bg-[#17212b] rounded-2xl my-4 shadow-sm space-y-3">
                <div class="w-12 h-12 rounded-2xl bg-zinc-800/80 text-zinc-400 flex items-center justify-center text-xl">
                    🎓
                </div>
                <h4 class="font-heading font-semibold text-base text-zinc-300">No mentors found</h4>
                <p class="text-xs text-[#708499] max-w-sm">No mentor profiles match "${escapeHtml(state.mentorSearch)}".</p>
                <button onclick="StudentsView.clearMentorSearch()" class="px-4 py-2 bg-[#242f3d] hover:bg-[#2b394a] text-white rounded-xl text-xs font-semibold transition-all cursor-pointer">Clear Search</button>
            </div>
            `;
        }

        return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
            ${filtered.map(m => renderMentorCard(m)).join('')}
        </div>
        `;
    }

    function renderMentorCard(m) {
        const initials = (m.full_name || m.username || 'M').charAt(0).toUpperCase();
        const linkedinUrl = m.linkedin ? (m.linkedin.startsWith('http') ? m.linkedin : 'https://' + m.linkedin) : null;
        const phone = (m.phone && String(m.phone).trim()) ? String(m.phone).trim() : null;
        const email = (m.email && String(m.email).trim()) ? String(m.email).trim() : null;
        const mentorTick = (typeof ICC_CONFIG !== 'undefined' && ICC_CONFIG.MENTOR_TICK) ? ICC_CONFIG.MENTOR_TICK : '';

        return `
        <div onclick="StudentsView.navigateToProfile('${m.id}')" 
             role="button" 
             tabindex="0" 
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();StudentsView.navigateToProfile('${m.id}');}" 
             class="group bg-[#17212b] hover:bg-[#242f3d] rounded-2xl p-5 shadow-md space-y-3.5 transition-all cursor-pointer border-none" 
             title="View ${escapeHtml(m.full_name || 'Mentor')}'s profile">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-full bg-[#0e1621] flex items-center justify-center text-white font-bold text-base overflow-hidden flex-shrink-0 shadow-inner">
                    ${m.avatar_url ? `<img src="${m.avatar_url}" class="w-full h-full object-cover">` : initials}
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <h3 class="font-heading font-bold text-base text-white group-hover:text-[#3390ec] transition-colors truncate">
                            ${escapeHtml(m.full_name || m.username || 'Mentor')}
                        </h3>
                        <span class="flex-shrink-0 inline-flex items-center text-amber-400" title="Verified Mentor">
                            ${mentorTick}
                        </span>
                    </div>
                    <p class="text-xs text-[#708499] truncate">@${escapeHtml(m.username || 'mentor')}</p>
                </div>
            </div>

            <div class="space-y-2 text-xs pt-1">
                ${email ? `
                    <div class="flex items-center gap-2 text-zinc-300 min-w-0">
                        <svg class="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
                        </svg>
                        <a href="mailto:${escapeHtml(email)}" onclick="event.stopPropagation()" class="text-zinc-300 hover:text-white truncate transition-colors" title="${escapeHtml(email)}">${escapeHtml(email)}</a>
                    </div>
                ` : ''}

                ${phone ? `
                    <div class="flex items-center gap-2 text-zinc-300 min-w-0">
                        <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                        <a href="tel:${escapeHtml(phone)}" onclick="event.stopPropagation()" class="text-zinc-300 hover:text-white truncate transition-colors" title="${escapeHtml(phone)}">${escapeHtml(phone)}</a>
                    </div>
                ` : ''}

                ${linkedinUrl ? `
                    <div class="flex items-center gap-2 text-zinc-300 min-w-0">
                        <svg class="w-4 h-4 text-[#3390ec] flex-shrink-0 fill-current" viewBox="0 0 24 24">
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                        </svg>
                        <a href="${escapeHtml(linkedinUrl)}" onclick="event.stopPropagation()" target="_blank" rel="noopener noreferrer" class="text-[#3390ec] hover:underline truncate transition-colors">LinkedIn</a>
                    </div>
                ` : ''}
            </div>
        </div>
        `;
    }

    function setActiveTab(tab) {
        state.activeTab = tab;
        syncStateToUrl();
        renderShell();
        renderContent();
        updateResultsCount();
    }

    function onMentorSearchInput(val) {
        state.mentorSearch = val;
        syncStateToUrl();
        renderContent();
    }

    function clearMentorSearch() {
        state.mentorSearch = '';
        syncStateToUrl();
        const input = document.getElementById('mentors-search-input');
        if (input) input.value = '';
        renderContent();
    }

    function setMentorDomainFilter(domain) {
        state.mentorDomainFilter = domain;
        syncStateToUrl();
        renderShell();
        renderContent();
    }

    function retry() {
        loadData();
    }

    // Navigation to Student Profile
    function navigateToProfile(userId) {
        if (!userId) return;
        if (typeof UserProfileModal !== 'undefined' && typeof UserProfileModal.open === 'function') {
            UserProfileModal.open(userId);
        } else {
            window.location.hash = `#profile/${userId}`;
        }
    }

    // Navigation to Project / Team page (stops propagation so row click does not fire)
    function navigateToProject(projectId, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!projectId) return;
        window.location.hash = `#teams/${projectId}`;
    }

    return {
        mount,
        unmount,
        setActiveTab,
        onMentorSearchInput,
        clearMentorSearch,
        setMentorDomainFilter,
        setViewMode,
        onSearchInput,
        clearSearch,
        setSort,
        setLinkedinFilter,
        setProjectCountFilter,
        setBranchFilter,
        setYearFilter,
        onToggleProjectFilter,
        toggleFilterDrawer,
        clearAllFilters,
        goToPage,
        retry,
        navigateToProfile,
        navigateToProject
    };
})();
