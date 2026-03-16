const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_USER,
    pass: process.env.NODEMAILER_PASS,
  },
});

// Verify connection on startup (logs to console, doesn't crash server)
transporter.verify((err) => {
  if (err) console.error('❌ Mailer error:', err.message);
  else console.log('✅ Mailer ready');
});

/**
 * sendMail({ to, subject, html })
 */
async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.NODEMAILER_FROM || `OTTMarket <${process.env.NODEMAILER_USER}>`,
    to,
    subject,
    html,
  });
}

// ── Pre-built templates ───────────────────────────────────────────────────────

function orderConfirmationMail({ userName, orderNumber, productName, amount, duration }) {
  return {
    subject: `Order Confirmed – ${productName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f0f1a;color:#e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px">
          <h1 style="margin:0;font-size:22px;color:#fff">✅ Order Confirmed</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:14px">OTTMarket</p>
        </div>
        <div style="padding:28px 32px">
          <p style="margin:0 0 16px">Hi <strong>${userName}</strong>,</p>
          <p style="margin:0 0 20px;color:#94a3b8">Your order has been placed successfully. We'll deliver your credentials shortly.</p>
          <div style="background:#1e1e2e;border-radius:8px;padding:16px 20px;margin-bottom:20px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="color:#64748b;padding:4px 0">Order #</td><td style="text-align:right;color:#e2e8f0">${orderNumber}</td></tr>
              <tr><td style="color:#64748b;padding:4px 0">Product</td><td style="text-align:right;color:#e2e8f0">${productName}</td></tr>
              <tr><td style="color:#64748b;padding:4px 0">Duration</td><td style="text-align:right;color:#e2e8f0">${duration}</td></tr>
              <tr><td style="color:#64748b;padding:4px 0">Amount</td><td style="text-align:right;color:#818cf8;font-weight:bold">₹${amount}</td></tr>
            </table>
          </div>
          <p style="font-size:12px;color:#475569;margin:0">If you have questions, open a support ticket on OTTMarket.</p>
        </div>
      </div>`,
  };
}

