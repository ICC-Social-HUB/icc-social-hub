/* ============================================
   ICC Social Hub — Bottom Nav + Desktop Sidebar
   ============================================ */
const BottomNav = (() => {
    let unreadMessages = 0;
    let unreadNotifs = 0;

    function render() {
        const h = window.location.hash || '#dashboard';
        const u = ICCSupabase.getUser();
        const tabs = [
            { id:'dashboard', hash:'#dashboard', label:'Home', icon:homeIcon },
            { id:'feed', hash:'#feed', label:'Feed', icon:feedIcon },
            { id:'teams', hash:'#teams', label:'Teams', icon:teamsIcon },
            { id:'fab', isFab:true },
            { id:'chat', hash:'#chat', label:'Chat', icon:chatIcon, badge:unreadMessages },
            { id:'profile', hash:'#profile', label:'Profile', icon:profileIcon }
        ];
        if (ICCSupabase.isAdmin()) {
            tabs.splice(4, 0, { id:'admin', hash:'#admin', label:'Admin', icon:adminIcon });
        }
        const mobile = `<nav class="bottom-nav md:hidden" id="bottom-nav"><div class="flex items-end justify-around px-2 pt-1 pb-1 max-w-lg mx-auto">${tabs.map(t=>{
            if(t.isFab) return `<button class="fab-create" id="fab-create-btn" aria-label="Create post"><svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg></button>`;
            const a=h.startsWith(t.hash);
            return `<a href="${t.hash}" class="bottom-nav-item ${a?'active':''}" id="nav-${t.id}">${t.icon(a)}<span class="text-[10px] font-medium">${t.label}</span>${t.badge>0?`<span class="nav-badge">${t.badge>9?'9+':t.badge}</span>`:''}</a>`;
        }).join('')}</div></nav>`;
        const desktopTabs = [
            { id:'dashboard', hash:'#dashboard', label:'Home', icon:homeIcon },
            { id:'feed', hash:'#feed', label:'Feed', icon:feedIcon },
            { id:'teams', hash:'#teams', label:'Teams', icon:teamsIcon },
            { id:'chat', hash:'#chat', label:'Chat', icon:chatIcon, badge:unreadMessages },
            { id:'profile', hash:'#profile', label:'Profile', icon:profileIcon }
        ];
        if (ICCSupabase.isAdmin()) {
            desktopTabs.push({ id:'admin', hash:'#admin', label:'Admin', icon:adminIcon });
        }
        const desktop = `<nav class="desktop-nav hidden md:flex" id="desktop-nav"><a href="#dashboard" class="block mb-4 mt-2"><div class="w-10 h-10 bg-gradient-to-br from-red-600 to-rose-700 rounded-xl flex items-center justify-center font-heading font-bold text-xs">ICC</div></a><div class="flex-1 flex flex-col items-center gap-1 mt-4">${desktopTabs.map(t=>{const a=h.startsWith(t.hash);return `<a href="${t.hash}" class="desktop-nav-item ${a?'active':''}" title="${t.label}" id="dnav-${t.id}">${t.icon(a)}${t.badge>0?`<span class="nav-badge" style="top:4px;right:4px;transform:none">${t.badge>9?'9+':t.badge}</span>`:''}</a>`;}).join('')}<button class="desktop-nav-item mt-2" id="desktop-fab-btn" title="Create Post" style="color:#E11D48"><svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg></button></div></nav>`;
        return mobile+desktop;
    }
    function mount(){const r=document.getElementById('bottom-nav-root');if(r)r.innerHTML=render();bindEvents();}
    function bindEvents(){
        document.getElementById('fab-create-btn')?.addEventListener('click',()=>{if(!ICCSupabase.getUser()){AuthModal.open();return;}CreatePostModal.open();});
        document.getElementById('desktop-fab-btn')?.addEventListener('click',()=>{if(!ICCSupabase.getUser()){AuthModal.open();return;}CreatePostModal.open();});
    }
    async function updateUnreadCount(){unreadMessages=await ICCSupabase.getUnreadCount();mount();}
    async function updateNotifCount(){unreadNotifs=await ICCSupabase.getUnreadNotifCount();mount();}
    async function updateAllBadges(){await Promise.all([updateUnreadCount(), updateNotifCount()]);}
    function setUnread(c){unreadMessages=c;}
    function setUnreadNotifs(c){unreadNotifs=c;}
    return {mount,updateUnreadCount,updateNotifCount,updateAllBadges,setUnread,setUnreadNotifs};
})();

function homeIcon(a){return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>'}</svg>`;}
function feedIcon(a){return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/>'}</svg>`;}
function teamsIcon(a){return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>'}</svg>`;}
function chatIcon(a){return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>'}</svg>`;}
function notifIcon(a){return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>'}</svg>`;}
function profileIcon(a){return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>'}</svg>`;}
function adminIcon(a){return `<svg class="w-6 h-6" fill="${a?'currentColor':'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${a?'0':'1.5'}">${a?'<path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>':'<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>'}</svg>`;}

