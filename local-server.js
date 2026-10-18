process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://gryfobekzlmfonnrwbpg.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyeWZvYmVremxtZm9ubnJ3YnBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg2OTQxNiwiZXhwIjoyMDkyNDQ1NDE2fQ.jKBfT0TtW55ol9WLteUXUlbkg64M6LrSpleNxJcXEGY';
process.env.EMAIL_USER = process.env.EMAIL_USER || 'iccsocialhub@gmail.com';
process.env.EMAIL_PASS = process.env.EMAIL_PASS || 'bywz uurd fsvd qcyp';

const http = require('http');
const cors = require('cors');

const masterLoginHandler = require('./api/master-login');
const sendAuthOtpHandler = require('./api/send-auth-otp');
const verifyAuthOtpHandler = require('./api/verify-auth-otp');
const verifyOtpHandler = require('./api/verify-otp');
const studentsHandler = require('./api/students');

const corsMiddleware = cors({ origin: true, credentials: true });

const server = http.createServer((req, res) => {
    corsMiddleware(req, res, () => {
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                if (body) req.body = JSON.parse(body);
            } catch (e) {
                req.body = {};
            }

            res.status = function (code) {
                res.statusCode = code;
                return res;
            };
            res.json = function (obj) {
                if (!res.headersSent) {
                    res.setHeader('Content-Type', 'application/json');
                }
                res.end(JSON.stringify(obj));
            };

            const url = req.url.split('?')[0];
            console.log(`[API Request] ${req.method} ${url}`);

            try {
                if (url === '/api/master-login') {
                    return await masterLoginHandler(req, res);
                } else if (url === '/api/send-auth-otp') {
                    return await sendAuthOtpHandler(req, res);
                } else if (url === '/api/verify-auth-otp') {
                    return await verifyAuthOtpHandler(req, res);
                } else if (url === '/api/verify-otp') {
                    return await verifyOtpHandler(req, res);
                } else if (url === '/api/students') {
                    return await studentsHandler(req, res);
                } else {
                    res.status(404).json({ error: 'Endpoint not found' });
                }
            } catch (err) {
                console.error('Server error handling request:', err);
                res.status(500).json({ error: err.message || 'Internal server error' });
            }
        });
    });
});

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`✅ Local API Server running on http://localhost:${PORT}`);
});
