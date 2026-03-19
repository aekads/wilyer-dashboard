// src/services/emailService.js

const nodemailer = require('nodemailer');

const DEFAULT_FROM = 'no-reply@wilyer.com';

/**
 * Create a nodemailer transporter using environment variables.
 * Supports SMTP (any provider) and falls back to Ethereal test accounts
 * in development when no SMTP credentials are configured.
 */
const createTransporter = () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback: log-only transport for development / missing config
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
};

/**
 * Send an email via the configured transporter.
 * @param {{ to: string, subject: string, html: string }} options
 */
const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || DEFAULT_FROM,
    to,
    subject,
    html,
  };
  return transporter.sendMail(mailOptions);
};

/**
 * Send a password-reset email.
 * @param {{ email: string, first_name: string }} user
 * @param {string} resetUrl
 * @param {string} [expiresInLabel] - Human-readable expiry string shown in the email (default: '1 hour')
 */
const sendResetEmail = async (user, resetUrl, expiresInLabel = '1 hour') => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello ${user.first_name || 'there'},</p>
          <p>We received a request to reset the password for your Wilyer Signage account.</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset My Password</a>
          </div>
          <p>This link will expire in <strong>${expiresInLabel}</strong>.</p>
          <p>If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 12px; color: #667eea;">${resetUrl}</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Wilyer Signage. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: user.email,
    subject: 'Reset your Wilyer Signage password',
    html,
  });
};

const sendTeamInvitationEmail = async ({ to, invitationToken, inviterName, orgName, expiresAt }) => {
  const invitationLink = `${process.env.FRONTEND_URL}/accept-invitation?token=${invitationToken}`;
  const expiryDate = new Date(expiresAt).toLocaleDateString();

  // Using your existing email service (nodemailer, sendgrid, etc.)
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
        .expiry { color: #e53e3e; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Wilyer Signage!</h1>
        </div>
        <div class="content">
          <h2>You've been invited to join ${orgName}</h2>
          <p>Hello,</p>
          <p><strong>${inviterName}</strong> has invited you to join their team on Wilyer Signage.</p>
          
          <div style="text-align: center;">
            <a href="${invitationLink}" class="button">Accept Invitation</a>
          </div>
          
          <p class="expiry">This invitation will expire on ${expiryDate}</p>
          
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 12px; color: #667eea;">${invitationLink}</p>
          
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Wilyer Signage. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Use your existing email transport
  return await sendEmail({
    to,
    subject: `You've been invited to join ${orgName} on Wilyer Signage`,
    html
  });
};

module.exports = { sendEmail, sendResetEmail, sendTeamInvitationEmail };