/* ============================================
   ICC Social Hub — Email Allowlist
   Only emails listed here can log in.

   HOW TO ADD EMAILS:
   Just add a new line inside the array:
       "newemail@example.com",
   Trailing commas are fine. Order doesn't matter.
   ============================================ */

// ── To add more emails later, just append to this list ──
const _ALLOWED_EMAIL_LIST = [

    // ── Batch 1: Core Members ──
    "saravanantn1920@gmail.com",

    // ── Add more below as needed ──

];

// Internal lookup set (auto-built, case-insensitive — don't edit this)
const ALLOWED_EMAILS = new Set(_ALLOWED_EMAIL_LIST.map(e => e.trim().toLowerCase()));

/**
 * Returns true if the given email is on the allowlist.
 * Check is case-insensitive.
 */
function isEmailAllowed(email) {
    return ALLOWED_EMAILS.has(email.trim().toLowerCase());
}

