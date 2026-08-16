// Indian mobile normalization: strips spaces/dashes, removes a leading +91/91
// or 0, and returns a plain 10-digit number. Returns null if invalid.
export function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

// Returns a friendly "90xxx xxxxx" display form for a stored/normalized number.
export function displayPhone(input) {
  const digits = normalizePhone(input);
  if (!digits) return input || '';
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}
