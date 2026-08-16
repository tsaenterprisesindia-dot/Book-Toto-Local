import Settings from '../models/Settings.js';
import { PRICING } from '../utils/pricing.js';

// Merges stored (admin-editable) pricing values over the compiled defaults.
export async function getPricingConfig() {
  const doc = await Settings.findOne();
  const stored = doc?.pricing || {};
  const cfg = { ...PRICING };
  for (const key of Object.keys(stored)) {
    const value = stored[key];
    if (key in cfg && typeof value === 'number' && Number.isFinite(value)) {
      cfg[key] = value;
    }
  }
  return cfg;
}

// Validates and persists pricing overrides. Returns the merged config.
export async function savePricingConfig(input = {}) {
  const doc = (await Settings.findOne()) || new Settings();
  const clean = {};
  for (const key of Object.keys(PRICING)) {
    if (input[key] === undefined || input[key] === null || input[key] === '') continue;
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < 0) continue;
    clean[key] = value;
  }
  doc.pricing = clean;
  await doc.save();
  return { ...PRICING, ...clean };
}
