import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';
import PasswordInput from '../components/PasswordInput.jsx';
import logo from '../assets/super-toto-logo.png';

const ROLES = [
  { key: 'rider', label: 'Rider' },
  { key: 'driver', label: 'Driver' },
  { key: 'admin', label: 'Admin' },
];

export default function Login() {
  const { login, otpLogin, sendOtp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('password'); // password | otp
  const [role, setRole] = useState('rider');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpPhone, setOtpPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [captcha, setCaptcha] = useState(null); // { captchaId, question }
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);

  const loadCaptcha = useCallback(() => {
    setCaptchaAnswer('');
    client.get('/auth/captcha').then(({ data }) => setCaptcha(data)).catch(() => setCaptcha(null));
  }, []);

  useEffect(() => {
    if (mode === 'password' && role === 'admin') loadCaptcha();
  }, [mode, role, loadCaptcha]);

  const quick = (mail) => {
    setEmail(mail);
    setPassword('demo123');
  };

  const pickRole = (r) => {
    setRole(r);
    setError('');
  };

  const goHome = (user) => navigate(user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/ride');

  const submitPassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const extra = role === 'admin' ? { captchaId: captcha?.captchaId, captchaAnswer } : {};
      const { user } = await login(email, password, extra);
      goHome(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      if (role === 'admin') loadCaptcha();
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    setError('');
    setDemoOtp('');
    setOtpBusy(true);
    try {
      const data = await sendOtp(otpPhone, 'login');
      setDemoOtp(data.demoOtp || '');
      setOtp('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setOtpBusy(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await otpLogin(otpPhone, otp);
      goHome(user);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP login failed');
      setOtp('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in">
        <div className="auth-title">
          <img src={logo} alt="Super Toto Local logo" className="auth-logo" /> Super Toto Local
        </div>
        <p className="muted">Log in to continue</p>

        {error && <div className="err-box">{error}</div>}

        <div className="seg-row mb">
          <button type="button" className={`seg${mode === 'password' ? ' active' : ''}`} onClick={() => setMode('password')}>
            Password
          </button>
          <button type="button" className={`seg${mode === 'otp' ? ' active' : ''}`} onClick={() => setMode('otp')}>
            Mobile OTP
          </button>
        </div>

        <div className="seg-row mb">
          {ROLES.map((r) => (
            <button
              type="button"
              key={r.key}
              className={`seg${role === r.key ? ' active' : ''}`}
              onClick={() => pickRole(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {mode === 'password' ? (
          <form onSubmit={submitPassword}>
            <div className="field">
              <label>Email or mobile</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com or +91 9xxxx xxxxx" />
            </div>
            <div className="field">
              <label>Password</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            {role === 'admin' && (
              <div className="field captcha-box">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <label style={{ marginBottom: 0 }}>Security check</label>
                  <button type="button" className="btn btn-ghost small" onClick={loadCaptcha}>↻ New</button>
                </div>
                {captcha ? (
                  <>
                    <div className="captcha-q">{captcha.question}</div>
                    <input
                      className="input"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="Your answer"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </>
                ) : (
                  <div className="small muted">Loading security check…</div>
                )}
                <div className="small muted">Admins always sign in with password + this security check.</div>
              </div>
            )}

            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp}>
            <div className="field">
              <label>Mobile number</label>
              <div className="row">
                <input
                  className="input"
                  value={otpPhone}
                  onChange={(e) => setOtpPhone(e.target.value)}
                  placeholder="+91 9xxxx xxxxx"
                  inputMode="tel"
                />
                <button type="button" className="btn btn-ghost" onClick={requestOtp} disabled={otpBusy || !otpPhone}>
                  {otpBusy ? 'Sending…' : 'Send OTP'}
                </button>
              </div>
            </div>

            {demoOtp && (
              <div className="alert alert-info mb">
                <b>Demo SMS:</b> your OTP is <b>{demoOtp}</b> (valid 5 minutes). In production this would be
                sent to your phone.
              </div>
            )}

            {otpPhone && (
              <div className="field">
                <label>One-time password</label>
                <input
                  className="input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit OTP"
                  inputMode="numeric"
                />
              </div>
            )}

            {role === 'admin' ? (
              <div className="alert alert-warn mb">Admins can't use OTP login — sign in with password and the security check.</div>
            ) : (
              <button className="btn btn-primary btn-block btn-lg" disabled={busy || !otp}>
                {busy ? 'Verifying…' : 'Log in with OTP'}
              </button>
            )}
          </form>
        )}

        <div className="small mt" style={{ textAlign: 'center' }}>
          <Link to="/face-login">Log in with Face Recognition</Link>
        </div>

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          No account? <Link to="/register">Create one</Link>
        </div>

        <div className="card mt" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
          <div className="small muted mb" style={{ fontWeight: 700 }}>
            Demo accounts (password: demo123)
          </div>
          <div className="row">
            <button className="btn btn-ghost small" onClick={() => { pickRole('rider'); quick('rider@supertoto.local'); }}>Rider</button>
            <button className="btn btn-ghost small" onClick={() => { pickRole('driver'); quick('driver@supertoto.local'); }}>Driver</button>
            <button className="btn btn-ghost small" onClick={() => { pickRole('admin'); quick('admin@supertoto.local'); }}>Admin</button>
          </div>
          <div className="small muted mt">
            OTP login demo: <b>90000 00002</b> (rider) · <b>90000 00003</b> (driver)
          </div>
          <div className="small muted mt">Admin sign-in includes a security check (captcha).</div>
        </div>
      </div>
    </div>
  );
}
