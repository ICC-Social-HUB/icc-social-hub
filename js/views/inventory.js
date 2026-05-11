/* ============================================
   ICC Social Hub — Inventory & Component Management
   ============================================ */
const InventoryView = (() => {
    let currentTab = 'storefront'; // storefront, my-requests, management
    let inventory = [];
    let myRequests = [];
    let allRequests = []; // Admin only
    let isLoading = true;
    let searchQuery = '';

    async function mount(container) {
        try {
            container.innerHTML = `<div class="flex items-center justify-center min-h-[60vh]"><div class="spinner"></div></div>`;
            
            const user = ICCSupabase.getUser();
            if (!user) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                        <div class="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800">
                            <svg class="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        </div>
                        <h2 class="text-xl font-bold mb-2">Authentication Required</h2>
                        <p class="text-zinc-500 text-sm mb-6">Please sign in to access the ICC Inventory.</p>
                        <button onclick="AuthModal.open()" class="px-6 py-3 bg-crimson rounded-xl font-bold hover:bg-crimson-dark transition-all">Sign In</button>
                    </div>
                `;
                return;
            }

            await refreshData();
            render(container);
            setupSubscriptions();
        } catch (err) {
            console.error('InventoryView mount error:', err);
            container.innerHTML = `<div class="p-8 text-center"><p class="text-red-500 font-semibold">Failed to load Inventory</p><p class="text-xs text-zinc-500 mt-2">${err.message}</p></div>`;
        }
    }

    async function refreshData() {
        isLoading = true;
        try {
            inventory = await ICCSupabase.fetchInventory();
            myRequests = await ICCSupabase.fetchMyInventoryRequests();
            if (ICCSupabase.isAdmin()) {
                allRequests = await ICCSupabase.fetchInventoryRequests();
            }
        } catch (err) {
            console.error('Inventory refresh error:', err);
        } finally {
            isLoading = false;
        }
    }

    function setupSubscriptions() {
        ICCSupabase.subscribeToInventory(() => {
            refreshData().then(() => {
                const container = document.getElementById('app');
                if (container && window.location.hash === '#inventory') render(container);
            });
        });

        if (ICCSupabase.isAdmin()) {
            ICCSupabase.subscribeToInventoryRequests(() => {
                refreshData().then(() => {
                    const container = document.getElementById('app');
                    if (container && window.location.hash === '#inventory') render(container);
                });
            });
        }
    }

    function render(container) {
        const isAdmin = ICCSupabase.isAdmin();
        
        container.innerHTML = `
            <div class="min-h-screen pb-24 px-4 pt-4 animate-fade-in">
                <div class="max-w-5xl mx-auto">
                    
                    <!-- Header -->
                    <div class="flex flex-col items-center text-center gap-4 mb-8 pt-4">
                        <div>
                            <h1 class="font-heading font-bold text-3xl mb-1">ICC <span class="gradient-text-static">Inventory</span></h1>
                            <p class="text-zinc-500 text-sm">Hardware, components, and tools for your innovation projects.</p>
                        </div>
                        ${isAdmin ? `
                            <button onclick="InventoryView.openAddModal()" class="flex items-center gap-2 px-6 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all text-emerald-400">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                                Add New Component
                            </button>
                        ` : ''}
                    </div>

                    <!-- Tabs -->
                    <div class="flex items-center justify-center gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
                        <button onclick="InventoryView.setTab('storefront')" class="px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${currentTab === 'storefront' ? 'bg-crimson text-white shadow-lg shadow-crimson/20' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}">Storefront</button>
                        <button onclick="InventoryView.setTab('my-requests')" class="px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${currentTab === 'my-requests' ? 'bg-crimson text-white shadow-lg shadow-crimson/20' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}">My Borrows</button>
                        ${isAdmin ? `
                            <button onclick="InventoryView.setTab('management')" class="px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${currentTab === 'management' ? 'bg-crimson text-white shadow-lg shadow-crimson/20' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}">Admin Panel</button>
                        ` : ''}
                    </div>

                    <!-- Content Area -->
                    <div id="inventory-content">
                        ${renderTabContent()}
                    </div>
                </div>
            </div>

            <!-- Modals Root for Inventory -->
            <div id="inventory-modal-root"></div>
        `;
    }

    function renderTabContent() {
        if (isLoading) return `<div class="flex items-center justify-center py-20"><div class="spinner"></div></div>`;

        if (currentTab === 'storefront') {
            return renderStorefront();
        } else if (currentTab === 'my-requests') {
            return renderMyRequests();
        } else if (currentTab === 'management') {
            if (!ICCSupabase.isAdmin()) {
                currentTab = 'storefront';
                return renderStorefront();
            }
            return renderManagement();
        }
    }

    function renderStorefront() {
        if (inventory.length === 0) {
            return `
                <div class="flex flex-col items-center justify-center py-20 text-center">
                    <p class="text-zinc-500 mb-4">No items available in the inventory yet.</p>
                </div>
            `;
        }

        const categories = [...new Set(inventory.map(i => i.category))];
        const filteredInventory = inventory.filter(item => 
            (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.category || '').toLowerCase().includes(searchQuery.toLowerCase())
        );

        return `
            <!-- Search Bar -->
            <div class="mb-8 max-w-md mx-auto">
                <div class="relative group">
                    <input 
                        type="text" 
                        id="inventory-search" 
                        placeholder="Search components (e.g. Arduino, Sensor...)" 
                        value="${searchQuery}"
                        oninput="InventoryView.handleSearch(this.value)"
                        class="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-12 py-4 text-sm focus:border-crimson focus:ring-1 focus:ring-crimson/20 outline-none transition-all placeholder:text-zinc-600"
                    >
                    <div class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-crimson transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    ${searchQuery ? `
                        <button onclick="InventoryView.clearSearch()" class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                ${filteredInventory.length > 0 ? filteredInventory.map(item => `
                    <div class="glass-card rounded-2xl overflow-hidden group border border-zinc-800/50 hover:border-crimson/30 transition-all duration-300 flex flex-col">
                        <div class="aspect-video bg-zinc-900 relative overflow-hidden">
                            ${item.image_url ? `<img src="${item.image_url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">` : `
                                <div class="w-full h-full flex items-center justify-center text-zinc-700">
                                    <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                                </div>
                            `}
                            <div class="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold uppercase tracking-wider text-zinc-300 border border-white/5">${item.category}</div>
                            <div class="absolute bottom-3 right-3 px-2.5 py-1 ${item.available_stock > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} backdrop-blur-md rounded-lg text-[10px] font-bold border border-white/5">
                                ${item.available_stock} Available
                            </div>
                        </div>
                        <div class="p-5 flex-1 flex flex-col">
                            <h3 class="font-bold text-lg mb-1">${item.name}</h3>
                            <p class="text-zinc-500 text-xs mb-6 line-clamp-2">High-quality component for prototyping and production.</p>
                            
                            <div class="mt-auto flex items-center justify-between gap-4">
                                <div class="flex flex-col">
                                    <span class="text-[10px] text-zinc-500 uppercase tracking-tighter">Total Stock</span>
                                    <span class="text-sm font-bold text-zinc-300">${item.total_stock} Units</span>
                                </div>
                                <button 
                                    onclick="InventoryView.openRequestModal('${item.id}')" 
                                    class="px-5 py-2.5 bg-crimson text-white rounded-xl text-xs font-bold hover:bg-crimson-dark transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-crimson/10"
                                    ${item.available_stock <= 0 ? 'disabled' : ''}
                                >
                                    ${item.available_stock > 0 ? 'Borrow Item' : 'Out of Stock'}
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('') : `
                    <div class="col-span-full py-20 text-center animate-fade-in">
                        <div class="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 mx-auto border border-zinc-800">
                            <svg class="w-8 h-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                        <p class="text-zinc-500">No components found matching your search.</p>
                        <button onclick="InventoryView.clearSearch()" class="mt-4 text-crimson text-sm font-bold hover:underline">Clear all filters</button>
                    </div>
                `}
            </div>
        `;
    }

    function renderMyRequests() {
        if (myRequests.length === 0) {
            return `
                <div class="flex flex-col items-center justify-center py-20 text-center bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
                    <div class="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                        <svg class="w-8 h-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <p class="text-zinc-500">You haven't borrowed any items yet.</p>
                    <button onclick="InventoryView.setTab('storefront')" class="mt-4 text-crimson text-sm font-bold hover:underline">Browse Storefront</button>
                </div>
            `;
        }

        return `
            <div class="space-y-4">
                <h2 class="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Currently Borrowed & History</h2>
                ${myRequests.map(req => {
                    const statusColors = {
                        'pending': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                        'taken': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
                        'completed': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                        'cancelled': 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'
                    };
                    return `
                        <div class="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700 overflow-hidden">
                                    ${req.inventory?.image_url ? `<img src="${req.inventory.image_url}" class="w-full h-full object-cover">` : `<svg class="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`}
                                </div>
                                <div>
                                    <h4 class="font-bold text-sm">${req.inventory?.name || 'Deleted Item'}</h4>
                                    <p class="text-[10px] text-zinc-500">${req.quantity} Unit(s) • Project: ${req.project_name || 'N/A'}</p>
                                    ${req.team_name ? `<p class="text-[10px] text-crimson font-bold uppercase tracking-tight">${req.team_name}</p>` : ''}
                                    <p class="text-[10px] text-zinc-600 mt-1">${new Date(req.requested_at).toLocaleDateString()} • ${new Date(req.requested_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                </div>
                            </div>
                            <div class="flex items-center justify-between sm:justify-end gap-3">
                                <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[req.status] || ''}">
                                    ${req.status}
                                </span>
                                ${req.status === 'pending' ? `
                                    <button onclick="InventoryView.cancelMyRequest('${req.id}')" class="p-2 text-zinc-500 hover:text-red-400 transition-colors" title="Cancel Request">
                                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderManagement() {
        return `
            <div class="space-y-8 animate-slide-up">
                
                <!-- Stock Overview -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                        <span class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total Items</span>
                        <div class="text-2xl font-bold mt-1">${inventory.length}</div>
                    </div>
                    <div class="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                        <span class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Pending Requests</span>
                        <div class="text-2xl font-bold mt-1 text-amber-500">${allRequests.filter(r => r.status === 'pending').length}</div>
                    </div>
                    <div class="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                        <span class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Active Borrows</span>
                        <div class="text-2xl font-bold mt-1 text-blue-500">${allRequests.filter(r => r.status === 'taken').length}</div>
                    </div>
                    <div class="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                        <span class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Return Rate</span>
                        <div class="text-2xl font-bold mt-1 text-emerald-500">100%</div>
                    </div>
                </div>

                <!-- Requests Tracking -->
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xs font-bold text-zinc-500 uppercase tracking-widest">Borrower Activity</h2>
                        <span class="text-[10px] text-zinc-600 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800">Showing all logs</span>
                    </div>
                    
                    <div class="grid grid-cols-1 gap-4">
                        ${allRequests.map(req => {
                            const statusStyle = 
                                req.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                req.status === 'taken' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                req.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                'bg-red-500/10 text-red-500 border-red-500/20';
                            
                            return `
                                <div class="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 hover:bg-zinc-900/60 transition-all group">
                                    <div class="flex flex-col md:flex-row md:items-start justify-between gap-6">
                                        <!-- User Info -->
                                        <div class="flex items-center gap-4 min-w-0">
                                            <div class="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0">
                                                ${req.profiles?.avatar_url ? `<img src="${req.profiles.avatar_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center font-bold text-xl text-zinc-600">${req.profiles?.full_name?.charAt(0) || '?'}</div>`}
                                            </div>
                                            <div class="min-w-0">
                                                <h3 class="font-bold text-white text-base truncate">${req.profiles?.full_name || 'Anonymous Innovator'}</h3>
                                                <div class="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                                    <span class="text-[11px] font-medium text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700/50">USN: ${req.profiles?.usn || 'N/A'}</span>
                                                    <span class="text-[11px] font-medium text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700/50">Sec: ${req.profiles?.section || 'N/A'}</span>
                                                    <span class="text-[11px] font-medium text-emerald-400/80 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">${req.profiles?.phone || 'No Phone'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Item Info -->
                                        <div class="flex-1 p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/80">
                                            <div class="flex items-center gap-3">
                                                <div class="w-10 h-10 bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden shrink-0">
                                                    ${req.inventory?.image_url ? `<img src="${req.inventory.image_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center"><svg class="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>`}
                                                </div>
                                                <div class="min-w-0">
                                                    <div class="text-xs font-bold text-zinc-300 truncate">${req.inventory?.name || 'Deleted Component'}</div>
                                                    <div class="text-[10px] text-zinc-500">Qty: ${req.quantity} • ${req.project_name || 'Personal Use'}</div>
                                                    ${req.team_name ? `<div class="text-[10px] text-crimson font-black uppercase tracking-tighter">${req.team_name}</div>` : ''}
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Status & Actions -->
                                        <div class="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0">
                                            <div class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${statusStyle}">
                                                ${req.status}
                                            </div>
                                            <div class="flex items-center gap-2">
                                                ${req.status === 'pending' ? `
                                                    <button onclick="InventoryView.updateStatus('${req.id}', 'taken')" class="h-9 px-4 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/10">Approve</button>
                                                    <button onclick="InventoryView.updateStatus('${req.id}', 'cancelled')" class="h-9 px-4 bg-zinc-800 text-zinc-400 rounded-lg text-[10px] font-bold hover:bg-red-500 hover:text-white transition-all">Reject</button>
                                                ` : ''}
                                                ${req.status === 'taken' ? `
                                                    <button onclick="InventoryView.updateStatus('${req.id}', 'completed')" class="h-9 px-4 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/10">Mark Returned</button>
                                                ` : ''}
                                                <a href="https://wa.me/${req.profiles?.phone?.replace(/\D/g,'')}" target="_blank" class="w-9 h-9 flex items-center justify-center bg-zinc-800 text-zinc-400 rounded-lg hover:text-emerald-400 transition-all border border-zinc-700/50">
                                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.394 0 12.03a11.811 11.811 0 001.578 5.925L0 24l6.135-1.61a11.81 11.81 0 005.91 1.586c6.638 0 12.034-5.394 12.036-12.032a11.805 11.805 0 00-3.48-8.504"/></svg>
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Product Inventory CRUD List -->
                <div>
                    <h2 class="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Stock Control</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${inventory.map(item => `
                            <div class="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-between gap-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-700 overflow-hidden">
                                        ${item.image_url ? `<img src="${item.image_url}" class="w-full h-full object-cover">` : `<svg class="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`}
                                    </div>
                                    <div>
                                        <div class="font-bold text-xs">${item.name}</div>
                                        <div class="text-[10px] text-zinc-500">${item.available_stock} / ${item.total_stock} Available</div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button onclick="InventoryView.openEditModal('${item.id}')" class="p-2 text-zinc-400 hover:text-white transition-all"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                                    <button onclick="InventoryView.deleteItem('${item.id}')" class="p-2 text-zinc-400 hover:text-red-500 transition-all"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Modal Helpers
    function openRequestModal(itemId) {
        const item = inventory.find(i => i.id === itemId);
        if (!item) return;

        const root = document.getElementById('inventory-modal-root');
        root.innerHTML = `
            <div class="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
                <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="InventoryView.closeModal()"></div>
                <div class="relative w-full max-w-md bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-slide-up">
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-xl font-bold font-heading">Borrow Component</h3>
                            <button onclick="InventoryView.closeModal()" class="text-zinc-500 hover:text-white"><svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                        </div>
                        
                        <div class="flex items-center gap-4 mb-8 p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                            <div class="w-14 h-14 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800">
                                ${item.image_url ? `<img src="${item.image_url}" class="w-full h-full object-cover">` : `<svg class="w-8 h-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`}
                            </div>
                            <div>
                                <div class="font-bold">${item.name}</div>
                                <div class="text-xs text-zinc-500">${item.available_stock} Units Available</div>
                            </div>
                        </div>

                        <form onsubmit="InventoryView.submitRequest(event, '${itemId}')" class="space-y-4">
                            <div>
                                <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-1 ml-1 tracking-wider">Quantity</label>
                                <input type="number" id="req-quantity" min="1" max="${item.available_stock}" value="1" required class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-crimson focus:ring-1 focus:ring-crimson/20 outline-none transition-all">
                            </div>
                            <div>
                                <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-1 ml-1 tracking-wider">Project Name</label>
                                <input type="text" id="req-project" placeholder="e.g. Smart Irrigation System" required class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-crimson focus:ring-1 focus:ring-crimson/20 outline-none transition-all">
                            </div>
                            <div>
                                <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-1 ml-1 tracking-wider">Team Name (Optional)</label>
                                <select id="req-team" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-crimson outline-none transition-all appearance-none cursor-pointer">
                                    <option value="">No Specific Team</option>
                                    ${(typeof CORE_LEADS !== 'undefined' ? CORE_LEADS : (typeof CORE_LEADS_STATIC !== 'undefined' ? CORE_LEADS_STATIC : []))
                                        .sort((a, b) => (a.team || '').localeCompare(b.team || ''))
                                        .map(l => `<option value="${l.team}">${l.team}</option>`).join('')}
                                </select>
                            </div>
                            <button type="submit" class="w-full py-4 bg-crimson text-white rounded-xl font-bold hover:bg-crimson-dark transition-all shadow-lg shadow-crimson/20 mt-4">Confirm Request</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    async function submitRequest(e, itemId) {
        e.preventDefault();
        const quantity = parseInt(document.getElementById('req-quantity').value);
        const projectName = document.getElementById('req-project').value;
        const teamName = document.getElementById('req-team').value;
        
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerHTML = `<div class="spinner mx-auto"></div>`;

        const { error } = await ICCSupabase.requestInventoryItem(itemId, quantity, projectName, teamName);
        
        if (error) {
            Toast.show(error.message, 'error');
            btn.disabled = false;
            btn.innerText = 'Confirm Request';
        } else {
            Toast.show('Borrow request submitted! Please visit the lab for collection.', 'success');
            closeModal();
            refreshData().then(() => {
                const container = document.getElementById('app');
                if (container) render(container);
            });
        }
    }

    // Admin CRUD Helpers
    function openAddModal() {
        if (!ICCSupabase.isAdmin()) return;
        const root = document.getElementById('inventory-modal-root');
        root.innerHTML = `
            <div class="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in overflow-y-auto">
                <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" onclick="InventoryView.closeModal()"></div>
                <div class="relative w-full max-w-lg bg-obsidian border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up mb-0 sm:mb-8">
                    
                    <!-- Drag Handle for Mobile -->
                    <div class="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mt-3 mb-1 sm:hidden"></div>

                    <div class="p-6">
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-xl font-bold font-heading">Add New Component</h3>
                            <button onclick="InventoryView.closeModal()" class="text-zinc-500 hover:text-white transition-colors">
                                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>

                        <form onsubmit="InventoryView.submitAddItem(event)" class="space-y-6">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="col-span-1 sm:col-span-2">
                                    <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-2 ml-1 tracking-wider">Item Name</label>
                                    <input type="text" id="add-name" placeholder="e.g. Arduino Uno R3" required class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-sm focus:border-crimson outline-none transition-all">
                                </div>
                                <div>
                                    <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-2 ml-1 tracking-wider">Category</label>
                                    <select id="add-category" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-sm focus:border-crimson outline-none transition-all appearance-none cursor-pointer">
                                        <option value="Microcontrollers">Microcontrollers</option>
                                        <option value="Sensors">Sensors</option>
                                        <option value="Actuators">Actuators</option>
                                        <option value="Communication">Communication</option>
                                        <option value="Tools">Tools</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-2 ml-1 tracking-wider">Stock Units</label>
                                    <input type="number" id="add-stock" value="10" min="1" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-sm focus:border-crimson outline-none transition-all">
                                </div>
                            </div>

                            <div>
                                <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-2 ml-1 tracking-wider">Component Image (.png only)</label>
                                <div class="relative group">
                                    <input type="file" id="add-image" accept=".png" class="hidden" onchange="document.getElementById('file-name-add').textContent = this.files[0]?.name || 'Select PNG Image'">
                                    <label for="add-image" class="flex flex-col items-center justify-center gap-3 w-full bg-zinc-950/50 border-2 border-dashed border-zinc-800 rounded-2xl p-8 text-sm text-zinc-500 cursor-pointer hover:border-crimson/50 hover:bg-zinc-900/50 transition-all group-active:scale-[0.98]">
                                        <div class="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-crimson transition-colors shadow-inner">
                                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                        </div>
                                        <span id="file-name-add" class="font-medium">Select PNG Image</span>
                                        <span class="text-[10px] text-zinc-600 uppercase">Optional • PNG only</span>
                                    </label>
                                </div>
                            </div>

                            <button type="submit" class="w-full py-4 bg-crimson text-white rounded-2xl font-bold hover:bg-crimson-dark transition-all shadow-xl shadow-crimson/20 flex items-center justify-center gap-2 group">
                                <span>Register Component</span>
                                <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    async function submitAddItem(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerHTML = `<div class="spinner mx-auto"></div>`;

        let imageUrl = null;
        const imageFile = document.getElementById('add-image').files[0];
        
        if (imageFile) {
            if (!imageFile.name.toLowerCase().endsWith('.png')) {
                Toast.show('Only PNG images are allowed', 'error');
                btn.disabled = false;
                btn.innerText = 'Add to Inventory';
                return;
            }
            const { url, error: uploadError } = await ICCSupabase.uploadImage('inventory', imageFile);
            if (uploadError) {
                Toast.show('Failed to upload image', 'error');
                console.error(uploadError);
            } else {
                imageUrl = url;
            }
        }

        const fields = {
            name: document.getElementById('add-name').value,
            category: document.getElementById('add-category').value,
            total_stock: parseInt(document.getElementById('add-stock').value),
            available_stock: parseInt(document.getElementById('add-stock').value),
            image_url: imageUrl
        };
        const { error } = await ICCSupabase.createInventoryItem(fields);
        if (error) {
            Toast.show(error.message, 'error');
            btn.disabled = false;
            btn.innerText = 'Add to Inventory';
        } else {
            Toast.show('Item added successfully', 'success');
            closeModal();
            refreshData().then(() => render(document.getElementById('app')));
        }
    }

    async function updateStatus(requestId, status) {
        if (!ICCSupabase.isAdmin()) return;
        const { error } = await ICCSupabase.updateInventoryRequestStatus(requestId, status);
        if (error) Toast.show(error.message, 'error');
        else {
            Toast.show(`Request ${status === 'cancelled' ? 'cancelled' : 'updated'}`, 'success');
            refreshData().then(() => render(document.getElementById('app')));
        }
    }

    async function cancelMyRequest(requestId) {
        if (!confirm('Are you sure you want to cancel this borrow request?')) return;
        const { error } = await ICCSupabase.updateInventoryRequestStatus(requestId, 'cancelled');
        if (error) Toast.show(error.message, 'error');
        else {
            Toast.show('Request cancelled', 'success');
            refreshData().then(() => render(document.getElementById('app')));
        }
    }

    async function deleteItem(itemId) {
        if (!ICCSupabase.isAdmin()) return;
        if (!confirm('Are you sure you want to remove this item? This action cannot be undone.')) return;
        const { error } = await ICCSupabase.deleteInventoryItem(itemId);
        if (error) Toast.show(error.message, 'error');
        else {
            Toast.show('Item removed from inventory', 'success');
            refreshData().then(() => render(document.getElementById('app')));
        }
    }

    function openEditModal(itemId) {
        if (!ICCSupabase.isAdmin()) return;
        const item = inventory.find(i => i.id === itemId);
        if (!item) return;

        const root = document.getElementById('inventory-modal-root');
        root.innerHTML = `
            <div class="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
                <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="InventoryView.closeModal()"></div>
                <div class="relative w-full max-w-lg bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-slide-up">
                    <div class="p-6">
                        <h3 class="text-xl font-bold font-heading mb-6">Edit Component</h3>
                        <form onsubmit="InventoryView.submitEditItem(event, '${itemId}')" class="grid grid-cols-2 gap-4">
                            <div class="col-span-2">
                                <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-1 ml-1 tracking-wider">Item Name</label>
                                <input type="text" id="edit-name" value="${item.name}" required class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-crimson outline-none transition-all">
                            </div>
                            <div>
                                <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-1 ml-1 tracking-wider">Total Stock</label>
                                <input type="number" id="edit-stock" value="${item.total_stock}" min="0" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-crimson outline-none transition-all">
                            </div>
                            <div>
                                <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-1 ml-1 tracking-wider">Available Stock</label>
                                <input type="number" id="edit-available" value="${item.available_stock}" min="0" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-crimson outline-none transition-all">
                            </div>
                            <div class="col-span-2">
                                <label class="block text-[10px] uppercase font-bold text-zinc-500 mb-1 ml-1 tracking-wider">Component Image (.png only, optional)</label>
                                <div class="relative group">
                                    <input type="file" id="edit-image" accept=".png" class="hidden" onchange="document.getElementById('file-name-edit').textContent = this.files[0]?.name || 'No file selected'">
                                    <label for="edit-image" class="flex items-center justify-center gap-2 w-full bg-zinc-950 border-2 border-dashed border-zinc-800 rounded-xl px-4 py-6 text-sm text-zinc-500 cursor-pointer hover:border-crimson/50 hover:bg-zinc-900/50 transition-all">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                        <span id="file-name-edit">${item.image_url ? 'Change Image' : 'Select PNG Image'}</span>
                                    </label>
                                </div>
                            </div>
                            <button type="submit" class="col-span-2 mt-4 py-4 bg-zinc-100 text-black rounded-xl font-bold hover:bg-white transition-all">Update Item</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    async function submitEditItem(e, itemId) {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerHTML = `<div class="spinner mx-auto"></div>`;

        const item = inventory.find(i => i.id === itemId);
        let imageUrl = item.image_url;
        const imageFile = document.getElementById('edit-image').files[0];
        
        if (imageFile) {
            if (!imageFile.name.toLowerCase().endsWith('.png')) {
                Toast.show('Only PNG images are allowed', 'error');
                btn.disabled = false;
                btn.innerText = 'Update Item';
                return;
            }
            const { url, error: uploadError } = await ICCSupabase.uploadImage('inventory', imageFile);
            if (uploadError) {
                Toast.show('Failed to upload image', 'error');
            } else {
                // Optionally delete old image
                if (item.image_url) await ICCSupabase.deleteImage('inventory', item.image_url);
                imageUrl = url;
            }
        }

        const fields = {
            name: document.getElementById('edit-name').value,
            total_stock: parseInt(document.getElementById('edit-stock').value),
            available_stock: parseInt(document.getElementById('edit-available').value),
            image_url: imageUrl
        };
        const { error } = await ICCSupabase.updateInventoryItem(itemId, fields);
        if (error) {
            Toast.show(error.message, 'error');
            btn.disabled = false;
            btn.innerText = 'Update Item';
        } else {
            Toast.show('Item updated', 'success');
            closeModal();
            refreshData().then(() => render(document.getElementById('app')));
        }
    }

    function setTab(tab) {
        currentTab = tab;
        render(document.getElementById('app'));
    }

    function closeModal() {
        const root = document.getElementById('inventory-modal-root');
        if (root) root.innerHTML = '';
    }

    function handleSearch(val) {
        searchQuery = val;
        render(document.getElementById('app'));
        // Maintain focus
        const input = document.getElementById('inventory-search');
        if (input) {
            input.focus();
            input.setSelectionRange(val.length, val.length);
        }
    }

    function clearSearch() {
        searchQuery = '';
        render(document.getElementById('app'));
    }

    return { 
        mount, setTab, openRequestModal, closeModal, submitRequest, 
        openAddModal, submitAddItem, updateStatus, deleteItem,
        openEditModal, submitEditItem, handleSearch, clearSearch
    };
})();
