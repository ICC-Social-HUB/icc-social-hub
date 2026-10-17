/* ============================================
   ICC Social Hub — 13 Core Team Leads Data
   ============================================ */

const CORE_LEADS_STATIC = [
    { id:1, name:"Arjun Mehta", team:"Team Circuit", initials:"AM", bio:"A visionary full-stack developer who believes in building systems that scale. Arjun leads Team Circuit with an obsession for clean architecture, performance optimization, and pushing the boundaries of what's possible with code.", specialties:["Full-Stack Development","System Architecture","Cloud & DevOps"], gradient:"from-red-600 to-orange-500", color:"#dc2626" },
    { id:2, name:"Priya Sharma", team:"Team Pixel", initials:"PS", bio:"Priya is the creative force behind ICC's visual identity. With an eye for detail and a deep understanding of human-centered design, she transforms complex ideas into beautiful, intuitive experiences.", specialties:["UI/UX Design","Brand Identity","Motion Design"], gradient:"from-pink-600 to-purple-500", color:"#db2777" },
    { id:3, name:"Rohan Desai", team:"Team Neuron", initials:"RD", bio:"Rohan is on a mission to make artificial intelligence accessible and impactful. Leading Team Neuron, he dives deep into machine learning models, neural networks, and data science to solve real-world problems.", specialties:["Machine Learning","Deep Learning","Data Science"], gradient:"from-cyan-500 to-blue-600", color:"#06b6d4" },
    { id:4, name:"Ananya Iyer", team:"Team Forge", initials:"AI", bio:"Ananya is a front-end wizard who turns designs into pixel-perfect, performant web applications. Team Forge specializes in modern web frameworks and responsive design.", specialties:["React & Next.js","Frontend Engineering","Web Performance"], gradient:"from-emerald-500 to-teal-600", color:"#10b981" },
    { id:5, name:"Karthik Nair", team:"Team Swift", initials:"KN", bio:"Karthik breathes life into mobile experiences. With expertise in both native and cross-platform development, Team Swift builds polished, high-performance mobile applications.", specialties:["React Native","Flutter","Mobile UI/UX"], gradient:"from-violet-500 to-indigo-600", color:"#8b5cf6" },
    { id:6, name:"Sneha Reddy", team:"Team Blaze", initials:"SR", bio:"Sneha knows how to make ideas go viral. As the head of Team Blaze, she crafts compelling narratives and manages ICC's digital presence with data-driven strategy.", specialties:["Digital Marketing","Growth Strategy","Social Media"], gradient:"from-amber-500 to-red-500", color:"#f59e0b" },
    { id:7, name:"Vikram Joshi", team:"Team Shield", initials:"VJ", bio:"In a world of digital threats, Vikram stands guard. Team Shield focuses on ethical hacking, vulnerability assessment, and building secure systems.", specialties:["Ethical Hacking","Network Security","CTF Competitions"], gradient:"from-green-500 to-emerald-700", color:"#22c55e" },
    { id:8, name:"Diya Kapoor", team:"Team Quill", initials:"DK", bio:"Words are Diya's superpower. Leading Team Quill, she manages everything from technical blog posts and newsletters to social media copy and event scripts.", specialties:["Technical Writing","Content Strategy","Copywriting"], gradient:"from-rose-500 to-pink-600", color:"#f43f5e" },
    { id:9, name:"Aditya Patel", team:"Team Spark", initials:"AP", bio:"Every legendary ICC event has Aditya's fingerprints on it. Team Spark plans, organizes, and executes hackathons, workshops, and tech talks that bring the community together.", specialties:["Event Management","Workshop Design","Community Building"], gradient:"from-orange-500 to-yellow-500", color:"#f97316" },
    { id:10, name:"Meera Krishnan", team:"Team Lens", initials:"MK", bio:"Meera captures the soul of ICC through her lens. Team Lens handles photography, videography, and multimedia production for all events and projects.", specialties:["Photography","Video Production","Visual Storytelling"], gradient:"from-fuchsia-500 to-purple-600", color:"#d946ef" },
    { id:11, name:"Harsh Gupta", team:"Team Ledger", initials:"HG", bio:"Behind every successful project is solid financial planning. Harsh and Team Ledger manage budgets, sponsorships, and resource allocation with analytical precision.", specialties:["Budget Management","Sponsorship","Financial Planning"], gradient:"from-slate-400 to-zinc-600", color:"#94a3b8" },
    { id:12, name:"Ishita Sen", team:"Team Bridge", initials:"IS", bio:"Ishita builds bridges between ICC and the world. Team Bridge manages partnerships with companies, other colleges, and industry mentors for exclusive opportunities.", specialties:["Corporate Relations","Partnerships","Networking"], gradient:"from-sky-400 to-blue-600", color:"#38bdf8" },
    { id:13, name:"Siddharth Rao", team:"Team Axis", initials:"SRo", bio:"Siddharth is the engine that keeps ICC running smoothly. Team Axis handles logistics, internal coordination, and process optimization across all teams.", specialties:["Project Management","Logistics","Process Optimization"], gradient:"from-red-500 to-rose-700", color:"#ef4444" }
];

// Live data — mutable, initialized from localStorage cache if available, falling back to static
let CORE_LEADS = (() => {
    try {
        const cached = localStorage.getItem('icc_leads_cache');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {}
    return [...CORE_LEADS_STATIC];
})();

// Team ID to Lead mapping helper
function getLeadByTeamId(teamId) {
    return CORE_LEADS.find(l => Number(l.id) === Number(teamId)) || null;
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
            CORE_LEADS = leads.map(dbLead => {
                const staticMatch = CORE_LEADS_STATIC.find(s => s.id === dbLead.id);
                let specialties = dbLead.specialties;
                if (!Array.isArray(specialties)) {
                    if (typeof specialties === 'string') {
                        specialties = specialties.split(',').map(s => s.trim()).filter(Boolean);
                    } else {
                        specialties = staticMatch?.specialties || [];
                    }
                }
                if (specialties.length === 0 && staticMatch?.specialties) {
                    specialties = staticMatch.specialties;
                }
                let milestones = dbLead.milestones;
                if (typeof milestones === 'string') {
                    try { milestones = JSON.parse(milestones); } catch (e) { milestones = {}; }
                }
                return {
                    ...(staticMatch || {}),
                    ...dbLead,
                    specialties,
                    milestones: milestones || staticMatch?.milestones || {},
                    gradient: dbLead.gradient || staticMatch?.gradient || 'from-red-600 to-orange-500',
                    color: dbLead.color || staticMatch?.color || '#dc2626',
                    initials: dbLead.initials || staticMatch?.initials || (dbLead.name ? dbLead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ICC')
                };
            });
            try {
                localStorage.setItem('icc_leads_cache', JSON.stringify(CORE_LEADS));
            } catch (e) {}
            console.log('✅ Loaded', CORE_LEADS.length, 'leads from Supabase and updated cache');
        } else {
            console.log('📦 Using current cached/static leads');
        }
    } catch (e) {
        console.warn('📦 Error loading leads from Supabase, retaining current data:', e);
    }
    return CORE_LEADS;
}
