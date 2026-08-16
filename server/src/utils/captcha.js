// Offline math captcha for the admin login. Challenges are held in memory,
// single-use, and expire after CAPTCHA_TTL_MS. No internet or external service
// required, so it works identically in the Android app and the web app.

const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const CAPTCHA_MAX_STORED = 100;
const store = new Map(); // id -> { answer, expiresAt }

function randomInt(max) {
  return Math.floor(Math.random() * max) + 1;
}

function createCaptcha() {
  const a = randomInt(20);
  const b = randomInt(20);
  const op = Math.random() < 0.5 ? '+' : '*';
  const answer = op === '+' ? a + b : a * b;
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const entry = { answer: String(answer), expiresAt: Date.now() + CAPTCHA_TTL_MS };
  store.set(id, entry);

  if (store.size > CAPTCHA_MAX_STORED) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }

  return { id, question: `${a} ${op} ${b} = ?` };
}

// Returns true and consumes the challenge only on a correct, unexpired answer.
function verifyCaptcha(id, answer) {
  if (!id || answer === undefined || answer === null) return false;
  const entry = store.get(id);
  if (!entry) return false;
  store.delete(id); // single-use
  if (Date.now() > entry.expiresAt) return false;
  return String(answer).trim() === entry.answer;
}

export { createCaptcha, verifyCaptcha };
