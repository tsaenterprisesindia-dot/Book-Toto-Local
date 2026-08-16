import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema(
  {
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    pickup: {
      name: { type: String, default: 'Pickup' },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    drop: {
      name: { type: String, default: 'Drop' },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },

    distanceKm: { type: Number, default: 0 },
    durationMin: { type: Number, default: 0 },
    fare: { type: Number, default: 0 }, // total charged to the rider (incl. GST)
    fareBreakup: {
      base: { type: Number, default: 0 },
      distance: { type: Number, default: 0 },
      time: { type: Number, default: 0 },
      surge: { type: Number, default: 1 },
      subtotal: { type: Number, default: 0 }, // fare before surge & tax
      gross: { type: Number, default: 0 }, // subtotal x surge
      gst: { type: Number, default: 0 }, // 5% GST collected
      commission: { type: Number, default: 0 }, // platform commission
      driverEarnings: { type: Number, default: 0 }, // gross - commission
      total: { type: Number, default: 0 },
    },
    cancellationFee: { type: Number, default: 0 }, // charged if rider cancels after a driver accepts

    status: {
      type: String,
      enum: [
        'requested',
        'assigned',
        'driver_arrived',
        'in_progress',
        'completed',
        'cancelled_by_rider',
        'cancelled_by_driver',
        'no_driver',
      ],
      default: 'requested',
    },

    payment: {
      status: {
        type: String,
        enum: ['pending', 'cash_pending', 'paid'],
        default: 'pending',
      },
      method: { type: String, default: '' }, // UPI | Cash | Card
      amount: { type: Number, default: 0 }, // amount the rider paid / owes
      paidAt: { type: Date, default: null },
    },

    riderRating: { type: Number, default: null }, // rider rates driver
    driverRating: { type: Number, default: null }, // driver rates rider

    pendingDrivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    requestedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Ride = mongoose.model('Ride', rideSchema);
export default Ride;
