const nodemailer = require('nodemailer');

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !process.env.SMTP_FROM) {
    return null;
  }

  if (SMTP_HOST === 'smtp.example.com' || SMTP_USER === 'your-smtp-username') {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendVerificationCode(email, code) {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('\n==================================================');
    console.log(`[DEV MODE - NO SMTP CONFIGURED]`);
    console.log(`Verification code for: ${email}`);
    console.log(`Code: ${code}`);
    console.log('==================================================\n');
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Your CCCM Manager verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your CCCM Manager verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in 10 minutes.</p>`,
    });
  } catch (err) {
    console.warn(`\n[SMTP ERROR] Failed to send email via ${process.env.SMTP_HOST}: ${err.message}`);
    console.log(`[DEV FALLBACK] Verification code for ${email}: ${code}\n`);
    if (process.env.NODE_ENV !== 'production' || process.env.SMTP_HOST === 'smtp.example.com') {
      return;
    }
    throw err;
  }
}

module.exports = { sendVerificationCode };

