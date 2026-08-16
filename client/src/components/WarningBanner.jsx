import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Displays active warnings and suspension notices for the current user.
 * Dismissed warnings are tracked locally so the banner doesn't reappear
 * in the same session — but the warnings remain in the account record.
 */
export default function WarningBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(new Set());
  if (!user) return null;

  const warnings = (user.warnings || []).filter(
    (w) => !dismissed.has(String(w._id))
  );
  const suspension = user.suspension?.active ? user.suspension : null;
  const hide = user.isHidden;

  if (warnings.length === 0 && !suspension && !hide) return null;

  const dismiss = (id) => setDismissed((prev) => new Set([...prev, String(id)]));

  return (
    <>
      {suspension && (
        <div className="warning-banner severe">
          <div className="warning-title">⛔ Account Suspended</div>
          <div className="warning-msg">
            {suspension.until
              ? `Your account has been temporarily suspended until ${new Date(suspension.until).toLocaleDateString('en-IN')}.`
              : 'Your account has been permanently suspended.'}
            {suspension.reason ? ` Reason: ${suspension.reason}` : ''}
            {' '}You cannot use the Service until the suspension is lifted by an administrator.
          </div>
        </div>
      )}

      {hide && (
        <div className="warning-banner severe">
          <div className="warning-title">⛔ Account Deactivated</div>
          <div className="warning-msg">
            Your account has been deactivated by an administrator. Please contact support for assistance.
          </div>
        </div>
      )}

      {warnings.map((w) => (
        <div key={String(w._id)} className="warning-banner">
          <div className="warning-title">⚠️ Warning — Breach of Terms</div>
          <div className="warning-msg">
            {w.message}
            {' '}Continued violations may result in temporary suspension or permanent termination of your service.
            {w.issuedAt && (
              <span style={{ display: 'block', marginTop: 4, opacity: 0.7, fontSize: 11 }}>
                Issued {new Date(w.issuedAt).toLocaleDateString('en-IN')}
              </span>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 6, padding: '2px 10px', fontSize: 11 }}
            onClick={() => dismiss(w._id)}
          >
            Dismiss
          </button>
        </div>
      ))}
    </>
  );
}
