/* ============================================
   ICC Social Hub — Admin Dashboard
   ============================================ */
const AdminView = (() => {
    let activeTab = 'users';
    let pendingLeads = [];
    let pendingEditRequests = [];
    let allPosts = [];
    let allUsers = [];
    let allEvents = [];
    let allAttendance = [];
    let attendanceMap = {}; // user_id -> { present, total, percent }
    let editingLead = null;
    let editingUserId = null;
    let editingEvent = null;
    let userSearchQuery = '';
    let userSectionFilter = '';
    let userTeamFilter = '';
    let accessSearchQuery = '';
    let accessRoleFilter = 'all'; // 'all', 'super_admin', 'admin'
    let appointingUserId = null;
    let appointingUserDraft = null; // { broadcast, moderate, events, leads, users, all, isSuperAdmin }

    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function updateAttendanceStats(records) {
        attendanceMap = {};
        if (!Array.isArray(records)) return;
        records.forEach(r => {
            if (!r.user_id) return;
            if (!attendanceMap[r.user_id]) {
                attendanceMap[r.user_id] = { present: 0, total: 0, percent: 0 };
            }
            attendanceMap[r.user_id].total++;
            if (r.status === 'present') {
                attendanceMap[r.user_id].present++;
            }
        });
        Object.keys(attendanceMap).forEach(uid => {
            const item = attendanceMap[uid];
            item.percent = item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;
        });
    }

    function getUserDetails(u) {
        const student = window.getStudentDataByEmail ? window.getStudentDataByEmail(u.email) : null;
        const isVerified = !!student;
        const fullName = u.full_name || (student ? student.fullName : '') || 'Anonymous';
        const usn = (u.usn || (student ? student.usn : '') || '').trim().toUpperCase();
        const phone = u.phone || (student ? student.phone : '') || '';
        const section = (student ? student.section : '') || '';
        const isManuallyUpdated = !!(u.usn || u.phone || (u.full_name && u.full_name !== (student ? student.fullName : '')));

        let status = 'Unverified';
        if (isManuallyUpdated) status = 'Manually Updated';
        else if (isVerified) status = 'Excel Verified';

        const leadObj = CORE_LEADS.find(l => Number(l.id) === Number(u.team_id));
        const teamName = leadObj ? leadObj.team : (u.team_id ? `Team ${u.team_id}` : 'No Team');
        const teamLeader = leadObj ? leadObj.name : 'N/A';
        const teamLeaderEmail = leadObj ? (allUsers.find(au => Number(au.team_id) === Number(leadObj.id) && au.role === 'lead')?.email || '') : '';
        const projectName = leadObj?.project_name || 'TBD';

        let milestoneProgress = 0;
        if (leadObj && leadObj.milestones) {
            const completedCount = Object.values(leadObj.milestones).filter(Boolean).length;
            milestoneProgress = Math.round((completedCount / 8) * 100);
        }

        const attInfo = attendanceMap[u.id];
        const attendancePercent = attInfo && attInfo.total > 0 ? `${attInfo.percent}%` : '0%';
        const attendancePresent = attInfo ? attInfo.present : 0;
        const attendanceTotal = attInfo ? attInfo.total : 0;

        return {
            id: u.id,
            fullName,
            username: u.username ? `@${u.username}` : '',
            email: u.email || '',
            phone: phone ? String(phone) : '',
            usn,
            section,
            attendancePercent,
            attendancePresent,
            attendanceTotal,
            attendanceStatsStr: attInfo && attInfo.total > 0 ? `${attInfo.percent}% (${attInfo.present}/${attInfo.total})` : '0% (0/0)',
            teamId: u.team_id,
            teamName,
            teamLeader,
            teamLeaderEmail,
            projectName,
            milestoneProgress: `${milestoneProgress}%`,
            role: u.role || 'member',
            status,
            discTag: u.disc_tag || '',
            discSummary: u.summary || '',
            createdAt: u.created_at ? new Date(u.created_at).toLocaleString('en-IN') : ''
        };
    }

    function getFilteredUsers() {
        const displayUsers = allUsers.filter(u => u.role !== 'admin' && u.role !== 'lead');
        const query = (userSearchQuery || '').trim().toLowerCase();
        const sectionQuery = (userSectionFilter || '').trim().toUpperCase();
        const teamQuery = (userTeamFilter || '').trim();

        return displayUsers.filter(u => {
            const student = window.getStudentDataByEmail ? window.getStudentDataByEmail(u.email) : null;
            const fullName = (u.full_name || (student ? student.fullName : '') || '').toLowerCase();
            const username = (u.username || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const usn = (u.usn || (student ? student.usn : '') || '').toLowerCase();
            const section = (student ? student.section : '') || '';
            const cardTeamId = u.team_id !== null && u.team_id !== undefined ? String(u.team_id) : '';

            const searchText = `${fullName} ${username} ${email} ${usn}`;
            const matchesSearch = !query || searchText.includes(query);
            const matchesSection = !sectionQuery || section.toUpperCase() === sectionQuery;

            let matchesTeam = true;
            if (teamQuery === 'none') {
                matchesTeam = !cardTeamId || cardTeamId === 'null' || cardTeamId === 'undefined';
            } else if (teamQuery) {
                matchesTeam = cardTeamId === teamQuery;
            }

            return matchesSearch && matchesSection && matchesTeam;
        });
    }

    function downloadCSVFallback(aoaData, filename) {
        if (!aoaData || !aoaData.length) return;
        const csvRows = aoaData.map(row => {
            if (!Array.isArray(row)) return '';
            return row.map(cell => {
                const val = cell === null || cell === undefined ? '' : String(cell);
                return `"${val.replace(/"/g, '""')}"`;
            }).join(',');
        });
        const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    async function exportUsersAndTeamsToExcel() {
        try {
            const filteredUsers = getFilteredUsers();
            if (filteredUsers.length === 0) {
                Toast.error('No users match the selected filters to export.');
                return;
            }

            Toast.info('Preparing Team-Grouped Excel export...');

            // Ensure fresh attendance records are loaded
            try {
                const attData = await ICCSupabase.fetchAllAttendanceData();
                if (attData && attData.length > 0) {
                    allAttendance = attData;
                    updateAttendanceStats(allAttendance);
                }
            } catch (attErr) {
                console.warn('Could not refresh attendance for Excel export:', attErr);
            }

            // Build filter description for title
            const filterParts = [];
            if (userSectionFilter) filterParts.push(`Section: ${userSectionFilter}`);
            if (userTeamFilter) {
                if (userTeamFilter === 'none') filterParts.push('Team: No Team (Unassigned)');
                else {
                    const tObj = CORE_LEADS.find(l => String(l.id) === String(userTeamFilter));
                    if (tObj) filterParts.push(`Team: ${tObj.team}`);
                }
            }
            if (userSearchQuery) filterParts.push(`Search: "${userSearchQuery}"`);
            const activeFilterStr = filterParts.length ? filterParts.join(' | ') : 'All Members (No Filter)';

            // ═════════════════════════════════════════════════════════════
            // SHEET 1: TEAM-WISE GROUPED ROSTER (Main Sheet)
            // ═════════════════════════════════════════════════════════════
            const aoaGrouped = [];

            // Title Banner
            aoaGrouped.push(['ICC SOCIAL HUB — TEAM-WISE USERS ROSTER']);
            aoaGrouped.push([`Generated On: ${new Date().toLocaleString('en-IN')}`, '', '', '', '', `Applied Filters: ${activeFilterStr}`]);
            aoaGrouped.push([]); // Blank separator

            // Determine which teams to iterate through
            let teamsToIterate = [...CORE_LEADS];
            if (userTeamFilter === 'none') {
                teamsToIterate = []; // only unassigned
            } else if (userTeamFilter) {
                teamsToIterate = CORE_LEADS.filter(l => String(l.id) === String(userTeamFilter));
            }

            let renderedTeamsCount = 0;

            teamsToIterate.forEach(lead => {
                // Find all matching users for this team from filteredUsers
                const teamMembers = filteredUsers.filter(u => Number(u.team_id) === Number(lead.id));
                const allTeamMembers = allUsers.filter(u => Number(u.team_id) === Number(lead.id) && u.role !== 'admin' && u.role !== 'lead');

                // If filtering by specific section/search across all teams and this team has 0 matches, skip
                if (filteredUsers.length > 0 && teamMembers.length === 0 && (userSectionFilter || userSearchQuery) && !userTeamFilter) {
                    return;
                }

                renderedTeamsCount++;
                const assignedLeadUser = allUsers.find(u => Number(u.team_id) === Number(lead.id) && u.role === 'lead');
                const leadEmail = assignedLeadUser ? assignedLeadUser.email : 'Unassigned';

                let progress = 0;
                if (lead.milestones) {
                    const completedCount = Object.values(lead.milestones).filter(Boolean).length;
                    progress = Math.round((completedCount / 8) * 100);
                }

                // 1. Team Header Row (Team name, Lead name once, Lead email, Project & Stats)
                aoaGrouped.push([
                    `TEAM: ${lead.team.toUpperCase()}`,
                    `Team Leader: ${lead.name}`,
                    `Leader Email: ${leadEmail}`,
                    `Project: ${lead.project_name || 'TBD'}`,
                    `Progress: ${progress}%`,
                    `Total Members: ${allTeamMembers.length}`,
                    `Filtered in View: ${teamMembers.length}`
                ]);

                // 2. Member Column Headers
                aoaGrouped.push([
                    '#',
                    'Member Full Name',
                    'USN / Reg No',
                    'Section',
                    'Attendance %',
                    'Email Address',
                    'Phone Number',
                    'Role',
                    'Verification Status',
                    'Username',
                    'DISC Personality',
                    'Registered Date'
                ]);

                // 3. Member Rows (Listed one below the other)
                if (teamMembers.length === 0) {
                    aoaGrouped.push(['—', '(No members in this team matching active filter)', '', '', '', '', '', '', '', '', '', '']);
                } else {
                    teamMembers.forEach((u, idx) => {
                        const d = getUserDetails(u);
                        aoaGrouped.push([
                            idx + 1,
                            d.fullName,
                            d.usn,
                            d.section,
                            d.attendancePercent,
                            d.email,
                            d.phone,
                            d.role,
                            d.status,
                            d.username,
                            d.discTag,
                            d.createdAt
                        ]);
                    });
                }

                // 4. Spacer rows before next team
                aoaGrouped.push([]);
                aoaGrouped.push([]);
            });

            // 5. Unassigned / No Team Section
            const unassignedMembers = filteredUsers.filter(u => !u.team_id || u.team_id === 'null' || u.team_id === 'undefined');
            if (unassignedMembers.length > 0 || userTeamFilter === 'none') {
                aoaGrouped.push([
                    'TEAM: UNASSIGNED / NO TEAM',
                    'Team Leader: None',
                    'Leader Email: N/A',
                    'Project: None',
                    'Progress: N/A',
                    `Total Unassigned: ${unassignedMembers.length}`,
                    `Filtered in View: ${unassignedMembers.length}`
                ]);

                aoaGrouped.push([
                    '#',
                    'Member Full Name',
                    'USN / Reg No',
                    'Section',
                    'Attendance %',
                    'Email Address',
                    'Phone Number',
                    'Role',
                    'Verification Status',
                    'Username',
                    'DISC Personality',
                    'Registered Date'
                ]);

                if (unassignedMembers.length === 0) {
                    aoaGrouped.push(['—', '(No unassigned members matching active filter)', '', '', '', '', '', '', '', '', '', '']);
                } else {
                    unassignedMembers.forEach((u, idx) => {
                        const d = getUserDetails(u);
                        aoaGrouped.push([
                            idx + 1,
                            d.fullName,
                            d.usn,
                            d.section,
                            d.attendancePercent,
                            d.email,
                            d.phone,
                            d.role,
                            d.status,
                            d.username,
                            d.discTag,
                            d.createdAt
                        ]);
                    });
                }

                aoaGrouped.push([]);
                aoaGrouped.push([]);
            }

            // ═════════════════════════════════════════════════════════════
            // SHEET 2: FLAT FILTERED TABLE (For Sorting / Pivots)
            // ═════════════════════════════════════════════════════════════
            const flatUsersData = filteredUsers.map((u, idx) => {
                const d = getUserDetails(u);
                return {
                    'SL No': idx + 1,
                    'Team Name': d.teamName,
                    'Team Leader': d.teamLeader,
                    'Team Leader Email': d.teamLeaderEmail,
                    'Student Full Name': d.fullName,
                    'USN / Reg No': d.usn,
                    'Section': d.section,
                    'Attendance %': d.attendancePercent,
                    'Email Address': d.email,
                    'Phone Number': d.phone,
                    'Role': d.role,
                    'Verification Status': d.status,
                    'Username': d.username,
                    'Team Project': d.projectName,
                    'Project Progress': d.milestoneProgress,
                    'DISC Personality': d.discTag,
                    'Account Created': d.createdAt
                };
            });

            // ═════════════════════════════════════════════════════════════
            // SHEET 3: TEAMS SUMMARY
            // ═════════════════════════════════════════════════════════════
            const teamsData = CORE_LEADS.map(lead => {
                const assignedLeadUser = allUsers.find(u => Number(u.team_id) === Number(lead.id) && u.role === 'lead');
                const members = allUsers.filter(u => Number(u.team_id) === Number(lead.id) && u.role !== 'admin' && u.role !== 'lead');
                const membersListStr = members.map(m => {
                    const s = window.getStudentDataByEmail ? window.getStudentDataByEmail(m.email) : null;
                    const name = m.full_name || (s ? s.fullName : '') || m.username || 'User';
                    const usn = m.usn || (s ? s.usn : '') || '';
                    return usn ? `${name} (${usn})` : name;
                }).join(', ');

                let progress = 0;
                if (lead.milestones) {
                    const completedCount = Object.values(lead.milestones).filter(Boolean).length;
                    progress = Math.round((completedCount / 8) * 100);
                }

                return {
                    'Team ID': lead.id,
                    'Team Name': lead.team,
                    'Team Leader': lead.name,
                    'Leader Email': assignedLeadUser ? assignedLeadUser.email : 'Unassigned',
                    'Leader Initials': lead.initials,
                    'Project Name': lead.project_name || 'TBD',
                    'Milestone Progress': `${progress}%`,
                    'Total Members Count': members.length,
                    'Team Members (Names & USNs)': membersListStr || 'No members yet',
                    'Specialties': Array.isArray(lead.specialties) ? lead.specialties.join(', ') : (lead.specialties || ''),
                    'Team Bio': lead.bio || ''
                };
            });

            // Build dynamic filename reflecting current filters
            const dateStr = new Date().toISOString().slice(0, 10);
            let filterSuffix = '';
            if (userSectionFilter) filterSuffix += `_Sec_${userSectionFilter}`;
            if (userTeamFilter) {
                if (userTeamFilter === 'none') filterSuffix += '_NoTeam';
                else {
                    const teamObj = CORE_LEADS.find(l => String(l.id) === String(userTeamFilter));
                    if (teamObj) filterSuffix += `_${teamObj.team.replace(/\s+/g, '_')}`;
                }
            }
            if (userSearchQuery) filterSuffix += `_Filtered`;

            const fileName = `ICC_Team_Roster${filterSuffix || '_All'}_${dateStr}.xlsx`;

            if (window.XLSX) {
                const wb = XLSX.utils.book_new();

                const wsGrouped = XLSX.utils.aoa_to_sheet(aoaGrouped);
                const wsFlat = XLSX.utils.json_to_sheet(flatUsersData);
                const wsTeams = XLSX.utils.json_to_sheet(teamsData);

                // Column widths for Grouped Sheet
                wsGrouped['!cols'] = [
                    { wch: 8 },   // # or TEAM: XXX
                    { wch: 28 },  // Full Name / Leader
                    { wch: 18 },  // USN / Lead Email
                    { wch: 10 },  // Section / Project
                    { wch: 16 },  // Attendance %
                    { wch: 32 },  // Email Address / Progress
                    { wch: 18 },  // Phone Number / Total Members
                    { wch: 14 },  // Role / Filtered in view
                    { wch: 20 },  // Verification Status
                    { wch: 18 },  // Username
                    { wch: 18 },  // DISC Personality
                    { wch: 22 }   // Registered Date
                ];

                // Column widths for Flat Sheet
                wsFlat['!cols'] = [
                    { wch: 8 },  // SL No
                    { wch: 18 }, // Team Name
                    { wch: 20 }, // Team Leader
                    { wch: 28 }, // Team Leader Email
                    { wch: 24 }, // Student Full Name
                    { wch: 15 }, // USN
                    { wch: 9 },  // Section
                    { wch: 16 }, // Attendance %
                    { wch: 30 }, // Email Address
                    { wch: 15 }, // Phone Number
                    { wch: 10 }, // Role
                    { wch: 18 }, // Verification Status
                    { wch: 16 }, // Username
                    { wch: 22 }, // Team Project
                    { wch: 18 }, // Project Progress
                    { wch: 16 }, // DISC Personality
                    { wch: 22 }  // Account Created
                ];

                // Column widths for Teams Overview
                wsTeams['!cols'] = [
                    { wch: 8 },  // Team ID
                    { wch: 18 }, // Team Name
                    { wch: 20 }, // Team Leader
                    { wch: 28 }, // Leader Email
                    { wch: 15 }, // Leader Initials
                    { wch: 22 }, // Project Name
                    { wch: 18 }, // Milestone Progress
                    { wch: 18 }, // Total Members Count
                    { wch: 50 }, // Team Members
                    { wch: 35 }, // Specialties
                    { wch: 40 }  // Team Bio
                ];

                XLSX.utils.book_append_sheet(wb, wsGrouped, 'Team-Wise Roster');
                XLSX.utils.book_append_sheet(wb, wsFlat, 'All Members (Flat Table)');
                XLSX.utils.book_append_sheet(wb, wsTeams, 'Teams Overview');

                XLSX.writeFile(wb, fileName);
                Toast.success(`📊 Excel downloaded: ${filteredUsers.length} members grouped team-wise!`);
            } else {
                downloadCSVFallback(aoaGrouped, fileName.replace('.xlsx', '.csv'));
                Toast.success(`📊 CSV downloaded: ${filteredUsers.length} members grouped team-wise!`);
            }
        } catch (err) {
            console.error('Error exporting users Excel:', err);
            Toast.error('Export failed: ' + err.message);
        }
    }

    function renderRequestDiff(req) {
        const changes = req.proposed_changes || {};
        const orig = req.original_data || {};
        const diffs = [];

        if (changes.hasOwnProperty('full_name') && changes.full_name !== orig.full_name) {
            diffs.push({
                label: 'Full Name',
                from: orig.full_name || '(Empty)',
                to: changes.full_name || '(Cleared/Reset)'
            });
        }
        if (changes.hasOwnProperty('username') && changes.username !== orig.username) {
            diffs.push({
                label: 'Auth Username',
                from: orig.username ? `@${orig.username}` : '(Empty)',
                to: changes.username ? `@${changes.username}` : '(Empty)'
            });
        }
        if (changes.hasOwnProperty('usn') && changes.usn !== orig.usn) {
            diffs.push({
                label: 'USN',
                from: orig.usn || '(Empty)',
                to: changes.usn || '(Cleared/Reset)'
            });
        }
        if (changes.hasOwnProperty('phone') && changes.phone !== orig.phone) {
            diffs.push({
                label: 'Phone Number',
                from: orig.phone || '(Empty)',
                to: changes.phone || '(Cleared/Reset)'
            });
        }
        if (changes.hasOwnProperty('team_id') && String(changes.team_id) !== String(orig.team_id)) {
            diffs.push({
                label: 'Team Assignment',
                from: getTeamName(orig.team_id),
                to: getTeamName(changes.team_id)
            });
        }

        if (diffs.length === 0) {
            return `<div class="text-[11px] text-zinc-400 font-mono bg-zinc-950/70 p-2 rounded-lg mt-2 border border-zinc-800">${escapeHtml(JSON.stringify(changes))}</div>`;
        }

        return `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
            ${diffs.map(d => `
                <div class="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5 text-xs">
                    <span class="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold block mb-0.5">${d.label}</span>
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-zinc-500 line-through text-[11px]">${escapeHtml(d.from)}</span>
                        <span class="text-zinc-600 text-[10px]">➔</span>
                        <span class="text-emerald-400 font-semibold text-[11px]">${escapeHtml(d.to)}</span>
                    </div>
                </div>
            `).join('')}
        </div>`;
    }

    function renderPendingRequestCard(req, isSuper) {
        const currentUser = ICCSupabase.getUser();
        const isMyRequest = currentUser && req.requester_id === currentUser.id;

        return `
        <div class="glass-card rounded-xl p-4 border border-amber-500/25 bg-amber-500/[0.04] transition-all">
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-zinc-800/60">
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            🛡️ Change Request
                        </span>
                        <span class="text-[12px] text-zinc-300 font-medium">
                            Target: <strong class="text-white">${escapeHtml(req.target_user_name || 'User')}</strong> ${req.target_user_email ? `<span class="text-zinc-500 font-mono text-[11px]">(${escapeHtml(req.target_user_email)})</span>` : ''}
                        </span>
                    </div>
                    <p class="text-[11px] text-zinc-500 mt-1">
                        Requested by <strong class="text-zinc-300">${escapeHtml(req.requester_name || 'Admin')}</strong> (${escapeHtml(req.requester_email || '—')}) • ${formatTimeAgo(req.created_at)}
                    </p>
                </div>
                
                ${isSuper ? `
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <button class="approve-edit-req-btn px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md flex items-center gap-1" data-id="${req.id}">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                            Approve & Apply
                        </button>
                        <button class="reject-edit-req-btn px-3 py-1.5 bg-red-900/40 hover:bg-red-800 text-red-300 rounded-lg text-xs font-medium transition-all" data-id="${req.id}">
                            Reject
                        </button>
                    </div>
                ` : `
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <span class="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-semibold">
                            ⏳ Awaiting Super Admin Approval
                        </span>
                        ${isMyRequest ? `
                            <button class="cancel-edit-req-btn text-[11px] text-zinc-500 hover:text-red-400 underline transition-colors" data-id="${req.id}">
                                Cancel
                            </button>
                        ` : ''}
                    </div>
                `}
            </div>

            <!-- Changes Diff View -->
            ${renderRequestDiff(req)}
        </div>`;
    }

    function getAvailableTabs() {
        const isSuper = ICCSupabase.isSuperAdmin();
        const perms = ICCSupabase.getAdminPermissions ? ICCSupabase.getAdminPermissions() : { all: true };
        const tabs = [];

        if (isSuper || perms.broadcast) tabs.push({ id: 'broadcast', label: 'Broadcast', icon: '📢' });
        if (isSuper || perms.leads) tabs.push({ id: 'leads', label: 'Leads', icon: '👥' });
        if (isSuper || perms.users) tabs.push({ id: 'users', label: 'Users', icon: '📋' });
        if (isSuper || perms.moderate) tabs.push({ id: 'moderate', label: 'Moderate', icon: '🛡️' });
        if (isSuper || perms.events) tabs.push({ id: 'events', label: 'Events', icon: '📅' });
        if (isSuper) tabs.push({ id: 'access_control', label: 'Access Control', icon: '🔐', badge: 'Super' });

        return tabs;
    }

    function renderPermissionDenied(msg = 'You do not have permission to access this section.') {
        return `
        <div class="glass-card rounded-2xl p-8 text-center max-w-md mx-auto my-12 border border-zinc-800">
            <div class="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center text-2xl mx-auto mb-4">
                🔒
            </div>
            <h3 class="font-heading font-semibold text-lg text-white mb-2">Access Restricted</h3>
            <p class="text-xs text-zinc-400 mb-5 leading-relaxed">${escapeHtml(msg)}</p>
            <div class="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-[11px] text-zinc-500">
                Please request a <strong class="text-amber-400">Super Administrator</strong> to grant this permission via the Access Control panel.
            </div>
        </div>`;
    }

    function render() {
        const user = ICCSupabase.getUser();
        if (!user) return `<div class="empty-state min-h-screen"><h3 class="font-heading font-semibold text-lg">Sign In Required</h3><button onclick="AuthModal.open()" class="mt-4 px-6 py-2.5 bg-red-600 rounded-xl text-sm font-semibold">Sign In</button></div>`;
        if (!ICCSupabase.isAdmin()) return `<div class="empty-state min-h-screen"><div class="empty-state-icon"><svg class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div><h3 class="font-heading font-semibold text-lg mb-1">Access Denied</h3><p class="text-sm text-zinc-500">You don't have admin privileges.</p><a href="#feed" class="mt-4 inline-block px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-all">Back to Feed</a></div>`;

        const tabs = getAvailableTabs();
        if (!tabs.some(t => t.id === activeTab)) {
            activeTab = tabs[0]?.id || 'users';
        }

        return `
        <section class="min-h-screen pt-2 pb-4 px-4" id="admin-section">
            <div class="max-w-4xl mx-auto">
                <div class="flex items-center gap-3 mb-4">
                    <a href="#profile" class="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    </a>
                    <div>
                        <h1 class="font-heading font-bold text-xl">Command Center</h1>
                        <p class="text-[11px] text-zinc-500">Admin Dashboard</p>
                    </div>
                </div>
                <div class="flex gap-1 overflow-x-auto mb-4 pb-1 border-b border-zinc-800/50">
                    ${tabs.map(t => `
                        <button class="admin-tab flex items-center gap-1.5 ${activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
                            <span class="text-xs">${t.icon}</span>
                            <span>${t.label}</span>
                            ${t.badge ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">${t.badge}</span>` : ''}
                        </button>
                    `).join('')}
                </div>
                <div id="admin-content">${renderTab()}</div>

                <!-- Developer Credit -->
                <div class="mt-16 mb-12 py-8 border-t border-zinc-800/50 text-center animate-fade-in">
                    <p class="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-medium mb-3">Crafted with ❤️ by</p>
                    <a href="https://saravanantm1920.wixsite.com/my-site-4" target="_blank" 
                       class="inline-flex items-center gap-2 px-5 py-2 bg-zinc-800/50 hover:bg-red-500/10 text-zinc-300 hover:text-red-500 rounded-full border border-zinc-700/50 hover:border-red-500/50 transition-all duration-300 group shadow-lg">
                        <span class="text-sm font-bold tracking-tight">T M Saravanan</span>
                        <svg class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                    </a>
                </div>
            </div>
        </section>`;
    }

    function renderTab() {
        const isSuper = ICCSupabase.isSuperAdmin();
        const perms = ICCSupabase.getAdminPermissions ? ICCSupabase.getAdminPermissions() : { all: true };

        if (activeTab === 'access_control' && !isSuper) {
            return renderPermissionDenied('The Access Control console is exclusively reserved for Super Administrators.');
        }
        if (activeTab === 'broadcast' && !isSuper && !perms.broadcast && !perms.all) {
            return renderPermissionDenied('You have not been granted access to Broadcast Alerts.');
        }
        if (activeTab === 'leads' && !isSuper && !perms.leads && !perms.all) {
            return renderPermissionDenied('You have not been granted access to Core Leads management.');
        }
        if (activeTab === 'users' && !isSuper && !perms.users && !perms.all) {
            return renderPermissionDenied('You have not been granted access to User Management.');
        }
        if (activeTab === 'moderate' && !isSuper && !perms.moderate && !perms.all) {
            return renderPermissionDenied('You have not been granted access to Content Moderation.');
        }
        if (activeTab === 'events' && !isSuper && !perms.events && !perms.all) {
            return renderPermissionDenied('You have not been granted access to Events Management.');
        }

        switch (activeTab) {
            case 'broadcast': return renderBroadcast();
            case 'leads': return renderLeads();
            case 'users': return renderUsers();
            case 'moderate': return renderModerate();
            case 'events': return renderEvents();
            case 'access_control': return renderAccessControl();
            default: return renderUsers();
        }
    }

    function renderAccessControl() {
        const currentUserId = ICCSupabase.getUser()?.id;
        const allAdmins = allUsers.filter(u => u.role === 'admin' || u.role === 'super_admin' || u.role === 'superadmin');
        const superAdminsCount = allAdmins.filter(u => u.role === 'super_admin' || u.role === 'superadmin').length;
        const standardAdminsCount = allAdmins.length - superAdminsCount;

        // Filter active admins based on role pill
        let filteredAdmins = allAdmins;
        if (accessRoleFilter === 'super_admin') {
            filteredAdmins = allAdmins.filter(u => u.role === 'super_admin' || u.role === 'superadmin');
        } else if (accessRoleFilter === 'admin') {
            filteredAdmins = allAdmins.filter(u => u.role === 'admin');
        }

        // Search candidates to appoint
        const query = (accessSearchQuery || '').trim().toLowerCase();
        let searchCandidates = [];
        if (query) {
            searchCandidates = allUsers.filter(u => {
                const student = window.getStudentDataByEmail ? window.getStudentDataByEmail(u.email) : null;
                const name = (u.full_name || (student ? student.fullName : '') || '').toLowerCase();
                const uname = (u.username || '').toLowerCase();
                const email = (u.email || '').toLowerCase();
                const usn = (u.usn || (student ? student.usn : '') || '').toLowerCase();
                return name.includes(query) || uname.includes(query) || email.includes(query) || usn.includes(query);
            }).slice(0, 8);
        }

        const appointingUser = appointingUserId ? allUsers.find(u => u.id === appointingUserId) : null;

        return `
        <div class="space-y-6 animate-fade-in">
            <!-- Header Banner -->
            <div class="glass-card rounded-2xl p-5 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 shadow-xl">
                <div class="flex items-center justify-between flex-wrap gap-4">
                    <div class="flex items-center gap-3.5">
                        <div class="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-xl font-bold shadow-inner">
                            🔐
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-heading font-bold text-base text-white">Access Control & Role Governance</h3>
                                <span class="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">Super Admin Only</span>
                            </div>
                            <p class="text-[11px] text-zinc-400 mt-0.5">Toggle granular feature permissions, appoint new admins, and govern club privileges.</p>
                        </div>
                    </div>
                </div>

                <!-- Metrics Overview -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-zinc-800/60">
                    <div class="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/80">
                        <span class="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">Total Admins</span>
                        <div class="flex items-baseline gap-1 mt-0.5">
                            <span class="text-xl font-bold text-white">${allAdmins.length}</span>
                            <span class="text-[10px] text-zinc-500">accounts</span>
                        </div>
                    </div>
                    <div class="bg-amber-500/10 rounded-xl p-3 border border-amber-500/30">
                        <span class="text-[10px] uppercase font-semibold text-amber-400 tracking-wider block">Super Admins</span>
                        <div class="flex items-baseline gap-1 mt-0.5">
                            <span class="text-xl font-bold text-amber-300">${superAdminsCount}</span>
                            <span class="text-[10px] text-amber-500/80">full power</span>
                        </div>
                    </div>
                    <div class="bg-blue-500/10 rounded-xl p-3 border border-blue-500/30">
                        <span class="text-[10px] uppercase font-semibold text-blue-400 tracking-wider block">Standard Admins</span>
                        <div class="flex items-baseline gap-1 mt-0.5">
                            <span class="text-xl font-bold text-blue-300">${standardAdminsCount}</span>
                            <span class="text-[10px] text-blue-400/80">custom perms</span>
                        </div>
                    </div>
                    <div class="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800/80">
                        <span class="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">Platform Users</span>
                        <div class="flex items-baseline gap-1 mt-0.5">
                            <span class="text-xl font-bold text-zinc-200">${allUsers.length}</span>
                            <span class="text-[10px] text-zinc-500">registered</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SECTION 1: SEARCH & APPOINT NEW ADMIN -->
            <div class="glass-card rounded-2xl p-5 border border-zinc-800">
                <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                        <h4 class="font-heading font-semibold text-sm text-white flex items-center gap-2">
                            <span>🔍 Search & Appoint New Administrator</span>
                        </h4>
                        <p class="text-[11px] text-zinc-400">Search any registered member to grant admin privileges and choose their feature accesses.</p>
                    </div>
                </div>

                <!-- Search Input Bar -->
                <div class="relative mb-3">
                    <input type="text" id="access-user-search-input" value="${escapeHtml(accessSearchQuery)}" 
                        placeholder="Search members by full name, email address, @username, or USN..." 
                        class="form-input w-full pl-10 pr-10 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:border-blue-500 outline-none">
                    <svg class="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    ${accessSearchQuery ? `
                        <button id="clear-access-search-btn" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 text-xs">✕</button>
                    ` : ''}
                </div>

                <!-- Appoint Configuration Card (When user clicked "+ Appoint as Admin") -->
                ${appointingUser ? `
                    <div class="p-4 rounded-xl border border-blue-500/40 bg-blue-500/5 mb-4 space-y-4 animate-fade-in" id="appoint-panel">
                        <div class="flex items-center justify-between border-b border-blue-500/20 pb-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm">
                                    ${(appointingUser.full_name || appointingUser.username || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h5 class="text-xs font-semibold text-white">Appointing: ${escapeHtml(appointingUser.full_name || 'Anonymous')}</h5>
                                    <p class="text-[11px] text-zinc-400">${escapeHtml(appointingUser.email || 'No email')} · @${escapeHtml(appointingUser.username || 'user')}</p>
                                </div>
                            </div>
                            <button id="cancel-appoint-btn" class="text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-800/80 rounded-lg transition-colors">Cancel</button>
                        </div>

                        <!-- Role Level Selector -->
                        <div class="space-y-1.5">
                            <label class="text-[11px] font-semibold text-zinc-300 block uppercase tracking-wider">Target Admin Role</label>
                            <div class="grid grid-cols-2 gap-2">
                                <label class="flex items-center gap-2 p-2.5 bg-zinc-950/70 border ${!appointingUserDraft?.isSuperAdmin ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800'} rounded-xl cursor-pointer">
                                    <input type="radio" name="appoint_role" value="admin" class="accent-blue-500" ${!appointingUserDraft?.isSuperAdmin ? 'checked' : ''} id="role-admin-radio">
                                    <div>
                                        <span class="text-xs font-semibold text-white block">👑 Standard Admin</span>
                                        <span class="text-[10px] text-zinc-400">Customizable feature permissions</span>
                                    </div>
                                </label>
                                <label class="flex items-center gap-2 p-2.5 bg-zinc-950/70 border ${appointingUserDraft?.isSuperAdmin ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-800'} rounded-xl cursor-pointer">
                                    <input type="radio" name="appoint_role" value="super_admin" class="accent-amber-500" ${appointingUserDraft?.isSuperAdmin ? 'checked' : ''} id="role-superadmin-radio">
                                    <div>
                                        <span class="text-xs font-semibold text-amber-300 block">🛡️ Super Admin</span>
                                        <span class="text-[10px] text-zinc-400">Unrestricted system-wide access</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- Granular Permissions (Only for Standard Admin) -->
                        <div id="appoint-perms-section" class="${appointingUserDraft?.isSuperAdmin ? 'opacity-40 pointer-events-none' : ''} space-y-2.5">
                            <div class="flex items-center justify-between">
                                <label class="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Granular Feature Permissions</label>
                                <label class="inline-flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" id="appoint-all-toggle" class="accent-blue-500" ${appointingUserDraft?.all ? 'checked' : ''}>
                                    <span class="text-[11px] text-zinc-300 font-medium">All Features (Full Access)</span>
                                </label>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <label class="flex items-center justify-between p-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-xl cursor-pointer hover:border-zinc-700">
                                    <div>
                                        <span class="text-xs font-medium text-white flex items-center gap-1.5">📢 Broadcast Alerts</span>
                                        <span class="text-[10px] text-zinc-500">Send push banners & alerts</span>
                                    </div>
                                    <input type="checkbox" class="appoint-perm-check accent-blue-500 w-4 h-4" data-perm="broadcast" ${appointingUserDraft?.broadcast ? 'checked' : ''}>
                                </label>

                                <label class="flex items-center justify-between p-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-xl cursor-pointer hover:border-zinc-700">
                                    <div>
                                        <span class="text-xs font-medium text-white flex items-center gap-1.5">🛡️ Moderate Content</span>
                                        <span class="text-[10px] text-zinc-500">Delete & moderate posts</span>
                                    </div>
                                    <input type="checkbox" class="appoint-perm-check accent-blue-500 w-4 h-4" data-perm="moderate" ${appointingUserDraft?.moderate ? 'checked' : ''}>
                                </label>

                                <label class="flex items-center justify-between p-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-xl cursor-pointer hover:border-zinc-700">
                                    <div>
                                        <span class="text-xs font-medium text-white flex items-center gap-1.5">📅 Add & Manage Events</span>
                                        <span class="text-[10px] text-zinc-500">Create, edit, delete events</span>
                                    </div>
                                    <input type="checkbox" class="appoint-perm-check accent-blue-500 w-4 h-4" data-perm="events" ${appointingUserDraft?.events ? 'checked' : ''}>
                                </label>

                                <label class="flex items-center justify-between p-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-xl cursor-pointer hover:border-zinc-700">
                                    <div>
                                        <span class="text-xs font-medium text-white flex items-center gap-1.5">👥 Core Team Leads</span>
                                        <span class="text-[10px] text-zinc-500">Manage leads & rosters</span>
                                    </div>
                                    <input type="checkbox" class="appoint-perm-check accent-blue-500 w-4 h-4" data-perm="leads" ${appointingUserDraft?.leads ? 'checked' : ''}>
                                </label>

                                <label class="flex items-center justify-between p-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-xl cursor-pointer hover:border-zinc-700 col-span-1 sm:col-span-2">
                                    <div>
                                        <span class="text-xs font-medium text-white flex items-center gap-1.5">📋 User Management</span>
                                        <span class="text-[10px] text-zinc-500">Edit member details, approvals & export roster</span>
                                    </div>
                                    <input type="checkbox" class="appoint-perm-check accent-blue-500 w-4 h-4" data-perm="users" ${appointingUserDraft?.users ? 'checked' : ''}>
                                </label>
                            </div>
                        </div>

                        <!-- Action Submit Button -->
                        <div class="flex items-center gap-2 pt-2">
                            <button id="confirm-appoint-btn" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2" data-user-id="${appointingUser.id}">
                                <span>Confirm & Appoint Administrator</span>
                            </button>
                            <button id="cancel-appoint-btn-2" class="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl text-xs transition-all">
                                Cancel
                            </button>
                        </div>
                    </div>
                ` : ''}

                <!-- Search Results List -->
                ${query ? `
                    <div class="space-y-2 mt-2">
                        <div class="text-[11px] text-zinc-500 font-medium mb-1 flex items-center justify-between">
                            <span>Search results for "${escapeHtml(query)}"</span>
                            <span>${searchCandidates.length} found</span>
                        </div>
                        ${searchCandidates.length === 0 ? `
                            <div class="p-6 text-center bg-zinc-950/40 rounded-xl border border-zinc-800 text-xs text-zinc-500">
                                No users found matching "${escapeHtml(query)}"
                            </div>
                        ` : searchCandidates.map(u => {
                            const isAlreadyAdmin = u.role === 'admin' || u.role === 'super_admin' || u.role === 'superadmin';
                            const student = window.getStudentDataByEmail ? window.getStudentDataByEmail(u.email) : null;
                            const fullName = u.full_name || (student ? student.fullName : 'Anonymous');
                            const usn = u.usn || (student ? student.usn : '');
                            const section = student ? student.section : '';
                            return `
                            <div class="flex items-center justify-between gap-3 p-3 bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-800/80 rounded-xl transition-colors">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-9 h-9 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                        ${fullName.charAt(0).toUpperCase()}
                                    </div>
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span class="text-xs font-semibold text-white truncate">${escapeHtml(fullName)}</span>
                                            ${usn ? `<span class="text-[10px] font-mono text-zinc-400">(${escapeHtml(usn)})</span>` : ''}
                                            ${section ? `<span class="px-1.5 py-0.2 rounded text-[9px] bg-zinc-800 text-zinc-300">Sec ${escapeHtml(section)}</span>` : ''}
                                        </div>
                                        <p class="text-[11px] text-zinc-400 font-mono truncate">${escapeHtml(u.email || 'No email')} · @${escapeHtml(u.username || 'user')}</p>
                                    </div>
                                </div>
                                <div class="flex-shrink-0">
                                    ${isAlreadyAdmin ? `
                                        <span class="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
                                            ${u.role === 'super_admin' || u.role === 'superadmin' ? '🛡️ Super Admin' : '👑 Admin'}
                                        </span>
                                    ` : `
                                        <button class="start-appoint-btn px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all shadow-sm" data-user-id="${u.id}">
                                            + Appoint as Admin
                                        </button>
                                    `}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                ` : `
                    <div class="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/60 text-center">
                        <p class="text-[11px] text-zinc-500">💡 Type a member's name, email, or USN above to promote them to an Administrator.</p>
                    </div>
                `}
            </div>

            <!-- SECTION 2: ACTIVE ADMINISTRATORS & LIVE FEATURE TOGGLES -->
            <div class="glass-card rounded-2xl p-5 border border-zinc-800">
                <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div>
                        <h4 class="font-heading font-semibold text-sm text-white flex items-center gap-2">
                            <span>🛡️ Active Administrators & Feature Access</span>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">${allAdmins.length}</span>
                        </h4>
                        <p class="text-[11px] text-zinc-400">Toggle individual feature switches in real time. Changes take effect immediately.</p>
                    </div>

                    <!-- Role Filter Pills -->
                    <div class="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                        <button class="admin-role-filter px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${accessRoleFilter === 'all' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-500 hover:text-zinc-300'}" data-filter="all">All (${allAdmins.length})</button>
                        <button class="admin-role-filter px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${accessRoleFilter === 'super_admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold' : 'text-zinc-500 hover:text-zinc-300'}" data-filter="super_admin">Super Admins (${superAdminsCount})</button>
                        <button class="admin-role-filter px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${accessRoleFilter === 'admin' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold' : 'text-zinc-500 hover:text-zinc-300'}" data-filter="admin">Admins (${standardAdminsCount})</button>
                    </div>
                </div>

                <!-- Admin Cards Grid -->
                <div class="space-y-4">
                    ${filteredAdmins.length === 0 ? `
                        <div class="p-8 text-center bg-zinc-950/40 rounded-xl border border-zinc-800 text-xs text-zinc-500">
                            No administrators found matching the active filter.
                        </div>
                    ` : filteredAdmins.map(u => {
                        const isMe = u.id === currentUserId;
                        const isSuper = u.role === 'super_admin' || u.role === 'superadmin';
                        const student = window.getStudentDataByEmail ? window.getStudentDataByEmail(u.email) : null;
                        const fullName = u.full_name || (student ? student.fullName : 'Anonymous');
                        const perms = ICCSupabase.getAdminPermissions(u);

                        return `
                        <div class="p-4 rounded-2xl border ${isSuper ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/60'} transition-all" data-admin-id="${u.id}">
                            <!-- Admin Header -->
                            <div class="flex items-start justify-between gap-3 flex-wrap">
                                <div class="flex items-center gap-3 min-w-0 flex-1">
                                    <div class="w-10 h-10 rounded-full ${isSuper ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'} flex items-center justify-center font-bold text-sm flex-shrink-0">
                                        ${fullName.charAt(0).toUpperCase()}
                                    </div>
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <h5 class="text-sm font-semibold text-white break-words">${escapeHtml(fullName)}</h5>
                                            ${isSuper ? `
                                                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">🛡️ Super Admin</span>
                                            ` : `
                                                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">👑 Admin</span>
                                            `}
                                            ${isMe ? `
                                                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">You</span>
                                            ` : ''}
                                        </div>
                                        <p class="text-[11px] text-zinc-400 font-mono truncate">${escapeHtml(u.email || 'No email')} · @${escapeHtml(u.username || 'user')}</p>
                                    </div>
                                </div>

                                <!-- Action Buttons -->
                                <div class="flex items-center gap-2">
                                    ${!isMe ? `
                                        ${isSuper ? `
                                            <button class="demote-superadmin-btn px-2.5 py-1 text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors" data-id="${u.id}" data-name="${escapeHtml(fullName)}">
                                                Demote to Admin
                                            </button>
                                        ` : `
                                            <button class="promote-superadmin-btn px-2.5 py-1 text-[11px] font-medium bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/30 rounded-lg transition-colors" data-id="${u.id}" data-name="${escapeHtml(fullName)}">
                                                Promote to Super Admin
                                            </button>
                                        `}
                                        <button class="revoke-admin-btn px-2.5 py-1 text-[11px] font-medium bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 rounded-lg transition-colors" data-id="${u.id}" data-name="${escapeHtml(fullName)}">
                                            Revoke Admin
                                        </button>
                                    ` : `
                                        <span class="text-[10px] text-zinc-500 px-2.5 py-1 bg-zinc-950 rounded-lg border border-zinc-800/80">Active User (Protected)</span>
                                    `}
                                </div>
                            </div>

                            <!-- Granular Feature Access Toggles -->
                            <div class="mt-4 pt-4 border-t ${isSuper ? 'border-amber-500/20' : 'border-zinc-800/80'}">
                                ${isSuper ? `
                                    <div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-xs text-amber-200">
                                        <span class="text-base">🛡️</span>
                                        <span>Super Administrators inherently possess unrestricted permissions for all dashboard modules, database mutations, and the Access Control console.</span>
                                    </div>
                                ` : `
                                    <div class="space-y-3">
                                        <!-- Master Toggle -->
                                        <div class="flex items-center justify-between p-3 bg-zinc-950/70 rounded-xl border border-zinc-800">
                                            <div>
                                                <span class="text-xs font-semibold text-white block">⚡ Master Toggle: Full Access (All Features)</span>
                                                <span class="text-[10px] text-zinc-400">Grant or remove all 5 administrator permissions simultaneously</span>
                                            </div>
                                            <label class="switch-container">
                                                <input type="checkbox" class="switch-input admin-all-perm-toggle" data-user-id="${u.id}" data-name="${escapeHtml(fullName)}" ${perms.all ? 'checked' : ''}>
                                                <span class="switch-slider"></span>
                                            </label>
                                        </div>

                                        <!-- Individual 5 Feature Toggles -->
                                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                            <!-- 1. Broadcast -->
                                            <div class="flex items-center justify-between p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-800/60">
                                                <div class="min-w-0 pr-2">
                                                    <span class="text-xs font-medium text-white flex items-center gap-1.5 truncate">📢 Broadcast Alerts</span>
                                                    <span class="text-[10px] text-zinc-500 block truncate">Blast app-wide alert banner</span>
                                                </div>
                                                <label class="switch-container flex-shrink-0">
                                                    <input type="checkbox" class="switch-input admin-perm-toggle" data-user-id="${u.id}" data-perm="broadcast" data-name="${escapeHtml(fullName)}" ${(perms.all || perms.broadcast) ? 'checked' : ''} ${perms.all ? 'disabled' : ''}>
                                                    <span class="switch-slider"></span>
                                                </label>
                                            </div>

                                            <!-- 2. Moderate -->
                                            <div class="flex items-center justify-between p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-800/60">
                                                <div class="min-w-0 pr-2">
                                                    <span class="text-xs font-medium text-white flex items-center gap-1.5 truncate">🛡️ Moderate Content</span>
                                                    <span class="text-[10px] text-zinc-500 block truncate">Delete posts & moderate feed</span>
                                                </div>
                                                <label class="switch-container flex-shrink-0">
                                                    <input type="checkbox" class="switch-input admin-perm-toggle" data-user-id="${u.id}" data-perm="moderate" data-name="${escapeHtml(fullName)}" ${(perms.all || perms.moderate) ? 'checked' : ''} ${perms.all ? 'disabled' : ''}>
                                                    <span class="switch-slider"></span>
                                                </label>
                                            </div>

                                            <!-- 3. Events -->
                                            <div class="flex items-center justify-between p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-800/60">
                                                <div class="min-w-0 pr-2">
                                                    <span class="text-xs font-medium text-white flex items-center gap-1.5 truncate">📅 Add & Manage Events</span>
                                                    <span class="text-[10px] text-zinc-500 block truncate">Create, edit, delete events</span>
                                                </div>
                                                <label class="switch-container flex-shrink-0">
                                                    <input type="checkbox" class="switch-input admin-perm-toggle" data-user-id="${u.id}" data-perm="events" data-name="${escapeHtml(fullName)}" ${(perms.all || perms.events) ? 'checked' : ''} ${perms.all ? 'disabled' : ''}>
                                                    <span class="switch-slider"></span>
                                                </label>
                                            </div>

                                            <!-- 4. Leads -->
                                            <div class="flex items-center justify-between p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-800/60">
                                                <div class="min-w-0 pr-2">
                                                    <span class="text-xs font-medium text-white flex items-center gap-1.5 truncate">👥 Core Team Leads</span>
                                                    <span class="text-[10px] text-zinc-500 block truncate">Appoint leads & teams</span>
                                                </div>
                                                <label class="switch-container flex-shrink-0">
                                                    <input type="checkbox" class="switch-input admin-perm-toggle" data-user-id="${u.id}" data-perm="leads" data-name="${escapeHtml(fullName)}" ${(perms.all || perms.leads) ? 'checked' : ''} ${perms.all ? 'disabled' : ''}>
                                                    <span class="switch-slider"></span>
                                                </label>
                                            </div>

                                            <!-- 5. Users -->
                                            <div class="flex items-center justify-between p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-800/60 sm:col-span-2 lg:col-span-2">
                                                <div class="min-w-0 pr-2">
                                                    <span class="text-xs font-medium text-white flex items-center gap-1.5 truncate">📋 User Management & Roster</span>
                                                    <span class="text-[10px] text-zinc-500 block truncate">Edit members, approve change requests & export roster Excel</span>
                                                </div>
                                                <label class="switch-container flex-shrink-0">
                                                    <input type="checkbox" class="switch-input admin-perm-toggle" data-user-id="${u.id}" data-perm="users" data-name="${escapeHtml(fullName)}" ${(perms.all || perms.users) ? 'checked' : ''} ${perms.all ? 'disabled' : ''}>
                                                    <span class="switch-slider"></span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                `}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <!-- Database Schema Notice & Quick Copy -->
            <div class="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-2.5">
                    <span class="text-base">📋</span>
                    <div>
                        <span class="text-xs font-semibold text-zinc-300 block">Supabase Migration Script: access_control_schema.sql</span>
                        <span class="text-[10px] text-zinc-500">Run this once in Supabase SQL editor to create the admin_permissions column if not already executed.</span>
                    </div>
                </div>
                <button id="copy-access-sql-btn" class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors">
                    Copy SQL Script
                </button>
            </div>
        </div>`;
    }

    function renderBroadcast() {
        return `

        <div class="glass-card rounded-xl p-5">
            <h3 class="font-heading font-semibold text-sm mb-1">Broadcast Alert</h3>
            <p class="text-[11px] text-zinc-500 mb-4">Send a red alert banner to all active users</p>
            <form id="broadcast-form" class="space-y-3">
                <textarea id="broadcast-msg" rows="3" placeholder="Type your broadcast message..." class="form-input w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white resize-none" maxlength="200" required></textarea>
                <div class="flex items-center justify-between">
                    <span id="broadcast-chars" class="text-[11px] text-zinc-600">0/200</span>
                    <button type="submit" class="px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-semibold transition-all">🚨 Blast</button>
                </div>
            </form>
        </div>`;
    }

    function renderLeads() {
        if (editingLead) {
            const assignedUser = editingLead.id ? allUsers.find(u => u.team_id === editingLead.id && u.role === 'lead') : null;
            const currentEmail = assignedUser ? (assignedUser.email || '') : '';
            return `
            <div class="glass-card rounded-xl p-5">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-heading font-semibold text-lg">${editingLead.id ? 'Edit Lead' : 'Add Core Lead'}</h3>
                    <button id="cancel-edit-lead" class="text-zinc-500 hover:text-white transition-colors">Cancel</button>
                </div>
                <form id="lead-edit-form" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="block text-xs font-medium text-zinc-400 mb-1">Name</label><input type="text" id="lead-name" value="${editingLead.name || ''}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required></div>
                        <div><label class="block text-xs font-medium text-zinc-400 mb-1">Team</label><input type="text" id="lead-team" value="${editingLead.team || ''}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required></div>
                        <div><label class="block text-xs font-medium text-zinc-400 mb-1">Initials</label><input type="text" id="lead-initials" value="${editingLead.initials || ''}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required></div>
                        <div><label class="block text-xs font-medium text-zinc-400 mb-1">Assign User Email</label><input type="email" id="lead-email" value="${currentEmail}" placeholder="User email to make lead" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                        <div class="col-span-2"><label class="block text-xs font-medium text-zinc-400 mb-1">Specialties (comma-separated)</label><input type="text" id="lead-specialties" value="${(editingLead.specialties || []).join(', ')}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                    </div>
                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Bio</label><textarea id="lead-bio" rows="2" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white resize-none">${editingLead.bio || ''}</textarea></div>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="block text-xs font-medium text-zinc-400 mb-1">Gradient (Tailwind classes)</label><input type="text" id="lead-gradient" value="${editingLead.gradient || 'from-red-600 to-orange-500'}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
                        <div><label class="block text-xs font-medium text-zinc-400 mb-1">Theme Color (Hex)</label><input type="color" id="lead-color" value="${editingLead.color || '#ef4444'}" class="form-input w-full h-9 p-0 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer"></div>
                    </div>
                    <button type="submit" class="w-full py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-semibold transition-all mt-2">Save Lead</button>
                </form>
            </div>`;
        }

        return `
        <div class="glass-card rounded-xl overflow-hidden">
            <div class="flex items-center justify-between p-4 border-b border-zinc-800/50">
                <h3 class="font-heading font-semibold text-sm">Core Team Leads</h3>
                <button id="add-lead-btn" class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors">+ Add Lead</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead><tr class="border-b border-zinc-800">
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase">Lead</th>
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase hidden md:table-cell">Team</th>
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase text-right">Actions</th>
                    </tr></thead>
                    <tbody>${CORE_LEADS.map(l => `
                        <tr class="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                            <td class="px-4 py-3"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-gradient-to-br ${l.gradient} flex items-center justify-center text-xs font-bold flex-shrink-0">${l.initials}</div><span class="text-sm font-medium">${l.name}${ICC_CONFIG.VERIFIED_TICK}</span></div></td>
                            <td class="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">${l.team}</td>
                            <td class="px-4 py-3 text-right">
                                <button class="edit-lead-btn text-xs text-blue-400 hover:text-blue-300 transition-colors mr-3" data-id="${l.id}">Edit</button>
                                <button class="delete-lead-btn text-xs text-red-500 hover:text-red-400 transition-colors" data-id="${l.id}">Delete</button>
                            </td>
                        </tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
        ${pendingLeads.length > 0 ? `
        <div class="glass-card rounded-xl p-5 mt-4">
            <h3 class="font-heading font-semibold text-sm mb-3">Pending Lead Requests (${pendingLeads.length})</h3>
            <div class="space-y-2">${pendingLeads.map(p => `
                <div class="flex items-center justify-between px-3 py-2.5 bg-zinc-900 rounded-lg">
                    <div><p class="text-sm font-medium">${p.full_name || p.username || 'User'}</p><p class="text-[11px] text-zinc-500">${p.username ? '@' + p.username : ''}</p></div>
                    <div class="flex items-center gap-2">
                        <select class="assign-team-select text-[11px] bg-zinc-950 border border-zinc-800 rounded px-2 py-1 outline-none text-zinc-300" data-user-id="${p.id}">
                            <option value="">Select Team...</option>
                            ${CORE_LEADS.map(l => `<option value="${l.id}">${l.team}</option>`).join('')}
                        </select>
                        <button class="approve-lead-btn px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-[11px] font-semibold transition-colors" data-id="${p.id}">Approve</button>
                        <button class="deny-lead-btn px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-[11px] font-medium transition-colors" data-id="${p.id}">Deny</button>
                    </div>
                </div>`).join('')}</div>
        </div>` : ''}`;
    }

    function renderModerate() {
        if (allPosts.length === 0) return '<div class="empty-state py-16"><p class="text-sm text-zinc-600">No posts to moderate</p></div>';
        return `
        <div class="space-y-2">
            ${allPosts.slice(0, 30).map(p => {
            const prof = p.profiles || {};
            return `<div class="flex items-center gap-3 px-4 py-3 glass-card rounded-xl">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate">${prof.username || prof.full_name || 'Anon'}${prof.role === 'lead' ? ICC_CONFIG.VERIFIED_TICK : ''}</p>
                        <p class="text-xs text-zinc-500 truncate">${(p.caption || 'No caption').slice(0, 60)}</p>
                        <p class="text-[10px] text-zinc-600 mt-0.5">${formatTimeAgo(p.created_at)}</p>
                    </div>
                    <button class="admin-delete-post px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded-lg text-[11px] font-medium transition-colors" data-post-id="${p.id}">Delete</button>
                </div>`;
        }).join('')}
        </div>`;
    }

    function renderEvents() {
        if (editingEvent) {
            return `
            <div class="glass-card rounded-xl p-5">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-heading font-semibold text-lg">${editingEvent.id ? 'Edit Event' : 'Create Event'}</h3>
                    <button id="cancel-edit-event" class="text-zinc-500 hover:text-white transition-colors">Cancel</button>
                </div>
                <form id="event-edit-form" class="space-y-4">
                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Title</label><input type="text" id="event-title" value="${editingEvent.title || ''}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required></div>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="block text-xs font-medium text-zinc-400 mb-1">Date/Time</label><input type="datetime-local" id="event-date" value="${editingEvent.event_date ? editingEvent.event_date.slice(0, 16) : ''}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white" required></div>
                        <div>
                            <label class="block text-xs font-medium text-zinc-400 mb-1">Status</label>
                            <select id="event-status" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white">
                                <option value="upcoming" ${editingEvent.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
                                <option value="past" ${editingEvent.status === 'past' ? 'selected' : ''}>Past</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-zinc-400 mb-1">Banner Image</label>
                        ${editingEvent.banner_url ? `<div class="mb-2"><img src="${editingEvent.banner_url}" class="h-20 rounded object-cover border border-zinc-800"></div>` : ''}
                        <input type="file" id="event-banner-file" accept="image/*" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white">
                        <p class="text-[10px] text-zinc-500 mt-1">Leave empty to keep current banner.</p>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-zinc-400 mb-1">Gallery Images</label>
                        ${(editingEvent.gallery_urls && editingEvent.gallery_urls.length > 0) ? `<div class="mb-2 flex gap-2 overflow-x-auto">${editingEvent.gallery_urls.map(url => `<img src="${url}" class="h-16 rounded object-cover border border-zinc-800">`).join('')}</div>` : ''}
                        <input type="file" id="event-gallery-files" accept="image/*" multiple class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white">
                        <p class="text-[10px] text-zinc-500 mt-1">Selecting new images will replace the existing gallery.</p>
                    </div>
                    <div><label class="block text-xs font-medium text-zinc-400 mb-1">Description (Rich Text/HTML supported)</label><textarea id="event-desc" rows="5" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white resize-none" required>${editingEvent.description || ''}</textarea></div>
                    
                    <div class="border-t border-zinc-800/50 pt-4 mt-4">
                        <label class="block text-xs font-medium text-zinc-400 mb-2">Dynamic Action Buttons</label>
                        <div id="action-buttons-container" class="space-y-2 mb-2">
                            ${(editingEvent.action_buttons || []).map((btn, i) => `
                            <div class="flex items-center gap-2 action-button-row">
                                <input type="text" placeholder="Label (e.g. Register Now)" value="${btn.label}" class="form-input flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" required>
                                <input type="url" placeholder="Target URL" value="${btn.url}" class="form-input flex-[2] px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" required>
                                <button type="button" class="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg remove-action-btn"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </div>`).join('')}
                        </div>
                        <button type="button" id="add-action-btn" class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors">+ Add Button</button>
                    </div>

                    <button type="submit" class="w-full py-2.5 bg-crimson hover:bg-red-600 rounded-xl text-sm font-semibold transition-all mt-4">Save Event</button>
                </form>
            </div>`;
        }

        return `
        <div class="glass-card rounded-xl overflow-hidden">
            <div class="flex items-center justify-between p-4 border-b border-zinc-800/50">
                <h3 class="font-heading font-semibold text-sm">Events Management</h3>
                <button id="add-event-btn" class="px-3 py-1.5 bg-crimson hover:bg-red-600 rounded-lg text-xs font-medium transition-colors">+ Create Event</button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead><tr class="border-b border-zinc-800">
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase">Event</th>
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase">Date</th>
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase">Status</th>
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase text-right">Actions</th>
                    </tr></thead>
                    <tbody>
                    ${allEvents.length === 0 ? '<tr><td colspan="4" class="px-4 py-8 text-center text-zinc-500 text-xs">No events found</td></tr>' : 
                    allEvents.map(e => {
                        const date = new Date(e.event_date).toLocaleDateString();
                        return `
                        <tr class="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                            <td class="px-4 py-3"><span class="text-sm font-medium line-clamp-1">${e.title}</span></td>
                            <td class="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">${date}</td>
                            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${e.status === 'upcoming' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}">${e.status}</span></td>
                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                <button class="edit-event-btn text-xs text-blue-400 hover:text-blue-300 transition-colors mr-3" data-id="${e.id}">Edit</button>
                                <button class="delete-event-btn text-xs text-red-500 hover:text-red-400 transition-colors" data-id="${e.id}">Delete</button>
                            </td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    function renderUsers() {
        const displayUsers = allUsers.filter(u => u.role !== 'admin' && u.role !== 'lead');
        const isSuper = ICCSupabase.isSuperAdmin();

        return `
        <div class="space-y-4">
            <!-- Super Admin Hub / Safety Policy Banner -->
            ${isSuper ? `
                <div class="glass-card rounded-2xl p-5 border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 shadow-xl">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center text-lg font-bold shadow-inner">
                                🛡️
                            </div>
                            <div>
                                <h3 class="font-heading font-bold text-sm text-amber-200">Super Admin Approval Hub</h3>
                                <p class="text-[11px] text-zinc-400">User modification requests awaiting your authorization</p>
                            </div>
                        </div>
                        <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${pendingEditRequests.length > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' : 'bg-zinc-800 text-zinc-500'}">
                            ${pendingEditRequests.length} Pending
                        </span>
                    </div>

                    ${pendingEditRequests.length === 0 ? `
                        <div class="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60 text-center">
                            <p class="text-xs text-zinc-400">✅ No pending change requests. All user profile records are up to date.</p>
                        </div>
                    ` : `
                        <div class="space-y-3 mt-3">
                            ${pendingEditRequests.map(req => renderPendingRequestCard(req, true)).join('')}
                        </div>
                    `}
                </div>
            ` : `
                <div class="glass-card rounded-xl p-4 border border-blue-500/20 bg-blue-500/5 flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                        🛡️
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-xs font-semibold text-blue-300">Safety Policy Active: Super Admin Approval Required</h4>
                        <p class="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                            For security and data integrity, admins cannot directly modify user details. Any edits you make below will be submitted to a <strong>Super Admin</strong> for review and approval before taking effect.
                        </p>
                    </div>
                </div>

                ${pendingEditRequests.length > 0 ? `
                    <div class="glass-card rounded-2xl p-4 border border-zinc-800">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                                <span>Pending Approval Requests</span>
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">${pendingEditRequests.length}</span>
                            </h4>
                            <span class="text-[10px] text-zinc-500">Awaiting Super Admin Review</span>
                        </div>
                        <div class="space-y-3">
                            ${pendingEditRequests.map(req => renderPendingRequestCard(req, false)).join('')}
                        </div>
                    </div>
                ` : ''}
            `}

            <div class="flex items-center justify-between px-2 flex-wrap gap-3">
                <div class="flex items-center gap-3">
                    <h3 class="font-heading font-semibold text-sm">User Management</h3>
                    <span class="text-xs text-zinc-500" id="users-count-badge">${displayUsers.length} members</span>
                </div>
                <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <select id="admin-user-section-filter" class="bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white px-2 py-2 outline-none focus:border-blue-500">
                        <option value="">All Secs</option>
                        ${['A','B','C','D','E','F','G','H','I','J','K'].map(s => `<option value="${s}" ${userSectionFilter === s ? 'selected' : ''}>Sec ${s}</option>`).join('')}
                    </select>
                    <select id="admin-user-team-filter" class="bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white px-2 py-2 outline-none focus:border-blue-500">
                        <option value="">All Teams</option>
                        <option value="none" ${userTeamFilter === 'none' ? 'selected' : ''}>No Team</option>
                        ${CORE_LEADS.map(l => `<option value="${l.id}" ${userTeamFilter === String(l.id) ? 'selected' : ''}>${l.team}</option>`).join('')}
                    </select>
                    <div class="relative flex-1 sm:w-56">
                        <input type="text" id="admin-user-search" placeholder="Search by name, email, or USN..." class="form-input w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white" value="${userSearchQuery}">
                        <svg class="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <button id="admin-download-excel-btn" class="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer whitespace-nowrap group" title="Download dynamic Excel format (.xlsx) of users & teams based on active filters">
                        <svg class="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span id="admin-excel-btn-text">${(userSectionFilter || userTeamFilter || userSearchQuery) ? 'Export Filtered (.xlsx)' : 'Download Excel (.xlsx)'}</span>
                    </button>
                </div>
            </div>

            <div class="grid gap-3" id="users-list-container">
                ${displayUsers.map(u => {
                    const isEditing = editingUserId === u.id;
                    const student = window.getStudentDataByEmail ? window.getStudentDataByEmail(u.email) : null;
                    const isVerified = !!student;
                    
                    const fullName = u.full_name || (student ? student.fullName : '');
                    const usn = u.usn || (student ? student.usn : '');
                    const phone = u.phone || (student ? student.phone : '');
                    const section = student ? student.section : '';
                    
                    const isManuallyUpdated = !!(u.usn || u.phone || (u.full_name && u.full_name !== (student ? student.fullName : '')));
                    const teamName = CORE_LEADS.find(l => Number(l.id) === Number(u.team_id))?.team || 'No Team';
                    const userPendingReq = pendingEditRequests.find(r => r.target_user_id === u.id);
                    
                    return `
                    <div class="glass-card rounded-2xl p-4 transition-all duration-300 ${isEditing ? 'ring-1 ring-blue-500/50 bg-blue-500/5' : ''}" data-user-id="${u.id}" data-section="${(section || '').toUpperCase()}" data-team-id="${u.team_id || ''}">
                        ${userPendingReq ? `
                            <div class="mb-3 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-center justify-between">
                                <span class="flex items-center gap-1.5 font-medium">
                                    <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                                    Edit Request Pending Super Admin Approval
                                </span>
                                <span class="text-zinc-400 text-[10px]">by ${escapeHtml(userPendingReq.requester_name || 'Admin')}</span>
                            </div>
                        ` : ''}

                        <div class="flex items-start justify-between gap-4">
                            <div class="flex items-center gap-3 flex-1 min-w-0">
                                <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold flex-shrink-0 border border-zinc-700 relative">
                                    ${(fullName || u.username || '?').charAt(0).toUpperCase()}
                                </div>
                                
                                ${isEditing ? `
                                    <div class="flex-1 space-y-2 py-1">
                                        <div class="relative">
                                            <input type="text" class="user-name-input w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none" value="${escapeHtml(fullName)}" placeholder="Full Name">
                                            <span class="absolute -top-2 left-2 px-1 bg-zinc-900 text-[9px] text-zinc-500 uppercase tracking-wider">Full Name</span>
                                        </div>
                                        <div class="relative">
                                            <div class="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                                                <span class="pl-3 pr-1 text-[10px] text-zinc-500">@</span>
                                                <input type="text" class="user-username-input w-full bg-transparent px-0 py-1.5 text-xs text-white focus:outline-none" value="${escapeHtml(u.username || '')}" placeholder="Auth Username">
                                            </div>
                                            <span class="absolute -top-2 left-2 px-1 bg-zinc-900 text-[9px] text-zinc-500 uppercase tracking-wider">Auth Username</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div class="flex-1 min-w-0">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <h4 class="text-sm font-semibold text-white break-words">${escapeHtml(fullName || 'Anonymous')}</h4>
                                            ${isVerified ? `<span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Excel Verified</span>` : `<span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">Unverified</span>`}
                                            ${isManuallyUpdated ? `<span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">Manually Updated</span>` : ''}
                                            ${(() => {
                                                const att = attendanceMap[u.id];
                                                if (att && att.total > 0) {
                                                    const col = att.percent >= 75 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : att.percent >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20';
                                                    return `<span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${col}" title="Attendance: ${att.present}/${att.total} days">Att: ${att.percent}%</span>`;
                                                }
                                                return `<span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700/30">Att: 0%</span>`;
                                            })()}
                                        </div>
                                        <p class="text-[11px] text-zinc-500 truncate">@${escapeHtml(u.username || '—')}</p>
                                    </div>
                                `}
                            </div>
                            
                            ${!isEditing ? `
                                <button class="edit-user-btn p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all" data-id="${u.id}" title="Edit user details">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                </button>
                            ` : ''}
                        </div>

                        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-zinc-800/50 pt-4">
                            <div class="space-y-1">
                                <span class="text-[9px] text-zinc-500 uppercase tracking-wider block">Email Address (Read Only)</span>
                                <p class="text-[11px] text-zinc-400 font-mono truncate">${escapeHtml(u.email || 'No email')}</p>
                            </div>
                            <div class="space-y-1">
                                <span class="text-[9px] text-zinc-500 uppercase tracking-wider block">USN</span>
                                ${isEditing ? `
                                    <input type="text" class="user-usn-input w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-white focus:border-blue-500 outline-none uppercase" value="${escapeHtml(usn)}" placeholder="1KS...">
                                ` : `
                                    <p class="text-[11px] text-zinc-300 font-mono uppercase">${escapeHtml(usn || '—')}</p>
                                `}
                            </div>
                            <div class="space-y-1">
                                <span class="text-[9px] text-zinc-500 uppercase tracking-wider block">Phone Number</span>
                                ${isEditing ? `
                                    <input type="tel" class="user-phone-input w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-white focus:border-blue-500 outline-none" value="${escapeHtml(phone)}" placeholder="10 digits">
                                ` : `
                                    <p class="text-[11px] text-zinc-300 font-mono">${escapeHtml(phone || '—')}</p>
                                `}
                            </div>
                            <div class="space-y-1">
                                <span class="text-[9px] text-zinc-500 uppercase tracking-wider block">Section & Team</span>
                                <div class="flex gap-2 items-center">
                                    <span class="text-[11px] font-bold text-zinc-300 uppercase">${escapeHtml(section || '-')}</span>
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${u.team_id ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-500'}">
                                        ${escapeHtml(teamName)}
                                    </span>
                                </div>
                            </div>
                            <div class="space-y-1">
                                <span class="text-[9px] text-zinc-500 uppercase tracking-wider block">Attendance Rate</span>
                                <div class="flex items-center gap-1.5">
                                    ${(() => {
                                        const att = attendanceMap[u.id];
                                        if (att && att.total > 0) {
                                            const colorCls = att.percent >= 75 ? 'text-emerald-400' : att.percent >= 50 ? 'text-amber-400' : 'text-red-400';
                                            return `<p class="text-[11px] font-bold font-mono ${colorCls}">${att.percent}% <span class="text-zinc-500 font-normal font-sans text-[10px]">(${att.present}/${att.total} days)</span></p>`;
                                        }
                                        return `<p class="text-[11px] text-zinc-500 font-mono">0% <span class="text-zinc-600 font-normal font-sans text-[10px]">(0 days)</span></p>`;
                                    })()}
                                </div>
                            </div>
                        </div>

                        ${isEditing ? `
                            <div class="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/30">
                                <button class="save-user-btn flex-1 py-2 ${isSuper ? 'bg-blue-600 hover:bg-blue-500' : 'bg-amber-600 hover:bg-amber-500'} text-white rounded-xl text-xs font-semibold transition-all shadow-md flex items-center justify-center gap-1.5" data-id="${u.id}">
                                    ${isSuper ? '<span>Save Changes (Direct)</span>' : '<span>🛡️ Submit for Super Admin Approval</span>'}
                                </button>
                                <button class="cancel-user-edit-btn px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-all">Cancel</button>
                                ${isManuallyUpdated ? `
                                    <button class="restore-user-btn px-3 py-2 bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white border border-orange-500/30 rounded-xl text-xs font-semibold transition-all" data-id="${u.id}" title="Revert to Excel Data">
                                        ${isSuper ? 'Restore' : 'Request Restore'}
                                    </button>
                                ` : ''}
                                ${isSuper ? `
                                    <button class="delete-user-btn p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all" data-id="${u.id}" title="Delete User">
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                ` : `
                                    <button class="p-2 text-zinc-600 cursor-not-allowed rounded-xl transition-all" title="Only Super Admins can delete users" disabled>
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                `}
                            </div>
                        ` : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    async function mount(container) {
        container.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="spinner"></div></div>';
        try {
            await ICCSupabase.fetchProfile();
        } catch (e) {
            console.warn('Admin mount fetchProfile error:', e);
        }
        const allowedTabs = getAvailableTabs();
        activeTab = allowedTabs.some(t => t.id === 'users') ? 'users' : (allowedTabs[0]?.id || 'users');

        pendingLeads = await ICCSupabase.getPendingLeads();
        allPosts = await ICCSupabase.getAllPosts();
        allUsers = await ICCSupabase.getAllProfiles();
        allEvents = await ICCSupabase.fetchEvents();
        pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
        try {
            allAttendance = await ICCSupabase.fetchAllAttendanceData();
            updateAttendanceStats(allAttendance);
        } catch (attErr) {
            console.warn('Admin mount fetchAllAttendanceData error:', attErr);
        }
        container.innerHTML = render();
        bindEvents(container);

        // Realtime subscription for pending user edit requests
        if (!window._adminUserEditSubscribed) {
            window._adminUserEditSubscribed = true;
            ICCSupabase.subscribeToUserEditRequests(async () => {
                pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                allUsers = await ICCSupabase.getAllProfiles();
                try {
                    allAttendance = await ICCSupabase.fetchAllAttendanceData();
                    updateAttendanceStats(allAttendance);
                } catch (e) {}
                if (activeTab === 'users') {
                    const content = document.getElementById('admin-content');
                    if (content) {
                        content.innerHTML = renderTab();
                        bindEvents(document.getElementById('admin-section') || container);
                    }
                }
            });
        }
    }

    function bindEvents(container) {
        // Tab switching
        container.querySelectorAll('.admin-tab, .admin-tab-switch').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                container.innerHTML = render();
                bindEvents(container);
            });
        });

        // Wipe all notifications
        document.getElementById('admin-wipe-notifications')?.addEventListener('click', async () => {
            if (!confirm('⚠️ CRITICAL: This will permanently delete ALL notifications for ALL users across the entire platform. This cannot be undone. Proceed?')) return;
            const res = await ICCSupabase.adminClearAllNotifications();
            if (res.error) Toast.error('Action failed: ' + res.error.message);
            else Toast.success('System Wiped: All notifications cleared! 🎉');
        });

        // Broadcast
        document.getElementById('broadcast-msg')?.addEventListener('input', e => {
            const chars = document.getElementById('broadcast-chars');
            if (chars) chars.textContent = `${e.target.value.length}/200`;
        });
        document.getElementById('broadcast-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const msg = document.getElementById('broadcast-msg')?.value?.trim();
            if (!msg) return;
            const { error } = await ICCSupabase.createBroadcast(msg);
            if (error) Toast.error('Broadcast failed: ' + error.message);
            else {
                Toast.success('Broadcast sent! 📢');
                document.getElementById('broadcast-msg').value = '';
                // Notify everyone
                ICCSupabase.getAllProfiles().then(profiles => {
                    profiles.forEach(p => {
                        ICCSupabase.createNotification({
                            userId: p.id,
                            type: 'broadcast',
                            actorId: ICCSupabase.getUser().id,
                            body: msg
                        });
                    });
                });
            }
        });

        // Super Admin Request Approval & Rejection Handlers
        container.querySelectorAll('.approve-edit-req-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reqId = btn.dataset.id;
                const origText = btn.innerHTML;
                btn.innerHTML = 'Approving...';
                btn.disabled = true;

                const res = await ICCSupabase.approveUserEditRequest(reqId);
                if (res.error) {
                    Toast.error('Approval failed: ' + res.error.message);
                    btn.innerHTML = origText;
                    btn.disabled = false;
                } else {
                    Toast.success('✅ Request approved! User profile details updated.');
                    pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                    allUsers = await ICCSupabase.getAllProfiles();
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        });

        container.querySelectorAll('.reject-edit-req-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reqId = btn.dataset.id;
                const reason = prompt('Optional rejection reason for the requesting admin:');
                if (reason === null) return; // cancelled prompt
                
                const origText = btn.textContent;
                btn.textContent = 'Rejecting...';
                btn.disabled = true;

                const res = await ICCSupabase.rejectUserEditRequest(reqId, reason);
                if (res.error) {
                    Toast.error('Rejection failed: ' + res.error.message);
                    btn.textContent = origText;
                    btn.disabled = false;
                } else {
                    Toast.info('Request rejected.');
                    pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        });

        container.querySelectorAll('.cancel-edit-req-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reqId = btn.dataset.id;
                if (!confirm('Are you sure you want to cancel this change request?')) return;
                const res = await ICCSupabase.cancelUserEditRequest(reqId);
                if (res?.error) Toast.error('Failed to cancel request');
                else {
                    Toast.info('Change request cancelled');
                    pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        });

        // Approve/deny leads
        container.querySelectorAll('.approve-lead-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const teamId = container.querySelector(`.assign-team-select[data-user-id="${userId}"]`)?.value;
                if (!teamId) { Toast.error('Please select a team first'); return; }

                const { error } = await ICCSupabase.approveLead(userId, parseInt(teamId));
                if (error) Toast.error('Failed to approve lead');
                else {
                    Toast.success('Lead approved!');
                    // Notify the user
                    const teamName = CORE_LEADS.find(l => l.id === parseInt(teamId))?.team || 'a team';
                    ICCSupabase.createNotification({
                        userId: userId,
                        type: 'system',
                        actorId: ICCSupabase.getUser().id,
                        body: `Congratulations! You have been appointed as the Team Lead for ${teamName}.`
                    });
                    mount(container);
                }
            });
        });
        container.querySelectorAll('.deny-lead-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await ICCSupabase.denyLead(btn.dataset.id);
                Toast.info('Request denied');
                pendingLeads = await ICCSupabase.getPendingLeads();
                container.innerHTML = render(); bindEvents(container);
            });
        });
        // Delete posts
        container.querySelectorAll('.admin-delete-post').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this post?')) return;
                const { error } = await ICCSupabase.adminDeletePost(btn.dataset.postId);
                if (error) Toast.error('Delete failed');
                else { Toast.success('Post deleted'); allPosts = await ICCSupabase.getAllPosts(); container.innerHTML = render(); bindEvents(container); }
            });
        });

        // Super Admin Approval Actions
        container.querySelectorAll('.approve-edit-req-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reqId = btn.dataset.id;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = 'Approving...';
                btn.disabled = true;

                const res = await ICCSupabase.approveUserEditRequest(reqId);
                if (res.error) {
                    Toast.error('Approval failed: ' + (res.error.message || res.error));
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                } else {
                    Toast.success('✅ Change request approved and applied successfully!');
                    pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                    allUsers = await ICCSupabase.getAllProfiles();
                    container.innerHTML = render(); bindEvents(container);
                }
            });
        });

        container.querySelectorAll('.reject-edit-req-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reqId = btn.dataset.id;
                const reason = prompt('Optional: Enter rejection reason / notes for the admin:') || '';
                const originalHtml = btn.innerHTML;
                btn.innerHTML = 'Rejecting...';
                btn.disabled = true;

                const res = await ICCSupabase.rejectUserEditRequest(reqId, reason);
                if (res.error) {
                    Toast.error('Rejection failed: ' + (res.error.message || res.error));
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                } else {
                    Toast.info('❌ Change request rejected.');
                    pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                    container.innerHTML = render(); bindEvents(container);
                }
            });
        });

        container.querySelectorAll('.cancel-edit-req-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reqId = btn.dataset.id;
                if (!confirm('Cancel this pending change request?')) return;
                const res = await ICCSupabase.cancelUserEditRequest(reqId);
                if (res.error) {
                    Toast.error('Cancel failed: ' + (res.error.message || res.error));
                } else {
                    Toast.info('Request cancelled.');
                    pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                    container.innerHTML = render(); bindEvents(container);
                }
            });
        });

        // User management
        container.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                editingUserId = btn.dataset.id;
                container.innerHTML = render(); bindEvents(container);
            });
        });

        container.querySelectorAll('.cancel-user-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                editingUserId = null;
                container.innerHTML = render(); bindEvents(container);
            });
        });

        container.querySelectorAll('.save-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const targetUser = allUsers.find(u => u.id === userId);
                const student = window.getStudentDataByEmail ? window.getStudentDataByEmail(targetUser?.email) : null;

                const card = container.querySelector(`.glass-card[data-user-id="${userId}"]`);
                const fullName = card.querySelector(`.user-name-input`)?.value.trim();
                const username = card.querySelector(`.user-username-input`)?.value.trim();
                const usn = card.querySelector(`.user-usn-input`)?.value.trim();
                const phone = card.querySelector(`.user-phone-input`)?.value.trim();
                const cleanedPhone = phone ? phone.replace(/\D/g, '') : null;
                
                if (!username) { Toast.error('Username cannot be empty'); return; }

                if (usn && !/^[1-9][A-Z]{2}\d{2}[A-Z]{2}\d{3}$/i.test(usn) && usn.length !== 10) {
                    Toast.error('Please enter a valid USN format (e.g. 1KS25CS001)');
                    return;
                }

                if (phone && !/^\d{10}$/.test(cleanedPhone)) {
                    Toast.error('Please enter a valid 10-digit phone number');
                    return;
                }

                const originalText = btn.innerHTML;
                btn.innerHTML = 'Submitting...';
                btn.disabled = true;
                
                const fields = { 
                    full_name: fullName, 
                    username: username,
                    usn: usn ? usn.toUpperCase() : null,
                    phone: cleanedPhone
                };

                const origData = {
                    full_name: targetUser?.full_name || (student ? student.fullName : ''),
                    username: targetUser?.username || '',
                    usn: targetUser?.usn || (student ? student.usn : ''),
                    phone: targetUser?.phone || (student ? student.phone : ''),
                    team_id: targetUser?.team_id
                };

                const isSuper = ICCSupabase.isSuperAdmin();

                if (isSuper) {
                    const { error } = await ICCSupabase.adminUpdateUser(userId, fields);
                    if (error) {
                        Toast.error('Failed to update user: ' + error.message);
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    } else {
                        Toast.success('User profile updated directly (Super Admin)!');
                        editingUserId = null;
                        allUsers = await ICCSupabase.getAllProfiles();
                        pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                        container.innerHTML = render(); bindEvents(container);
                    }
                } else {
                    // Regular Admin: create change request for Super Admin
                    const { error } = await ICCSupabase.requestUserUpdate(userId, fields, origData);
                    if (error) {
                        Toast.error('Failed to submit request: ' + (error.message || error));
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    } else {
                        Toast.success('🛡️ Change request submitted! A Super Admin will review and approve these changes before they take effect.');
                        editingUserId = null;
                        pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                        container.innerHTML = render(); bindEvents(container);
                    }
                }
            });
        });

        container.querySelectorAll('.restore-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const targetUser = allUsers.find(u => u.id === userId);
                const student = window.getStudentDataByEmail ? window.getStudentDataByEmail(targetUser?.email) : null;
                const isSuper = ICCSupabase.isSuperAdmin();

                if (!confirm(isSuper ? 'Are you sure you want to revert to the original Excel verified data?' : 'Request Super Admin approval to revert this user to Excel verified data?')) return;
                
                const originalText = btn.textContent;
                btn.textContent = 'Processing...';
                btn.disabled = true;
                
                const fields = { 
                    full_name: null, 
                    usn: null, 
                    phone: null 
                };

                const origData = {
                    full_name: targetUser?.full_name || (student ? student.fullName : ''),
                    username: targetUser?.username || '',
                    usn: targetUser?.usn || (student ? student.usn : ''),
                    phone: targetUser?.phone || (student ? student.phone : '')
                };

                if (isSuper) {
                    const { error } = await ICCSupabase.adminUpdateUser(userId, fields);
                    if (error) {
                        Toast.error('Restore failed: ' + error.message);
                        btn.textContent = originalText;
                        btn.disabled = false;
                    } else {
                        Toast.success('Reverted to Excel values!');
                        editingUserId = null;
                        allUsers = await ICCSupabase.getAllProfiles();
                        pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                        container.innerHTML = render(); bindEvents(container);
                    }
                } else {
                    const { error } = await ICCSupabase.requestUserUpdate(userId, fields, origData);
                    if (error) {
                        Toast.error('Failed to submit restore request: ' + (error.message || error));
                        btn.textContent = originalText;
                        btn.disabled = false;
                    } else {
                        Toast.success('🛡️ Restore request submitted to Super Admin for approval.');
                        editingUserId = null;
                        pendingEditRequests = await ICCSupabase.fetchUserEditRequests('pending');
                        container.innerHTML = render(); bindEvents(container);
                    }
                }
            });
        });

        // User Search & Filter
        const applyUserFilters = () => {
            const query = userSearchQuery.trim().toLowerCase();
            const sectionQuery = userSectionFilter;
            const teamQuery = userTeamFilter;
            const listContainer = document.getElementById('users-list-container');
            if (!listContainer) return;
            const cards = listContainer.querySelectorAll('.glass-card[data-user-id]');
            let visibleCount = 0;
            
            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                const cardSection = card.getAttribute('data-section') || '';
                const cardTeamId = card.getAttribute('data-team-id') || '';

                const matchesSearch = !query || text.includes(query);
                const matchesSection = !sectionQuery || cardSection === sectionQuery;
                
                let matchesTeam = true;
                if (teamQuery === 'none') {
                    matchesTeam = !cardTeamId || cardTeamId === 'null' || cardTeamId === 'undefined';
                } else if (teamQuery) {
                    matchesTeam = String(cardTeamId) === String(teamQuery);
                }

                if (matchesSearch && matchesSection && matchesTeam) {
                    card.style.display = '';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });
            const countBadge = document.getElementById('users-count-badge');
            if (countBadge) countBadge.textContent = visibleCount + ' members';

            const excelBtnText = document.getElementById('admin-excel-btn-text');
            if (excelBtnText) {
                const hasFilters = !!(query || sectionQuery || teamQuery);
                excelBtnText.textContent = hasFilters ? `Export Filtered (${visibleCount})` : 'Download Excel (.xlsx)';
            }
        };

        const searchInput = document.getElementById('admin-user-search');
        if (searchInput) {
            searchInput.addEventListener('input', e => {
                userSearchQuery = e.target.value;
                applyUserFilters();
            });
        }
        
        const sectionSelect = document.getElementById('admin-user-section-filter');
        if (sectionSelect) {
            sectionSelect.addEventListener('change', e => {
                userSectionFilter = e.target.value;
                applyUserFilters();
            });
        }

        const teamSelect = document.getElementById('admin-user-team-filter');
        if (teamSelect) {
            teamSelect.addEventListener('change', e => {
                userTeamFilter = e.target.value;
                applyUserFilters();
            });
        }

        // Excel Download Button Listener
        const excelBtn = document.getElementById('admin-download-excel-btn');
        if (excelBtn) {
            excelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                exportUsersAndTeamsToExcel();
            });
        }

        if (userSearchQuery || userSectionFilter || userTeamFilter) {
            applyUserFilters();
        }

        container.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) return;
                const userId = btn.dataset.id;
                btn.textContent = '...';
                const { error } = await ICCSupabase.adminDeleteUser(userId);
                if (error) { Toast.error('Delete failed: ' + error.message); btn.textContent = 'Delete'; }
                else {
                    Toast.success('User deleted!');
                    allUsers = await ICCSupabase.getAllProfiles();
                    container.innerHTML = render(); bindEvents(container);
                }
            });
        });
        // Core Leads CRUD
        document.getElementById('add-lead-btn')?.addEventListener('click', () => {
            editingLead = {}; container.innerHTML = render(); bindEvents(container);
        });
        document.getElementById('cancel-edit-lead')?.addEventListener('click', () => {
            editingLead = null; container.innerHTML = render(); bindEvents(container);
        });
        container.querySelectorAll('.edit-lead-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                editingLead = CORE_LEADS.find(l => l.id === id) || null;
                if (editingLead) { container.innerHTML = render(); bindEvents(container); }
            });
        });
        container.querySelectorAll('.delete-lead-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to delete this core lead?')) return;
                const id = parseInt(btn.dataset.id);
                const { error } = await ICCSupabase.deleteLead(id);
                if (error) Toast.error('Failed to delete lead: ' + error.message);
                else {
                    Toast.success('Lead deleted');
                    await loadLeads(); // Refresh global data from DB
                    container.innerHTML = render(); bindEvents(container);
                }
            });
        });
        document.getElementById('lead-edit-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true; submitBtn.textContent = 'Saving...';

            const fields = {
                name: document.getElementById('lead-name').value.trim(),
                team: document.getElementById('lead-team').value.trim(),
                initials: document.getElementById('lead-initials').value.trim(),
                bio: document.getElementById('lead-bio').value.trim(),
                specialties: document.getElementById('lead-specialties').value.split(',').map(s => s.trim()).filter(Boolean),
                gradient: document.getElementById('lead-gradient').value.trim(),
                color: document.getElementById('lead-color').value.trim()
            };

            const userEmailToAssign = document.getElementById('lead-email')?.value.trim();

            let error;
            let teamId;
            if (editingLead.id) {
                const res = await ICCSupabase.updateLead(editingLead.id, fields);
                error = res.error;
                teamId = editingLead.id;
            } else {
                const res = await ICCSupabase.createLead(fields);
                error = res.error;
                if (res.data) teamId = res.data.id;
            }

            if (!error && userEmailToAssign && teamId) {
                const targetUser = allUsers.find(u => u.email === userEmailToAssign);
                if (targetUser) {
                    if (ICCSupabase.isSuperAdmin()) {
                        await ICCSupabase.adminUpdateUser(targetUser.id, { role: 'lead', team_id: teamId, is_pending_member: false });
                    } else {
                        await ICCSupabase.requestUserUpdate(targetUser.id, { role: 'lead', team_id: teamId, is_pending_member: false }, { role: targetUser.role, team_id: targetUser.team_id });
                        Toast.info('Lead appointment submitted to Super Admin for approval.');
                    }
                } else {
                    Toast.error('Team saved, but no user found with email: ' + userEmailToAssign);
                }
            }

            if (error) {
                Toast.error('Failed to save lead: ' + error.message);
                submitBtn.disabled = false; submitBtn.textContent = 'Save Lead';
            } else {
                Toast.success('Lead saved successfully');
                await loadLeads(); // refresh global data from DB
                allUsers = await ICCSupabase.getAllProfiles(); // Refresh users too
                editingLead = null;
                container.innerHTML = render(); bindEvents(container);
            }
        });

        // Events CRUD
        document.getElementById('add-event-btn')?.addEventListener('click', () => {
            editingEvent = { action_buttons: [] }; 
            container.innerHTML = render(); bindEvents(container);
        });

        document.getElementById('cancel-edit-event')?.addEventListener('click', () => {
            editingEvent = null; 
            container.innerHTML = render(); bindEvents(container);
        });

        document.getElementById('add-action-btn')?.addEventListener('click', () => {
            const containerEl = document.getElementById('action-buttons-container');
            const row = document.createElement('div');
            row.className = 'flex items-center gap-2 action-button-row';
            row.innerHTML = `
                <input type="text" placeholder="Label (e.g. Register Now)" class="form-input flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" required>
                <input type="url" placeholder="Target URL" class="form-input flex-[2] px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white" required>
                <button type="button" class="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg remove-action-btn"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            `;
            containerEl.appendChild(row);
        });

        container.addEventListener('click', (e) => {
            if (e.target.closest('.remove-action-btn')) {
                e.target.closest('.action-button-row').remove();
            }
        });

        container.querySelectorAll('.edit-event-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                editingEvent = allEvents.find(ev => ev.id === btn.dataset.id) || null;
                if (editingEvent) { container.innerHTML = render(); bindEvents(container); }
            });
        });

        container.querySelectorAll('.delete-event-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
                const { error } = await ICCSupabase.deleteEvent(btn.dataset.id);
                if (error) Toast.error('Failed to delete event: ' + error.message);
                else {
                    Toast.success('Event deleted');
                    allEvents = await ICCSupabase.fetchEvents();
                    container.innerHTML = render(); bindEvents(container);
                }
            });
        });

        document.getElementById('event-edit-form')?.addEventListener('submit', async e => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true; submitBtn.textContent = 'Saving...';

            // Gather action buttons
            const actionButtons = [];
            document.querySelectorAll('.action-button-row').forEach(row => {
                const inputs = row.querySelectorAll('input');
                if (inputs[0].value && inputs[1].value) {
                    actionButtons.push({ label: inputs[0].value.trim(), url: inputs[1].value.trim() });
                }
            });

            const bannerFile = document.getElementById('event-banner-file').files[0];
            const galleryFiles = document.getElementById('event-gallery-files').files;

            let banner_url = editingEvent.banner_url || null;
            if (bannerFile) {
                Toast.info('Uploading banner image...');
                const { url, error: uploadError } = await ICCSupabase.uploadImage('events', bannerFile);
                if (uploadError) {
                    Toast.error('Banner upload failed: ' + uploadError.message);
                    submitBtn.disabled = false; submitBtn.textContent = 'Save Event';
                    return;
                }
                banner_url = url;
            }

            let gallery_urls = editingEvent.gallery_urls || [];
            if (galleryFiles && galleryFiles.length > 0) {
                Toast.info('Uploading gallery images...');
                const newGalleryUrls = [];
                for (let i = 0; i < galleryFiles.length; i++) {
                    const { url, error: uploadError } = await ICCSupabase.uploadImage('events', galleryFiles[i]);
                    if (uploadError) {
                        Toast.error('Gallery image upload failed: ' + uploadError.message);
                        submitBtn.disabled = false; submitBtn.textContent = 'Save Event';
                        return;
                    }
                    newGalleryUrls.push(url);
                }
                gallery_urls = newGalleryUrls;
            }

            const fields = {
                title: document.getElementById('event-title').value.trim(),
                event_date: new Date(document.getElementById('event-date').value).toISOString(),
                status: document.getElementById('event-status').value,
                description: document.getElementById('event-desc').value.trim(),
                banner_url: banner_url,
                gallery_urls: gallery_urls,
                action_buttons: actionButtons
            };

            let error;
            if (editingEvent.id) {
                const res = await ICCSupabase.updateEvent(editingEvent.id, fields);
                error = res.error;
            } else {
                const res = await ICCSupabase.createEvent(fields);
                error = res.error;
            }

            if (error) {
                Toast.error('Failed to save event: ' + error.message);
                submitBtn.disabled = false; submitBtn.textContent = 'Save Event';
            } else {
                Toast.success('Event saved successfully');
                allEvents = await ICCSupabase.fetchEvents();
                editingEvent = null;
                container.innerHTML = render(); bindEvents(container);
            }
        });

        // ==================== ACCESS CONTROL LISTENERS ====================
        const accessSearch = container.querySelector('#access-user-search-input');
        if (accessSearch) {
            accessSearch.addEventListener('input', e => {
                accessSearchQuery = e.target.value;
                const content = document.getElementById('admin-content');
                if (content && activeTab === 'access_control') {
                    content.innerHTML = renderTab();
                    bindEvents(container);
                    const newSearch = container.querySelector('#access-user-search-input');
                    if (newSearch) {
                        newSearch.focus();
                        newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
                    }
                }
            });
        }
        container.querySelector('#clear-access-search-btn')?.addEventListener('click', () => {
            accessSearchQuery = '';
            container.innerHTML = render();
            bindEvents(container);
        });

        // Role filter pills
        container.querySelectorAll('.admin-role-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                accessRoleFilter = btn.dataset.filter;
                container.innerHTML = render();
                bindEvents(container);
            });
        });

        // Start Appointing a member as Admin
        container.querySelectorAll('.start-appoint-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                appointingUserId = btn.dataset.userId;
                appointingUserDraft = {
                    broadcast: true,
                    moderate: true,
                    events: true,
                    leads: true,
                    users: true,
                    all: true,
                    isSuperAdmin: false
                };
                container.innerHTML = render();
                bindEvents(container);
                container.querySelector('#appoint-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });

        // Cancel Appointing
        container.querySelectorAll('#cancel-appoint-btn, #cancel-appoint-btn-2').forEach(btn => {
            btn.addEventListener('click', () => {
                appointingUserId = null;
                appointingUserDraft = null;
                container.innerHTML = render();
                bindEvents(container);
            });
        });

        // Appoint Role Radios (Standard Admin vs Super Admin)
        container.querySelector('#role-admin-radio')?.addEventListener('change', e => {
            if (e.target.checked && appointingUserDraft) {
                appointingUserDraft.isSuperAdmin = false;
                container.innerHTML = render();
                bindEvents(container);
            }
        });
        container.querySelector('#role-superadmin-radio')?.addEventListener('change', e => {
            if (e.target.checked && appointingUserDraft) {
                appointingUserDraft.isSuperAdmin = true;
                appointingUserDraft.all = true;
                container.innerHTML = render();
                bindEvents(container);
            }
        });

        // Appoint Master Toggle
        container.querySelector('#appoint-all-toggle')?.addEventListener('change', e => {
            const checked = e.target.checked;
            if (appointingUserDraft) {
                appointingUserDraft.all = checked;
                appointingUserDraft.broadcast = checked;
                appointingUserDraft.moderate = checked;
                appointingUserDraft.events = checked;
                appointingUserDraft.leads = checked;
                appointingUserDraft.users = checked;
                container.querySelectorAll('.appoint-perm-check').forEach(cb => {
                    cb.checked = checked;
                });
            }
        });

        // Appoint Individual Checkboxes
        container.querySelectorAll('.appoint-perm-check').forEach(cb => {
            cb.addEventListener('change', e => {
                const perm = cb.dataset.perm;
                if (appointingUserDraft) {
                    appointingUserDraft[perm] = e.target.checked;
                    const allTrue = appointingUserDraft.broadcast && appointingUserDraft.moderate && appointingUserDraft.events && appointingUserDraft.leads && appointingUserDraft.users;
                    appointingUserDraft.all = allTrue;
                    const allToggle = container.querySelector('#appoint-all-toggle');
                    if (allToggle) allToggle.checked = allTrue;
                }
            });
        });

        // Confirm Appoint Admin
        container.querySelector('#confirm-appoint-btn')?.addEventListener('click', async () => {
            const targetId = appointingUserId;
            if (!targetId) return;
            const targetUser = allUsers.find(u => u.id === targetId);
            const targetName = targetUser?.full_name || 'User';
            const btn = container.querySelector('#confirm-appoint-btn');
            btn.disabled = true;
            btn.innerHTML = 'Appointing...';

            const roleToSet = appointingUserDraft.isSuperAdmin ? 'super_admin' : 'admin';
            const permsToSet = appointingUserDraft.isSuperAdmin ? null : {
                broadcast: !!appointingUserDraft.broadcast,
                moderate: !!appointingUserDraft.moderate,
                events: !!appointingUserDraft.events,
                leads: !!appointingUserDraft.leads,
                users: !!appointingUserDraft.users,
                all: !!appointingUserDraft.all
            };

            const res = await ICCSupabase.setAdminRole(targetId, roleToSet, permsToSet);
            if (res.error) {
                Toast.error('Failed to appoint admin: ' + (res.error.message || res.error));
                btn.disabled = false;
                btn.innerHTML = 'Confirm & Appoint Administrator';
            } else {
                Toast.success(`👑 Appointed ${targetName} as ${roleToSet === 'super_admin' ? 'Super Admin' : 'Administrator'}!`);
                appointingUserId = null;
                appointingUserDraft = null;
                accessSearchQuery = '';
                allUsers = await ICCSupabase.getAllProfiles();
                container.innerHTML = render();
                bindEvents(container);
            }
        });

        // Active Admins: Master Permission Toggle
        container.querySelectorAll('.admin-all-perm-toggle').forEach(toggle => {
            toggle.addEventListener('change', async e => {
                const userId = toggle.dataset.userId;
                const userName = toggle.dataset.name || 'Admin';
                const isAll = e.target.checked;
                
                const targetUser = allUsers.find(u => u.id === userId);
                const currentPerms = ICCSupabase.getAdminPermissions(targetUser);
                const updated = {
                    ...currentPerms,
                    all: isAll,
                    broadcast: isAll ? true : currentPerms.broadcast,
                    moderate: isAll ? true : currentPerms.moderate,
                    events: isAll ? true : currentPerms.events,
                    leads: isAll ? true : currentPerms.leads,
                    users: isAll ? true : currentPerms.users
                };

                const res = await ICCSupabase.updateAdminPermissions(userId, updated);
                if (res.error) {
                    Toast.error('Failed to update permissions: ' + (res.error.message || res.error));
                    toggle.checked = !isAll;
                } else {
                    Toast.success(`Updated permissions for ${userName}`);
                    if (targetUser) targetUser.admin_permissions = updated;
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        });

        // Active Admins: Individual Feature Toggles
        container.querySelectorAll('.admin-perm-toggle').forEach(toggle => {
            toggle.addEventListener('change', async e => {
                const userId = toggle.dataset.userId;
                const perm = toggle.dataset.perm;
                const userName = toggle.dataset.name || 'Admin';
                const checked = e.target.checked;

                const targetUser = allUsers.find(u => u.id === userId);
                const currentPerms = { ...ICCSupabase.getAdminPermissions(targetUser) };
                currentPerms[perm] = checked;
                
                const allFive = currentPerms.broadcast && currentPerms.moderate && currentPerms.events && currentPerms.leads && currentPerms.users;
                currentPerms.all = allFive;

                const res = await ICCSupabase.updateAdminPermissions(userId, currentPerms);
                if (res.error) {
                    Toast.error('Failed to update: ' + (res.error.message || res.error));
                    toggle.checked = !checked;
                } else {
                    const permNames = {
                        broadcast: 'Broadcast',
                        moderate: 'Moderate',
                        events: 'Events',
                        leads: 'Leads',
                        users: 'Users'
                    };
                    Toast.success(`${permNames[perm] || perm} access ${checked ? 'granted' : 'removed'} for ${userName}`);
                    if (targetUser) targetUser.admin_permissions = currentPerms;
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        });

        // Promote to Super Admin
        container.querySelectorAll('.promote-superadmin-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const name = btn.dataset.name || 'User';
                if (!confirm(`Are you sure you want to promote ${name} to Super Admin? They will receive full, unrestricted control across all dashboard features.`)) return;

                const res = await ICCSupabase.setAdminRole(userId, 'super_admin');
                if (res.error) {
                    Toast.error('Failed to promote: ' + (res.error.message || res.error));
                } else {
                    Toast.success(`🛡️ Promoted ${name} to Super Admin!`);
                    allUsers = await ICCSupabase.getAllProfiles();
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        });

        // Demote Super Admin to Standard Admin
        container.querySelectorAll('.demote-superadmin-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const name = btn.dataset.name || 'User';
                if (!confirm(`Demote ${name} from Super Admin to Standard Admin?`)) return;

                const res = await ICCSupabase.setAdminRole(userId, 'admin', { ...ICCSupabase.DEFAULT_ADMIN_PERMISSIONS, all: true });
                if (res.error) {
                    Toast.error('Failed to demote: ' + (res.error.message || res.error));
                } else {
                    Toast.info(`Demoted ${name} to Standard Admin.`);
                    allUsers = await ICCSupabase.getAllProfiles();
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        });

        // Revoke Admin Access
        container.querySelectorAll('.revoke-admin-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const name = btn.dataset.name || 'User';
                if (!confirm(`⚠️ Revoke administrator privileges for ${name}? They will become a standard member.`)) return;

                const res = await ICCSupabase.setAdminRole(userId, 'member', null);
                if (res.error) {
                    Toast.error('Failed to revoke admin: ' + (res.error.message || res.error));
                } else {
                    Toast.info(`Revoked admin access for ${name}`);
                    allUsers = await ICCSupabase.getAllProfiles();
                    container.innerHTML = render();
                    bindEvents(container);
                }
            });
        });

        // Copy SQL Script Button
        container.querySelector('#copy-access-sql-btn')?.addEventListener('click', () => {
            const sql = `-- Run this in Supabase SQL Editor:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_permissions JSONB DEFAULT '{"broadcast": true, "moderate": true, "events": true, "leads": true, "users": true}'::jsonb;
UPDATE public.profiles SET admin_permissions = '{"broadcast": true, "moderate": true, "events": true, "leads": true, "users": true}'::jsonb WHERE role IN ('admin', 'super_admin', 'superadmin') AND (admin_permissions IS NULL OR admin_permissions = '{}'::jsonb);`;
            navigator.clipboard.writeText(sql).then(() => {
                Toast.success('📋 SQL migration copied to clipboard!');
            }).catch(() => {
                Toast.info('Please refer to access_control_schema.sql in project root');
            });
        });
    }

    return { mount };
})();
