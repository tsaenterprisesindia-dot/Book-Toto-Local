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
      const [riders, drivers, hiddenRiders, hiddenDrivers, suspendedRiders, suspendedDrivers, rides, online, completed, cancelled, methods, collected] =
        await Promise.all([
          User.countDocuments({ role: 'rider' }),
          User.countDocuments({ role: 'driver' }),
          User.countDocuments({ role: 'rider', isHidden: true }),
          User.countDocuments({ role: 'driver', isHidden: true }),
          User.countDocuments({ role: 'rider', 'suspension.active': true }),
          User.countDocuments({ role: 'driver', 'suspension.active': true }),
          Ride.countDocuments(),
          User.countDocuments({ role: 'driver', isOnline: true, driverStatus: 'approved', isHidden: false, 'suspension.active': false }),
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
          hiddenRiders,
          hiddenDrivers,
          suspendedRiders,
          suspendedDrivers,
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
      else if (action === 'reinstate') {
        driver.isHidden = false;
        driver.suspension = { active: false, until: null, reason: '', issuedBy: null, issuedAt: null };
        driver.driverStatus = 'approved';
      }
      else return res.status(400).json({ message: 'Unknown action' });

      if (driver.driverStatus !== 'approved') driver.isOnline = false;
      if (driver.isHidden) driver.isOnline = false;
      await driver.save();
      res.json({ driver: driver.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  // --- Enforcement: warn, suspend, reinstate, clear-warnings ----------------

  // Warn a user (rider or driver). The warning is visible to the user as an
  // in-app banner. Multiple warnings are cumulative and may lead to suspension.
  router.post('/warn/:id', async (req, res, next) => {
    try {
      const { message } = req.body || {};
      if (!message || !message.trim()) return res.status(400).json({ message: 'Warning message is required' });
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.warnings.push({ message: message.trim(), issuedAt: new Date(), issuedBy: req.userDoc._id });
      await user.save();
      res.json({ user: user.toSafeJSON(), message: 'Warning issued' });
    } catch (err) { next(err); }
  });

  // Suspend (ban) a user for a specific period or permanently.
  //   until: ISO date string  → temporary suspension (auto-expires)
  //   until: null / omitted   → permanent suspension until admin reinstates
  //   settlementConfirmed: true → required when the user has outstanding financials
  router.post('/suspend/:id', async (req, res, next) => {
    try {
      const { reason, until, settlementConfirmed } = req.body || {};
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (user.role === 'admin') return res.status(400).json({ message: 'Admin accounts cannot be suspended' });

      // --- Financial settlement gate ---
      // For permanent suspensions (or any suspension of a user with outstanding
      // financials), require explicit settlement confirmation from the admin.
      const isPermanent = !until;
      let outstandingAmount = 0;
      if (user.role === 'rider') {
        const outstanding = await Ride.aggregate([
          { $match: { rider: user._id, status: { $in: ['completed', 'cancelled_by_rider'] }, payment: { $ne: null }, 'payment.status': { $in: ['pending', 'cash_pending'] } } },
          { $group: { _id: null, total: { $sum: '$payment.amount' }, count: { $sum: 1 } } },
        ]);
        outstandingAmount = outstanding[0]?.total || 0;
      } else if (user.role === 'driver') {
        outstandingAmount = user.earnings || 0; // pending payout
      }

      if (outstandingAmount > 0 && !settlementConfirmed) {
        return res.status(409).json({
          message: `This user has ₹${outstandingAmount.toLocaleString('en-IN')} in outstanding financials. Confirm settlement before suspending.`,
          outstandingAmount,
          requiresSettlement: true,
        });
      }

      user.suspension = {
        active: true,
        until: until ? new Date(until) : null,
        reason: (reason || '').trim() || 'Violations of terms of service',
        issuedBy: req.userDoc._id,
        issuedAt: new Date(),
      };
      user.isOnline = false; // force offline on suspension
      await user.save();
      res.json({ user: user.toSafeJSON(), message: 'User suspended' });
    } catch (err) { next(err); }
  });

  // Reinstate a suspended / hidden user.
  // Clears suspension, isHidden, and (for drivers) resets to approved.
  router.post('/reinstate/:id', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.suspension = { active: false, until: null, reason: '', issuedBy: null, issuedAt: null };
      user.isHidden = false;
      if (user.role === 'driver') user.driverStatus = 'approved';
      await user.save();
      res.json({ user: user.toSafeJSON(), message: 'User reinstated' });
    } catch (err) { next(err); }
  });

  // Remove a specific warning from a user's record.
  router.delete('/warnings/:userId/:warningId', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const idx = user.warnings.findIndex((w) => String(w._id) === req.params.warningId);
      if (idx === -1) return res.status(404).json({ message: 'Warning not found' });
      user.warnings.splice(idx, 1);
      await user.save();
      res.json({ user: user.toSafeJSON(), message: 'Warning removed' });
    } catch (err) { next(err); }
  });

  // Clear all warnings for a user.
  router.delete('/warnings/:userId', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      user.warnings = [];
      await user.save();
      res.json({ user: user.toSafeJSON(), message: 'All warnings cleared' });
    } catch (err) { next(err); }
  });

  // --- End enforcement -----------------------------------------------------

  // Financial summary for a user: outstanding dues for riders, pending payout
  // for drivers. Used by the admin to verify settlement before suspension.
  router.get('/financial-summary/:id', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      if (user.role === 'rider') {
        // Outstanding ride payments: paid via digital method but still pending, or cash not yet collected.
        const outstanding = await Ride.aggregate([
          {
            $match: {
              rider: user._id,
              status: { $in: ['completed', 'cancelled_by_rider'] },
              payment: { $ne: null },
              'payment.status': { $in: ['pending', 'cash_pending'] },
            },
          },
          {
            $group: {
              _id: null,
              totalOutstanding: { $sum: '$payment.amount' },
              rideCount: { $sum: 1 },
              rides: { $push: { _id: '$_id', fare: '$fare', status: '$status', paymentStatus: '$payment.status', method: '$payment.method' } },
            },
          },
        ]);

        const totalSpent = await Ride.aggregate([
          { $match: { rider: user._id, status: 'completed', 'payment.status': 'paid' } },
          { $group: { _id: null, total: { $sum: '$fare' } } },
        ]);

        res.json({
          role: 'rider',
          totalOutstanding: outstanding[0]?.totalOutstanding || 0,
          outstandingRides: outstanding[0]?.rideCount || 0,
          outstandingDetails: outstanding[0]?.rides || [],
          totalSpent: totalSpent[0]?.total || 0,
        });
      } else if (user.role === 'driver') {
        // Driver earnings: total earned from completed rides.
        const earnings = await Ride.aggregate([
          { $match: { driver: user._id, status: 'completed' } },
          {
            $group: {
              _id: null,
              totalEarned: { $sum: '$fareBreakup.driverEarnings' },
              totalCommission: { $sum: '$fareBreakup.commission' },
              totalGst: { $sum: '$fareBreakup.gst' },
              rideCount: { $sum: 1 },
            },
          },
        ]);

        // Wallet balance = earnings recorded on user minus what has been paid out.
        const walletBalance = user.earnings || 0;

        res.json({
          role: 'driver',
          totalEarned: earnings[0]?.totalEarned || 0,
          totalCommission: earnings[0]?.totalCommission || 0,
          totalGst: earnings[0]?.totalGst || 0,
          completedRides: earnings[0]?.rideCount || 0,
          walletBalance,
          // pending payout = wallet balance (what the driver should receive)
          pendingPayout: walletBalance,
        });
      } else {
        res.json({ role: 'admin', totalOutstanding: 0, pendingPayout: 0 });
      }
    } catch (err) { next(err); }
  });

  // --- End financial settlement --------------------------------------------

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
      const { action } = req.body; // hide | unhide | reinstate
      const rider = await User.findById(req.params.id);
      if (!rider || rider.role !== 'rider') {
        return res.status(404).json({ message: 'Rider not found' });
      }
      if (action === 'hide') rider.isHidden = true;
      else if (action === 'unhide') rider.isHidden = false;
      else if (action === 'reinstate') {
        rider.isHidden = false;
        rider.suspension = { active: false, until: null, reason: '', issuedBy: null, issuedAt: null };
      }
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
