const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, token, userId } = req.body;

    if (!email || !token || !userId) {
        return res.status(400).json({ error: 'Email, token, and userId are required' });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(url, key);

    try {
        // 1. Verify OTP in database
        const { data: validTokens, error: fetchError } = await supabase
            .from('otp_tokens')
            .select('*')
            .eq('user_id', userId)
            .eq('token', token)
            .eq('used', false)
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError || !validTokens || validTokens.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired verification code' });
        }

        const otpRecord = validTokens[0];
        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(401).json({ error: 'Verification code has expired' });
        }

        // 2. Mark OTP as used
        await supabase.from('otp_tokens').update({ used: true }).eq('id', otpRecord.id);

        // 3. Confirm the user's email in Auth (safeguard)
        await supabase.auth.admin.updateUserById(userId, { email_confirm: true });

        // 4. Generate a session/link for the user
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: email
        });

        if (linkError) throw linkError;

        return res.status(200).json({
            message: 'Verified successfully',
            token: linkData.properties.hashed_token,
            type: 'magiclink',
            email: email
        });

    } catch (err) {
        console.error('❌ Verify Auth OTP Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
