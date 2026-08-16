import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFace } from '../context/FaceProvider.jsx';
import FaceCapture from '../components/FaceCapture.jsx';
import client from '../api/client.js';

const TERMS_VERSION = '1.0';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const face = useFace();
  const navigate = useNavigate();

  const [faceOpen, setFaceOpen] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [err, setErr] = useState('');
  const [termsMsg, setTermsMsg] = useState('');

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
  const warnings = user?.warnings || [];
  const susp = user?.suspension?.active ? user.suspension : null;

  const reAcceptTerms = async () => {
    setTermsMsg(''); setErr('');
    try {
      await client.post('/auth/accept-terms', { version: TERMS_VERSION });
      await refreshUser();
      setTermsMsg('Terms re-accepted successfully');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save');
    }
  };

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
          { label: 'Rating', value: `${user?.rating?.toFixed?.(1)}` },
          { label: 'Net earnings', value: `₹${(user?.earnings || 0).toLocaleString('en-IN')}` },
          { label: 'Total rides', value: String(user?.totalRides || 0) },
        ]
      : []),
    ...(user?.role !== 'admin'
      ? [{ label: 'Terms accepted', value: user?.termsAcceptedAt ? `Yes (v${user.termsVersion || '?'})` : 'Not yet' }]
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
              {susp && (
                <span className="badge badge-suspended" style={{ marginLeft: 4 }}>
                  {susp.until ? `Suspended till ${new Date(susp.until).toLocaleDateString('en-IN')}` : 'Permanently suspended'}
                </span>
              )}
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

          {susp && (
            <div className="warning-banner severe mt">
              <div className="warning-title">Account Suspended</div>
              <div className="warning-msg">
                {susp.until ? `Until ${new Date(susp.until).toLocaleDateString('en-IN')}` : 'Permanent suspension'}.
                {susp.reason ? ` Reason: ${susp.reason}` : ''} Contact support for help.
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mt">
              <h4 style={{ margin: '0 0 8px' }}>Warnings ({warnings.length})</h4>
              {warnings.map((w) => (
                <div key={w._id} className="warning-banner" style={{ marginBottom: 8 }}>
                  <div className="warning-msg">{w.message}</div>
                  <div className="small muted mt">{new Date(w.issuedAt).toLocaleDateString('en-IN')}</div>
                </div>
              ))}
              <p className="small muted">Continued violations may lead to suspension or termination of service.</p>
            </div>
          )}

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

          {user?.role !== 'admin' && (
            <button className="btn btn-ghost btn-block mt" onClick={reAcceptTerms} type="button">
              Re-accept Terms &amp; Conditions
            </button>
          )}
          {termsMsg && <div className="alert alert-green mt">{termsMsg}</div>}
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
