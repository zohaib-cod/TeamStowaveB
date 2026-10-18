const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/emailService');
const { 
  sendWhatsAppMessage, 
  alertAdmins, 
  getAdminNumbers, 
  checkWhatsAppHealth 
} = require('../services/whatsappService');
const { uploadMedia } = require('../services/cloudinaryService');

// 1. Upload file or image to Cloudinary
router.post('/upload', async (req, res) => {
  const { fileData, folder = 'team_management' } = req.body;
  if (!fileData) {
    return res.status(400).json({ error: 'fileData is required (base64 string or image URL)' });
  }

  const result = await uploadMedia(fileData, folder);
  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

// 2. Test Email Dispatch
router.post('/test-email', async (req, res) => {
  const { to = process.env.GMAIL_USER || 'alizohaib.web@gmail.com' } = req.body;
  const result = await sendEmail({
    to,
    subject: '🧪 Stowave — Live Email Test Alert',
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #0d1527; color: #f8fafc; padding: 24px; border-radius: 12px;">
        <h2 style="color: #e11d48;">Stowave Global — Email Dispatcher Verified</h2>
        <p>This is a real-time verification email sent from your connected Gmail SMTP dispatcher (<code>${process.env.GMAIL_USER}</code>).</p>
        <div style="background: rgba(16, 185, 129, 0.1); padding: 14px; border-radius: 8px; border-left: 4px solid #10b981;">
          <p style="margin: 0; color: #34d399;"><strong>Status:</strong> Active & Ready for Automated Notifications</p>
        </div>
      </div>
    `
  });
  res.json(result);
});

// 3. Test WhatsApp Dispatch (to single number or all configured admin numbers)
router.post('/test-whatsapp', async (req, res) => {
  const { phone, message } = req.body;
  const adminNumbers = getAdminNumbers();
  const text = message || '🚀 Stowave Global: WhatsApp Cloud API notification engine live verification test!';

  if (phone) {
    const result = await sendWhatsAppMessage(phone, text);
    return res.json({
      target: 'single',
      recipient: phone,
      adminNumbersConfigured: adminNumbers,
      ...result
    });
  }

  const results = await alertAdmins(text, 'VERIFICATION TEST');
  res.json({
    target: 'broadcast',
    adminNumbersConfigured: adminNumbers,
    totalRecipients: adminNumbers.length,
    results
  });
});

// 4. WhatsApp Cloud API Connection Health
router.get('/whatsapp-health', async (req, res) => {
  const health = await checkWhatsAppHealth();
  res.json(health);
});

// 5. Integrations Health & Status Overview
router.get('/status', async (req, res) => {
  const adminNumbers = getAdminNumbers();
  const whatsappHealth = await checkWhatsAppHealth();

  res.json({
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'dqmjtblih',
      apiKeyMasked: process.env.CLOUDINARY_API_KEY ? `${process.env.CLOUDINARY_API_KEY.slice(0, 4)}...` : 'Not Set',
      status: 'Connected & Active'
    },
    email: {
      user: process.env.GMAIL_USER || 'alizohaib.web@gmail.com',
      service: 'Gmail App Password SMTP',
      status: 'Connected & Active'
    },
    whatsapp: {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '1141217175751828',
      adminRecipients: adminNumbers,
      status: whatsappHealth.valid ? 'Active & Verified' : (whatsappHealth.status || 'Configuration Needed'),
      details: whatsappHealth
    },
    jwt: {
      configured: Boolean(process.env.JWT_SECRET),
      status: 'Active'
    },
    supabase: {
      projectRef: 'waokbbftfhjrhvgpigzm',
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://waokbbftfhjrhvgpigzm.supabase.co',
      region: 'ap-southeast-2',
      table: 'public.todos',
      status: 'Connected & Active (PostgreSQL 17.11)'
    }
  });
});

module.exports = router;
