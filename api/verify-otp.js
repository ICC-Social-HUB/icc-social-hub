const { createClient } = require('@supabase/supabase-js');

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
        const { userId, token } = req.body;

        if (!userId || !token) {
            return res.status(400).json({ error: 'User ID and token are required' });
        }

        // 1. Find the token in the database
        const { data: tokens, error: fetchError } = await supabase
            .from('otp_tokens')
            .select('*')
            .eq('user_id', userId)
            .eq('token', token)
            .eq('used', false)
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError || !tokens || tokens.length === 0) {
            return res.status(400).json({ error: 'Invalid or already used OTP' });
        }

        const validToken = tokens[0];

        // 2. Check expiration
        const now = new Date();
        const expiresAt = new Date(validToken.expires_at);

        if (now > expiresAt) {
            // Mark as used since it's expired
            await supabase
                .from('otp_tokens')
                .update({ used: true })
                .eq('id', validToken.id);
                
            return res.status(400).json({ error: 'OTP has expired' });
        }

        // 3. Mark token as used
        const { error: updateError } = await supabase
            .from('otp_tokens')
            .update({ used: true })
            .eq('id', validToken.id);

        if (updateError) {
            console.error('Error marking token used:', updateError);
            return res.status(500).json({ error: 'Failed to complete verification' });
        }

        // 4. Actually update the user's email in Supabase Auth securely using Service Role
        if (validToken.new_email) {
            const { error: authError } = await supabase.auth.admin.updateUserById(
                userId,
                { email: validToken.new_email, email_confirm: true }
            );
            
            if (authError) {
                console.error('Error updating auth email:', authError);
                return res.status(500).json({ error: 'Failed to update email address in Auth' });
            }
        }

        // 5. Verification successful
        return res.status(200).json({ 
            message: 'OTP verified successfully',
            newEmail: validToken.new_email 
        });
        
    } catch (error) {
        console.error('Verify OTP Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
