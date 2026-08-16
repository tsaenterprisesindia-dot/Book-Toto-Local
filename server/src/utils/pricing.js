export const PRICING = {
  base: 30, // INR
  perKm: 14,
  perMin: 1.5,
  minimum: 40,
  avgSpeedKmh: 20,
  searchRadiusKm: 6,
  surgeFloor: 1.0,
  surgeCeil: 1.6,
  gstRate: 0.05, // 5% GST on the gross fare
  commissionRate: 0.15, // 15% platform commission on the gross fare
  cancellationFee: 20, // rider is charged when cancelling after a driver accepts
};

// ---- Face recognition helpers ----
// face-api.js descriptors are 128-dim. We L2-normalize defensively (the model
// already returns unit vectors) and verify using Euclidean distance, the
// canonical metric for face-api.js. FACE_MATCH_THRESHOLD is the max distance
// to accept as a genuine match (default 0.6).
export function normalize(vec = []) {
  const len = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / len);
}

export function faceDistance(a = [], b = []) {
  if (!a || !b || a.length !== b.length || a.length === 0) return Infinity;
  const na = normalize(a);
  const nb = normalize(b);
  let sum = 0;
  for (let i = 0; i < na.length; i++) sum += (na[i] - nb[i]) ** 2;
  return Math.sqrt(sum);
}

export function FACE_THRESHOLD() {
  return Number(process.env.FACE_MATCH_THRESHOLD || 0.6);
}

export function faceMatch(stored, probe) {
  const distance = faceDistance(stored, probe);
  return { distance, matched: distance <= FACE_THRESHOLD() };
}

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return 0;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function estimate(distanceKm) {
  const durationMin = (distanceKm / PRICING.avgSpeedKmh) * 60;
  return { distanceKm, durationMin: Math.max(2, Math.round(durationMin)) };
}

export function computeSurge(activeRequests, onlineDrivers) {
  const online = Math.max(onlineDrivers, 1);
  const ratio = activeRequests / online;
  // No surge while supply comfortably covers demand (ratio <= 0.6).
  // Otherwise scale linearly from 1.0 up to the surge ceiling.
  const surge =
    ratio <= 0.6
      ? 1.0
      : Math.min(PRICING.surgeCeil, 1 + (ratio - 0.6) * 0.5);
  return Math.round(surge * 100) / 100;
}

export function computeFare(distanceKm, durationMin, surge = 1) {
  const base = PRICING.base;
  const distance = Math.round(distanceKm * PRICING.perKm);
  const time = Math.round(durationMin * PRICING.perMin);
  const raw = base + distance + time;
  const subtotal = Math.max(raw, PRICING.minimum); // fare before surge & tax
  const gross = Math.round(subtotal * surge); // what the fare earns pre-tax
  const gst = Math.round(gross * PRICING.gstRate); // 5% GST paid by the rider
  const commission = Math.round(gross * PRICING.commissionRate); // platform cut
  const driverEarnings = gross - commission; // what the driver keeps
  const total = gross + gst; // what the rider is charged (incl. GST)
  return {
    base,
    distance,
    time,
    surge,
    subtotal,
    gross,
    gst,
    commission,
    driverEarnings,
    total,
  };
}
