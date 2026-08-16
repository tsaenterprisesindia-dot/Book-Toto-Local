import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useFace } from '../context/FaceProvider.jsx';
import FaceCapture from '../components/FaceCapture.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import client from '../api/client.js';
import logo from '../assets/super-toto-logo.png';

export default function Register() {
  const { register, refreshUser } = useAuth();
  const face = useFace();
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
  const [faceOpen, setFaceOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollDone, setEnrollDone] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const { user } = await register({ ...form, role });
      // Auto-enroll a face for driver/rider so face login is usable right away.
      if (user.role !== 'admin') setFaceOpen(true);
      else navigate('/ride');
    } catch (err) {
      setErr(err.response?.data?.message || 'Registration failed');
    }
  };

  const enrollFace = async () => {
    setErr('');
    setEnrolling(true);
    const res = await face.captureDescriptor();
    face.stopStream();
    if (!res.ok) {
      setErr(res.message);
      setEnrolling(false);
      return;
    }
    try {
      await client.post('/face/register', { descriptor: res.descriptor });
      setEnrollDone(true);
      await refreshUser();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not save face');
    } finally {
      setEnrolling(false);
    }
  };

  const canEnroll = face.ready && role !== 'admin';

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in">
        <div className="auth-title">
          <img src={logo} alt="Super Toto Local logo" className="auth-logo" /> Create account
        </div>
        <p className="muted">Join Super Toto Local</p>

        {err && <div className="err-box">{err}</div>}

        <div className="tab-row">
          <button className={`tab${role === 'rider' ? ' active' : ''}`} onClick={() => setRole('rider')}>I ride</button>
          <button className={`tab${role === 'driver' ? ' active' : ''}`} onClick={() => setRole('driver')}>I drive a toto</button>
        </div>

        {role === 'driver' && (
          <p className="hint">Driver accounts need admin approval to go online (the seeded driver already works).</p>
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
            <PasswordInput value={form.password} onChange={set('password')} placeholder="min 6 characters" required />
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

          <button className="btn btn-primary btn-block btn-lg" type="submit">
            Create account
          </button>
        </form>

        {canEnroll ? (
          <div className="mt">
            <div className="row">
              <span className="chip">Face login</span>
              <span className={`badge ${enrollDone ? 'badge-green' : face.faceRegistered ? 'badge-green' : 'badge-gray'}`}>
                {enrollDone || face.faceRegistered ? 'enrolled' : 'not enrolled'}
              </span>
            </div>
            <p className="small muted">
              Register your face to log in with Face Recognition instead of a password (optional).
            </p>
            <button className="btn btn-ghost btn-block" onClick={() => setFaceOpen(true)} disabled={enrolling} type="button">
              {enrollDone || face.faceRegistered ? 'Re-register face' : 'Register my face'}
            </button>
            <p className="small muted">
              Your photo stays on this device. Only the face descriptor is stored for later login.
            </p>
          </div>
        ) : (
          <p className="small muted mt">Face login is available for rider/driver accounts after registration.</p>
        )}

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>

      <FaceCapture
        open={faceOpen}
        onClose={() => {
          setFaceOpen(false);
          face.stopStream();
        }}
        videoRef={face.videoRef}
        startCamera={face.startCamera}
        onCapture={enrollFace}
        loading={enrolling}
        title="Register your face"
      />
    </div>
  );
}
