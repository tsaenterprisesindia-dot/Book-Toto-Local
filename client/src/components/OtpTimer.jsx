import { useState, useEffect } from 'react';

// Live mm:ss countdown until the OTP expires. Calls onExpire once when it hits zero.
export default function OtpTimer({ expiresAt, onExpire }) {
  const secondsFor = () => (expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(secondsFor);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    setLeft(secondsFor());
    const t = setInterval(() => {
      const s = secondsFor();
      setLeft(s);
      if (s <= 0) {
        clearInterval(t);
        if (!done) {
          setDone(true);
          onExpire?.();
        }
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <span className={`otp-timer${left <= 30 ? ' warn' : ''}`} role="timer" aria-label="OTP expires in">
      ⏳ {mm}:{ss}
    </span>
  );
}
