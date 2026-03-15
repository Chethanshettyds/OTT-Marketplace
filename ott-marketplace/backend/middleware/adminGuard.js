/**
 * adminGuard — email-based admin check (case-insensitive).
 * Must be used AFTER authJWT so req.user is populated.
 * Grants access if req.user.email === ADMIN_EMAIL (case-insensitive)
 * OR if req.user.role === 'admin'.
 */
const adminGuard = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const userEmail = (req.user.email || '').toLowerCase().trim();

  const isAdminByEmail = adminEmail && userEmail === adminEmail;
  const isAdminByRole = req.user.role === 'admin';

  if (!isAdminByEmail && !isAdminByRole) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

module.exports = adminGuard;
