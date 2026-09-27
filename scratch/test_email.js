require('dotenv').config();
const sendOTP = require('../services/emailSender');

const to = (process.env.MAIL || '').trim().replace(/^["']|["']$/g, '');
console.log('Testing OTP send to', to);

const timer = setTimeout(() => {
  console.error('SEND_TIMEOUT: email hung after 15s');
  process.exit(2);
}, 15000);

sendOTP(to, '12345')
  .then(() => {
    clearTimeout(timer);
    console.log('SEND_OK');
    process.exit(0);
  })
  .catch((e) => {
    clearTimeout(timer);
    console.error('SEND_FAIL:', e.message);
    process.exit(1);
  });
