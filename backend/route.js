const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { sendOTP } = require('./mailer');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
// Use SERVICE_ROLE_KEY to bypass RLS, fallback to ANON_KEY if not provided
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// @route   POST /api/otp/generate
// @desc    Generate an OTP and send it via email
router.post('/generate', async (req, res) => {
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

        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Generate OTP Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// @route   POST /api/otp/verify
// @desc    Verify the OTP and return associated data
router.post('/verify', async (req, res) => {
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
            // Mark as used since it's expired anyway
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

        // 4. Verification successful
        res.status(200).json({ 
            message: 'OTP verified successfully',
            newEmail: validToken.new_email // Pass back the new email if this was an email change request
        });
        
    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// @route   POST /api/otp/team-status
// @desc    Send a team status update email (approve, deny, remove)
router.post('/team-status', async (req, res) => {
    try {
        const { email, type, teamName } = req.body;

        if (!email || !type || !teamName) {
            return res.status(400).json({ error: 'Email, type, and team name are required' });
        }

        const { sendTeamStatusEmail } = require('./mailer');
        const emailSent = await sendTeamStatusEmail(email, type, teamName);
        
        if (!emailSent) {
            return res.status(500).json({ error: 'Failed to send email' });
        }

        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Team Status Email Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
