
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // 1. Basic security checks
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { email, masterPassword } = req.body;
    
    if (!email || !masterPassword) {
        return res.status(400).json({ error: 'Email and master password required' });
    }

    // 2. Validate Master Password
    if (masterPassword !== 'login@admin') {
        return res.status(401).json({ error: 'Invalid master password' });
    }

    // 3. Initialize Admin Client
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('❌ Missing environment variables');
        return res.status(500).json({ error: 'Server configuration error (env missing)' });
    }

    console.log(`📡 Master Login connecting to: ${url}`);
    // Only log first 10 chars of key for security
    console.log(`🔑 Key present: ${!!key} (Starts with: ${key?.substring(0, 10)}...)`);

    const supabase = createClient(url, key);

    try {
        console.log(`🔍 Checking user in profiles: ${email}`);
        
        // 4. Find or auto-create the user
        let { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        let userId = profile?.id;

        if (!userId) {
            console.log('ℹ️ User not in profiles, checking Auth...');
            // Try creating in Auth
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: {}
            });

            if (createError) {
                if (createError.message.includes('already')) {
                    // Exists in Auth but not profiles — find them
                    const { data: listData } = await supabase.auth.admin.listUsers();
                    const authUser = listData?.users?.find(u => u.email === email);
                    if (authUser) {
                        userId = authUser.id;
                    } else {
                        return res.status(500).json({ error: 'User auth sync error. Contact support.' });
                    }
                } else {
                    return res.status(500).json({ error: createError.message });
                }
            } else {
                userId = newUser.user.id;
            }

            // Create profile row
            await supabase.from('profiles').insert({
                id: userId,
                email: email,
                full_name: email.split('@')[0],
                username: `user_${userId.substring(0, 8)}`
            });

            console.log(`✅ Auto-created user profile for: ${email}`);
        }

        // 5. Generate a magic link for the target user
        // This doesn't send an email because we are using the Admin API generateLink
        const { data, error } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: email
        });

        if (error) throw error;

        // 5. The data object contains 'hashed_token' and 'verification_type'
        // We can use these to sign in the user via setSession or verifyOtp
        // A simpler way: admin.generateLink provides a 'session' object if we're lucky? 
        // No, it doesn't return a session.
        
        // HOWEVER, we can use the 'hashed_token' to verify in the frontend.
        // OR, we can do a trick: 
        // We return the hashed_token, and the frontend calls ICCSupabase.client.auth.verifyOtp
        
        return res.status(200).json({ 
            token: data.properties.hashed_token,
            type: 'magiclink',
            email: email
        });

    } catch (err) {
        console.error('Master Login API Error:', err);
        return res.status(500).json({ error: err.message });
    }
};
