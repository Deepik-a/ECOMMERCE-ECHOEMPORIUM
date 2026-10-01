const axios = require('axios');
require('dotenv').config();

const brevoApiKey = process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.trim().replace(/^["']|["']$/g, '') : '';
const senderEmail = process.env.MAIL ? process.env.MAIL.trim().replace(/^["']|["']$/g, '') : 'noreply@echoemporium.com';

async function sendOTP(email, otp) {
  console.log(`Sending OTP to: ${email}`);
  console.log(`[DEV] OTP for ${email}: ${otp}`);

  if (!brevoApiKey) {
    return Promise.reject(new Error('BREVO_API_KEY is not configured in .env'));
  }

  const otpDigits = String(otp)
    .split('')
    .map(
      (d) =>
        `<td style="width:44px;height:52px;border:1px solid #c8dcc7;border-radius:8px;background:#f4faf4;text-align:center;vertical-align:middle;font-size:24px;font-weight:700;color:#1A5319;letter-spacing:0;">${d}</td>`
    )
    .join('<td style="width:8px;"></td>');

  const htmlContent = `
      <div style="margin:0;padding:0;background:#eef3ee;font-family:Georgia,'Times New Roman',serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3ee;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(26,83,25,0.12);">
                <tr>
                  <td style="background:linear-gradient(135deg,#1A5319 0%,#2d7a2c 100%);padding:28px 32px;text-align:center;">
                    <p style="margin:0;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#c8e6c7;">Echo Emporium</p>
                    <h1 style="margin:10px 0 0;font-size:26px;font-weight:700;color:#ffffff;">Verify your email</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 32px 16px;text-align:center;color:#333;">
                    <p style="margin:0 0 8px;font-size:16px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
                      Use this one-time code to finish signing up:
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto;">
                      <tr>${otpDigits}</tr>
                    </table>
                    <p style="margin:8px 0 0;font-size:14px;color:#666;font-family:Arial,Helvetica,sans-serif;">
                      This code expires in <strong style="color:#1A5319;">2 minutes</strong>.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 32px;text-align:center;">
                    <p style="margin:0;padding:14px 18px;background:#f8fbf8;border-radius:10px;font-size:13px;line-height:1.5;color:#6b7c6a;font-family:Arial,Helvetica,sans-serif;">
                      Never share this code with anyone. Echo Emporium will never ask for it by phone or chat.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #e8efe8;">
                    <p style="margin:0;font-size:12px;color:#9aaa99;font-family:Arial,Helvetica,sans-serif;">
                      If you didn&rsquo;t request this, you can ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

  const textContent = `Echo Emporium\n\nYour verification code is ${otp}.\nIt expires in 2 minutes.\n\nNever share this code with anyone.`;

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: 'Echo Emporium', email: senderEmail },
        to: [{ email: email }],
        subject: 'Your Echo Emporium verification code',
        htmlContent: htmlContent,
        textContent: textContent,
      },
      {
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
      }
    );
    console.log('OTP email sent successfully via Brevo API:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending OTP email via Brevo API:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = sendOTP;
