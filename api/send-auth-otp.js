const { createClient } = require('@supabase/supabase-js');
const { sendOTP } = require('./_mailer');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, metadata } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('❌ Missing Supabase Environment Variables');
        return res.status(500).json({ error: 'Server configuration error (missing environment variables)' });
    }

    const supabase = createClient(url, key);

    try {
        // 1. Identify or Create User in Auth
        let { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
        let user = userData?.user;
        
        if (!user) {
            console.log('👤 Creating new user in Auth:', email);
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: metadata || {}
            });
            
            if (createError) {
                if (createError.message.toLowerCase().includes('already')) {
                    const { data: retryData } = await supabase.auth.admin.getUserByEmail(email);
                    user = retryData?.user;
                } else {
                    throw createError;
                }
            } else {
                user = newUser?.user;
            }
        }

        if (!user) throw new Error('Failed to identify or create user in Supabase Auth');

        const userId = user.id;

        // 2. Ensure Profile exists (otp_tokens might have FK to profiles)
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
        if (!profile) {
            console.log('📄 Creating missing profile for:', email);
            await supabase.from('profiles').insert({
                id: userId,
                email: email,
                full_name: metadata?.full_name || '',
                username: metadata?.username || null
            });
        }

        // 3. Generate 6-digit OTP
        const otpCode = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // 4. Store in otp_tokens
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

        if (insertError) {
            console.error('❌ Database error inserting OTP:', insertError);
            throw new Error(`Database error: ${insertError.message}`);
        }

        // 5. Send Email via our mailer
        console.log('✉️ Sending OTP email via custom mailer...');
        const sent = await sendOTP(email, otpCode);
        
        if (!sent) {
            return res.status(500).json({ error: 'Email service failure. Please check your SMTP settings.' });
        }

        console.log('✅ OTP sent successfully to', email);
        return res.status(200).json({ message: 'OTP sent successfully', userId });

    } catch (err) {
        console.error('❌ Send Auth OTP Error:', err);
        return res.status(500).json({ 
            error: err.message || 'Internal server error',
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};
