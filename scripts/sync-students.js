// ========================================================
// ICC Social Hub — Student Excel Sync (PERMANENTLY DEACTIVATED)
// ========================================================
// As per the New Member Registration feature specification:
// New students no longer come in through the Excel sync.
// Instead, they register through the private link with two-stage approval.
// This script is disabled to prevent automated insertion or modification of users.

console.log('ℹ️  Student Excel sync has been permanently disabled.');
console.log('👉 New students register via the private link with two-stage approval (Admin/Mentor review -> Super Admin approval).');
console.log('👉 Existing user data remains completely untouched.');

if (require.main === module) {
    process.exit(0);
}

module.exports = {
    sync: async () => {
        console.warn('Sync is deactivated. No users will be created or updated from Excel.');
        return { success: false, message: 'Excel sync has been permanently deactivated.' };
    }
};
