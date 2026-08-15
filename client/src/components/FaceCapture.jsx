import { useEffect } from 'react';
import Modal from './Modal.jsx';

export default function FaceCapture({ open, onClose, onCapture, videoRef, startCamera, loading, error, title }) {
  useEffect(() => {
    if (!open) return;
    if (!videoRef?.current || typeof startCamera !== 'function') return;
    let cancelled = false;
    startCamera().then((r) => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [open, videoRef, startCamera]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="fade-in">
        <h3 style={{ marginTop: 0 }}>{title || 'Face Recognition'}</h3>
        {error && <div className="err-box mb">{error}</div>}
        <div style={{ position: 'relative' }}>
          <video
            ref={videoRef}
            style={{ width: '100%', borderRadius: 10, background: '#000' }}
            playsInline
            muted
            autoPlay
          />
          <p className="small muted mt">
            Position your face in the frame, ensure good lighting, then tap capture.
          </p>
        </div>
        <div className="row mt">
          <button className="btn btn-ghost btn-block" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary btn-block" onClick={onCapture} disabled={loading}>
            {loading ? 'Capturing…' : 'Capture face'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
