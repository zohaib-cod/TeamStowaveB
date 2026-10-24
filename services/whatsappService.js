const db = require('../db');

function getToken() {
  const settings = db.getSettings ? db.getSettings() : (db.read()?.settings || {});
  return settings.whatsappToken || process.env.WHATSAPP_TOKEN;
}

function getPhoneNumberId() {
  const settings = db.getSettings ? db.getSettings() : (db.read()?.settings || {});
  return settings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '1291620604045427';
}

function getAdminNumbers() {
  const defaultNumbers = ['923290010909', '923184360458'];
  const settings = db.getSettings ? db.getSettings() : (db.read()?.settings || {});
  const envNumbers = settings.adminWhatsappNumbers || process.env.ADMIN_WHATSAPP_NUMBER;
  if (!envNumbers) return defaultNumbers;

  const parsed = envNumbers
    .split(',')
    .map(n => n.trim().replace(/\D/g, ''))
    .filter(Boolean);

  // Guarantee both company admin phones are retained
  for (const defNum of defaultNumbers) {
    if (!parsed.includes(defNum)) {
      parsed.push(defNum);
    }
  }

  return parsed;
}

/**
 * Send a WhatsApp text notification to a specific number
 */
async function sendWhatsAppMessage(recipientPhone, messageText) {
  const token = getToken();
  const phoneId = getPhoneNumberId();

  if (!token) {
    console.warn('⚠️ WhatsApp token not configured in .env or settings');
    return { success: false, error: 'WhatsApp access token is missing in .env or settings' };
  }

  // Clean phone number: international format without + or spaces (e.g. 923290010909)
  const cleanNumber = String(recipientPhone).replace(/\D/g, '');
  if (!cleanNumber || cleanNumber.length < 8) {
    return { success: false, error: `Invalid recipient phone number: "${recipientPhone}"` };
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanNumber,
        type: 'text',
        text: {
          preview_url: true,
          body: messageText
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const errMsg = data.error?.message || 'Meta WhatsApp API Error';
      const errCode = data.error?.code;
      const errSubcode = data.error?.error_subcode;
      console.warn(`⚠️ WhatsApp dispatch error for ${cleanNumber} [Code ${errCode}/${errSubcode}]:`, errMsg);
      return { 
        success: false, 
        phone: cleanNumber,
        error: errMsg, 
        code: errCode, 
        subcode: errSubcode, 
        details: data 
      };
    }

    const messageId = data.messages?.[0]?.id;
    console.log(`📱 WhatsApp notification delivered to ${cleanNumber}: ID ${messageId}`);
    return { success: true, phone: cleanNumber, messageId };
  } catch (err) {
    console.error(`❌ WhatsApp network error for ${cleanNumber}:`, err.message);
    return { success: false, phone: cleanNumber, error: err.message };
  }
}

/**
 * Broadcast critical alert to all configured Admin WhatsApp numbers
 */
async function alertAdmins(messageText, tag = 'ALERT') {
  const numbers = getAdminNumbers();
  const results = [];
  const fullMessage = messageText.startsWith('🌟') || messageText.startsWith('🚀') || messageText.startsWith('🚨')
    ? messageText
    : `🔔 *Stowave [${tag}]*\n${messageText}`;

  for (const num of numbers) {
    const res = await sendWhatsAppMessage(num, fullMessage);
    results.push(res);
  }
  return results;
}

/**
 * 1. WhatsApp Alert: New Task Assigned
 */
async function notifyWhatsAppTaskAssigned({ taskTitle, priority = 'medium', dueDate = 'N/A', assigneeName = 'Team Contributor', assignedByName = 'Leadership' }) {
  const priorityEmoji = priority.toLowerCase() === 'urgent' ? '🔴 URGENT' : (priority.toLowerCase() === 'high' ? '🟠 HIGH' : '🟡 ' + priority.toUpperCase());
  const text = 
`🚀 *Stowave Workspace — New Task Assigned*

📌 *Task:* ${taskTitle}
👤 *Assignee:* ${assigneeName}
👑 *Assigned By:* ${assignedByName}
⚡ *Priority:* ${priorityEmoji}
📅 *Due Date:* ${dueDate}

🔗 *Track Deliverables:* https://team.stowave.com/tasks`;

  return alertAdmins(text, 'TASK ASSIGNED');
}

/**
 * 2. WhatsApp Alert: Task Deliverables Submitted for Review
 */
async function notifyWhatsAppTaskSubmitted({ taskTitle, submittedByName = 'Team Member', notes = '', actualHours = 0 }) {
  const text = 
`📤 *Stowave Workspace — Deliverables Submitted*

📌 *Task:* ${taskTitle}
👤 *Submitted By:* ${submittedByName}
⏱️ *Hours Logged:* ${actualHours || 0} hrs
💬 *Notes:* "${notes || 'Deliverables submitted for review.'}"

🔗 *Review Deliverables:* https://team.stowave.com/tasks`;

  return alertAdmins(text, 'SUBMISSION FOR REVIEW');
}

