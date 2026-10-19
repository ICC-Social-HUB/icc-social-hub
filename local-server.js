// ========================================================
// ICC Social Hub — Local Development Server
// Loads environment variables from .env.local or .env
// ========================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const cors = require('cors');

// Helper to load simple .env files without external dependencies
function loadEnvFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx !== -1) {
                    const key = trimmed.slice(0, eqIdx).trim();
                    let val = trimmed.slice(eqIdx + 1).trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    if (!process.env[key]) {
                        process.env[key] = val;
                    }
                }
            });
        } catch (e) {
            console.warn(`Could not parse ${filePath}:`, e.message);
        }
    }
}

// Load local environment files if present
loadEnvFile(path.join(__dirname, '.env.local'));
loadEnvFile(path.join(__dirname, '.env'));

// Validate required environment settings
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('\n⚠️  WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment.');
    console.warn('👉 Please create a .env.local file using .env.example as a template.\n');
}

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`✅ Local API Server running on http://localhost:${PORT}`);
});
