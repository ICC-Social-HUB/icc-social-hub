const { sendTeamStatusEmail } = require('./_mailer');

module.exports = async (req, res) => {
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
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, type, teamName } = req.body;

    if (!email || !type || !teamName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const success = await sendTeamStatusEmail(email, type, teamName);
        if (success) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(200).json({ success: false, error: 'Email delivery failed. Please check SMTP settings.' });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(200).json({ success: false, error: error.message || 'Internal server error' });
    }
};
