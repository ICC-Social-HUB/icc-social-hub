/* ============================================
   ICC Social Hub — Admin Dashboard
   ============================================ */
const AdminView = (() => {
    let activeTab = 'users';
    let pendingLeads = [];
    let allPosts = [];
    let allUsers = [];
    let allEvents = [];
    let editingLead = null;
    let editingUserId = null;
    let editingEvent = null;
    let userSearchQuery = '';
    let userSectionFilter = '';
    let userTeamFilter = '';

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
                    ${['broadcast', 'leads', 'users', 'moderate', 'events'].map(t => `<button class="admin-tab ${activeTab === t ? 'active' : ''}" data-tab="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
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
        switch (activeTab) {
            case 'broadcast': return renderBroadcast();
            case 'leads': return renderLeads();
            case 'users': return renderUsers();
            case 'moderate': return renderModerate();
            case 'events': return renderEvents();
            default: return '';
        }
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

        return `
        <div class="space-y-4">
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
                    <div class="relative flex-1 sm:w-64">
                        <input type="text" id="admin-user-search" placeholder="Search by name, email, or USN..." class="form-input w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white" value="${userSearchQuery}">
                        <svg class="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
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
                    
                    // A user is manually updated if they have db overrides that differ from the empty defaults
                    const isManuallyUpdated = !!(u.usn || u.phone || (u.full_name && u.full_name !== (student ? student.fullName : '')));
                    const teamName = CORE_LEADS.find(l => Number(l.id) === Number(u.team_id))?.team || 'No Team';
                    
                    return `
                    <div class="glass-card rounded-2xl p-4 transition-all duration-300 ${isEditing ? 'ring-1 ring-blue-500/50 bg-blue-500/5' : ''}" data-user-id="${u.id}" data-section="${(section || '').toUpperCase()}" data-team-id="${u.team_id || ''}">
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex items-center gap-3 flex-1 min-w-0">
                                <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold flex-shrink-0 border border-zinc-700 relative">
                                    ${(fullName || u.username || '?').charAt(0).toUpperCase()}
                                </div>
                                
                                ${isEditing ? `
                                    <div class="flex-1 space-y-2 py-1">
                                        <div class="relative">
                                            <input type="text" class="user-name-input w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none" value="${fullName}" placeholder="Full Name">
                                            <span class="absolute -top-2 left-2 px-1 bg-zinc-900 text-[9px] text-zinc-500 uppercase tracking-wider">Full Name</span>
                                        </div>
                                        <div class="relative">
                                            <div class="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                                                <span class="pl-3 pr-1 text-[10px] text-zinc-500">@</span>
                                                <input type="text" class="user-username-input w-full bg-transparent px-0 py-1.5 text-xs text-white focus:outline-none" value="${u.username || ''}" placeholder="Auth Username">
                                            </div>
                                            <span class="absolute -top-2 left-2 px-1 bg-zinc-900 text-[9px] text-zinc-500 uppercase tracking-wider">Auth Username</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div class="flex-1 min-w-0">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <h4 class="text-sm font-semibold text-white break-words">${fullName || 'Anonymous'}</h4>
                                            ${isVerified ? `<span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Excel Verified</span>` : `<span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">Unverified</span>`}
                                            ${isManuallyUpdated ? `<span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">Manually Updated</span>` : ''}
                                        </div>
                                        <p class="text-[11px] text-zinc-500 truncate">@${u.username || '—'}</p>
                                    </div>
                                `}
                            </div>
                            
                            ${!isEditing ? `
                                <button class="edit-user-btn p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all" data-id="${u.id}">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                </button>
                            ` : ''}
                        </div>

                        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-zinc-800/50 pt-4">
                            <div class="space-y-1">
                                <span class="text-[9px] text-zinc-500 uppercase tracking-wider block">Email Address (Read Only)</span>
                                <p class="text-[11px] text-zinc-400 font-mono truncate">${u.email || 'No email'}</p>
                            </div>
                            <div class="space-y-1">
                                <span class="text-[9px] text-zinc-500 uppercase tracking-wider block">USN</span>
                                ${isEditing ? `
                                    <input type="text" class="user-usn-input w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-white focus:border-blue-500 outline-none uppercase" value="${usn}" placeholder="1KS...">
                                ` : `
                                    <p class="text-[11px] text-zinc-300 font-mono uppercase">${usn || '—'}</p>
                                `}
                            </div>
                            <div class="space-y-1">
                                <span class="text-[9px] text-zinc-500 uppercase tracking-wider block">Phone Number</span>
                                ${isEditing ? `
                                    <input type="tel" class="user-phone-input w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-white focus:border-blue-500 outline-none" value="${phone}" placeholder="10 digits">
                                ` : `
                                    <p class="text-[11px] text-zinc-300 font-mono">${phone || '—'}</p>
                                `}
                            </div>
                            <div class="space-y-1">
                                <span class="text-[9px] text-zinc-500 uppercase tracking-wider block">Section & Team</span>
                                <div class="flex gap-2 items-center">
                                    <span class="text-[11px] font-bold text-zinc-300 uppercase">${section || '-'}</span>
                                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${u.team_id ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-500'}">
                                        ${teamName}
                                    </span>
                                </div>
                            </div>
                        </div>

                        ${isEditing ? `
                            <div class="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/30">
                                <button class="save-user-btn flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all" data-id="${u.id}">Save Changes</button>
                                <button class="cancel-user-edit-btn px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-all">Cancel</button>
                                ${isManuallyUpdated ? `
                                    <button class="restore-user-btn px-4 py-2 bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white border border-orange-500/30 rounded-xl text-xs font-semibold transition-all" data-id="${u.id}" title="Revert to Excel Data">Restore</button>
                                ` : ''}
                                <button class="delete-user-btn p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all" data-id="${u.id}" title="Delete User">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                            </div>
                        ` : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    async function mount(container) {
        activeTab = 'users';
        container.innerHTML = '<div class="flex items-center justify-center min-h-screen"><div class="spinner"></div></div>';
        pendingLeads = await ICCSupabase.getPendingLeads();
        allPosts = await ICCSupabase.getAllPosts();
        allUsers = await ICCSupabase.getAllProfiles();
        allEvents = await ICCSupabase.fetchEvents();
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

                const originalText = btn.textContent;
                btn.textContent = 'Saving...';
                btn.disabled = true;
                
                const fields = { 
                    full_name: fullName, 
                    username: username,
                    usn: usn ? usn.toUpperCase() : null,
                    phone: cleanedPhone
                };

                const { error } = await ICCSupabase.adminUpdateUser(userId, fields);
                if (error) {
                    Toast.error('Failed to update user: ' + error.message);
                    btn.textContent = originalText;
                    btn.disabled = false;
                } else {
                    Toast.success('User profile updated!');
                    editingUserId = null;
                    allUsers = await ICCSupabase.getAllProfiles();
                    container.innerHTML = render(); bindEvents(container);
                }
            });
        });

        container.querySelectorAll('.restore-user-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to revert to the original Excel verified data? This will clear manual overrides.')) return;
                const userId = btn.dataset.id;
                const originalText = btn.textContent;
                btn.textContent = 'Restoring...';
                btn.disabled = true;
                
                const fields = { 
                    full_name: null, 
                    usn: null,
                    phone: null
                };

                const { error } = await ICCSupabase.adminUpdateUser(userId, fields);
                if (error) {
                    Toast.error('Restore failed: ' + error.message);
                    btn.textContent = originalText;
                    btn.disabled = false;
                } else {
                    Toast.success('Reverted to Excel values!');
                    editingUserId = null;
                    allUsers = await ICCSupabase.getAllProfiles();
                    container.innerHTML = render(); bindEvents(container);
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
                    await ICCSupabase.adminUpdateUser(targetUser.id, { role: 'lead', team_id: teamId, is_pending_member: false });
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
    }

    return { mount };
})();
