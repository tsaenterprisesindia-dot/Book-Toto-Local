import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useFace } from '../context/FaceProvider.jsx';
import FaceCapture from '../components/FaceCapture.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import logo from '../assets/book-toto-logo.png';

export default function Login() {
  const { login, faceLogin } = useAuth();
  const face = useFace();
  const navigate = useNavigate();

  const [mode, setMode] = useState('password'); // 'password' | 'face'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [faceOpen, setFaceOpen] = useState(false);

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

  const captureAndLogin = async () => {
    setError('');
    setBusy(true);
    const res = await face.captureDescriptor();
    face.stopStream();
    if (!res.ok) {
      setError(res.message);
      setBusy(false);
      return;
    }
    try {
      const { user } = await faceLogin(email, res.descriptor);
      navigate(user.role === 'driver' ? '/driver' : '/ride');
    } catch (err) {
      const msg = err.response?.data?.message;
      if (err.response?.status === 403 && /No face enrolled/i.test(msg || '')) {
        setError('No face enrolled for this account. Log in with password, then register your face in Profile.');
      } else {
        setError(msg || 'Face login failed');
      }
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
        {face.loadError && <div className="err-box">{face.loadError}</div>}

        <div className="tab-row">
          <button className={`tab${mode === 'password' ? ' active' : ''}`} onClick={() => setMode('password')}>
            Password
          </button>
          <button className={`tab${mode === 'face' ? ' active' : ''}`} onClick={() => setMode('face')} disabled={!face.ready}>
            Face recognition
          </button>
        </div>

        {mode === 'password' && (
          <>
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
          </>
        )}

        {mode === 'face' && (
          <>
            {!face.ready ? (
              <div className="alert alert-info">
                Loading the face recognition engine… (models download ~7MB the first time)
              </div>
            ) : (
              <div className="alert alert-info">
                Scan your face for <b>{email || 'your account'}</b>. Your image stays on this device; only your face
                descriptor is sent to compare with your stored face.
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!email) return setError('Enter your email first');
                setFaceOpen(true);
              }}
            >
              <div className="field">
                <label>Email</label>
                <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={!email || !face.ready}>
                Scan my face
              </button>
            </form>
          </>
        )}
      </div>

      <FaceCapture
        open={faceOpen}
        onClose={() => {
          setFaceOpen(false);
          face.stopStream();
        }}
        videoRef={face.videoRef}
        startCamera={face.startCamera}
        onCapture={captureAndLogin}
        loading={busy}
        title="Look at the camera to log in"
      />
    </div>
  );
}
