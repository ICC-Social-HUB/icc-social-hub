const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // Enable CORS for Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(url, key);

    try {
        const { userId, token } = req.body;

        if (!userId || !token) {
            return res.status(400).json({ error: 'User ID and code are required' });
        }

        // 1. Fetch the latest unused OTP for this user
        const { data: validTokens, error: fetchError } = await supabase
            .from('otp_tokens')
            .select('*')
            .eq('user_id', userId)
            .eq('token', token)
            .eq('used', false)
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError || !validTokens || validTokens.length === 0) {
            return res.status(200).json({ success: false, error: 'Invalid or expired code' });
        }

        const otpRecord = validTokens[0];

        // 2. Check expiration
        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(200).json({ success: false, error: 'Verification code has expired' });
        }

        // 3. Mark as used
        await supabase
            .from('otp_tokens')
            .update({ used: true })
            .eq('id', otpRecord.id);

        // 4. If this was for an email change, update the user's email in Supabase Auth
        if (otpRecord.new_email) {
            const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
                email: otpRecord.new_email,
                email_confirm: true
            });

            if (updateError) {
                console.error('Error updating email in Auth:', updateError);
                return res.status(200).json({ success: false, error: 'Failed to update email: ' + updateError.message });
            }
            
            // Also update the email in the profiles table
            await supabase.from('profiles').update({ email: otpRecord.new_email }).eq('id', userId);
        }

        return res.status(200).json({ success: true, message: 'Verification successful' });
    } catch (error) {
        console.error('Verify OTP Error:', error);
        return res.status(200).json({ success: false, error: error.message || 'Internal server error' });
    }
};
