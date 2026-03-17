const Order = require('../models/Order');
const User = require('../models/User');

// In-memory analytics store (resets on server restart; swap for DB if needed)
const analytics = {
  totalQueries: 0,
  topTopics: {},
  recentQueries: [], // last 100
  escalations: 0,
  resolvedByBot: 0,
};

function trackQuery(topic, query) {
  analytics.totalQueries++;
  analytics.topTopics[topic] = (analytics.topTopics[topic] || 0) + 1;
  analytics.recentQueries.unshift({ topic, query, ts: new Date() });
  if (analytics.recentQueries.length > 100) analytics.recentQueries.pop();
}

// Detect intent from user message
function detectIntent(msg) {
  const m = msg.toLowerCase();
  if (/order|#\d+|ord-|track|ship|deliver|where.*order|status/i.test(m)) return 'order';
  if (/wallet|top.?up|fund|balance|credit|deposit|recharge/i.test(m)) return 'wallet';
  if (/subscri|plan|cancel|renew|expir|netflix|spotify|prime/i.test(m)) return 'subscription';
  if (/refund|money back|chargeback/i.test(m)) return 'refund';
  if (/password|login|sign.?in|account|email|reset/i.test(m)) return 'account';
  if (/human|agent|support|help|talk|person|escalat/i.test(m)) return 'escalation';
  if (/price|cost|how much|cheap|discount|promo/i.test(m)) return 'pricing';
  if (/bug|error|broken|not work|issue|problem|crash/i.test(m)) return 'bug';
  return 'general';
}

exports.chat = async (req, res) => {
  const { messages, userId } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const intent = detectIntent(lastUserMsg);
  trackQuery(intent, lastUserMsg);

  // Build user context
  let userContext = '';
  let orderContext = '';

  try {
    if (userId) {
      const user = await User.findById(userId).select('name email wallet activeSubscriptions');
      if (user) {
        userContext = `User: ${user.name} | Email: ${user.email} | Wallet: $${user.wallet?.toFixed(2) || '0.00'}`;
        const activeSubs = (user.activeSubscriptions || [])
          .filter((s) => s.status === 'active')
          .map((s) => `${s.productName} (expires ${new Date(s.expiryDate).toLocaleDateString()})`)
          .join(', ');
        if (activeSubs) userContext += ` | Active Subs: ${activeSubs}`;
      }

      // Fetch latest 3 orders for context
      const orders = await Order.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('orderNumber status amount productSnapshot createdAt credentials');

      if (orders.length) {
        orderContext = orders
          .map(
            (o) =>
              `Order ${o.orderNumber}: ${o.productSnapshot?.name || 'Unknown'} | Status: ${o.status} | $${o.amount} | Date: ${new Date(o.createdAt).toLocaleDateString()}`
          )
          .join('\n');
      }
    }
  } catch (_) {
    // non-fatal — proceed without context
  }

  const systemPrompt = `You are OTHub's friendly AI support agent. OTHub is a premium OTT subscription marketplace.
Be concise, warm, and helpful. Use emojis naturally. Keep replies under 120 words unless detail is needed.
Always offer actionable next steps with clear options.

${userContext ? `CURRENT USER CONTEXT:\n${userContext}` : ''}
${orderContext ? `\nRECENT ORDERS:\n${orderContext}` : ''}

PLATFORM KNOWLEDGE:
- Users buy OTT subscriptions (Netflix, Spotify, Prime, etc.) using wallet balance
- Wallet top-up: go to Dashboard → Fund Wallet → choose amount → pay via Stripe/bank transfer
- Orders are fulfilled within 1-24 hours; credentials delivered via email + dashboard
- Refunds: contact support within 48 hours of purchase
- Subscriptions auto-show in Dashboard → My Subscriptions
- Support tickets: Dashboard → Support Tickets

RESPONSE RULES:
- For order queries: always show order number, status, product name
- For wallet queries: always show current balance and top-up link
- For escalation requests: offer [Open Support Ticket] button
- Never share credentials in chat — direct to Dashboard
- If unsure, say "Let me connect you with our team" and offer escalation`;

  // Check if OpenAI key is configured
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback canned responses when no API key
    const fallback = getFallbackResponse(intent, lastUserMsg);
    if (intent === 'escalation') analytics.escalations++;
    else analytics.resolvedByBot++;
    return res.json({ reply: fallback, intent, fallback: true });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI error ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm having trouble right now. Please try again.";

    if (intent === 'escalation') analytics.escalations++;
    else analytics.resolvedByBot++;

    res.json({ reply, intent });
  } catch (err) {
    // Graceful fallback on API failure
    const fallback = getFallbackResponse(intent, lastUserMsg);
    res.json({ reply: fallback, intent, fallback: true });
  }
};

exports.getAnalytics = async (req, res) => {
  const sorted = Object.entries(analytics.topTopics)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));

  res.json({
    totalQueries: analytics.totalQueries,
    escalations: analytics.escalations,
    resolvedByBot: analytics.resolvedByBot,
    resolutionRate:
      analytics.totalQueries > 0
        ? Math.round((analytics.resolvedByBot / analytics.totalQueries) * 100)
        : 0,
    topTopics: sorted,
    recentQueries: analytics.recentQueries.slice(0, 20),
  });
};

function getFallbackResponse(intent, msg) {
  const responses = {
    order: `🔍 To check your order status, head to your **Dashboard → Order History**. You'll see real-time status updates there.\n\nNeed more help? [Open Support Ticket]`,
    wallet: `💳 To top up your wallet:\n1. Go to **Dashboard**\n2. Click **Fund Wallet**\n3. Choose your amount\n4. Complete payment\n\nYour balance updates instantly! [Go to Dashboard]`,
    subscription: `📺 Your active subscriptions are in **Dashboard → My Subscriptions**. Credentials are delivered via email within 24 hours.\n\nHaving issues? [Open Support Ticket]`,
    refund: `💰 Refund requests are processed within 48 hours. Please open a support ticket with your order number and we'll sort it out.\n\n[Open Support Ticket]`,
    account: `🔐 For account issues:\n- Password reset: Login page → "Forgot Password"\n- Email issues: [Open Support Ticket]\n\nOur team responds within 2 hours.`,
    escalation: `👋 Connecting you with our support team now! We typically respond within 2 hours.\n\n[Open Support Ticket]`,
    pricing: `💎 OTHub offers premium OTT subscriptions at the best prices. Browse our shop to see current deals!\n\n[Browse Shop]`,
    bug: `🐛 Sorry about that! Please describe the issue in a support ticket and our team will fix it ASAP.\n\n[Report Bug]`,
    general: `👋 Hi! I'm OTHub's AI assistant. I can help with:\n• 📦 Order status\n• 💳 Wallet & top-up\n• 📺 Subscriptions\n• 🔐 Account issues\n\nWhat do you need help with?`,
  };
  return responses[intent] || responses.general;
}
