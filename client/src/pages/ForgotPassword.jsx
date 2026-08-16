import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import PasswordInput from '../components/PasswordInput.jsx';
import logo from '../assets/book-toto-logo.png';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = request code, 2 = enter code + new password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const requestCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const { data } = await client.post('/auth/forgot-password', { email });
      setDemoCode(data.demoCode || '');
      setInfo(data.message || 'Reset code sent.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not request a reset code');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const { data } = await client.post('/auth/reset-password', { email, code, newPassword });
      setInfo(data.message || 'Password updated.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card fade-in">
        <div className="auth-title">
          <img src={logo} alt="Book Toto Local logo" className="auth-logo" /> Forgot password
        </div>
        <p className="muted">
          {step === 1 && 'Enter your account email to receive a reset code.'}
          {step === 2 && `Enter the 6-digit code sent to ${email} and choose a new password.`}
          {step === 3 && 'Password reset complete.'}
        </p>

        {error && <div className="err-box">{error}</div>}
        {info && <div className="alert alert-green mb">{info}</div>}

        {step === 1 && (
          <form onSubmit={requestCode}>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={!email || busy}>
              {busy ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        )}

        {step === 2 && (
          <>
            {demoCode && (
              <div className="alert alert-info mb">
                <b>Demo email:</b> your reset code is <b>{demoCode}</b> (valid 15 minutes). In
                production this would be emailed to you.
              </div>
            )}
            <form onSubmit={resetPassword}>
              <div className="field">
                <label>Reset code</label>
                <input
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                />
              </div>
              <div className="field">
                <label>New password</label>
                <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
              </div>
              <div className="field">
                <label>Confirm new password</label>
                <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" />
              </div>
              <button className="btn btn-primary btn-block btn-lg" disabled={!code || !newPassword || busy}>
                {busy ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
            <div className="small muted mt" style={{ textAlign: 'center' }}>
              <button className="btn btn-ghost small" onClick={() => { setStep(1); setCode(''); setDemoCode(''); setInfo(''); }}>
                Request a new code
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="row" style={{ flexDirection: 'column', gap: 12 }}>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/login')}>
              Go to login
            </button>
          </div>
        )}

        <div className="small muted mt" style={{ textAlign: 'center' }}>
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
