const nodemailer = require('nodemailer');
require('dotenv').config();

const mailUser = process.env.MAIL
  ? process.env.MAIL.trim().replace(/^["']|["']$/g, '')
  : '';
const mailPass = process.env.PASS
  ? process.env.PASS.trim().replace(/\s+/g, '').replace(/^["']|["']$/g, '')
  : '';
const smtpHost = process.env.SMTP_HOST
  ? process.env.SMTP_HOST.trim().replace(/^["']|["']$/g, '')
  : 'smtp.gmail.com';
const smtpPort = process.env.SMTP_PORT
  ? parseInt(process.env.SMTP_PORT.toString().trim(), 10)
  : 587;

let transporter = null;

function getTransporter() {
  if (!transporter) {
    // Prefer Gmail service when host is Gmail — more reliable than raw SMTP on some networks
    const isGmail = /gmail\.com$/i.test(smtpHost);
    transporter = nodemailer.createTransport(
      isGmail
        ? {
            service: 'gmail',
            auth: {
              user: mailUser,
              pass: mailPass,
            },
            connectionTimeout: 20000,
            greetingTimeout: 20000,
            socketTimeout: 30000,
          }
        : {
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            requireTLS: smtpPort === 587,
            auth: {
              user: mailUser,
              pass: mailPass,
            },
            connectionTimeout: 20000,
            greetingTimeout: 20000,
            socketTimeout: 30000,
          }
    );
  }
  return transporter;
}

function sendOTP(email, otp) {
  console.log(`Sending OTP to: ${email}`);
  console.log(`[DEV] OTP for ${email}: ${otp}`);

  if (!mailUser || !mailPass) {
    return Promise.reject(new Error('MAIL or PASS is not configured in .env'));
  }

  const otpDigits = String(otp)
    .split('')
    .map(
      (d) =>
        `<td style="width:44px;height:52px;border:1px solid #c8dcc7;border-radius:8px;background:#f4faf4;text-align:center;vertical-align:middle;font-size:24px;font-weight:700;color:#1A5319;letter-spacing:0;">${d}</td>`
    )
    .join('<td style="width:8px;"></td>');

  const mailOptions = {
    from: `"Echo Emporium" <${mailUser}>`,
    to: email,
    subject: 'Your Echo Emporium verification code',
    html: `
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
    `,
    text: `Echo Emporium\n\nYour verification code is ${otp}.\nIt expires in 2 minutes.\n\nNever share this code with anyone.`,
  };

  return getTransporter().sendMail(mailOptions)
    .then((info) => {
      console.log('OTP email sent successfully:', info.response);
      return info;
    })
    .catch((err) => {
      console.error('Error sending OTP email:', err.message);
      throw err;
    });
}

module.exports = sendOTP;
