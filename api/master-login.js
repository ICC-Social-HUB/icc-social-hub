const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { email, masterPassword, password } = req.body || {};
    const credential = masterPassword || password;
    
    if (!email || !credential) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const expected = process.env.MASTER_ADMIN_PASSWORD || 'login@admin';
    if (!expected || credential !== expected) {
        return res.status(401).json({ error: 'Authentication failed' });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(url, key);

    try {
        let { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        let userId = profile?.id;

        if (!userId) {
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: {}
            });

            if (createError) {
                if (createError.message.includes('already')) {
                    const { data: listData } = await supabase.auth.admin.listUsers();
                    const authUser = listData?.users?.find(u => u.email === email);
                    if (authUser) {
                        userId = authUser.id;
                    } else {
                        return res.status(500).json({ error: 'Account sync error' });
                    }
                } else {
                    return res.status(500).json({ error: createError.message });
                }
            } else {
                userId = newUser.user.id;
            }

            await supabase.from('profiles').insert({
                id: userId,
                email: email,
                full_name: email.split('@')[0],
                username: `user_${userId.substring(0, 8)}`
            });
        }

        const { data, error } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: email
        });

        if (error) throw error;

        return res.status(200).json({ 
            token: data.properties.hashed_token,
            type: 'magiclink',
            email: email
        });

    } catch (err) {
        return res.status(500).json({ error: err.message || 'Authentication error' });
    }
};
