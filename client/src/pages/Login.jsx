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
  const { login } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('rider');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState(null); // { captchaId, question }
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCaptcha = useCallback(() => {
    setCaptchaAnswer('');
    client.get('/auth/captcha').then(({ data }) => setCaptcha(data)).catch(() => setCaptcha(null));
  }, []);

  useEffect(() => {
    if (role === 'admin') loadCaptcha();
  }, [role, loadCaptcha]);

  const quick = (mail) => {
    setEmail(mail);
    setPassword('demo123');
  };

  const pickRole = (r) => {
    setRole(r);
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const extra = role === 'admin' ? { captchaId: captcha?.captchaId, captchaAnswer } : {};
      const { user } = await login(email, password, extra);
      navigate(user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/ride');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      if (role === 'admin') loadCaptcha();
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

        <form onSubmit={submit}>
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

          <div className="field">
            <label>Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
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
          <div className="small muted mt">Admin sign-in includes a security check (captcha).</div>
        </div>
      </div>
    </div>
  );
}
