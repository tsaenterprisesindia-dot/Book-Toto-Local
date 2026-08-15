import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { faceMatch } from '../utils/pricing.js';

// Face recognition management for riders/drivers (admin uses password only).
export default function faceRoutes() {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('rider', 'driver'));

  // Store a face descriptor (called once the user's selfie has been captured).
  router.post('/register', async (req, res, next) => {
    try {
      const { descriptor } = req.body;
      if (!Array.isArray(descriptor) || descriptor.length !== 128) {
        return res.status(400).json({ message: 'A valid 128-dimension face descriptor is required' });
      }
      if (req.user.role === 'admin') {
        return res.status(403).json({ message: 'Admins do not use face login' });
      }
      const user = await User.findById(req.user.id);
      user.faceDescriptor = descriptor;
      user.faceRegistered = true;
      await user.save();
      res.json({ message: 'Face registered', faceRegistered: true });
    } catch (err) {
      next(err);
    }
  });

  // Live verification of a selfie descriptor against the enrolled face.
  router.post('/verify', async (req, res, next) => {
    try {
      const { descriptor } = req.body;
      if (!Array.isArray(descriptor)) return res.status(400).json({ message: 'descriptor required' });
      const user = req.userDoc;
      if (!user.faceRegistered || !user.faceDescriptor.length) {
        return res.status(404).json({ message: 'No face enrolled yet' });
      }
      const { distance, matched } = faceMatch(user.faceDescriptor, descriptor);
      res.json({ distance, matched });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
