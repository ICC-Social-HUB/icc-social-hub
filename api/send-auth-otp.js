const { createClient } = require('@supabase/supabase-js');
const { sendOTP } = require('./_mailer');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, metadata } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // 1. Check if user exists
        let { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
        let user = userData?.user;
        
        if (!user) {
            // Create the user first so we have a userId
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirm: true, // We mark as confirmed because we'll verify them with our own OTP
                user_metadata: metadata || {}
            });
            
            if (createError) {
                if (createError.message.includes('already registered')) {
                    const { data: retryData } = await supabase.auth.admin.getUserByEmail(email);
                    user = retryData?.user;
                } else {
                    throw createError;
                }
            } else {
                user = newUser?.user;
            }
        }

        if (!user) throw new Error('Failed to identify or create user');

        const userId = user.id;

        // 2. Generate 6-digit OTP
        const otpCode = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // 3. Store in otp_tokens (using insert to be safe, like other parts of the app)
        const { error: insertError } = await supabase
            .from('otp_tokens')
            .insert([
                {
                    user_id: userId,
                    token: otpCode,
                    expires_at: expiresAt,
                    used: false
                }
            ]);

        if (insertError) throw insertError;

        // 4. Send Email via our mailer
        const sent = await sendOTP(email, otpCode);
        
        if (!sent) {
            return res.status(500).json({ error: 'Failed to send email via custom mailer' });
        }

        return res.status(200).json({ message: 'OTP sent successfully', userId });

    } catch (err) {
        console.error('Send Auth OTP Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
