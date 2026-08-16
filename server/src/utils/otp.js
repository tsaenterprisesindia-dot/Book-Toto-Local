import bcrypt from 'bcryptjs';

// In-memory OTP store. OTPs are hashed, single-use, expire after OTP_TTL_MS,
// and are limited to MAX_ATTEMPTS tries. There is no SMS gateway in this demo
// app, so the code is returned to the client as a "demo SMS" (mirrors the
// forgot-password demo code). Swap the response with a real SMS provider call
// in production.

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_STORED = 300;
const store = new Map(); // `${purpose}:${phone}` -> { hash, expiresAt, attempts }

const keyFor = (phone, purpose) => `${purpose}:${phone}`;

// Generates a 6-digit OTP and returns the plaintext code (the demo SMS body).
export async function createOtp(phone, purpose) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const key = keyFor(phone, purpose);
  store.set(key, {
    hash: await bcrypt.hash(code, 10),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  if (store.size > MAX_STORED) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }

  return code;
}

// Verifies and consumes an OTP. Returns true only for a correct, unexpired,
// within-attempt-limit code.
export async function verifyOtp(phone, purpose, code) {
  if (!phone || code === undefined || code === null) return false;
  const key = keyFor(phone, purpose);
  const entry = store.get(key);
  if (!entry) return false;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return false;
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    return false;
  }
  entry.attempts += 1;

  const ok = await bcrypt.compare(String(code).trim(), entry.hash);
  if (ok) store.delete(key); // single-use
  return ok;
}
