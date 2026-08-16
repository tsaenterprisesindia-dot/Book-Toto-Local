import jwt from 'jsonwebtoken';
import User from './models/User.js';
import Ride from './models/Ride.js';
import { haversineKm, PRICING } from './utils/pricing.js';

const RIDE_REQUEST_TIMEOUT_MS = 25000;
const dispatchTimers = new Map();

export async function toRideDTO(rideId) {
  const ride = await Ride.findById(rideId)
    .populate('rider', 'name phone rating ratingsCount')
    .populate('driver', 'name phone vehicleType vehicleNumber rating ratingsCount location');
  return ride ? ride.toObject() : null;
}

export function emitRideUpdate(io, rideId) {
  if (!io) return;
  void toRideDTO(rideId).then((ride) => {
    if (!ride) return;
    if (ride.rider) io.to(`user:${ride.rider._id}`).emit('ride:updated', ride);
    if (ride.driver) io.to(`user:${ride.driver._id}`).emit('ride:updated', ride);
    io.to(`ride:${rideId}`).emit('ride:updated', ride);
  });
}

export function clearDispatchTimer(rideId) {
  const t = dispatchTimers.get(String(rideId));
  if (t) {
    clearTimeout(t);
    dispatchTimers.delete(String(rideId));
  }
}

export async function dispatchNext(io, rideId) {
  clearDispatchTimer(rideId);
  const ride = await Ride.findById(rideId);
  if (!ride || ride.status !== 'requested') return;

  if (!ride.pendingDrivers.length) {
    ride.status = 'no_driver';
    await ride.save();
    emitRideUpdate(io, rideId);
    return;
  }

  const driverId = ride.pendingDrivers.shift();
  await ride.save();

  const dto = await toRideDTO(rideId);
  if (!dto) return;
  io.to(`user:${driverId}`).emit('ride:request', {
    ...dto,
    timeLeftMs: RIDE_REQUEST_TIMEOUT_MS,
  });

  const timer = setTimeout(() => dispatchNext(io, rideId), RIDE_REQUEST_TIMEOUT_MS);
  dispatchTimers.set(String(rideId), timer);
}

export async function dispatchRideRequest(io, rideId) {
  const ride = await Ride.findById(rideId);
  if (!ride) return;

  const candidates = await User.find({
    role: 'driver',
    driverStatus: 'approved',
    isOnline: true,
    currentRide: null,
    'location.lat': { $ne: null },
  });

  const near = candidates
    .map((d) => ({ d, dist: haversineKm(ride.pickup, d.location) }))
    .filter((x) => x.dist <= PRICING.searchRadiusKm)
    .sort((a, b) => a.dist - b.dist);

  ride.pendingDrivers = near.map((x) => x.d._id);
  await ride.save();
  await dispatchNext(io, rideId);
}

export function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Not authenticated'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'super-toto-dev-secret');
      socket.user = { id: payload.id, role: payload.role };
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    socket.join(`user:${id}`);

    // Driver live-location streaming
    socket.on('driver:location', async (payload) => {
      if (role !== 'driver') return;
      const { lat, lng } = payload || {};
      if (lat == null || lng == null) return;

      const driver = await User.findByIdAndUpdate(
        id,
        { 'location.lat': lat, 'location.lng': lng },
        { new: true }
      );
      if (driver?.currentRide) {
        io.to(`ride:${driver.currentRide}`).emit('ride:driver_location', { lat, lng });
      }
    });

    // Driver joins the active ride room so both sides receive location events
    socket.on('ride:join', async (rideId) => {
      const ride = await Ride.findById(rideId);
      if (!ride) return;
      if (String(ride.rider) === String(id) || String(ride.driver) === String(id)) {
        socket.join(`ride:${rideId}`);
      }
    });

    socket.on('disconnect', () => {});
  });
}
