import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';

export default function authRoutes() {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      const { name, email, phone, password, role, vehicleType, vehicleNumber } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email and password are required' });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) {
        return res.status(409).json({ message: 'An account with this email already exists' });
      }

      const userRole = ['rider', 'driver'].includes(role) ? role : 'rider';
      const hashed = await bcrypt.hash(password, 10);

      const user = await User.create({
        name,
        email,
        phone,
        password: hashed,
        role: userRole,
        vehicleType: userRole === 'driver' ? vehicleType || 'Toto (E-Rickshaw)' : undefined,
        vehicleNumber: userRole === 'driver' ? vehicleNumber || '' : undefined,
        driverStatus: userRole === 'driver' ? 'pending' : undefined,
      });

      const token = signToken(user);
      res.status(201).json({ token, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+password');
      if (!user || !(await bcrypt.compare(password || '', user.password))) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const token = signToken(user);
      res.json({ token, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  // Face recognition login for riders/drivers (admins use password only).
  router.post('/face-login', async (req, res, next) => {
    try {
      const { email, descriptor } = req.body;
      if (!email || !Array.isArray(descriptor)) {
        return res.status(400).json({ message: 'Email and descriptor are required' });
      }
      const user = await User.findOne({ email: (email || '').toLowerCase() });
      if (!user) return res.status(401).json({ message: 'No account for this email' });
      if (user.role === 'admin') {
        return res.status(403).json({ message: 'Admin must log in with password' });
      }
      if (!user.faceRegistered || !user.faceDescriptor.length) {
        return res.status(403).json({ message: 'No face enrolled. Log in with password and register your face first.' });
      }

      const { faceMatch } = await import('../utils/pricing.js');
      const { distance, matched } = faceMatch(user.faceDescriptor, descriptor);
      if (!matched) return res.status(401).json({ message: 'Face did not match', distance });

      const token = signToken(user);
      res.json({ token, user: user.toSafeJSON(), distance });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.userDoc.toSafeJSON() });
  });

  return router;
}
