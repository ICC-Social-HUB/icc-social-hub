const admin = require('firebase-admin');

// Initialize Firebase Admin only once to prevent errors during hot reloads on Vercel
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Replace escaped newlines with actual newlines
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    } catch (error) {
        console.error('Firebase Admin Init Error:', error);
    }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { title, body, token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Missing device token' });
        }

        const message = {
            notification: { 
                title: title || 'New Notification', 
                body: body 
            },
            token: token,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    icon: 'ic_launcher',    // uses mipmap/ic_launcher
                    color: '#E11D48'        // ICC brand crimson red
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log('Successfully sent push notification:', response);
        return res.status(200).json({ success: true, messageId: response });
    } catch (error) {
        console.error('Error sending push notification:', error);
        return res.status(500).json({ error: 'Error sending push notification', details: error.message });
    }
};
