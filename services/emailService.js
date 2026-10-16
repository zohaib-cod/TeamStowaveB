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
    <div style="font-family: Arial, sans-serif; background-color: #0d1527; color: #f8fafc; padding: 24px; border-radius: 12px;">
      <h2 style="color: #e11d48; margin-top: 0;">Stowave — Task Notification</h2>
      <p>Hello <strong>${assigneeName}</strong>,</p>
      <p>A new strategic task has been assigned to you by leadership:</p>
      <div style="background: rgba(255, 255, 255, 0.05); padding: 16px; border-radius: 8px; border-left: 4px solid #e11d48;">
        <h3 style="margin: 0 0 8px 0; color: #ffffff;">${taskTitle}</h3>
        <p style="margin: 4px 0; color: #94a3b8;"><strong>Priority:</strong> ${priority.toUpperCase()}</p>
        <p style="margin: 4px 0; color: #94a3b8;"><strong>Due Date:</strong> ${dueDate}</p>
      </div>
      <p style="margin-top: 20px;">Log in to your contributor mission portal to track sprint deliverables and submit work.</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

/**
 * Email template when work is approved and graded
 */
async function notifyWorkApproved({ to, taskTitle, rating, pointsAwarded, memberName }) {
  const subject = `🎉 Task Deliverable Approved: ${taskTitle} (+${pointsAwarded} pts)`;
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0d1527; color: #f8fafc; padding: 24px; border-radius: 12px;">
      <h2 style="color: #10b981; margin-top: 0;">Stowave — Deliverable Approved</h2>
      <p>Congratulations <strong>${memberName}</strong>!</p>
      <p>Leadership has reviewed and approved your deliverable for <strong>"${taskTitle}"</strong>.</p>
      <div style="background: rgba(16, 185, 129, 0.1); padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
        <p style="margin: 4px 0; color: #34d399;"><strong>Executive Rating:</strong> ⭐ ${rating} / 5</p>
        <p style="margin: 4px 0; color: #34d399;"><strong>Reward Points Added:</strong> +${pointsAwarded} pts</p>
      </div>
    </div>
  `;
  return sendEmail({ to, subject, html });
}

module.exports = {
  sendEmail,
  notifyTaskAssigned,
  notifyWorkApproved
};
