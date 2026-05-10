require('dotenv').config();
const express = require('express');
const cors = require('cors');
const otpRoutes = require('./route');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/otp', otpRoutes);

// Vercel Compatibility Routes (Mapped from /api folder)
const masterLogin = require('../api/master-login');
const sendAuthOtp = require('../api/send-auth-otp');
const verifyAuthOtp = require('../api/verify-auth-otp');
const teamStatusEmail = require('../api/team-status-email');

app.post('/api/master-login', masterLogin);
app.post('/api/send-auth-otp', sendAuthOtp);
app.post('/api/verify-auth-otp', verifyAuthOtp);
app.post('/api/team-status-email', teamStatusEmail);

app.get('/', (req, res) => {
    res.send('ICC InnovoApp Backend is running with Vercel compatibility');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