/**
 * 3. WhatsApp Alert: Work Approved & Rewarded
 */
async function notifyWhatsAppTaskApproved({ taskTitle, memberName = 'Team Contributor', rating = 5, pointsAwarded = 100, feedback = '' }) {
  const ratingStars = rating ? `${rating}/5 Stars ⭐` : 'Approved';
  const text = 
`🎉 *Stowave Workspace — Deliverable Approved*

📌 *Task:* ${taskTitle}
👤 *Contributor:* ${memberName}
⭐ *Rating:* ${ratingStars}
🏆 *Reward Points:* +${pointsAwarded} pts
${feedback ? `💬 *Feedback:* "${feedback}"\n` : ''}
🔗 *View Task Board:* https://team.stowave.com/tasks`;

  return alertAdmins(text, 'TASK APPROVED');
}

/**
 * 4. WhatsApp Alert: Work Rejected / Revisions Requested
 */
async function notifyWhatsAppTaskRejected({ taskTitle, memberName = 'Team Contributor', reason = '' }) {
  const text = 
`⚠️ *Stowave Workspace — Revisions Requested*

📌 *Task:* ${taskTitle}
👤 *Assignee:* ${memberName}
📝 *Revision Notes:* "${reason || 'Deliverable requires changes. Please inspect feedback and re-submit.'}"

🔗 *Action Required:* https://team.stowave.com/tasks`;

  return alertAdmins(text, 'REVISION REQUESTED');
}

/**
 * 5. WhatsApp Alert: Deadline Extension Requested
 */
async function notifyWhatsAppExtensionRequested({ taskTitle, memberName = 'Team Member', requestedDueDate, reason = '' }) {
  const text = 
`⏳ *Stowave Workspace — Extension Requested*

📌 *Task:* ${taskTitle}
👤 *Requested By:* ${memberName}
📅 *New Requested Deadline:* ${requestedDueDate}
💬 *Reason:* "${reason || 'More time requested.'}"

🔗 *Review Request:* https://team.stowave.com/tasks`;

  return alertAdmins(text, 'EXTENSION REQUEST');
}

/**
 * 6. WhatsApp Alert: Extension Approved / Declined
 */
async function notifyWhatsAppExtensionReviewed({ taskTitle, approved = true, memberName = 'Team Member', notes = '' }) {
  const statusStr = approved ? '✅ APPROVED' : '❌ DECLINED';
  const text = 
`⏳ *Stowave Workspace — Extension ${statusStr}*

📌 *Task:* ${taskTitle}
👤 *Member:* ${memberName}
📝 *Admin Notes:* "${notes || (approved ? 'Extension granted.' : 'Request declined.')}"

🔗 *View Status:* https://team.stowave.com/tasks`;

  return alertAdmins(text, `EXTENSION ${statusStr}`);
}

/**
 * 7. WhatsApp Alert: General In-Portal Notification
 */
async function notifyWhatsAppInPortalAlert({ title, message, type = 'info', link = '/tasks' }) {
  const text = 
`🔔 *Stowave Alert — ${title}*

${message}

🔗 *Link:* https://team.stowave.com${link.startsWith('/') ? link : '/' + link}`;

  return alertAdmins(text, type.toUpperCase());
}

/**
 * Health Check: Verify Meta Token & Phone ID
 */
async function checkWhatsAppHealth() {
  const token = getToken();
  const phoneId = getPhoneNumberId();
  const adminNumbers = getAdminNumbers();

  if (!token) {
    return {
      configured: false,
      status: 'Token Missing in .env or settings',
      phoneId,
      adminNumbers
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}?fields=display_phone_number,verified_name,quality_rating`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.error) {
      return {
        configured: true,
        valid: false,
        status: 'Authentication Error',
        errorMessage: data.error.message,
        errorCode: data.error.code,
        errorSubcode: data.error.error_subcode,
        phoneId,
        adminNumbers
      };
    }

    return {
      configured: true,
      valid: true,
      status: 'Active & Verified',
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
      qualityRating: data.quality_rating,
      phoneId,
      adminNumbers
    };
  } catch (err) {
    return {
      configured: true,
      valid: false,
      status: 'Network / Fetch Error',
      errorMessage: err.message,
      phoneId,
      adminNumbers
    };
  }
}

module.exports = {
  sendWhatsAppMessage,
  alertAdmins,
  getAdminNumbers,
  notifyWhatsAppTaskAssigned,
  notifyWhatsAppTaskSubmitted,
  notifyWhatsAppTaskApproved,
  notifyWhatsAppTaskRejected,
  notifyWhatsAppExtensionRequested,
  notifyWhatsAppExtensionReviewed,
  notifyWhatsAppInPortalAlert,
  checkWhatsAppHealth
};
