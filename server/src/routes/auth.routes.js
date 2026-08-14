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

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.userDoc.toSafeJSON() });
  });

  return router;
}
