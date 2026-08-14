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

export function moveToward(from, to, stepKm) {
  if (!from || !to) return from;
  const d = haversineKm(from, to);
  if (d < stepKm) return to;
  const f = stepKm / d;
  return {
    lat: from.lat + (to.lat - from.lat) * f,
    lng: from.lng + (to.lng - from.lng) * f,
  };
}

export function jitter(base, radius = 0.003) {
  const ang = Math.random() * Math.PI * 2;
  const dist = Math.random() * radius;
  return {
    lat: base.lat + dist * Math.cos(ang),
    lng: base.lng + dist * Math.sin(ang),
  };
}

export function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const DESTINATIONS = [
  { name: 'M.G. Marg', lat: 27.3358, lng: 88.614 },
  { name: 'Zero Point (Tashi View Point)', lat: 27.3653, lng: 88.6118 },
  { name: 'Paljor Stadium', lat: 27.3381, lng: 88.6146 },
  { name: 'Deorali', lat: 27.3231, lng: 88.6177 },
  { name: 'Tadong', lat: 27.3144, lng: 88.6128 },
  { name: 'Tibet Road', lat: 27.3338, lng: 88.615 },
  { name: 'SNT Bus Stand', lat: 27.3314, lng: 88.6193 },
  { name: 'Ranka / Baluwakhani', lat: 27.3229, lng: 88.6265 },
];

export const STATUS_LABELS = {
  requested: 'Searching for a toto',
  assigned: 'Driver assigned',
  driver_arrived: 'Driver arrived at pickup',
  in_progress: 'On the way',
  completed: 'Ride completed',
  cancelled_by_rider: 'Cancelled by rider',
  cancelled_by_driver: 'Cancelled by driver',
  no_driver: 'No driver available',
};
