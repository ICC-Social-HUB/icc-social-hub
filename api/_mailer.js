const nodemailer = require('nodemailer');

// Handle trailing spaces in app password (if passed via .env)
const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: emailPass
    }
});

const sendOTP = async (email, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your ICC InnovoApp Verification Code',
        html: `
        <div style="font-family: 'Inter', sans-serif; background-color: #0f172a; color: #f8fafc; padding: 40px 20px; text-align: center; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #334155;">
            <h1 style="color: #38bdf8; margin-bottom: 10px; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">ICC Social Hub</h1>
            <h2 style="font-size: 20px; font-weight: 400; margin-bottom: 30px; color: #94a3b8;">Security Verification</h2>
            <p style="font-size: 16px; margin-bottom: 20px; color: #cbd5e1;">Your verification code is:</p>
            <div style="background: linear-gradient(to right, #38bdf8, #818cf8); padding: 2px; border-radius: 8px; display: inline-block; margin-bottom: 30px;">
                <div style="background-color: #0f172a; padding: 15px 30px; border-radius: 6px;">
                    <span style="font-size: 36px; font-weight: 700; color: #38bdf8; letter-spacing: 5px;">${otp}</span>
                </div>
            </div>
            <p style="font-size: 14px; color: #64748b; margin-bottom: 10px;">This code will expire in <strong>10 minutes</strong>.</p>
            <p style="font-size: 12px; color: #475569;">If you didn't request this, please ignore this email or contact support if you have concerns.</p>
        </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('OTP email sent successfully to', email);
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error);
        return false;
    }
};

module.exports = { sendOTP };
