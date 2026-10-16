/**
 * WhatsApp Cloud API Notification Service
 */

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1141217175751828';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const ADMIN_NUMBERS = (process.env.ADMIN_WHATSAPP_NUMBER || '923290010909,923184360458')
  .split(',')
  .map(n => n.trim().replace(/\D/g, ''));

/**
 * Send a WhatsApp text notification to a specific number
 */
async function sendWhatsAppMessage(recipientPhone, messageText) {
  if (!WHATSAPP_TOKEN) {
    console.warn('⚠️ WhatsApp token not configured in .env');
    return { success: false, error: 'Token not configured' };
  }

  // Ensure clean international format without + sign (e.g., 923290010909)
  const cleanNumber = recipientPhone.replace(/\D/g, '');

  try {
    const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
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
      console.warn(`WhatsApp dispatch error for ${cleanNumber}:`, data);
      return { success: false, error: data.error?.message || 'Meta API Error', details: data };
    }

    console.log(`📱 WhatsApp notification delivered to ${cleanNumber}:`, data.messages?.[0]?.id);
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error('WhatsApp API network error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Broadcast critical alert to all configured Admin WhatsApp numbers
 */
async function alertAdmins(messageText) {
  const results = [];
  for (const num of ADMIN_NUMBERS) {
    if (num) {
      const res = await sendWhatsAppMessage(num, `[Stowave Alert]\n${messageText}`);
      results.push({ phone: num, ...res });
    }
  }
  return results;
}

module.exports = {
  sendWhatsAppMessage,
  alertAdmins,
  ADMIN_NUMBERS
};
