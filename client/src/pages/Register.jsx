import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('rider');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    vehicleType: 'Toto (E-Rickshaw)',
    vehicleNumber: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const { user } = await register({ ...form, role });
      navigate(user.role === 'driver' ? '/driver' : '/ride');
    } catch (err) {
      setErr(err.response?.data?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in">
        <div className="auth-title">
          <span>🛺</span> Create account
        </div>
        <p className="muted">Join Book Toto Local</p>

        {err && <div className="err-box">{err}</div>}

        <div className="tab-row">
          <button className={`tab${role === 'rider' ? ' active' : ''}`} onClick={() => setRole('rider')}>
            I ride
          </button>
          <button className={`tab${role === 'driver' ? ' active' : ''}`} onClick={() => setRole('driver')}>
            I drive a toto
          </button>
        </div>

        {role === 'driver' && (
          <p className="hint">
            Driver accounts need admin approval before going online. A pending account will be listed
            on the admin dashboard.
          </p>
        )}

        <form onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Your name" required />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
          </div>
          <div className="field">
            <label>Phone</label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="+91 …" />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="min 6 characters" required />
          </div>

          {role === 'driver' && (
            <>
              <div className="field">
                <label>Vehicle type</label>
                <select className="input" value={form.vehicleType} onChange={set('vehicleType')}>
                  <option>Toto (E-Rickshaw)</option>
                  <option>Auto Rickshaw</option>
                  <option>Cab</option>
                </select>
              </div>
              <div className="field">
                <label>Vehicle number</label>
                <input className="input" value={form.vehicleNumber} onChange={set('vehicleNumber')} placeholder="SK-01-T1234" />
              </div>
            </>
          )}

          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Creating account…' : role === 'driver' ? 'Register as driver' : 'Create rider account'}
          </button>
        </form>

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
