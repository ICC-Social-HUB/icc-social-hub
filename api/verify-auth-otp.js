const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    const sendError = (msg) => {
        console.error('❌ API Error:', msg);
        return res.status(200).json({ success: false, error: msg });
    };

    try {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const { email, token, userId } = req.body;
        if (!email || !token || !userId) return sendError('Email, token, and userId are required');

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return sendError('Server configuration error');

        const supabase = createClient(url, key);

        // 1. Verify OTP
        const { data: validTokens, error: fetchError } = await supabase
            .from('otp_tokens')
            .select('*')
            .eq('user_id', userId)
            .eq('token', token)
            .eq('used', false)
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError || !validTokens || validTokens.length === 0) {
            return sendError('Invalid or expired verification code');
        }

        const otpRecord = validTokens[0];
        if (new Date() > new Date(otpRecord.expires_at)) {
            return sendError('Verification code has expired');
        }

        // 2. Mark Used
        await supabase.from('otp_tokens').update({ used: true }).eq('id', otpRecord.id);

        // 3. Confirm Email
        await supabase.auth.admin.updateUserById(userId, { email_confirm: true });

        // 4. Generate Magic Link
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: email
        });

        if (linkError) return sendError(linkError.message);

        return res.status(200).json({
            success: true,
            message: 'Verified successfully',
            token: linkData.properties.hashed_token,
            type: 'magiclink',
            email: email
        });

    } catch (err) {
        return sendError(err.message || 'Internal server error');
    }
};
