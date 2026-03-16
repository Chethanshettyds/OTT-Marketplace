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
  const orderDate = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const firstName = (userName || 'there').split(' ')[0];
  const year = new Date().getFullYear();

  return {
    subject: `Order ${orderNumber} Confirmed – Processing Within 24 Hours`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Order Confirmed</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(135deg,#1e1b4b 0%,#2d1b69 100%);font-family:'Segoe UI',Arial,sans-serif;min-height:100vh">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:600px;background:rgba(255,255,255,0.05);border-radius:24px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;box-shadow:0 32px 64px rgba(0,0,0,0.4)">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#8b5cf6 0%,#a855f7 100%);padding:36px 32px;text-align:center">
          <div style="margin-bottom:12px">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block">
              <rect width="52" height="52" rx="14" fill="rgba(255,255,255,0.15)"/>
              <polygon points="20,16 20,36 38,26" fill="white"/>
              <rect x="13" y="16" width="4" height="20" rx="2" fill="white"/>
            </svg>
          </div>
          <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">OTTMARKET</div>
          <h1 style="margin:12px 0 0;font-size:26px;font-weight:700;color:#ffffff">Order Confirmed!</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px">Your subscription is being activated</p>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:32px">

          <!-- Greeting -->
          <p style="margin:0 0 24px;font-size:16px;color:#e2e8f0">Hi <strong style="color:#ffffff">${firstName}</strong>, your order has been placed successfully.</p>

          <!-- Order ID badge -->
          <div style="background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.35);border-radius:12px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:1.5px">Order Reference</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#c4b5fd;font-family:'Courier New',monospace">${orderNumber}</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.45)">Placed on ${orderDate}</p>
          </div>

          <!-- Items table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <!-- Header row -->
            <tr>
              <td style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;padding:0 0 10px;border-bottom:1px solid rgba(255,255,255,0.08)">Product</td>
              <td style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;padding:0 0 10px;border-bottom:1px solid rgba(255,255,255,0.08);text-align:center">Duration</td>
              <td style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;padding:0 0 10px;border-bottom:1px solid rgba(255,255,255,0.08);text-align:right">Price</td>
            </tr>
            <!-- Item row -->
            <tr>
              <td style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                <p style="margin:0;font-size:15px;font-weight:600;color:#ffffff">${productName}</p>
              </td>
              <td style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:center;color:rgba(255,255,255,0.6);font-size:14px">${duration}</td>
              <td style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;font-size:17px;font-weight:700;color:#10b981">₹${amount}</td>
            </tr>
            <!-- Total row -->
            <tr>
              <td colspan="2" style="padding:16px 0 0;font-size:15px;font-weight:700;color:#ffffff">Total Paid</td>
              <td style="padding:16px 0 0;text-align:right;font-size:22px;font-weight:800;color:#10b981">₹${amount}</td>
            </tr>
          </table>

          <!-- ETA notice -->
          <div style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:24px">
            <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#60a5fa">⚡ Processing in Progress</p>
            <p style="margin:0;font-size:15px;color:#ffffff">Your order will be completed within <strong>24 hours</strong></p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6)">You will receive another email once your credentials are activated</p>
          </div>

          <!-- Support note -->
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);text-align:center">
            Need help? <a href="mailto:support@ottmarket.com" style="color:#a855f7;text-decoration:none;font-weight:600">Contact Support</a> or open a ticket on OTTMarket.
          </p>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:rgba(0,0,0,0.25);padding:20px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.06)">
          <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.35)">© ${year} OTTMARKET. All rights reserved.</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2)">You received this because you placed an order on OTTMarket.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
  };
}

