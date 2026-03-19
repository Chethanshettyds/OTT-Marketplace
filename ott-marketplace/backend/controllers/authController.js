const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sendMail, welcomeMail, passwordResetMail, passwordChangedMail } = require('../utils/mailer');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Only ADMIN_EMAIL gets admin role — everyone else is always 'user'
    const adminEmail = process.env.ADMIN_EMAIL;
    const role =
      adminEmail && email.toLowerCase().trim() === adminEmail.toLowerCase().trim()
        ? 'admin'
        : 'user';

    const user = await User.create({ name, email, password, role, welcomeEmailSent: true });
    const token = generateToken(user._id);
    res.status(201).json({ token, user });

    // Send welcome email (non-blocking — never delays the response)
    sendMail({
      to: user.email,
      ...welcomeMail({
        userName: user.name,
        email: user.email,
        shopUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/shop`,
      }),
    }).then(() => {
      console.log(`📧 Welcome email sent to ${user.email}`);
    }).catch((err) => {
      console.error(`❌ Welcome email failed for ${user.email}:`, err.message, err.stack);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.isActive) return res.status(403).json({ error: 'Account is deactivated. Contact support.' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // Auto-promote ADMIN_EMAIL user to admin role (case-insensitive)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase() && user.role !== 'admin') {
      user.role = 'admin';
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential required' });

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) return res.status(400).json({ error: 'No email from Google account' });

    // Upsert user — find by email or googleId
    let user = await User.findOne({ $or: [{ email }, { googleId }] });

    const adminEmail = process.env.ADMIN_EMAIL;
    const role =
      adminEmail && email.toLowerCase().trim() === adminEmail.toLowerCase().trim()
        ? 'admin'
        : 'user';

    if (!user) {
      // New user via Google — no password needed
      user = await User.create({
        name,
        email,
        googleId,
        avatar: picture,
        role,
        welcomeEmailSent: true,
        // Random password so the schema doesn't reject (won't be used)
        password: require('crypto').randomBytes(32).toString('hex'),
      });

      // Welcome email (non-blocking)
      sendMail({
        to: user.email,
        ...welcomeMail({
          userName: user.name,
          email: user.email,
          shopUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/shop`,
        }),
      }).then(() => console.log(`📧 Welcome email sent to ${user.email}`))
        .catch((err) => console.error('Welcome email failed:', err.message));
    } else {
      // Existing user — patch googleId/avatar if missing
      if (!user.googleId) user.googleId = googleId;
      if (!user.avatar && picture) user.avatar = picture;
      if (adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase() && user.role !== 'admin') {
        user.role = 'admin';
      }
      user.lastLogin = new Date();

      // Send welcome email if they never received one (e.g. created via password then linked Google)
      if (!user.welcomeEmailSent) {
        user.welcomeEmailSent = true;
        sendMail({
          to: user.email,
          ...welcomeMail({
            userName: user.name,
            email: user.email,
            shopUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/shop`,
          }),
        }).then(() => console.log(`📧 Welcome email sent to ${user.email}`))
          .catch((err) => console.error('Welcome email failed:', err.message));
      }

      await user.save({ validateBeforeSave: false });
    }

    if (!user.isActive) return res.status(403).json({ error: 'Account is deactivated. Contact support.' });

    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Google authentication failed' });
  }
};

// ── Forgot Password ───────────────────────────────────────────────────────────
// Always returns the same message to prevent account enumeration
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const GENERIC = "If an account exists for this email, we've sent a password reset link.";

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json({ message: GENERIC }); // don't reveal non-existence

    // Expire any existing unused tokens for this user
    await PasswordResetToken.updateMany(
      { userId: user._id, used: false },
      { used: true }
    );

    // Generate a cryptographically secure 64-byte raw token
    const rawToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;

    sendMail({
      to: user.email,
      ...passwordResetMail({ userName: user.name, resetUrl }),
    }).catch((err) => console.error('Password reset email failed:', err.message));

    res.json({ message: GENERIC });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Validate Reset Token ──────────────────────────────────────────────────────
exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ valid: false, error: 'Token required' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await PasswordResetToken.findOne({ tokenHash, used: false });

    if (!record || record.expiresAt < new Date()) {
      return res.json({ valid: false });
    }
    res.json({ valid: true });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
};

// ── Reset Password ────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword))
      return res.status(400).json({ error: 'Password must contain letters and numbers' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await PasswordResetToken.findOne({ tokenHash, used: false });

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired' });
    }

    const user = await User.findById(record.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update password (pre-save hook will hash it)
    user.password = newPassword;
    // Rotate JWT secret per-user by bumping a passwordChangedAt field
    // so old tokens issued before this moment are rejected on next use
    user.passwordChangedAt = new Date();
    await user.save();

    // Mark token used and expire all other tokens for this user
    await PasswordResetToken.updateMany({ userId: user._id }, { used: true });

    sendMail({
      to: user.email,
      ...passwordChangedMail({ userName: user.name }),
    }).catch((err) => console.error('Password changed email failed:', err.message));

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Change Password (authenticated) ──────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'All fields required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword))
      return res.status(400).json({ error: 'Password must contain letters and numbers' });

    const user = await User.findById(req.user._id);
    if (!user || !user.password) return res.status(400).json({ error: 'Cannot change password for Google-only accounts' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });

    user.password = newPassword;
    // Bumping passwordChangedAt invalidates all previously issued JWTs
    user.passwordChangedAt = new Date();
    await user.save();

    sendMail({
      to: user.email,
      ...passwordChangedMail({ userName: user.name }),
    }).catch((err) => console.error('Password changed email failed:', err.message));

    // Issue a fresh token so the current session stays alive
    const newToken = generateToken(user._id);
    res.json({ message: 'Password updated successfully', token: newToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
