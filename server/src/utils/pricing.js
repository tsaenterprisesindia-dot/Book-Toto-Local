export const PRICING = {
  base: 30, // INR
  perKm: 14,
  perMin: 1.5,
  minimum: 40,
  avgSpeedKmh: 20,
  searchRadiusKm: 6,
  surgeFloor: 1.0,
  surgeCeil: 1.6,
};

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

export function computeFare(distanceKm, durationMin, surge = 1) {
  const base = PRICING.base;
  const distance = Math.round(distanceKm * PRICING.perKm);
  const time = Math.round(durationMin * PRICING.perMin);
  const raw = base + distance + time;
  const subTotal = Math.max(raw, PRICING.minimum);
  const total = Math.round(subTotal * surge);
  return { base, distance, time, surge, total };
}
