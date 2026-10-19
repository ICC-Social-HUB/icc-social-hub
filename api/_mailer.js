const nodemailer = require('nodemailer');

const createTransporter = () => {
    const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: emailPass
        }
    });
};

const sendEmailViaResend = async (mailOptions) => {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return { success: false, error: 'No Resend Key' };

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendKey}`
            },
            body: JSON.stringify({
                from: 'ICC Social Hub <onboarding@resend.dev>',
                to: mailOptions.to,
                subject: mailOptions.subject,
                html: mailOptions.html
            })
        });
        return { success: res.ok, error: res.ok ? null : await res.text() };
    } catch (e) {
        return { success: false, error: e.message };
    }
};

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
        const transporter = createTransporter();
        await transporter.sendMail(mailOptions);
        console.log('OTP email sent via Gmail to', email);
        return true;
    } catch (error) {
        console.error('Gmail SMTP error:', error.message);
        
        // Fallback to Resend
        const resendRes = await sendEmailViaResend(mailOptions);
        if (resendRes.success) {
            console.log('OTP email sent via Resend to', email);
            return true;
        }

        console.error('Final email error:', resendRes.error || error.message);
        console.info('🔑 EMERGENCY OTP FOR', email, 'IS:', otp);
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
        const transporter = createTransporter();
        await transporter.sendMail(mailOptions);
        console.log(`Team status email [${type}] sent via Gmail to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending team status email:', error);
        return false;
    }
};

const sendRegistrationApprovalEmail = async (email, fullName, usn, appUrl) => {
    const loginUrl = appUrl || process.env.APP_URL || 'https://icc-social-hub.vercel.app';
    const cleanName = fullName || 'Student';
    const cleanUsn = (usn || '').toUpperCase();

    const mailOptions = {
        from: process.env.EMAIL_USER || 'ICC Social Hub <onboarding@resend.dev>',
        to: email,
        subject: '🎉 Your ICC Membership Request Has Been Approved!',
        html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background-color: #09090b; color: #f43f5e; padding: 40px 20px; border-radius: 16px; max-width: 540px; margin: 0 auto; border: 1px solid #27272a;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; font-weight: 700; border-radius: 12px; font-size: 16px;">ICC</div>
                <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 16px 0 6px 0; letter-spacing: -0.5px;">Welcome to Innovators Creators Club!</h1>
                <p style="color: #10b981; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Membership Approved</p>
            </div>

            <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <p style="color: #e4e4e7; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                    Hello <strong style="color: #ffffff;">${cleanName}</strong>,
                </p>
                <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 18px 0;">
                    Great news! Your registration request has been reviewed and officially approved by the ICC Super Administrator. You now have full member access to the ICC Social Hub platform.
                </p>

                <div style="background-color: #09090b; border: 1px solid #3f3f46; border-radius: 8px; padding: 14px 18px; margin-bottom: 18px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Registered Email</span>
                        <span style="color: #38bdf8; font-size: 13px; font-family: monospace; font-weight: 600;">${email}</span>
                    </div>
                    ${cleanUsn ? `
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Student USN</span>
                        <span style="color: #ffffff; font-size: 13px; font-family: monospace; font-weight: 600;">${cleanUsn}</span>
                    </div>
                    ` : ''}
                </div>

                <div style="border-top: 1px solid #27272a; padding-top: 16px;">
                    <h3 style="color: #f43f5e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px 0;">How to Log In:</h3>
                    <ol style="color: #d4d4d8; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li>Click the button below to launch the ICC Social Hub portal.</li>
                        <li>If this is your first time, click <strong>"Sign Up"</strong> and enter your registered email (<code style="color: #38bdf8; font-family: monospace;">${email}</code>).</li>
                        <li>You will receive a 6-digit verification code to set your secure password.</li>
                        <li>Once set, you can log in anytime with your email and password!</li>
                    </ol>
                </div>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
                <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; padding: 14px 32px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 14px rgba(37,99,235,0.35);">
                    Launch ICC Social Hub →
                </a>
            </div>

            <p style="text-align: center; color: #52525b; font-size: 12px; margin: 0;">
                If you have any questions or require assistance, reach out to your ICC Admin Team.
            </p>
        </div>
        `
    };

    try {
        const transporter = createTransporter();
        await transporter.sendMail(mailOptions);
        console.log(`Registration approval email sent via Gmail to ${email}`);
        return true;
    } catch (error) {
        console.error('Gmail SMTP error on approval email:', error.message);
        const resendRes = await sendEmailViaResend(mailOptions);
        if (resendRes.success) {
            console.log(`Registration approval email sent via Resend to ${email}`);
            return true;
        }
        console.error('Failed to send registration approval email:', resendRes.error || error.message);
        return false;
    }
};

const sendRegistrationDenialEmail = async (email, fullName, reason) => {
    const cleanName = fullName || 'Applicant';

    const mailOptions = {
        from: process.env.EMAIL_USER || 'ICC Social Hub <onboarding@resend.dev>',
        to: email,
        subject: 'Update Regarding Your ICC Registration Request',
        html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background-color: #09090b; color: #e4e4e7; padding: 40px 20px; border-radius: 16px; max-width: 540px; margin: 0 auto; border: 1px solid #27272a;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background-color: #27272a; color: #a1a1aa; font-weight: 700; border-radius: 12px; font-size: 16px;">ICC</div>
                <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 16px 0 6px 0;">Registration Request Update</h1>
                <p style="color: #ef4444; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Application Status</p>
            </div>

            <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <p style="color: #e4e4e7; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                    Hello <strong style="color: #ffffff;">${cleanName}</strong>,
                </p>
                <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                    Thank you for your interest in joining the Innovators Creators Club (ICC). After review, we regret to inform you that your registration request was not approved at this time.
                </p>

                ${reason ? `
                <div style="background-color: #09090b; border-left: 3px solid #ef4444; border-radius: 4px; padding: 14px 16px; margin-bottom: 18px;">
                    <span style="color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Reason Provided:</span>
                    <p style="color: #fca5a5; font-size: 13px; line-height: 1.5; margin: 0;">${reason}</p>
                </div>
                ` : ''}

                <p style="color: #71717a; font-size: 13px; line-height: 1.6; margin: 0;">
                    If you believe this is an error or would like to submit updated information, please contact your ICC club administrator or mentor.
                </p>
            </div>

            <p style="text-align: center; color: #52525b; font-size: 12px; margin: 0;">
                Innovators Creators Club · Automated Notification
            </p>
        </div>
        `
    };

    try {
        const transporter = createTransporter();
        await transporter.sendMail(mailOptions);
        console.log(`Registration denial email sent via Gmail to ${email}`);
        return true;
    } catch (error) {
        console.error('Gmail SMTP error on denial email:', error.message);
        const resendRes = await sendEmailViaResend(mailOptions);
        if (resendRes.success) {
            console.log(`Registration denial email sent via Resend to ${email}`);
            return true;
        }
        console.error('Failed to send registration denial email:', resendRes.error || error.message);
        return false;
    }
};

