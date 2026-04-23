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
    "saravanantm1920@gmail.com",
    "chetansurya625v3@gmail.com",
    "rishikrishnarishi25@gmail.com",
    "vn.bhavika@gmail.com",
    "shreyame193@gmail.com",
    "vigneshkaushik17@gmail.com",
    "puneethagsksit@gmail.com",
    "sujay200731@gmail.com",
    "dithyasem2@gmail.com",
    "Sanchitburli002@gmail.com",
    "ntarun132007@gmail.com",
    "Shrujantejask@gmail.com",
    "hasini01032007@gmail.com",

    "

    // ── Batch 2:  Club Members ──

];
s
// Internal lookup set (auto-built, case-insensitive — don't edit this)
const ALLOWED_EMAILS = new Set(_ALLOWED_EMAIL_LIST.map(e => e.trim().toLowerCase()));

/**
 * Returns true if the given email is on the allowlist.
 * Check is case-insensitive.
 */
function isEmailAllowed(email) {
    return ALLOWED_EMAILS.has(email.trim().toLowerCase());
}

