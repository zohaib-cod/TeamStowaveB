const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.GMAIL_USER || 'alizohaib.web@gmail.com';
  // Strip any spaces from the app password (e.g., "dymr wocf tffy vvah" -> "dymrwocftffyvvah")
  const pass = (process.env.GMAIL_APP_PASSWORD || 'dymr wocf tffy vvah').replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

/**
 * Send an email notification
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = createTransporter();
  const from = `"Stowave TeamHub" <${process.env.GMAIL_USER || 'alizohaib.web@gmail.com'}>`;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || subject,
      html
    });
    console.log(`✉️ Email dispatched to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email Dispatch Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Email template when a new task is assigned
 */
async function notifyTaskAssigned({ to, taskTitle, priority, dueDate, assigneeName }) {
  const subject = `🚀 New Task Assigned: [${priority.toUpperCase()}] ${taskTitle}`;
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0d1527; color: #f8fafc; padding: 28px; border-radius: 14px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
        <h2 style="color: #e11d48; margin: 0; font-size: 22px;">Stowave Global</h2>
      </div>
      <p style="font-size: 16px;">Hello <strong>${assigneeName || 'Team Contributor'}</strong>,</p>
      <p style="color: #cbd5e1; font-size: 14px;">A new strategic task has been assigned to you by leadership:</p>
      <div style="background: rgba(255, 255, 255, 0.06); padding: 18px; border-radius: 10px; border-left: 4px solid #e11d48; margin: 16px 0;">
        <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 18px;">${taskTitle}</h3>
        <p style="margin: 6px 0; color: #94a3b8; font-size: 14px;"><strong>Priority:</strong> <span style="color: #fda4af;">${priority.toUpperCase()}</span></p>
        <p style="margin: 6px 0; color: #94a3b8; font-size: 14px;"><strong>Due Date:</strong> ${dueDate}</p>
      </div>
      <p style="margin-top: 24px; color: #94a3b8; font-size: 13px;">Log in to your Stowave TeamHub workspace to track sprint deliverables and submit work.</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

/**
 * Email template when work is approved and graded (optional rating)
 */
async function notifyWorkApproved({ to, taskTitle, rating, feedback, pointsAwarded = 100, memberName }) {
  const ratingText = rating ? `⭐ Executive Rating: ${rating} / 5` : 'Deliverable Verified';
  const subject = `🎉 Task Deliverable Approved: ${taskTitle} (+${pointsAwarded} pts)`;
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0d1527; color: #f8fafc; padding: 28px; border-radius: 14px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
      <h2 style="color: #10b981; margin-top: 0; font-size: 22px;">Stowave — Deliverable Approved</h2>
      <p style="font-size: 16px;">Congratulations <strong>${memberName || 'Team Contributor'}</strong>!</p>
      <p style="color: #cbd5e1; font-size: 14px;">Leadership has reviewed and officially <strong>APPROVED</strong> your deliverable for:</p>
      <div style="background: rgba(16, 185, 129, 0.12); padding: 18px; border-radius: 10px; border-left: 4px solid #10b981; margin: 16px 0;">
        <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 17px;">${taskTitle}</h3>
        <p style="margin: 6px 0; color: #34d399; font-weight: bold; font-size: 15px;">${ratingText}</p>
        <p style="margin: 6px 0; color: #34d399; font-size: 14px;">Reward Points Credited: +${pointsAwarded} pts</p>
        ${feedback ? `<p style="margin: 10px 0 0; color: #e2e8f0; font-style: italic; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;"><strong>Feedback:</strong> "${feedback}"</p>` : ''}
      </div>
      <p style="margin-top: 20px; color: #94a3b8; font-size: 13px;">Keep up the extraordinary velocity on Stowave operations!</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

/**
 * Email template when a task deliverable is rejected / needs revision
 */
async function notifyTaskRejected({ to, taskTitle, reason, memberName }) {
  const subject = `⚠️ Task Review: Revision Requested for "${taskTitle}"`;
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0d1527; color: #f8fafc; padding: 28px; border-radius: 14px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
      <h2 style="color: #f43f5e; margin-top: 0; font-size: 22px;">Stowave — Task Revision Requested</h2>
      <p style="font-size: 16px;">Hello <strong>${memberName || 'Team Contributor'}</strong>,</p>
      <p style="color: #cbd5e1; font-size: 14px;">Your submitted work for <strong>"${taskTitle}"</strong> has been reviewed by leadership and requires revisions:</p>
      <div style="background: rgba(244, 63, 94, 0.12); padding: 18px; border-radius: 10px; border-left: 4px solid #f43f5e; margin: 16px 0;">
        <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 17px;">Revision Reason & Notes:</h3>
        <p style="margin: 4px 0; color: #fecdd3; font-size: 15px; line-height: 1.5;">${reason || 'Deliverable does not meet expected criteria. Please inspect feedback and re-submit.'}</p>
      </div>
      <p style="color: #cbd5e1; font-size: 14px;">The task has been set back to active. Please make the required updates and resubmit through the platform.</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

/**
 * Email template for Admin Team Invitation (expires in 30 minutes)
 */
async function sendInviteEmail({ to, inviteLink, role = 'member', department = '', invitedByName = 'Stowave Admin' }) {
  const subject = `✉️ You're Invited to Stowave TeamHub (${role.toUpperCase()}) — Expires in 30 Mins`;
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0d1527; color: #f8fafc; padding: 32px; border-radius: 14px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #e11d48; margin: 0; font-size: 26px; font-weight: 800;">Stowave Global</h1>
        <p style="color: #94a3b8; font-size: 14px; margin: 4px 0 0;">Team Operations & Strategy Workspace</p>
      </div>
      
      <p style="font-size: 16px;">Hello,</p>
      <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6;">
        <strong>${invitedByName}</strong> has invited you to join the Stowave Workspace as 
        <span style="background: rgba(225,29,72,0.2); color: #f43f5e; padding: 2px 8px; border-radius: 6px; font-weight: bold; text-transform: uppercase;">${role}</span>.
      </p>

      ${department ? `
        <div style="background: rgba(255, 255, 255, 0.05); border-left: 4px solid #e11d48; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0; color: #ffffff; font-size: 13px; font-weight: bold;">Assigned Responsibilities / Department:</p>
          <p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">${department}</p>
        </div>
      ` : ''}

      <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); padding: 14px 18px; border-radius: 10px; margin: 20px 0;">
        <p style="margin: 0; color: #fcd34d; font-size: 14px; font-weight: 600;">
          ⏳ <strong>Security Notice:</strong> This invitation link is valid for <strong>30 minutes</strong> only.
        </p>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 20px rgba(225,29,72,0.4);">
          Set Up Password & Activate Account →
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
        Or paste this link into your browser:<br/>
        <a href="${inviteLink}" style="color: #38bdf8; word-break: break-all;">${inviteLink}</a>
      </p>
      
      <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0;" />
      <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
        If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

/**
 * Email template for Profile Change OTP Verification
 */
async function sendOtpEmail({ to, otp, userName = 'Team Member', action = 'Profile Update' }) {
  const subject = `🔒 Your Stowave Verification OTP: ${otp}`;
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0d1527; color: #f8fafc; padding: 32px; border-radius: 14px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
      <h2 style="color: #e11d48; margin-top: 0; font-size: 22px;">Stowave Security Verification</h2>
      <p style="font-size: 16px;">Hello <strong>${userName}</strong>,</p>
      <p style="color: #cbd5e1; font-size: 14px;">A request was made to update your Stowave account (${action}). Enter this one-time passcode (OTP) to confirm:</p>
      
      <div style="text-align: center; margin: 28px 0;">
        <div style="display: inline-block; background: rgba(225, 29, 72, 0.15); border: 2px dashed #e11d48; padding: 16px 36px; border-radius: 12px; letter-spacing: 8px; font-size: 32px; font-weight: 900; color: #ffffff;">
          ${otp}
        </div>
      </div>

      <p style="color: #f59e0b; font-size: 13px; text-align: center;">
        ⏱️ This OTP expires in <strong>10 minutes</strong>. Do not share this code with anyone.
      </p>
      <p style="color: #64748b; font-size: 12px; margin-top: 24px; text-align: center;">
        If you did not request this update, please alert your administrator immediately.
      </p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

module.exports = {
  sendEmail,
  notifyTaskAssigned,
  notifyWorkApproved,
  notifyTaskRejected,
  sendInviteEmail,
  sendOtpEmail
};

