const { sendTeamStatusEmail } = require('./_mailer');

module.exports = async (req, res) => {
    // Basic security: Only allow POST
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
            return res.status(500).json({ error: 'Failed to send email' });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
