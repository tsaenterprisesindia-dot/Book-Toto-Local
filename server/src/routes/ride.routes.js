import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Ride from '../models/Ride.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  haversineKm,
  estimate,
  computeFare,
  computeSurge,
} from '../utils/pricing.js';
import { getPricingConfig } from '../services/settings.js';
import {
  dispatchRideRequest,
  emitRideUpdate,
  clearDispatchTimer,
} from '../socket.js';

const PAYMENT_METHODS = ['UPI', 'Cash', 'Card'];

async function surgeContext() {
  const [activeRequests, onlineDrivers] = await Promise.all([
    Ride.countDocuments({ status: 'requested' }),
    User.countDocuments({
      role: 'driver',
      driverStatus: 'approved',
      isOnline: true,
      currentRide: null,
      'location.lat': { $ne: null },
    }),
  ]);
  return { activeRequests, onlineDrivers };
}

export default function rideRoutes(io) {
  const router = Router();
  router.use(requireAuth);

  router.post('/estimate', async (req, res, next) => {
    try {
      const { pickup, drop } = req.body;
      if (!pickup?.lat || !pickup?.lng || !drop?.lat || !drop?.lng) {
        return res.status(400).json({ message: 'Pickup and drop locations are required' });
      }
      const distanceKm = haversineKm(pickup, drop);
      const { activeRequests, onlineDrivers } = await surgeContext();
      const cfg = await getPricingConfig();
      const { durationMin } = estimate(distanceKm, cfg);
      const surge = computeSurge(activeRequests, onlineDrivers, cfg);
      const fare = computeFare(distanceKm, durationMin, surge, cfg);
      res.json({
        distanceKm: +distanceKm.toFixed(2),
        durationMin,
        fare,
        surge,
        activeRequests,
        onlineDrivers,
      });
    } catch (err) {
      next(err);
    }
  });

  // Rider requests a toto
  router.post('/', requireRole('rider'), async (req, res, next) => {
    try {
      const { pickup, drop } = req.body;
      if (!pickup?.lat || !pickup?.lng || !drop?.lat || !drop?.lng) {
        return res.status(400).json({ message: 'Pickup and drop locations are required' });
      }
      const active = await Ride.findOne({
        rider: req.user.id,
        status: { $in: ['requested', 'assigned', 'driver_arrived', 'in_progress'] },
      });
      if (active) {
        return res.status(409).json({ message: 'You already have an active ride', rideId: active._id });
      }

      const distanceKm = haversineKm(pickup, drop);
      const { activeRequests, onlineDrivers } = await surgeContext();
      const cfg = await getPricingConfig();
      const { durationMin } = estimate(distanceKm, cfg);
      const surge = computeSurge(activeRequests, onlineDrivers, cfg);
      const fare = computeFare(distanceKm, durationMin, surge, cfg);

      const ride = await Ride.create({
        rider: req.user.id,
        pickup,
        drop,
        distanceKm: +distanceKm.toFixed(2),
        durationMin,
        fare: fare.total,
        fareBreakup: fare,
        status: 'requested',
      });

      void dispatchRideRequest(io, ride._id);
      const dto = await Ride.findById(ride._id).populate('rider', 'name phone').lean();
      res.status(201).json({ ride: dto });
    } catch (err) {
      next(err);
    }
  });

  router.get('/mine', async (req, res, next) => {
    try {
      const isDriver = req.user.role === 'driver';
      const query = isDriver ? { driver: req.user.id } : { rider: req.user.id };
      const rides = await Ride.find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('rider', 'name phone rating')
        .populate('driver', 'name phone vehicleNumber vehicleType rating');
      res.json({ rides });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).json({ message: 'Ride not found' });
      }
      const ride = await Ride.findById(req.params.id)
        .populate('rider', 'name phone rating ratingsCount')
        .populate('driver', 'name phone vehicleType vehicleNumber rating ratingsCount location');
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (
        String(ride.rider._id) !== String(req.user.id) &&
        String(ride.driver?._id) !== String(req.user.id) &&
        req.user.role !== 'admin'
      ) {
        return res.status(403).json({ message: 'Not your ride' });
      }
      res.json({ ride });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/cancel', requireRole('rider'), async (req, res, next) => {
    try {
      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (String(ride.rider) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Not your ride' });
      }
      if (!['requested', 'assigned'].includes(ride.status)) {
        return res.status(400).json({ message: `Cannot cancel a ride that is ${ride.status}` });
      }

      clearDispatchTimer(ride._id);
      ride.status = 'cancelled_by_rider';
      ride.cancelledAt = new Date();
      // The rider is charged a cancellation fee only once a driver has accepted.
      if (ride.driver) {
        const cfg = await getPricingConfig();
        ride.cancellationFee = cfg.cancellationFee;
        ride.payment.amount = cfg.cancellationFee;
        await User.findByIdAndUpdate(ride.driver, { currentRide: null, isOnline: true });
      }
      await ride.save();

      emitRideUpdate(io, ride._id);
      res.json({ message: 'Ride cancelled', cancellationFee: ride.cancellationFee });
    } catch (err) {
      next(err);
    }
  });

  // Payment - rider pays a completed ride or a cancellation fee
  router.post('/:id/pay', requireRole('rider'), async (req, res, next) => {
    try {
      const method = req.body.method || 'UPI';
      if (!PAYMENT_METHODS.includes(method)) {
        return res.status(400).json({ message: `Method must be one of: ${PAYMENT_METHODS.join(', ')}` });
      }

      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (String(ride.rider) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Not your ride' });
      }
      const isFeePayment =
        ride.status === 'cancelled_by_rider' && ride.cancellationFee > 0;
      if (ride.status !== 'completed' && !isFeePayment) {
        return res.status(400).json({ message: 'Ride is not completed yet' });
      }
      if (ride.payment.status === 'paid') {
        return res.json({ ride: await Ride.findById(ride._id).populate('driver', 'name').lean() });
      }
      if (ride.payment.status === 'cash_pending') {
        return res.json({ ride: await Ride.findById(ride._id).populate('driver', 'name').lean() });
      }

      const amount = isFeePayment ? ride.cancellationFee : ride.fare;
      ride.payment.method = method;
      ride.payment.amount = amount;
      if (method === 'Cash') {
        // Cash is collected by the driver on delivery; the driver confirms it.
        ride.payment.status = 'cash_pending';
      } else {
        // UPI / Card settle instantly (mock gateway).
        ride.payment.status = 'paid';
        ride.payment.paidAt = new Date();
      }
      await ride.save();

      emitRideUpdate(io, ride._id);
      res.json({ ride: await Ride.findById(ride._id).populate('driver', 'name').lean() });
    } catch (err) {
      next(err);
    }
  });

  // Rider rates driver OR driver rates rider
  router.post('/:id/rate', async (req, res, next) => {
    try {
      const { rating, ratedRole } = req.body;
      const value = Number(rating);
      if (!value || value < 1 || value > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      if (!['driver', 'rider'].includes(ratedRole)) {
        return res.status(400).json({ message: 'ratedRole must be driver or rider' });
      }

      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (ride.status !== 'completed') {
        return res.status(400).json({ message: 'You can only rate after the ride is completed' });
      }

      let target;
      if (ratedRole === 'driver') {
        if (String(ride.rider) !== String(req.user.id)) {
          return res.status(403).json({ message: 'Only the rider can rate the driver' });
        }
        if (ride.riderRating) return res.status(400).json({ message: 'Already rated' });
        ride.riderRating = value;
        target = ride.driver;
      } else {
        if (String(ride.driver) !== String(req.user.id)) {
          return res.status(403).json({ message: 'Only the driver can rate the rider' });
        }
        if (ride.driverRating) return res.status(400).json({ message: 'Already rated' });
        ride.driverRating = value;
        target = ride.rider;
      }
      await ride.save();

      if (target) {
        const t = await User.findById(target);
        const newCount = t.ratingsCount + 1;
        const newRating = (t.rating * t.ratingsCount + value) / newCount;
        t.rating = Math.round(newRating * 10) / 10;
        t.ratingsCount = newCount;
        await t.save();
      }

      emitRideUpdate(io, ride._id);
      res.json({ message: 'Thanks for your feedback' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