function orderDeliveredMail({ userName, orderNumber, productName, credentials }) {
  return {
    subject: `Your ${productName} credentials are ready 🎉`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f0f1a;color:#e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#10b981,#059669);padding:28px 32px">
          <h1 style="margin:0;font-size:22px;color:#fff">🎉 Subscription Delivered</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:14px">OTTMarket</p>
        </div>
        <div style="padding:28px 32px">
          <p style="margin:0 0 16px">Hi <strong>${userName}</strong>,</p>
          <p style="margin:0 0 20px;color:#94a3b8">Your <strong>${productName}</strong> subscription (Order #${orderNumber}) has been delivered.</p>
          ${credentials ? `
          <div style="background:#1e1e2e;border-radius:8px;padding:16px 20px;margin-bottom:20px;border-left:3px solid #10b981">
            <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Credentials</p>
            <pre style="margin:0;color:#e2e8f0;font-size:14px;white-space:pre-wrap">${credentials}</pre>
          </div>` : ''}
          <p style="font-size:12px;color:#475569;margin:0">Keep these credentials safe. Do not share them.</p>
        </div>
      </div>`,
  };
}

function walletTopupMail({ userName, amount, newBalance, transactionId }) {
  return {
    subject: `Wallet Topped Up – ₹${amount} Added`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f0f1a;color:#e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px">
          <h1 style="margin:0;font-size:22px;color:#fff">💰 Wallet Topped Up</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:14px">OTTMarket</p>
        </div>
        <div style="padding:28px 32px">
          <p style="margin:0 0 16px">Hi <strong>${userName}</strong>,</p>
          <div style="background:#1e1e2e;border-radius:8px;padding:16px 20px;margin-bottom:20px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="color:#64748b;padding:4px 0">Amount Added</td><td style="text-align:right;color:#fbbf24;font-weight:bold">₹${amount}</td></tr>
              <tr><td style="color:#64748b;padding:4px 0">New Balance</td><td style="text-align:right;color:#e2e8f0">₹${newBalance}</td></tr>
              <tr><td style="color:#64748b;padding:4px 0">Transaction ID</td><td style="text-align:right;color:#64748b;font-size:12px">${transactionId}</td></tr>
            </table>
          </div>
        </div>
      </div>`,
  };
}

function backInStockMail({ productName, platform, price, duration, shopUrl }) {
  return {
    subject: `🔔 ${productName} is Back in Stock!`,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:auto;background:#0f0f1a;color:#e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5)">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%);padding:36px 32px;text-align:center;position:relative">
          <div style="font-size:48px;margin-bottom:12px">🔔</div>
          <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px">Back in Stock!</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:15px">Your waitlisted product is available now</p>
        </div>

        <!-- Body -->
        <div style="padding:32px">

          <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6">
            Great news! The product you were waiting for is now available on
            <strong style="color:#e2e8f0">OTTMarket</strong>. Grab it before it sells out again.
          </p>

          <!-- Product card -->
          <div style="background:#1e1e2e;border-radius:12px;overflow:hidden;margin-bottom:28px;border:1px solid rgba(99,102,241,0.2)">
            <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:20px 24px">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.5px;font-weight:600">${platform}</p>
              <h2 style="margin:6px 0 0;font-size:20px;font-weight:800;color:#fff">${productName}</h2>
            </div>
            <div style="padding:20px 24px">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr>
                  <td style="color:#64748b;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">Duration</td>
                  <td style="text-align:right;color:#e2e8f0;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-weight:600">${duration}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;padding:6px 0">Price</td>
                  <td style="text-align:right;padding:6px 0">
                    <span style="color:#818cf8;font-size:20px;font-weight:800">₹${price}</span>
                  </td>
                </tr>
              </table>
            </div>
          </div>

          <!-- CTA Button -->
          <div style="text-align:center;margin-bottom:28px">
            <a href="${shopUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 40px;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 8px 24px rgba(99,102,241,0.4)">
              🛒 &nbsp;Order Now
            </a>
          </div>

          <!-- Urgency note -->
          <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:12px 16px;margin-bottom:24px;text-align:center">
            <p style="margin:0;font-size:13px;color:#fbbf24;font-weight:600">⚡ Limited stock — order before it sells out again</p>
          </div>

          <!-- Footer note -->
          <p style="font-size:12px;color:#334155;margin:0;text-align:center;line-height:1.6">
            You received this because you joined the waitlist for <strong style="color:#475569">${productName}</strong>.<br/>
            If you no longer wish to receive these alerts, simply ignore this email.
          </p>
        </div>

        <!-- Footer bar -->
        <div style="background:#0a0a14;padding:16px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.05)">
          <p style="margin:0;font-size:12px;color:#1e293b">© ${new Date().getFullYear()} OTTMarket · Premium Subscriptions</p>
        </div>
      </div>`,
  };
}

function welcomeMail({ userName, email, shopUrl }) {
  const firstName = userName.split(' ')[0];
  const year = new Date().getFullYear();
  return {
    subject: `Welcome to OTTMarket, ${firstName}! 🎉`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#080810;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080810;padding:40px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:580px;background:#0f0f1a;border-radius:20px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.6)">

      <!-- Hero banner -->
      <tr>
        <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#a855f7 100%);padding:48px 40px;text-align:center">
          <!-- Logo mark -->
          <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:16px;line-height:56px;font-size:28px;margin-bottom:20px;backdrop-filter:blur(10px)">🎬</div>
          <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.2">
            Welcome to OTTMarket
          </h1>
          <p style="margin:12px 0 0;font-size:16px;color:rgba(255,255,255,0.75);font-weight:400">
            Your premium subscription marketplace
          </p>
        </td>
      </tr>

      <!-- Greeting -->
      <tr>
        <td style="padding:40px 40px 0">
          <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9">
            Hey ${firstName}, great to have you! 👋
          </h2>
          <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.7">
            Your account has been created successfully. You now have access to the best deals on
            Netflix, Spotify, Disney+, Amazon Prime and many more — all at up to
            <strong style="color:#a78bfa">80% off</strong> retail price.
          </p>
        </td>
      </tr>

      <!-- Account details card -->
      <tr>
        <td style="padding:28px 40px">
          <div style="background:#1e1e2e;border-radius:12px;padding:20px 24px;border:1px solid rgba(99,102,241,0.2)">
            <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1.5px">Your Account</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#64748b;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)">Full Name</td>
                <td style="font-size:13px;color:#e2e8f0;text-align:right;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-weight:600">${userName}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#64748b;padding:5px 0">Email</td>
                <td style="font-size:13px;color:#e2e8f0;text-align:right;padding:5px 0">${email}</td>
              </tr>
            </table>
          </div>
        </td>
      </tr>

      <!-- What you can do -->
      <tr>
        <td style="padding:0 40px 28px">
          <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1px">What you can do</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              ['🎬', 'Browse Subscriptions', 'Netflix, Spotify, Disney+ and 10+ more platforms'],
              ['💰', 'Wallet Payments', 'Top up once, buy instantly — no card needed every time'],
              ['⚡', 'Instant Delivery', 'Credentials delivered to your dashboard right away'],
              ['🎫', '24/7 Support', 'Open a ticket anytime and our team will help you'],
            ].map(([icon, title, desc]) => `
            <tr>
              <td style="padding:0 0 12px">
                <div style="background:#1e1e2e;border-radius:10px;padding:14px 18px;display:flex;align-items:flex-start;gap:14px;border:1px solid rgba(255,255,255,0.05)">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="width:36px;height:36px;background:rgba(99,102,241,0.15);border-radius:8px;text-align:center;vertical-align:middle;font-size:18px">${icon}</td>
                    <td style="padding-left:14px;vertical-align:middle">
                      <p style="margin:0;font-size:14px;font-weight:700;color:#e2e8f0">${title}</p>
                      <p style="margin:3px 0 0;font-size:12px;color:#64748b">${desc}</p>
                    </td>
                  </tr></table>
                </div>
              </td>
            </tr>`).join('')}
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="padding:0 40px 40px;text-align:center">
          <a href="${shopUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 8px 32px rgba(99,102,241,0.45)">
            🛒 &nbsp; Start Shopping
          </a>
          <p style="margin:16px 0 0;font-size:13px;color:#334155">
            Or visit <a href="${shopUrl}" style="color:#818cf8;text-decoration:none">${shopUrl}</a>
          </p>
        </td>
      </tr>

      <!-- Divider -->
      <tr><td style="padding:0 40px"><div style="height:1px;background:rgba(255,255,255,0.06)"></div></td></tr>

      <!-- Footer -->
      <tr>
        <td style="padding:24px 40px;text-align:center">
          <p style="margin:0 0 6px;font-size:12px;color:#1e293b;font-weight:600">OTTMarket</p>
          <p style="margin:0;font-size:11px;color:#1e293b;line-height:1.6">
            You're receiving this because you created an account with this email address.<br/>
            © ${year} OTTMarket. All rights reserved.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
  };
}

module.exports = { sendMail, welcomeMail, orderConfirmationMail, orderDeliveredMail, walletTopupMail, backInStockMail };
