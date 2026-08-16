import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import logo from '../assets/book-toto-logo.png';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const quick = (mail) => {
    setEmail(mail);
    setPassword('demo123');
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await login(email, password);
      navigate(user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/ride');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in">
        <div className="auth-title">
          <img src={logo} alt="Book Toto Local logo" className="auth-logo" /> Book Toto Local
        </div>
        <p className="muted">Log in to continue</p>

        {error && <div className="err-box">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
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
            <button className="btn btn-ghost small" onClick={() => quick('rider@booktoto.local')}>Rider</button>
            <button className="btn btn-ghost small" onClick={() => quick('driver@booktoto.local')}>Driver</button>
            <button className="btn btn-ghost small" onClick={() => quick('admin@booktoto.local')}>Admin</button>
          </div>
          <div className="small muted mt">Admins always sign in with password (no face login).</div>
        </div>
      </div>
    </div>
  );
}
