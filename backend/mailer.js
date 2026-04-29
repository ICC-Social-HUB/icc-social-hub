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
        subject: 'Your ICC Social Hub Verification Code',
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

const sendTeamStatusEmail = async (email, type, teamName) => {
    let subject = '';
    let title = '';
    let message = '';
    let color = '#38bdf8'; // Default blue

    if (type === 'approve') {
        subject = `Welcome to ${teamName}!`;
        title = 'Application Approved';
        message = `Congratulations! You have been officially approved as a member of <strong>${teamName}</strong>. Welcome to the team!`;
        color = '#10b981'; // Green
    } else if (type === 'deny') {
        subject = `Update on your request to join ${teamName}`;
        title = 'Application Status';
        message = `Thank you for your interest in <strong>${teamName}</strong>. Unfortunately, your request to join the team has not been accepted at this time.`;
        color = '#f43f5e'; // Red
    } else if (type === 'remove') {
        subject = `Membership Update: ${teamName}`;
        title = 'Team Membership Update';
        message = `This is to inform you that you have been removed from the <strong>${teamName}</strong> roster. If you have questions, please reach out to your Lead.`;
        color = '#71717a'; // Zinc
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        html: `
        <div style="font-family: 'Inter', sans-serif; background-color: #030303; color: #f8fafc; padding: 40px 20px; text-align: center; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #18181b;">
            <h1 style="color: #ffffff; margin-bottom: 10px; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">ICC Social Hub</h1>
            <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 20px; color: ${color};">${title}</h2>
            <div style="background-color: #09090b; padding: 30px; border-radius: 12px; border: 1px solid #27272a; margin-bottom: 30px;">
                <p style="font-size: 15px; line-height: 1.6; color: #d4d4d8; margin: 0;">${message}</p>
            </div>
            <p style="font-size: 12px; color: #52525b; margin-top: 20px;">This is an automated notification from the ICC Innovation App.</p>
        </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(\`Team status email [\${type}] sent to \${email}\`);
        return true;
    } catch (error) {
        console.error('Error sending team status email:', error);
        return false;
    }
};

module.exports = { sendOTP, sendTeamStatusEmail };
