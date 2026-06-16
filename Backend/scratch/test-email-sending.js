require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('Starting SMTP Email test...');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('Port:', process.env.SMTP_PORT);
  console.log('User:', process.env.SMTP_USER);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: process.env.SMTP_PORT || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"Nova Store Test" <${process.env.EMAIL_FROM || 'noreply@novastore.com'}>`,
    to: 'amossomoloye65@gmail.com',
    subject: 'SMTP Connection Test',
    text: 'Hello! This is a test email to verify SMTP configuration.',
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Success! Email sent successfully.');
    console.log('Response:', info.response);
    console.log('Message ID:', info.messageId);
    process.exit(0);
  } catch (error) {
    console.error('✗ SMTP Error occurred:', error);
    process.exit(1);
  }
}

testEmail();
