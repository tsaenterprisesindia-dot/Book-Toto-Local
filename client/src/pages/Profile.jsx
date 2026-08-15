import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFace } from '../context/FaceProvider.jsx';
import FaceCapture from '../components/FaceCapture.jsx';
import client from '../api/client.js';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const face = useFace();
  const navigate = useNavigate();

  const [faceOpen, setFaceOpen] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [err, setErr] = useState('');

  const doLogout = () => {
    logout();
    navigate('/');
  };

  const enrollFace = async () => {
    setErr('');
    setEnrollBusy(true);
    const res = await face.captureDescriptor();
    face.stopStream();
    if (!res.ok) {
      setErr(res.message);
      setEnrollBusy(false);
      return;
    }
    try {
      await client.post('/face/register', { descriptor: res.descriptor });
      setFaceOpen(false);
      await refreshUser();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not save face');
    } finally {
      setEnrollBusy(false);
    }
  };

  const showFace = user?.role === 'rider' || user?.role === 'driver';

  const fields = [
    { label: 'Name', value: user?.name },
    { label: 'Email', value: user?.email },
    { label: 'Phone', value: user?.phone || '—' },
    { label: 'Role', value: user?.role },
    {
      label: 'Face login',
      value: user?.faceRegistered ? 'Enabled ⭐' : user?.role === 'admin' ? 'N/A (admin)' : 'Not enrolled',
    },
    ...(user?.role === 'driver'
      ? [
          { label: 'Vehicle', value: user?.vehicleType },
          { label: 'Vehicle number', value: user?.vehicleNumber || '—' },
          { label: 'Driver status', value: user?.driverStatus },
          { label: 'Rating', value: `⭐ ${user?.rating?.toFixed?.(1)}` },
          { label: 'Earnings', value: `₹${(user?.earnings || 0).toLocaleString('en-IN')}` },
          { label: 'Total rides', value: String(user?.totalRides || 0) },
        ]
      : []),
  ];

  return (
    <>
      <Nav />
      <div className="page">
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="row" style={{ marginBottom: 16 }}>
            <span className="avatar" style={{ width: 52, height: 52, fontSize: 24 }}>{user?.name?.[0]?.toUpperCase()}</span>
            <div>
              <h2 style={{ margin: 0 }}>{user?.name}</h2>
              <span className={`badge ${user?.role === 'driver' ? 'badge-amber' : user?.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>{user?.role}</span>
            </div>
          </div>

          <div className="stack">
            {fields.map((f) => (
              <div className="spread" key={f.label}>
                <span className="muted">{f.label}</span>
                <b>{f.value}</b>
              </div>
            ))}
          </div>

          {showFace ? (
            <div className="mt">
              {!face.ready ? (
                <div className="alert alert-info small">Face engine loading…</div>
              ) : (
                <button className="btn btn-ghost btn-block" onClick={() => setFaceOpen(true)} disabled={enrollBusy} type="button">
                  {user.faceRegistered ? 'Update face' : 'Register face for Face login'}
                </button>
              )}
              <p className="small muted">
                Enable Face Recognition login. Your photo never leaves your device; only the 128-dim face descriptor
                is stored and compared at login.
              </p>
            </div>
          ) : (
            <p className="small muted mt">Face login is not available for admins.</p>
          )}

          {err && <div className="err-box mt">{err}</div>}

          <button className="btn btn-ghost btn-block mt" onClick={doLogout}>Log out</button>
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
        loading={enrollBusy}
        title="Look at the camera to register your face"
      />
    </>
  );
}
