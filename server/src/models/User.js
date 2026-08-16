import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
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
    // Hidden accounts are deactivated by an admin: they cannot log in, are
    // excluded from ride dispatch and surge counts, but remain in the admin
    // lists so they can be restored (unhide).
    isHidden: { type: Boolean, default: false },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    rating: { type: Number, default: 5 },
    ratingsCount: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    totalRides: { type: Number, default: 0 },
    currentRide: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },

    // Terms & Conditions
    termsAcceptedAt: { type: Date, default: null },
    termsVersion: { type: String, default: '' },

    // Warnings issued by admin (visible to the user as in-app banners)
    warnings: [
      {
        message: String,
        issuedAt: { type: Date, default: Date.now },
        issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    // Suspension: time-limited or permanent ban until admin reinstates.
    suspension: {
      active: { type: Boolean, default: false },
      until: { type: Date, default: null }, // null = permanent
      reason: { type: String, default: '' },
      issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      issuedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  obj.id = obj._id; // ensure id is available (some clients expect it)
  delete obj.password; // never expose the password hash
  delete obj.resetCode; // password-reset codes are secrets too
  delete obj.resetExpires;
  delete obj.faceDescriptor; // biometric data never leaves the server
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
