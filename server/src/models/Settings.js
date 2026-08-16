import mongoose from 'mongoose';

// Singleton document holding admin-editable app configuration.
// pricing is merged over the PRICING defaults at read time.
const settingsSchema = new mongoose.Schema(
  {
    pricing: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
