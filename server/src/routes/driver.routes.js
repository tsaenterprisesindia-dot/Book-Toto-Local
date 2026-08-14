import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Ride from '../models/Ride.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitRideUpdate, clearDispatchTimer, toRideDTO, dispatchNext } from '../socket.js';

export default function driverRoutes(io) {
  const router = Router();
  router.use(requireAuth, requireRole('driver'));

  const requireApproved = (req, res, next) => {
    if (req.userDoc.driverStatus !== 'approved') {
      return res.status(403).json({ message: 'Your driver account is not approved yet' });
    }
    return next();
  };

  router.post('/online', requireApproved, async (req, res, next) => {
    try {
      const online = !!req.body.online;
      const location = req.body.location || req.userDoc.location;
      const driver = await User.findByIdAndUpdate(
        req.user.id,
        { isOnline: online, location },
        { new: true }
      ).select('-password');
      res.json({ user: driver.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/location', requireApproved, async (req, res, next) => {
    try {
      const { lat, lng } = req.body;
      if (lat == null || lng == null) return res.status(400).json({ message: 'lat/lng required' });
      const driver = await User.findByIdAndUpdate(
        req.user.id,
        { 'location.lat': lat, 'location.lng': lng },
        { new: true }
      ).select('-password');
      res.json({ user: driver.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  const assignedRide = async (req, res, next) => {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (String(ride.driver) !== String(req.user.id)) {
      return res.status(403).json({ message: 'This ride is not assigned to you' });
    }
    req.ride = ride;
    return next();
  };

  router.post('/accept/:id', requireApproved, async (req, res, next) => {
    try {
      const ride = await Ride.findById(req.params.id);
      if (!ride) return res.status(404).json({ message: 'Ride not found' });
      if (ride.status !== 'requested') {
        return res.status(400).json({ message: 'This ride is no longer available' });
      }
      if (!req.userDoc.isOnline || req.userDoc.currentRide) {
        return res.status(400).json({ message: 'You must be online with no active ride to accept' });
      }

      clearDispatchTimer(ride._id);
      ride.driver = req.user.id;
      ride.status = 'assigned';
      ride.acceptedAt = new Date();
      ride.pendingDrivers = [];
      await ride.save();

      await User.findByIdAndUpdate(req.user.id, { currentRide: ride._id, isOnline: true });

      const dto = await toRideDTO(ride._id);
      emitRideUpdate(io, ride._id);
      res.json({ ride: dto });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reject/:id', requireApproved, async (req, res, next) => {
    try {
      const ride = await Ride.findById(req.params.id);
      if (!ride || ride.status !== 'requested') {
        return res.status(200).json({ message: 'ok' });
      }
      if (!ride.pendingDrivers.length) {
        return res.status(200).json({ message: 'ok' });
      }
      // Hand the request to the next nearest driver right away
      await dispatchNext(io, ride._id);
      res.json({ message: 'Rejected' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/arrived/:id', requireApproved, assignedRide, async (req, res, next) => {
    try {
      if (req.ride.status !== 'assigned') {
        return res.status(400).json({ message: `Ride is ${req.ride.status}` });
      }
      req.ride.status = 'driver_arrived';
      req.ride.arrivedAt = new Date();
      await req.ride.save();
      emitRideUpdate(io, req.ride._id);
      res.json({ ride: await toRideDTO(req.ride._id) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/start/:id', requireApproved, assignedRide, async (req, res, next) => {
    try {
      if (!['assigned', 'driver_arrived'].includes(req.ride.status)) {
        return res.status(400).json({ message: `Ride is ${req.ride.status}` });
      }
      req.ride.status = 'in_progress';
      req.ride.startedAt = new Date();
      await req.ride.save();
      emitRideUpdate(io, req.ride._id);
      res.json({ ride: await toRideDTO(req.ride._id) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/complete/:id', requireApproved, assignedRide, async (req, res, next) => {
    try {
      if (req.ride.status !== 'in_progress') {
        return res.status(400).json({ message: `Ride is ${req.ride.status}` });
      }
      req.ride.status = 'completed';
      req.ride.completedAt = new Date();
      await req.ride.save();

      await User.findByIdAndUpdate(req.user.id, {
        currentRide: null,
        isOnline: true,
        $inc: { totalRides: 1, earnings: req.ride.fare },
      });
      emitRideUpdate(io, req.ride._id);
      res.json({ ride: await toRideDTO(req.ride._id) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/summary', async (req, res, next) => {
    try {
      const completed = await Ride.find({
        driver: req.user.id,
        status: 'completed',
      }).sort({ createdAt: -1 }).limit(20).select('fare payment createdAt drop pickup distanceKm');

      const totals = await Ride.aggregate([
        { $match: { driver: new mongoose.Types.ObjectId(req.user.id), status: 'completed' } },
        { $group: { _id: null, revenue: { $sum: '$fare' }, count: { $sum: 1 } } },
      ]);

      const online = await User.find({
        role: 'driver',
        isOnline: true,
        driverStatus: 'approved',
      }).countDocuments();

      res.json({
        completed,
        totals: totals[0] || { revenue: 0, count: 0 },
        online,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
