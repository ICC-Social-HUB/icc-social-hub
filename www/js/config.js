/* ============================================
   ICC Social Hub — Supabase Configuration
   ============================================ */

const ICC_CONFIG = {
    SUPABASE_URL: 'https://gryfobekzlmfonnrwbpg.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyeWZvYmVremxtZm9ubnJ3YnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njk0MTYsImV4cCI6MjA5MjQ0NTQxNn0.2l1LAjLeU4CjKjM7WI_rmEPXEM-bNlzTj9I-iw0ZAqM',
    API_BASE_URL: (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ? 'http://localhost:5000' : 'https://icc-social-hub.vercel.app',
    POSTS_PER_PAGE: 10,
    MESSAGES_PER_PAGE: 30,
    VERIFIED_TICK: `<svg class="w-3.5 h-3.5 text-blue-500 fill-current inline-block ml-1 align-baseline" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 2px rgba(59,130,246,0.5));" title="Verified Lead"><path d="M23.36,11.37,21,8.34V4.49a1.26,1.26,0,0,0-1.25-1.25H15.89l-3-2.35a1.36,1.36,0,0,0-1.7,0l-3,2.35H4.25A1.26,1.26,0,0,0,3,4.49V8.34l-2.36,3a1.36,1.36,0,0,0,0,1.7L3,16v3.85A1.26,1.26,0,0,0,4.25,21.1h3.92l3,2.35a1.36,1.36,0,0,0,1.7,0l3-2.35h3.92a1.26,1.26,0,0,0,1.25-1.25V16l2.36-3a1.36,1.36,0,0,0,0-1.7ZM10.22,15.63,7.1,12.51a1,1,0,0,1,1.42-1.42l1.71,1.71L15.5,7.51a1,1,0,0,1,1.42,1.42Z"/></svg>`,
    MENTOR_TICK: `<svg class="w-3.5 h-3.5 text-amber-400 fill-current inline-block ml-1 align-baseline" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 3px rgba(251,191,36,0.7));" title="Verified Mentor"><path d="M23.36,11.37,21,8.34V4.49a1.26,1.26,0,0,0-1.25-1.25H15.89l-3-2.35a1.36,1.36,0,0,0-1.7,0l-3,2.35H4.25A1.26,1.26,0,0,0,3,4.49V8.34l-2.36,3a1.36,1.36,0,0,0,0,1.7L3,16v3.85A1.26,1.26,0,0,0,4.25,21.1h3.92l3,2.35a1.36,1.36,0,0,0,1.7,0l3-2.35h3.92a1.26,1.26,0,0,0,1.25-1.25V16l2.36-3a1.36,1.36,0,0,0,0-1.7ZM10.22,15.63,7.1,12.51a1,1,0,0,1,1.42-1.42l1.71,1.71L15.5,7.51a1,1,0,0,1,1.42,1.42Z"/></svg>`,
    getRoleTick: function(u) {
        if (!u) return '';
        const role = (typeof u === 'string' ? u : (u.role || '')).toLowerCase().trim();
        if (role === 'mentor' || (typeof u === 'object' && (u.is_mentor || role === 'super_admin' || role === 'superadmin'))) {
            return ICC_CONFIG.MENTOR_TICK;
        }
        if (role === 'lead') {
            return ICC_CONFIG.VERIFIED_TICK;
        }
        return '';
    }
};

if (typeof window !== 'undefined') {
    window.getRoleTick = ICC_CONFIG.getRoleTick;
}

