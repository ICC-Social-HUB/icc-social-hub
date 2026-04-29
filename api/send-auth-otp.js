const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    // Return 200 for everything to bypass Vercel's HTML error interception
    const sendError = (msg) => {
        console.error('❌ API Error:', msg);
        return res.status(200).json({ success: false, error: msg });
    };

    try {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const { email, metadata } = req.body;
        if (!email) return sendError('Email is required');

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return sendError('Server configuration error (missing env variables)');

        const supabase = createClient(url, key);

        // 1. Identify or Create User
        let { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
        let user = userData?.user;
        
        if (!user) {
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: metadata || {}
            });
            if (createError && !createError.message.includes('already')) return sendError(createError.message);
            
            if (!newUser?.user) {
                const { data: retry } = await supabase.auth.admin.getUserByEmail(email);
                user = retry?.user;
            } else {
                user = newUser.user;
            }
        }

        if (!user) return sendError('Failed to identify user in Auth');
        const userId = user.id;

        // 2. Ensure Profile
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
        if (!profile) {
            await supabase.from('profiles').insert({
                id: userId,
                email: email,
                full_name: metadata?.full_name || email.split('@')[0],
                username: metadata?.username || `user_${userId.substring(0, 8)}`
            });
        }

        // 3. Generate OTP
        const otpCode = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // 4. Store OTP
        const { error: insertError } = await supabase.from('otp_tokens').insert([{
            user_id: userId,
            token: otpCode,
            expires_at: expiresAt,
            used: false
        }]);
        if (insertError) return sendError('Database error: ' + insertError.message);

        // 5. Send Email directly
        const emailUser = process.env.EMAIL_USER;
        const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
        
        if (!emailUser || !emailPass) return sendError('Email service not configured (env missing)');

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: emailUser, pass: emailPass }
        });

        const mailOptions = {
            from: emailUser,
            to: email,
            subject: 'Your ICC InnovoApp Verification Code',
            html: `
                <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
                    <h1 style="color: #38bdf8;">ICC Social Hub</h1>
                    <p>Your verification code is:</p>
                    <div style="font-size: 32px; font-weight: bold; color: #38bdf8; margin: 20px 0;">${otpCode}</div>
                    <p style="font-size: 12px; color: #64748b;">Expires in 10 minutes.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: true, message: 'OTP sent', userId });

    } catch (err) {
        return sendError(err.message || 'Internal server error');
    }
};
