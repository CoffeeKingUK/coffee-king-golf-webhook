require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'https://www.coffeekingdirect.com',
  credentials: true
}));

// Configuration
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID;
const MAILCHIMP_SERVER = process.env.MAILCHIMP_SERVER || 'us1';
const SALES_EMAIL = 'sales@coffeeking.org.uk';
const DISCOUNT_CODE = 'TGGG10';

// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Golf Group Webhook Active' });
});

// Main webhook endpoint
app.post('/webhooks/golf-group', async (req, res) => {
  try {
    const userData = req.body;

    // Validate required fields
    const requiredFields = ['firstName', 'surname', 'email', 'phone'];
    const missingFields = requiredFields.filter(field => !userData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing fields: ${missingFields.join(', ')}`
      });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    console.log('Processing Golf Group signup:', userData.email);

    // Subscribe to Mailchimp
    try {
      await subscribeToMailchimp(userData);
      console.log('Mailchimp subscription successful');
    } catch (err) {
      console.log('Mailchimp warning:', err.message);
    }

    // Send discount email to customer
    await sendCustomerEmail(userData);
    console.log('Customer email sent');

    // Send notification to sales team
    await sendSalesEmail(userData);
    console.log('Sales notification sent');

    // Success response
    res.json({
      success: true,
      message: 'Signup processed',
      data: {
        email: userData.email,
        discountCode: DISCOUNT_CODE
      }
    });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// Mailchimp subscription
async function subscribeToMailchimp(userData) {
  const mailchimpUrl = `https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`;
  
  const memberData = {
    email_address: userData.email,
    status: 'subscribed',
    merge_fields: {
      FNAME: userData.firstName,
      LNAME: userData.surname,
      PHONE: userData.phone,
      COMPANY: userData.businessName || ''
    },
    tags: ['Golf-Group', 'TGGG10']
  };

  return await axios.post(mailchimpUrl, memberData, {
    auth: {
      username: 'anystring',
      password: MAILCHIMP_API_KEY
    }
  });
}

// Send discount code email to customer
async function sendCustomerEmail(userData) {
  const emailHtml = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #331805; color: white; padding: 30px; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; }
          .code-box { background: white; border: 3px dashed #f49320; padding: 20px; text-align: center; margin: 20px 0; }
          .code { font-size: 36px; font-weight: bold; color: #331805; font-family: monospace; letter-spacing: 2px; }
          a { color: white; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome Golf Group Member!</h1>
          </div>
          <div class="content">
            <p>Hi ${userData.firstName},</p>
            <p>Thank you for signing up for the exclusive Golf Group member discount at Coffee King Direct.</p>
            <p><strong>Your 10% discount code is:</strong></p>
            <div class="code-box">
              <div class="code">TGGG10</div>
            </div>
            <p><strong>How to use your code:</strong></p>
            <ol>
              <li>Browse our premium coffee, tea, syrups, and equipment at www.coffeekingdirect.com</li>
              <li>Add items to your cart</li>
              <li>Enter code <strong>TGGG10</strong> at checkout</li>
              <li>Your 10% discount will be applied automatically</li>
            </ol>
            <p><strong>Your registered interests:</strong><br>${userData.services.join(', ')}</p>
            <p>Our sales team will reach out shortly to discuss your specific requirements.</p>
            <p style="text-align: center; margin-top: 20px;">
              <a href="https://www.coffeekingdirect.com" style="background: #331805; color: white; padding: 12px 24px; text-decoration: none; display: inline-block;">Start Shopping Now</a>
            </p>
            <p>Questions? Reply to this email or contact us at sales@coffeeking.org.uk</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return await emailTransporter.sendMail({
    from: SALES_EMAIL,
    to: userData.email,
    subject: `Your Golf Group Discount Code: TGGG10`,
    html: emailHtml,
    replyTo: SALES_EMAIL
  });
}

// Send notification to sales team
async function sendSalesEmail(userData) {
  const emailHtml = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f49320; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>🏌️ New Golf Group Signup</h2>
          <table>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
            <tr>
              <td>Name</td>
              <td>${userData.firstName} ${userData.surname}</td>
            </tr>
            <tr>
              <td>Email</td>
              <td><a href="mailto:${userData.email}">${userData.email}</a></td>
            </tr>
            <tr>
              <td>Phone</td>
              <td>${userData.phone}</td>
            </tr>
            <tr>
              <td>Business</td>
              <td>${userData.businessName || 'Not provided'}</td>
            </tr>
            <tr>
              <td>Services</td>
              <td>${userData.services.join(', ')}</td>
            </tr>
            <tr>
              <td>Marketing</td>
              <td>${userData.optOutMarketing ? 'Opted Out' : 'Opted In'}</td>
            </tr>
          </table>
          <p>Please follow up with this customer.</p>
        </div>
      </body>
    </html>
  `;

  return await emailTransporter.sendMail({
    from: SALES_EMAIL,
    to: SALES_EMAIL,
    subject: `Golf Group Signup: ${userData.firstName} ${userData.surname}`,
    html: emailHtml,
    replyTo: userData.email
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Golf Group Webhook running on port ${PORT}`);
});
