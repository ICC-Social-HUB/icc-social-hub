/* ========================================================
   ICC Social Hub — Email Allowlist Configuration
   
   HOW IT WORKS:
   - To restrict access to specific emails or college domains,
     add them to _ALLOWED_EMAIL_LIST below.
   - If _ALLOWED_EMAIL_LIST is left empty, any valid authenticated
     user registered in Supabase is permitted to access the hub.
   ======================================================== */

const _ALLOWED_EMAIL_LIST = [
    // ── Optional restricted access list (leave empty for open access) ──
    // "admin@example.com",
    // "member@example.com",
];

// Internal lookup set (case-insensitive)
const ALLOWED_EMAILS = new Set(_ALLOWED_EMAIL_LIST.map(e => e.trim().toLowerCase()));

/**
 * Returns true if the given email is permitted to log in or register.
 * Check is case-insensitive.
 * @param {string} email
 * @returns {boolean}
 */
function isEmailAllowed(email) {
    if (!email || typeof email !== 'string') return false;
    const cleanEmail = email.trim().toLowerCase();

    // If no restriction list is specified, all valid email formats are permitted
    if (ALLOWED_EMAILS.size === 0) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    }

    return ALLOWED_EMAILS.has(cleanEmail);
}

if (typeof window !== 'undefined') {
    window.ALLOWED_EMAILS = ALLOWED_EMAILS;
    window.isEmailAllowed = isEmailAllowed;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ALLOWED_EMAILS, isEmailAllowed };
}