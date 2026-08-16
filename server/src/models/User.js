import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, default: '' },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['rider', 'driver', 'admin'],
      default: 'rider',
    },

    // Face recognition login (rider/driver only)
    faceDescriptor: { type: [Number], default: [] },
    faceRegistered: { type: Boolean, default: false },

    // Password reset (demo: code is hashed on the user record, returned as "demo email")
    resetCode: { type: String, default: null },
    resetExpires: { type: Date, default: null },

    // Driver profile
    vehicleType: { type: String, default: 'Toto (E-Rickshaw)' },
    vehicleNumber: { type: String, default: '' },
    driverStatus: {
      type: String,
      enum: ['pending', 'approved', 'blocked'],
      default: 'pending',
    },
    isOnline: { type: Boolean, default: false },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    rating: { type: Number, default: 5 },
    ratingsCount: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    totalRides: { type: Number, default: 0 },
    currentRide: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.password; // never expose the password hash
  delete obj.resetCode; // password-reset codes are secrets too
  delete obj.resetExpires;
  delete obj.faceDescriptor; // biometric data never leaves the server
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
