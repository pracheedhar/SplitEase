import nodemailer from 'nodemailer';
import { logger } from './logger.js';

const createTransport = () => {
  if (!process.env.SMTP_HOST) {
    logger.warn('SMTP not configured — email notifications disabled');
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const FROM_ADDRESS = process.env.SMTP_FROM || 'SplitEase <noreply@splitease.app>';

export const sendGroupInviteEmail = async (
  toEmail: string,
  toName: string,
  groupName: string,
  inviteCode: string,
  inviterName: string
): Promise<void> => {
  const transport = createTransport();
  if (!transport) return;

  const appUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const joinUrl = `${appUrl}/join/${inviteCode}`;

  try {
    await transport.sendMail({
      from: FROM_ADDRESS,
      to: `${toName} <${toEmail}>`,
      subject: `${inviterName} invited you to join "${groupName}" on SplitEase`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Inter, sans-serif; background: #0f0f19; color: #e2e8f0; padding: 2rem; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background: #1c1c30; border-radius: 1rem; border: 1px solid rgba(99,102,241,0.2); overflow: hidden;">
            <div style="padding: 1.5rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); text-align: center;">
              <h1 style="margin: 0; font-size: 1.5rem; color: white;">✂️ SplitEase</h1>
            </div>
            <div style="padding: 2rem;">
              <h2 style="margin: 0 0 1rem; font-size: 1.2rem;">You're invited, ${toName}!</h2>
              <p style="color: #94a3b8; line-height: 1.6; margin: 0 0 1.5rem;">
                <strong style="color: #e2e8f0;">${inviterName}</strong> has invited you to join the group
                <strong style="color: #818cf8;">"${groupName}"</strong> on SplitEase — the smart way to split expenses.
              </p>
              <a href="${joinUrl}" style="display: inline-block; padding: 0.75rem 2rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600;">
                Join Group →
              </a>
              <p style="color: #475569; font-size: 0.8rem; margin: 1.5rem 0 0;">
                Or use invite code: <strong style="font-family: monospace; color: #818cf8;">${inviteCode}</strong>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    logger.info(`Invite email sent to ${toEmail}`);
  } catch (err: any) {
    logger.error(`Failed to send invite email: ${err.message}`);
  }
};

export const sendSettlementEmail = async (
  toEmail: string,
  toName: string,
  fromName: string,
  amount: number,
  currency: string,
  groupName: string
): Promise<void> => {
  const transport = createTransport();
  if (!transport) return;

  try {
    await transport.sendMail({
      from: FROM_ADDRESS,
      to: `${toName} <${toEmail}>`,
      subject: `${fromName} marked a payment to you in "${groupName}"`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Inter, sans-serif; background: #0f0f19; color: #e2e8f0; padding: 2rem; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background: #1c1c30; border-radius: 1rem; border: 1px solid rgba(99,102,241,0.2); overflow: hidden;">
            <div style="padding: 1.5rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); text-align: center;">
              <h1 style="margin: 0; font-size: 1.5rem; color: white;">✂️ SplitEase</h1>
            </div>
            <div style="padding: 2rem; text-align: center;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">🤝</div>
              <h2 style="margin: 0 0 0.5rem;">Payment Request</h2>
              <p style="color: #94a3b8; margin: 0 0 1.5rem;">
                <strong style="color: #e2e8f0;">${fromName}</strong> says they paid you
                <strong style="color: #4ade80; font-size: 1.25rem;"> ${currency} ${amount.toFixed(2)}</strong>
                in <strong>"${groupName}"</strong>
              </p>
              <p style="color: #64748b; font-size: 0.875rem;">Log in to confirm or reject the settlement.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  } catch (err: any) {
    logger.error(`Failed to send settlement email: ${err.message}`);
  }
};
