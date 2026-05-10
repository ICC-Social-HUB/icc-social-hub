/* ============================================
   ICC Social Hub — 13 Core Team Leads Data
   ============================================ */

const CORE_LEADS_STATIC = [
    { id:1, name:"Loading...", team:"Team 1", initials:"T1", bio:"", specialties:[], gradient:"from-zinc-800 to-zinc-900", color:"#27272a" },
    { id:2, name:"Loading...", team:"Team 2", initials:"T2", bio:"", specialties:[], gradient:"from-zinc-800 to-zinc-900", color:"#27272a" },
    { id:3, name:"Loading...", team:"Team 3", initials:"T3", bio:"", specialties:[], gradient:"from-zinc-800 to-zinc-900", color:"#27272a" },
    { id:4, name:"Loading...", team:"Team 4", initials:"T4", bio:"", specialties:[], gradient:"from-zinc-800 to-zinc-900", color:"#27272a" },
    { id:5, name:"Loading...", team:"Team 5", initials:"T5", bio:"", specialties:[], gradient:"from-zinc-800 to-zinc-900", color:"#27272a" },
    { id:6, name:"Loading...", team:"Team 6", initials:"T6", bio:"", specialties:[], gradient:"from-zinc-800 to-zinc-900", color:"#27272a" }
];

// Live data — mutable, updated from Supabase or fallback
let CORE_LEADS = []; // Start empty to trigger skeletons/loading states

// Team ID to Lead mapping helper
function getLeadByTeamId(teamId) {
    return CORE_LEADS.find(l => l.id === teamId) || null;
}

function getTeamName(teamId) {
    const lead = getLeadByTeamId(teamId);
    return lead ? lead.team : `Team ${teamId}`;
}

// Load leads from Supabase, fallback to static
async function loadLeads() {
    try {
        const leads = await ICCSupabase.fetchLeads();
        if (leads && leads.length > 0) {
            CORE_LEADS = leads;
            console.log('✅ Loaded', leads.length, 'leads from Supabase');
        } else {
            CORE_LEADS = [...CORE_LEADS_STATIC];
            console.log('📦 Using static fallback data');
        }
    } catch (e) {
        CORE_LEADS = [...CORE_LEADS_STATIC];
        console.log('📦 Using static fallback data (error)', e);
    }
    return CORE_LEADS;
}