const sendSuperAdminReviewAlertEmail = async ({ toEmail, applicant, stage, reviewerName, reviewerRole, note }) => {
    if (!toEmail) return false;

    const applicantName = applicant?.full_name || 'New Applicant';
    const applicantUsn = applicant?.usn ? applicant.usn.toUpperCase() : 'N/A';
    const applicantBranch = applicant?.branch || 'N/A';
    const applicantYear = applicant?.year || 'N/A';
    const applicantEmail = applicant?.email || 'N/A';
    const applicantPhone = applicant?.phone || 'N/A';
    const applicantLinkedin = applicant?.linkedin || '';
    const applicantGithub = applicant?.github || '';
    
    const isForwarded = stage === 'forwarded';
    const subject = isForwarded
        ? `📋 [Action Required] Registration Forwarded for Final Approval: ${applicantName} (${applicantUsn})`
        : `📋 [Notification] New Student Registration Request: ${applicantName} (${applicantUsn})`;

    const portalUrl = (process.env.APP_URL || 'https://icc-innovoapp.vercel.app').replace(/\/$/, '') + '/#admin';

    const mailOptions = {
        from: process.env.EMAIL_USER || 'ICC Social Hub <onboarding@resend.dev>',
        to: toEmail,
        subject: subject,
        html: `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background-color: #09090b; color: #e4e4e7; padding: 40px 20px; border-radius: 16px; max-width: 580px; margin: 0 auto; border: 1px solid #27272a;">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; background: linear-gradient(135deg, #0284c7, #38bdf8); color: #ffffff; font-weight: 700; border-radius: 14px; font-size: 18px; box-shadow: 0 4px 12px rgba(56,189,248,0.3);">ICC</div>
                <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 16px 0 6px 0;">Super Admin Review Alert</h1>
                <p style="color: ${isForwarded ? '#38bdf8' : '#a1a1aa'}; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0;">
                    ${isForwarded ? 'Awaiting Final Approval' : 'New Registration Submission'}
                </p>
            </div>

            <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <p style="color: #e4e4e7; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                    ${isForwarded
                        ? `A registration request has been reviewed by <strong>${reviewerName || 'an Admin'}</strong> (${reviewerRole || 'Reviewer'}) and forwarded to you for final approval.`
                        : `A new registration request has been submitted by an applicant and is currently pending review.`}
                </p>

                ${isForwarded && note ? `
                <div style="background-color: #09090b; border-left: 3px solid #38bdf8; border-radius: 4px; padding: 12px 16px; margin-bottom: 18px;">
                    <span style="color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Reviewer Note:</span>
                    <p style="color: #e0f2fe; font-size: 13px; line-height: 1.5; margin: 0; font-style: italic;">"${note}"</p>
                </div>
                ` : ''}

                <div style="background-color: #09090b; border: 1px solid #3f3f46; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                    <h3 style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px 0;">Applicant Information</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <tr>
                            <td style="color: #71717a; padding: 6px 0; width: 35%;">Full Name:</td>
                            <td style="color: #ffffff; font-weight: 600; padding: 6px 0;">${applicantName}</td>
                        </tr>
                        <tr>
                            <td style="color: #71717a; padding: 6px 0;">USN:</td>
                            <td style="color: #38bdf8; font-family: monospace; font-weight: 600; padding: 6px 0;">${applicantUsn}</td>
                        </tr>
                        <tr>
                            <td style="color: #71717a; padding: 6px 0;">Branch & Year:</td>
                            <td style="color: #e4e4e7; padding: 6px 0;">${applicantBranch} · ${applicantYear}</td>
                        </tr>
                        <tr>
                            <td style="color: #71717a; padding: 6px 0;">Email:</td>
                            <td style="color: #e4e4e7; padding: 6px 0;">${applicantEmail}</td>
                        </tr>
                        <tr>
                            <td style="color: #71717a; padding: 6px 0;">Phone:</td>
                            <td style="color: #e4e4e7; padding: 6px 0;">${applicantPhone}</td>
                        </tr>
                        ${applicantLinkedin ? `
                        <tr>
                            <td style="color: #71717a; padding: 6px 0;">LinkedIn:</td>
                            <td style="color: #60a5fa; padding: 6px 0;"><a href="${applicantLinkedin}" style="color: #60a5fa; text-decoration: underline;">View Profile</a></td>
                        </tr>
                        ` : ''}
                        ${applicantGithub ? `
                        <tr>
                            <td style="color: #71717a; padding: 6px 0;">GitHub:</td>
                            <td style="color: #60a5fa; padding: 6px 0;"><a href="${applicantGithub}" style="color: #60a5fa; text-decoration: underline;">View Profile</a></td>
                        </tr>
                        ` : ''}
                    </table>
                </div>

                <div style="text-align: center; margin-top: 20px;">
                    <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; padding: 12px 28px; border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 14px rgba(2,132,199,0.35);">
                        Open Admin Command Center →
                    </a>
                </div>
            </div>

            <p style="text-align: center; color: #52525b; font-size: 12px; margin: 0;">
                ICC Social Hub · Administrator Security Notification
            </p>
        </div>
        `
    };

    try {
        const transporter = createTransporter();
        await transporter.sendMail(mailOptions);
        console.log(`Super Admin review alert email sent via Gmail to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('Gmail SMTP error on Super Admin review alert:', error.message);
        const resendRes = await sendEmailViaResend(mailOptions);
        if (resendRes.success) {
            console.log(`Super Admin review alert email sent via Resend to ${toEmail}`);
            return true;
        }
        console.error('Failed to send Super Admin review alert:', resendRes.error || error.message);
        return false;
    }
};

module.exports = { 
    sendOTP, 
    sendTeamStatusEmail,
    sendRegistrationApprovalEmail,
    sendRegistrationDenialEmail,
    sendSuperAdminReviewAlertEmail
};
