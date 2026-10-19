/* ========================================================
   ICC Social Hub — Student Directory Schema & Helpers
   
   NOTE: Personal Identifiable Information (PII) is stored 
   securely in the private Supabase database and is never 
   committed to source control.
   ======================================================== */

const STUDENT_DATA = [
// ── STUDENT_DATA_START ──
// Sample format for local dev / offline testing:
// { "fullName": "Jane Doe", "usn": "1KS24XX001", "section": "A", "email": "student@example.com" }
// ── STUDENT_DATA_END ──
];

/**
 * Looks up student record by email address.
 * @param {string} email
 * @returns {object|null}
 */
function findStudentByEmail(email) {
    if (!email || !Array.isArray(STUDENT_DATA) || STUDENT_DATA.length === 0) return null;
    const clean = email.trim().toLowerCase();
    return STUDENT_DATA.find(s => s && s.email && s.email.trim().toLowerCase() === clean) || null;
}

if (typeof window !== 'undefined') {
    window.STUDENT_DATA = STUDENT_DATA;
    window.findStudentByEmail = findStudentByEmail;
    window.getStudentDataByEmail = findStudentByEmail;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STUDENT_DATA, findStudentByEmail };
}