function orderDeliveredMail({ userName, orderNumber, productName, amount, duration, credentials }) {
  const activationDate = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const firstName = (userName || 'there').split(' ')[0];
  const year = new Date().getFullYear();

  // Pick a platform icon based on product name
  const name = (productName || '').toLowerCase();
  const platformIcon = name.includes('youtube') ? `<svg width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="20" rx="5" fill="#FF0000"/><polygon points="11,5 11,15 20,10" fill="white"/></svg>`
    : name.includes('netflix') ? `<svg width="22" height="28" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="22" height="28" rx="3" fill="#E50914"/><text x="3" y="22" font-size="22" font-weight="900" fill="white" font-family="Arial">N</text></svg>`
    : name.includes('spotify') ? `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="14" fill="#1DB954"/><path d="M8 10.5c3.5-1 7.5-1 11 0.5M8 14c3-0.8 6.5-0.8 10 0.5M9 17.5c2.5-0.6 5-0.6 8 0.3" stroke="white" stroke-width="1.8" stroke-linecap="round"/></svg>`
    : name.includes('disney') ? `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="14" fill="#113CCF"/><text x="4" y="20" font-size="13" font-weight="900" fill="white" font-family="Arial">D+</text></svg>`
    : name.includes('amazon') || name.includes('prime') ? `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="14" fill="#00A8E0"/><text x="5" y="20" font-size="11" font-weight="900" fill="white" font-family="Arial">prime</text></svg>`
    : `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="14" fill="rgba(16,185,129,0.3)"/><polygon points="10,8 10,20 22,14" fill="#10b981"/></svg>`;

  return {
    subject: `✅ ${productName} Activated – Your subscription is LIVE!`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Subscription Activated</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(135deg,#052e16 0%,#14532d 50%,#1e1b4b 100%);font-family:'Segoe UI',Arial,sans-serif;min-height:100vh">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:600px;background:rgba(255,255,255,0.05);border-radius:24px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;box-shadow:0 32px 64px rgba(0,0,0,0.4)">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:36px 32px;text-align:center">
          <div style="margin-bottom:12px">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block">
              <rect width="52" height="52" rx="14" fill="rgba(255,255,255,0.2)"/>
              <circle cx="26" cy="26" r="14" fill="none" stroke="white" stroke-width="2.5"/>
              <polyline points="19,26 24,31 33,21" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">OTTMARKET</div>
          <h1 style="margin:10px 0 0;font-size:24px;font-weight:700;color:#ffffff">Subscription Activated!</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px">Your service is now LIVE and ready to use</p>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:32px">

          <!-- Greeting -->
          <p style="margin:0 0 24px;font-size:16px;color:#e2e8f0">Hi <strong style="color:#ffffff">${firstName}</strong>, great news — your subscription has been activated!</p>

          <!-- Service card -->
          <div style="background:linear-gradient(135deg,rgba(16,185,129,0.12) 0%,rgba(5,150,105,0.12) 100%);border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:24px;margin-bottom:24px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6ee7b7;text-transform:uppercase;letter-spacing:1.5px">Now Active</p>
                  <p style="margin:0;font-size:20px;font-weight:800;color:#10b981">${productName}</p>
                  ${duration ? `<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.55)">${duration} subscription</p>` : ''}
                </td>
                <td style="text-align:right;vertical-align:middle;padding-left:16px">${platformIcon}</td>
              </tr>
            </table>
          </div>

          <!-- Order details -->
          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6ee7b7;text-transform:uppercase;letter-spacing:1.5px">Order Reference</p>
            <p style="margin:0;font-size:17px;font-weight:700;color:#a7f3d0;font-family:'Courier New',monospace">${orderNumber}</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.4)">Activated on ${activationDate}</p>
            ${amount ? `<p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.5)">Amount paid: <strong style="color:#10b981">₹${amount}</strong></p>` : ''}
          </div>

          ${credentials ? `
          <!-- Credentials -->
          <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:20px;margin-bottom:24px">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:1.5px">🔐 Your Credentials</p>
            <pre style="margin:0;color:#e2e8f0;font-size:14px;white-space:pre-wrap;font-family:'Courier New',monospace;line-height:1.6">${credentials}</pre>
            <p style="margin:12px 0 0;font-size:11px;color:rgba(255,255,255,0.3)">Keep these safe. Do not share with anyone.</p>
          </div>` : ''}

          <!-- CTA -->
          <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:24px">
            <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#a855f7">🎬 Start Streaming Now</p>
            <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.5)">Head to your dashboard to view all active subscriptions</p>
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#a855f7);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:50px;font-size:14px;font-weight:700;box-shadow:0 6px 20px rgba(139,92,246,0.35)">
              → Go to Dashboard
            </a>
          </div>

          <!-- Support -->
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.35);text-align:center">
            Need help? <a href="mailto:support@ottmarket.com" style="color:#10b981;text-decoration:none;font-weight:600">Contact Support</a> or open a ticket on OTTMarket.
          </p>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:rgba(0,0,0,0.25);padding:20px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.06)">
          <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.3)">© ${year} OTTMARKET. All rights reserved.</p>
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.15)">You received this because your order was fulfilled on OTTMarket.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
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
