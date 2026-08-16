import { Router } from 'express';
import User from '../models/User.js';
import Ride from '../models/Ride.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getPricingConfig, savePricingConfig } from '../services/settings.js';
import { PRICING } from '../utils/pricing.js';

export default function adminRoutes() {
  const router = Router();
  router.use(requireAuth, requireRole('admin'));

  router.get('/stats', async (_req, res, next) => {
    try {
      const [riders, drivers, rides, online, completed, cancelled, methods, collected] =
        await Promise.all([
          User.countDocuments({ role: 'rider' }),
          User.countDocuments({ role: 'driver' }),
          Ride.countDocuments(),
          User.countDocuments({ role: 'driver', isOnline: true, driverStatus: 'approved', isHidden: false }),
          Ride.aggregate([
            { $match: { status: 'completed' } },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$fare' },
                paid: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$fare', 0] } },
                avgFare: { $avg: '$fare' },
                commission: { $sum: '$fareBreakup.commission' },
                gst: { $sum: '$fareBreakup.gst' },
                driverEarnings: { $sum: '$fareBreakup.driverEarnings' },
              },
            },
          ]),
          Ride.aggregate([
            { $match: { status: 'cancelled_by_rider' } },
            {
              $group: {
                _id: null,
                fees: { $sum: '$cancellationFee' },
                paidFees: {
                  $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$cancellationFee', 0] },
                },
              },
            },
          ]),
          Ride.aggregate([
            { $match: { status: 'completed' } },
            {
              $group: {
                _id: '$payment.method',
                rides: { $sum: 1 },
                amount: { $sum: '$fare' },
              },
            },
          ]),
          Ride.aggregate([
            {
              $match: {
                status: { $in: ['completed', 'cancelled_by_rider'] },
                payment: { $ne: null },
              },
            },
            {
              $group: {
                _id: null,
                outstanding: {
                  $sum: {
                    $cond: [
                      { $in: ['$payment.status', ['pending', 'cash_pending']] },
                      '$payment.amount',
                      0,
                    ],
                  },
                },
                pendingCount: {
                  $sum: {
                    $cond: [{ $in: ['$payment.status', ['pending', 'cash_pending']] }, 1, 0],
                  },
                },
              },
            },
          ]),
        ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ridesToday = await Ride.countDocuments({ createdAt: { $gte: today } });

      const methodBreakdown = {
        UPI: methods.find((m) => m._id === 'UPI') || { rides: 0, amount: 0 },
        Cash: methods.find((m) => m._id === 'Cash') || { rides: 0, amount: 0 },
        Card: methods.find((m) => m._id === 'Card') || { rides: 0, amount: 0 },
      };

      res.json({
        stats: {
          riders,
          drivers,
          rides,
          ridesToday,
          online,
          revenue: completed[0]?.revenue || 0,
          paid: completed[0]?.paid || 0,
          avgFare: Math.round(completed[0]?.avgFare || 0),
          commission: completed[0]?.commission || 0,
          gst: completed[0]?.gst || 0,
          driverEarnings: completed[0]?.driverEarnings || 0,
          cancellationFees: cancelled[0]?.fees || 0,
          cancellationFeesPaid: cancelled[0]?.paidFees || 0,
          platformRevenue:
            (completed[0]?.commission || 0) +
            (completed[0]?.gst || 0) +
            (cancelled[0]?.paidFees || 0),
          outstanding: collected[0]?.outstanding || 0,
          pendingCount: collected[0]?.pendingCount || 0,
          methods: methodBreakdown,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/drivers', async (_req, res, next) => {
    try {
      const drivers = await User.find({ role: 'driver' })
        .select('-password -resetCode -resetExpires -faceDescriptor')
        .sort({ createdAt: -1 })
        .lean();

      const counts = await Ride.aggregate([
        { $match: { driver: { $ne: null } } },
        { $group: { _id: '$driver', total: { $sum: 1 } } },
      ]);
      const map = Object.fromEntries(counts.map((c) => [String(c._id), c.total]));

      res.json({ drivers: drivers.map((d) => ({ ...d, rideCount: map[String(d._id)] || 0 })) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/drivers/:id', async (req, res, next) => {
    try {
      const { action } = req.body; // approve | block | unblock | hide | unhide
      const driver = await User.findById(req.params.id);
      if (!driver || driver.role !== 'driver') {
        return res.status(404).json({ message: 'Driver not found' });
      }
      if (action === 'approve') driver.driverStatus = 'approved';
      else if (action === 'block') driver.driverStatus = 'blocked';
      else if (action === 'unblock') driver.driverStatus = 'approved';
      else if (action === 'hide') driver.isHidden = true;
      else if (action === 'unhide') driver.isHidden = false;
      else return res.status(400).json({ message: 'Unknown action' });

      if (driver.driverStatus !== 'approved') driver.isOnline = false;
      if (driver.isHidden) driver.isOnline = false;
      await driver.save();
      res.json({ driver: driver.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.get('/riders', async (_req, res, next) => {
    try {
      const riders = await User.find({ role: 'rider' })
        .select('-password -resetCode -resetExpires -faceDescriptor')
        .sort({ createdAt: -1 });
      res.json({ riders });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/riders/:id', async (req, res, next) => {
    try {
      const { action } = req.body; // hide | unhide
      const rider = await User.findById(req.params.id);
      if (!rider || rider.role !== 'rider') {
        return res.status(404).json({ message: 'Rider not found' });
      }
      if (action === 'hide') rider.isHidden = true;
      else if (action === 'unhide') rider.isHidden = false;
      else return res.status(400).json({ message: 'Unknown action' });

      await rider.save();
      res.json({ rider: rider.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.get('/rides', async (_req, res, next) => {
    try {
      const rides = await Ride.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('rider', 'name email')
        .populate('driver', 'name vehicleNumber');
      res.json({ rides });
    } catch (err) {
      next(err);
    }
  });

  // Admin-editable pricing configuration (admin only, enforced by the router guard).
  router.get('/settings', async (_req, res, next) => {
    try {
      res.json({ settings: await getPricingConfig(), defaults: { ...PRICING } });
    } catch (err) {
      next(err);
    }
  });

  router.put('/settings', async (req, res, next) => {
    try {
      const settings = await savePricingConfig(req.body);
      res.json({ settings, message: 'Pricing settings updated' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
