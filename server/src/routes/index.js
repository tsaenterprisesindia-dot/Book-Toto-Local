import { Router } from 'express';
import authRoutes from './auth.routes.js';
import rideRoutes from './ride.routes.js';
import driverRoutes from './driver.routes.js';
import adminRoutes from './admin.routes.js';

export default function routes(io) {
  const router = Router();
  router.use('/auth', authRoutes());
  router.use('/rides', rideRoutes(io));
  router.use('/driver', driverRoutes(io));
  router.use('/admin', adminRoutes(io));
  router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  return router;
}
