import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'super-toto-dev-secret', {
    expiresIn: '7d',
  });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'super-toto-dev-secret');
    req.user = { id: payload.id, role: payload.role };
    const user = await User.findById(payload.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists' });
    }
    if (user.isHidden) {
      return res.status(403).json({ message: 'This account has been deactivated. Contact the admin.' });
    }
    // Auto-expire time-limited suspensions.
    if (user.suspension?.active && user.suspension.until && user.suspension.until <= new Date()) {
      user.suspension.active = false;
      await user.save();
    }
    if (user.suspension?.active) {
      const until = user.suspension.until;
      const when = until ? ` until ${until.toLocaleDateString('en-IN')}` : '';
      return res.status(403).json({
        message: `Service suspended${when}: ${user.suspension.reason || 'violations of terms'}`,
      });
    }
    req.userDoc = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Session expired, please log in again' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do this' });
    }
    return next();
  };
}
