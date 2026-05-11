/* ============================================
   ICC Social Hub — Team Attendance Management
   ============================================ */
const AttendanceView = (() => {
    let mode = 'student'; // 'student', 'lead', 'admin'
    let currentTeamId = null;
    let teammates = [];
    let attendanceRecords = {}; // user_id -> status
    let history = [];
    let stats = []; // For Admin
    let selectedDate = new Date().toISOString().split('T')[0];
    let filters = { team: '', section: '', branch: '' };

    function render() {
        const user = ICCSupabase.getUser();
        if (!user) return renderGuest();

        return `
        <section class="min-h-screen pt-2 pb-24 px-4">
            <div class="max-w-4xl mx-auto">
                ${renderHeader()}
                <div id="attendance-content" class="mt-4">
                    ${renderModeContent()}
                </div>
            </div>
        </section>`;
    }

    function renderGuest() {
        return `<div class="empty-state min-h-screen"><h3 class="font-heading font-semibold text-lg">Sign In Required</h3><button onclick="AuthModal.open()" class="mt-4 px-6 py-2.5 bg-red-600 rounded-xl text-sm font-semibold">Sign In</button></div>`;
    }

    function renderHeader() {
        const isAdmin = ICCSupabase.isAdmin();
        const isLead = ICCSupabase.isLead();
        
        return `
        <div class="flex items-center justify-between mb-2">
            <div>
                <h1 class="font-heading font-bold text-xl">Attendance</h1>
                <p class="text-[11px] text-zinc-500">Track and manage team presence</p>
            </div>
            <div class="flex gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
                <button class="mode-tab ${mode === 'student' ? 'active' : ''}" data-mode="student">My Status</button>
                ${isLead ? `<button class="mode-tab ${mode === 'lead' ? 'active' : ''}" data-mode="lead">Mark Entry</button>` : ''}
                ${isAdmin ? `<button class="mode-tab ${mode === 'admin' ? 'active' : ''}" data-mode="admin">Admin Panel</button>` : ''}
            </div>
        </div>`;
    }

    function renderModeContent() {
        if (mode === 'admin') return renderAdminView();
        if (mode === 'lead') return renderLeadView();
        return renderStudentView();
    }

    // --- STUDENT VIEW ---
    function renderStudentView() {
        const total = history.length;
        const present = history.filter(h => h.status === 'present').length;
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

        return `
        <div class="space-y-4">
            <div class="glass-card rounded-2xl p-6 flex items-center justify-between bg-gradient-to-br from-zinc-900 to-black">
                <div>
                    <p class="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Your Attendance</p>
                    <h2 class="text-4xl font-bold text-white">${percentage}%</h2>
                    <p class="text-xs text-zinc-400 mt-2">${present} Days Present / ${total} Total Sessions</p>
                </div>
                <div class="w-16 h-16 rounded-full border-4 border-zinc-800 flex items-center justify-center relative">
                    <svg class="w-full h-full -rotate-90 absolute">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4" class="text-crimson/20" />
                        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="4" class="text-crimson" stroke-dasharray="${175 * (percentage / 100)} 175" stroke-linecap="round" />
                    </svg>
                    <span class="text-[10px] font-bold">${present}/${total}</span>
                </div>
            </div>

            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="p-4 border-b border-zinc-800/50 bg-zinc-900/30">
                    <h3 class="font-heading font-semibold text-sm">Session History</h3>
                </div>
                <div class="divide-y divide-zinc-800/50">
                    ${history.length > 0 ? history.map(h => `
                        <div class="p-4 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                            <div>
                                <p class="text-sm font-medium">${formatDate(h.date)}</p>
                                <p class="text-[10px] text-zinc-500">${getTeamName(h.team_id)}</p>
                            </div>
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${h.status === 'present' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}">
                                ${h.status}
                            </span>
                        </div>
                    `).join('') : `<div class="p-8 text-center text-zinc-500 text-xs">No attendance records found yet.</div>`}
                </div>
            </div>
        </div>`;
    }

    // --- LEAD VIEW ---
    function renderLeadView() {
        return `
        <div class="space-y-4">
            <div class="flex items-center justify-between gap-3">
                <input type="date" id="att-date-picker" value="${selectedDate}" class="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-crimson">
                <button id="att-submit-btn" class="flex-1 py-2.5 bg-crimson hover:bg-crimson-dark text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-crimson/20">
                    Submit Attendance
                </button>
            </div>

            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="p-4 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/30">
                    <h3 class="font-heading font-semibold text-sm">Team Members (${teammates.length})</h3>
                    <div class="flex gap-2">
                        <button id="mark-all-present" class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider hover:underline">All Present</button>
                        <span class="text-zinc-700">|</span>
                        <button id="mark-all-absent" class="text-[10px] font-bold text-red-400 uppercase tracking-wider hover:underline">All Absent</button>
                    </div>
                </div>
                <div class="divide-y divide-zinc-800/50 max-h-[60vh] overflow-y-auto no-scrollbar">
                    ${teammates.map(m => {
                        const status = attendanceRecords[m.id] || 'present';
                        const student = window.getStudentDataByEmail ? window.getStudentDataByEmail(m.email) : null;
                        return `
                        <div class="p-4 flex items-center justify-between gap-4">
                            <div class="flex items-center gap-3 flex-1 min-w-0">
                                <div class="w-10 h-10 rounded-xl bg-zinc-800 overflow-hidden border border-zinc-700 flex-shrink-0">
                                    ${m.avatar_url ? `<img src="${m.avatar_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center font-bold text-zinc-500">${m.full_name?.charAt(0) || 'I'}</div>`}
                                </div>
                                <div class="min-w-0">
                                    <p class="text-sm font-semibold truncate">${m.full_name || m.username}</p>
                                    <p class="text-[10px] text-zinc-500 uppercase tracking-tight">${student ? `${student.usn} • Sec ${student.section}` : m.username}</p>
                                </div>
                            </div>
                            <div class="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                                <button class="status-toggle-btn px-3 py-1 rounded text-[10px] font-bold transition-all ${status === 'present' ? 'bg-emerald-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}" data-user-id="${m.id}" data-status="present">P</button>
                                <button class="status-toggle-btn px-3 py-1 rounded text-[10px] font-bold transition-all ${status === 'absent' ? 'bg-red-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}" data-user-id="${m.id}" data-status="absent">A</button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;
    }

    // --- ADMIN VIEW ---
    function renderAdminView() {
        // Apply filters to stats
        const filteredStats = stats.filter(s => {
            const matchesTeam = !filters.team || s.team === filters.team;
            const matchesSection = !filters.section || s.section === filters.section;
            const matchesBranch = !filters.branch || s.branch === filters.branch;
            return matchesTeam && matchesSection && matchesBranch;
        });

        const teams = [...new Set(stats.map(s => s.team))].sort();
        const branches = [...new Set(stats.map(s => s.branch))].sort();

        return `
        <div class="space-y-4">
            <!-- Filter Bar -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select id="adm-filter-team" class="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
                    <option value="">All Teams</option>
                    ${teams.map(t => `<option value="${t}" ${filters.team === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                <select id="adm-filter-branch" class="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
                    <option value="">All Branches</option>
                    ${branches.map(b => `<option value="${b}" ${filters.branch === b ? 'selected' : ''}>${b}</option>`).join('')}
                </select>
                <select id="adm-filter-section" class="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none">
                    <option value="">All Secs</option>
                    ${['A','B','C','D','E','F','G','H','I','J','K'].map(s => `<option value="${s}" ${filters.section === s ? 'selected' : ''}>Sec ${s}</option>`).join('')}
                </select>
                <button id="adm-export-btn" class="bg-zinc-100 hover:bg-white text-zinc-900 rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center justify-center gap-2">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Download Report
                </button>
            </div>

            <!-- Master Table -->
            <div class="glass-card rounded-2xl overflow-hidden">
                <div class="overflow-x-auto no-scrollbar">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-zinc-900/50 border-b border-zinc-800">
                            <tr>
                                <th class="px-4 py-3 font-semibold text-zinc-400 uppercase tracking-wider">Student</th>
                                <th class="px-4 py-3 font-semibold text-zinc-400 uppercase tracking-wider">Team</th>
                                <th class="px-4 py-3 font-semibold text-zinc-400 uppercase tracking-wider text-center">Branch</th>
                                <th class="px-4 py-3 font-semibold text-zinc-400 uppercase tracking-wider text-center">Sec</th>
                                <th class="px-4 py-3 font-semibold text-zinc-400 uppercase tracking-wider text-right">Attendance %</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-zinc-800/50">
                            ${filteredStats.length > 0 ? filteredStats.map(s => `
                                <tr class="hover:bg-zinc-800/20 transition-colors">
                                    <td class="px-4 py-3">
                                        <p class="font-semibold text-white">${s.fullName}</p>
                                        <p class="text-[10px] text-zinc-500 font-mono">${s.usn}</p>
                                    </td>
                                    <td class="px-4 py-3 text-zinc-400">${s.team}</td>
                                    <td class="px-4 py-3 text-center text-zinc-500">${s.branch}</td>
                                    <td class="px-4 py-3 text-center text-zinc-500">${s.section}</td>
                                    <td class="px-4 py-3 text-right">
                                        <span class="font-bold ${s.percent >= 75 ? 'text-emerald-400' : s.percent >= 50 ? 'text-amber-400' : 'text-red-400'}">${s.percent}%</span>
                                    </td>
                                </tr>
                            `).join('') : `<tr><td colspan="5" class="px-4 py-8 text-center text-zinc-500 italic">No matching records found.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }

    // --- LOGIC ---

    async function mount(container) {
        try {
            container.innerHTML = `<div class="flex items-center justify-center min-h-[60vh]"><div class="spinner"></div></div>`;
            
            const profile = ICCSupabase.getProfile();
            const user = ICCSupabase.getUser();
            
            if (!user) {
                container.innerHTML = renderGuest();
                return;
            }

            if (ICCSupabase.isAdmin()) mode = 'admin';
            else if (ICCSupabase.isLead()) mode = 'lead';
            else mode = 'student';

            await loadData();
            container.innerHTML = render();
            bindEvents(container);
        } catch (err) {
            console.error('AttendanceView mount error:', err);
            container.innerHTML = `<div class="p-8 text-center"><p class="text-red-500 font-semibold">Failed to load Attendance</p><p class="text-xs text-zinc-500 mt-2">${err.message}</p></div>`;
        }
    }

    async function loadData() {
        const user = ICCSupabase.getUser();
        const profile = ICCSupabase.getProfile();
        
        if (!user) return;
        
        if (mode === 'student') {
            history = await ICCSupabase.fetchUserAttendanceHistory(user.id);
        } else if (mode === 'lead') {
            currentTeamId = profile.team_id;
            teammates = await ICCSupabase.getTeamMembers(currentTeamId);
            // Fetch existing records for selected date
            const existing = await ICCSupabase.fetchTeamAttendance(currentTeamId, selectedDate);
            attendanceRecords = {};
            // Default to present for everyone not in DB
            teammates.forEach(m => attendanceRecords[m.id] = 'present');
            existing.forEach(r => attendanceRecords[r.user_id] = r.status);
        } else if (mode === 'admin') {
            const raw = await ICCSupabase.fetchAllAttendanceData();
            processAdminStats(raw);
        }
    }

    function processAdminStats(raw) {
        const map = {};
        raw.forEach(r => {
            if (!map[r.user_id]) {
                const u = r.user || {};
                const branch = parseBranch(u.usn);
                map[r.user_id] = {
                    fullName: u.full_name || 'Unknown',
                    usn: u.usn || '—',
                    section: u.section || '—',
                    branch: branch,
                    team: r.team?.team || 'No Team',
                    present: 0,
                    total: 0
                };
            }
            map[r.user_id].total++;
            if (r.status === 'present') map[r.user_id].present++;
        });

        stats = Object.values(map).map(s => ({
            ...s,
            percent: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0
        })).sort((a, b) => b.percent - a.percent);
    }

    function parseBranch(usn) {
        if (!usn) return '—';
        const match = usn.match(/[1-9][A-Z]{2}(\d{2})([A-Z]{2})/i);
        if (match && match[2]) return match[2].toUpperCase();
        return '—';
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function bindEvents(container) {
        // Mode switching
        container.querySelectorAll('.mode-tab').forEach(btn => {
            btn.addEventListener('click', async () => {
                mode = btn.dataset.mode;
                container.innerHTML = `<div class="flex items-center justify-center min-h-[60vh]"><div class="spinner"></div></div>`;
                await loadData();
                container.innerHTML = render();
                bindEvents(container);
            });
        });

        // Lead: Date picker
        const datePicker = document.getElementById('att-date-picker');
        if (datePicker) {
            datePicker.addEventListener('change', async (e) => {
                selectedDate = e.target.value;
                container.innerHTML = `<div class="flex items-center justify-center min-h-[60vh]"><div class="spinner"></div></div>`;
                await loadData();
                container.innerHTML = render();
                bindEvents(container);
            });
        }

        // Lead: Status toggle
        container.querySelectorAll('.status-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const uid = btn.getAttribute('data-user-id');
                const status = btn.dataset.status;
                attendanceRecords[uid] = status;
                
                // Partial re-render (update button styles)
                const parent = btn.parentElement;
                parent.querySelectorAll('.status-toggle-btn').forEach(b => {
                    if (b.dataset.status === status) {
                        if (status === 'present') {
                            b.classList.add('bg-emerald-500', 'text-white');
                            b.classList.remove('bg-red-500', 'text-zinc-500');
                        } else {
                            b.classList.add('bg-red-500', 'text-white');
                            b.classList.remove('bg-emerald-500', 'text-zinc-500');
                        }
                    } else {
                        b.classList.remove('bg-emerald-500', 'bg-red-500', 'text-white');
                        b.classList.add('text-zinc-500');
                    }
                });
            });
        });

        // Lead: Mark All
        document.getElementById('mark-all-present')?.addEventListener('click', () => {
            teammates.forEach(m => attendanceRecords[m.id] = 'present');
            container.innerHTML = render(); bindEvents(container);
        });
        document.getElementById('mark-all-absent')?.addEventListener('click', () => {
            teammates.forEach(m => attendanceRecords[m.id] = 'absent');
            container.innerHTML = render(); bindEvents(container);
        });

        // Lead: Submit
        document.getElementById('att-submit-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('att-submit-btn');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner spinner-sm"></div>';
            
            const records = Object.entries(attendanceRecords).map(([uid, status]) => ({
                user_id: uid,
                team_id: currentTeamId,
                date: selectedDate,
                status: status,
                recorded_by: ICCSupabase.getUser().id
            }));

            const { error } = await ICCSupabase.submitAttendance(records);
            if (error) {
                Toast.error('Failed to submit: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Submit Attendance';
            } else {
                Toast.success('Attendance recorded for ' + formatDate(selectedDate) + ' 🎉');
                await loadData();
                container.innerHTML = render();
                bindEvents(container);
            }
        });

        // Admin: Filters
        const filters_ids = ['adm-filter-team', 'adm-filter-branch', 'adm-filter-section'];
        filters_ids.forEach(id => {
            document.getElementById(id)?.addEventListener('change', (e) => {
                const type = id.split('-')[2];
                filters[type] = e.target.value;
                container.innerHTML = render(); bindEvents(container);
            });
        });

        // Admin: Export
        document.getElementById('adm-export-btn')?.addEventListener('click', () => {
            exportToCSV();
        });
    }

    function exportToCSV() {
        const headers = ['Full Name', 'USN', 'Section', 'Branch', 'Team', 'Present Days', 'Total Sessions', 'Attendance %'];
        const rows = stats.map(s => [
            s.fullName, s.usn, s.section, s.branch, s.team, s.present, s.total, `${s.percent}%`
        ]);

        let csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ICC_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Toast.success('Report downloaded! 📊');
    }

    return { mount };
})();
