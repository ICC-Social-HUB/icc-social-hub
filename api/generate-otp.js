const { createClient } = require('@supabase/supabase-js');
const { sendOTP } = require('./_mailer');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
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

    try {
        const { userId, email, newEmail } = req.body;

        if (!userId || !email) {
            return res.status(400).json({ error: 'User ID and email are required' });
        }

        // 1. Invalidate old tokens for this user
        await supabase
            .from('otp_tokens')
            .update({ used: true })
            .eq('user_id', userId)
            .eq('used', false);

        // 2. Generate 6-digit numeric OTP
        const otpCode = String(Math.floor(100000 + Math.random() * 900000));
        
        // 3. Expiration time (10 mins from now)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // 4. Insert new OTP into database
        const { error: insertError } = await supabase
            .from('otp_tokens')
            .insert([{
                user_id: userId,
                token: otpCode,
                expires_at: expiresAt,
                used: false,
                new_email: newEmail || null
            }]);

        if (insertError) {
            console.error('Error inserting OTP:', insertError);
            return res.status(500).json({ error: 'Failed to generate OTP' });
        }

        // 5. Send Email
        const emailSent = await sendOTP(email, otpCode);
        
        if (!emailSent) {
            return res.status(500).json({ error: 'Failed to send OTP email' });
        }

        return res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Generate OTP Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
