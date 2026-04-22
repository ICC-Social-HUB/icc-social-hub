/* ============================================
   ICC Social Hub — Admin Dashboard
   ============================================ */
const AdminView = (() => {
    let activeTab = 'overview';
    let pendingLeads = [];
    let allPosts = [];
    let allUsers = [];
    let editingLead = null;

    function render() {
        const user = ICCSupabase.getUser();
        if (!user) return `<div class="empty-state min-h-screen"><h3 class="font-heading font-semibold text-lg">Sign In Required</h3><button onclick="AuthModal.open()" class="mt-4 px-6 py-2.5 bg-red-600 rounded-xl text-sm font-semibold">Sign In</button></div>`;
        if (!ICCSupabase.isAdmin()) return `<div class="empty-state min-h-screen"><div class="empty-state-icon"><svg class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div><h3 class="font-heading font-semibold text-lg mb-1">Access Denied</h3><p class="text-sm text-zinc-500">You don't have admin privileges.</p><a href="#feed" class="mt-4 inline-block px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-all">Back to Feed</a></div>`;

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
                    ${['overview', 'broadcast', 'leads', 'users', 'moderate'].map(t => `<button class="admin-tab ${activeTab === t ? 'active' : ''}" data-tab="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
                </div>
                <div id="admin-content">${renderTab()}</div>
            </div>
        </section>`;
    }

    function renderTab() {
        switch (activeTab) {
            case 'overview': return renderOverview();
            case 'broadcast': return renderBroadcast();
            case 'leads': return renderLeads();
            case 'users': return renderUsers();
            case 'moderate': return renderModerate();
            default: return '';
        }
    }

    function renderOverview() {
        return `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div class="admin-stat-card"><p class="text-2xl font-heading font-bold">${CORE_LEADS.length}</p><p class="text-[11px] text-zinc-500 mt-0.5">Teams</p></div>
            <div class="admin-stat-card"><p class="text-2xl font-heading font-bold">${pendingLeads.length}</p><p class="text-[11px] text-zinc-500 mt-0.5">Pending</p></div>
            <div class="admin-stat-card"><p class="text-2xl font-heading font-bold">${allPosts.length}</p><p class="text-[11px] text-zinc-500 mt-0.5">Posts</p></div>
            <div class="admin-stat-card"><p class="text-2xl font-heading font-bold gradient-text-static">∞</p><p class="text-[11px] text-zinc-500 mt-0.5">Potential</p></div>
        </div>
        <div class="glass-card rounded-xl p-5">
            <h3 class="font-heading font-semibold text-sm mb-3">Quick Actions</h3>
            <div class="grid grid-cols-2 gap-2">
                <button class="admin-tab-switch px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors text-left" data-tab="broadcast">📢 Send Broadcast</button>
                <button class="admin-tab-switch px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors text-left" data-tab="leads">👥 Manage Leads</button>
                <button class="admin-tab-switch px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors text-left" data-tab="users">🧑‍💻 Manage Users</button>
                <button class="admin-tab-switch px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors text-left" data-tab="moderate">🛡️ Moderate Feed</button>
                <a href="#teams" class="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors text-left block">🏠 View Teams</a>
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
                        <div><label class="block text-xs font-medium text-zinc-400 mb-1">Specialties (comma-separated)</label><input type="text" id="lead-specialties" value="${(editingLead.specialties || []).join(', ')}" class="form-input w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white"></div>
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
                            <td class="px-4 py-3"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-gradient-to-br ${l.gradient} flex items-center justify-center text-xs font-bold flex-shrink-0">${l.initials}</div><span class="text-sm font-medium">${l.name}</span></div></td>
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
                    <div><p class="text-sm font-medium">${p.full_name || p.username || 'User'}</p><p class="text-[11px] text-zinc-500">${p.username ? '@'+p.username : ''}</p></div>
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
                        <p class="text-sm font-medium truncate">${prof.username || prof.full_name || 'Anon'}</p>
                        <p class="text-xs text-zinc-500 truncate">${(p.caption || 'No caption').slice(0, 60)}</p>
                        <p class="text-[10px] text-zinc-600 mt-0.5">${formatTimeAgo(p.created_at)}</p>
                    </div>
                    <button class="admin-delete-post px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded-lg text-[11px] font-medium transition-colors" data-post-id="${p.id}">Delete</button>
                </div>`;
            }).join('')}
        </div>`;
    }

    function renderUsers() {
        return `
        <div class="glass-card rounded-xl overflow-hidden">
            <div class="flex items-center justify-between p-4 border-b border-zinc-800/50">
                <h3 class="font-heading font-semibold text-sm">User Management</h3>
                <span class="text-xs text-zinc-500">${allUsers.length} total</span>
            </div>
            <div class="overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table class="w-full text-left text-sm relative">
                    <thead class="sticky top-0 bg-zinc-950 z-10"><tr class="border-b border-zinc-800">
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase">User</th>
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase">Role</th>
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase">Team ID</th>
                        <th class="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase text-right">Actions</th>
                    </tr></thead>
                    <tbody>${allUsers.map(u => `
                        <tr class="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                        ${(u.full_name || u.username || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div class="flex flex-col">
                                        <span class="font-medium text-xs">${u.full_name || 'Anon'}</span>
                                        <span class="text-[10px] text-zinc-500">@${u.username || ''}</span>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-3">
                                <select class="user-role-select bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-300 w-24" data-id="${u.id}">
                                    <option value="member" ${u.role==='member'?'selected':''}>Member</option>
                                    <option value="lead" ${u.role==='lead'?'selected':''}>Lead</option>
                                    <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
                                </select>
                            </td>
                            <td class="px-4 py-3">
                                <select class="user-team-select bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-300 w-32" data-id="${u.id}">
                                    <option value="">None</option>
                                    ${CORE_LEADS.map(l => `<option value="${l.id}" ${u.team_id===l.id?'selected':''}>${l.team}</option>`).join('')}
                                </select>
                            </td>
                            <td class="px-4 py-3 text-right flex justify-end gap-2">
                                <button class="save-user-btn text-[10px] bg-blue-600/20 text-blue-400 px-2.5 py-1.5 rounded hover:bg-blue-600/40 transition-colors font-medium" data-id="${u.id}">Save</button>
                                <button class="delete-user-btn text-[10px] bg-red-600/20 text-red-400 px-2.5 py-1.5 rounded hover:bg-red-600/40 transition-colors font-medium" data-id="${u.id}">Delete</button>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            </div>
        </div>`;
    }

    async function mount(container) {
        activeTab = 'overview';
        container.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="spinner"></div></div>';
        pendingLeads = await ICCSupabase.getPendingLeads();
        allPosts = await ICCSupabase.getAllPosts();
        allUsers = await ICCSupabase.getAllProfiles();
        container.innerHTML = render();
        bindEvents(container);
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
            else { Toast.success('Broadcast sent! 🚨'); document.getElementById('broadcast-msg').value = ''; }
        });
        // Approve/deny leads
        container.querySelectorAll('.approve-lead-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const select = document.querySelector(`.assign-team-select[data-user-id="${userId}"]`);
                const teamId = select ? select.value : null;
                if (!teamId) { Toast.error('Please select a team to assign this lead to.'); return; }
                
                const { error } = await ICCSupabase.approveLead(userId, parseInt(teamId));
                if (error) Toast.error('Approve failed'); else { Toast.success('Lead approved and assigned!'); pendingLeads = await ICCSupabase.getPendingLeads(); container.innerHTML = render(); bindEvents(container); }
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
        
        // User management
        container.querySelectorAll('.save-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                const role = document.querySelector(`.user-role-select[data-id="${userId}"]`).value;
                const teamVal = document.querySelector(`.user-team-select[data-id="${userId}"]`).value;
                const team_id = teamVal ? parseInt(teamVal) : null;
                btn.textContent = '...';
                const { error } = await ICCSupabase.adminUpdateUser(userId, { role, team_id, is_pending_member: false });
                if (error) Toast.error('Failed to update user: ' + error.message);
                else Toast.success('User updated!');
                btn.textContent = 'Save';
            });
        });
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

            let error;
            if (editingLead.id) {
                const res = await ICCSupabase.updateLead(editingLead.id, fields);
                error = res.error;
            } else {
                const res = await ICCSupabase.createLead(fields);
                error = res.error;
            }

            if (error) {
                Toast.error('Failed to save lead: ' + error.message);
                submitBtn.disabled = false; submitBtn.textContent = 'Save Lead';
            } else {
                Toast.success('Lead saved successfully');
                await loadLeads(); // refresh global data from DB
                editingLead = null;
                container.innerHTML = render(); bindEvents(container);
            }
        });
    }

    return { mount };
})();
