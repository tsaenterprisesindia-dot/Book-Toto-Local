import { useEffect, useState, useCallback } from 'react';
import client from '../../api/client.js';
import Modal from '../../components/Modal.jsx';

const SUSPEND_DURATIONS = [
  { label: '7 days', ms: 7 * 86400000 },
  { label: '14 days', ms: 14 * 86400000 },
  { label: '30 days', ms: 30 * 86400000 },
  { label: 'Permanent', ms: null },
];

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');

  // warn modal
  const [warnTarget, setWarnTarget] = useState(null);
  const [warnMsg, setWarnMsg] = useState('');

  // suspend modal
  const [suspTarget, setSuspTarget] = useState(null);
  const [suspReason, setSuspReason] = useState('');
  const [suspDuration, setSuspDuration] = useState(null);
  const [suspFinance, setSuspFinance] = useState(null); // financial summary
  const [settlementConfirmed, setSettlementConfirmed] = useState(false);

  // warnings viewer
  const [viewWarnTarget, setViewWarnTarget] = useState(null);

  const load = useCallback(() => {
    client.get('/admin/drivers').then(({ data }) => setDrivers(data.drivers)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  // Fetch financial summary when the suspend modal opens.
  useEffect(() => {
    if (suspTarget) {
      setSuspFinance(null);
      setSettlementConfirmed(false);
      client.get(`/admin/financial-summary/${suspTarget._id}`)
        .then(({ data }) => setSuspFinance(data))
        .catch(() => setSuspFinance({ error: true }));
    }
  }, [suspTarget]);

  const actOnDriver = async (id, action) => {
    setBusyId(id); setMsg('');
    try {
      await client.patch(`/admin/drivers/${id}`, { action });
      load();
      const labels = { approve: 'approved', block: 'blocked', unblock: 'unblocked', hide: 'hidden', unhide: 'restored', reinstate: 'reinstated' };
      setMsg(`Driver ${labels[action] || action}`);
    } catch (e) {
      setMsg(e.response?.data?.message || 'Update failed');
    } finally { setBusyId(null); }
  };

  const issueWarn = async () => {
    if (!warnTarget || !warnMsg.trim()) return;
    setBusyId(warnTarget._id); setMsg('');
    try {
      await client.post(`/admin/warn/${warnTarget._id}`, { message: warnMsg.trim() });
      setWarnTarget(null); setWarnMsg('');
      load();
      setMsg('Warning issued');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed');
    } finally { setBusyId(null); }
  };

  const issueSuspend = async () => {
    if (!suspTarget) return;
    setBusyId(suspTarget._id); setMsg('');
    try {
      const body = { reason: suspReason.trim() || 'Violations of terms', settlementConfirmed };
      if (suspDuration) body.until = new Date(Date.now() + suspDuration.ms).toISOString();
      await client.post(`/admin/suspend/${suspTarget._id}`, body);
      setSuspTarget(null); setSuspReason(''); setSuspDuration(null);
      load();
      setMsg('Driver suspended');
    } catch (e) {
      const data = e.response?.data;
      if (data?.requiresSettlement) {
        setMsg(`Cannot suspend: ₹${data.outstandingAmount?.toLocaleString('en-IN')} outstanding. Settle finances first.`);
      } else {
        setMsg(data?.message || 'Failed');
      }
    } finally { setBusyId(null); }
  };

  const clearWarnings = async (userId) => {
    setBusyId(userId); setMsg('');
    try {
      await client.delete(`/admin/warnings/${userId}`);
      load();
      setMsg('Warnings cleared');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Failed');
    } finally { setBusyId(null); }
  };

  const suspended = (d) => d.suspension?.active;
  const suspendedUntil = (d) => suspended(d) && d.suspension.until
    ? new Date(d.suspension.until).toLocaleDateString('en-IN')
    : null;
  const warnCount = (d) => (d.warnings || []).length;

  const filtered = drivers.filter((d) => {
    if (filter === 'hidden') return d.isHidden;
    if (filter === 'active') return !d.isHidden && !suspended(d);
    if (filter === 'suspended') return suspended(d);
    return true;
  });

  const hiddenCount = drivers.filter((d) => d.isHidden).length;
  const suspCount = drivers.filter((d) => suspended(d)).length;

  return (
    <div className="fade-in">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ marginTop: 0 }}>Drivers</h2>
        <span className="small muted">{hiddenCount} hidden · {suspCount} suspended</span>
      </div>
      {msg && <div className="alert alert-green mb">{msg}</div>}

      <div className="tab-row" style={{ maxWidth: 480 }}>
        {[['all', `All (${drivers.length})`], ['active', `Active (${drivers.length - hiddenCount - suspCount})`], ['hidden', `Hidden (${hiddenCount})`], ['suspended', `Suspended (${suspCount})`]].map(([k, label]) => (
          <button key={k} className={`tab${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Rides</th>
              <th>Status</th>
              <th>Warnings</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const status = d.driverStatus;
              return (
                <tr key={d._id}>
                  <td>
                    <b>{d.name}</b>
                    <div className="small muted">{d.email || d.phone}</div>
                  </td>
                  <td>{d.vehicleType}<div className="small muted">{d.vehicleNumber || '—'}</div></td>
                  <td>{d.rideCount || 0}</td>
                  <td>
                    <span className={`badge ${status === 'approved' ? 'badge-green' : status === 'pending' ? 'badge-amber' : 'badge-red'}`}>
                      {status}
                    </span>
                    {d.isHidden && <span className="badge badge-gray" style={{ marginLeft: 4 }}>hidden</span>}
                    {suspended(d) && <span className="badge badge-suspended" style={{ marginLeft: 4 }}>
                      {suspendedUntil(d) ? `susp. till ${suspendedUntil(d)}` : 'permanently suspended'}
                    </span>}
                  </td>
                  <td>
                    {warnCount(d) > 0 ? (
                      <button className="badge badge-warned btn-ghost" style={{ cursor: 'pointer', border: 'none' }} onClick={() => setViewWarnTarget(d)}>
                        {warnCount(d)} warning{warnCount(d) > 1 ? 's' : ''}
                      </button>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td>
                    <div className="row wrap" style={{ gap: 4 }}>
                      {d.isHidden || suspended(d) ? (
                        <button className="btn btn-primary small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'reinstate')}>
                          Reinstate
                        </button>
                      ) : (
                        <>
                          {status === 'pending' && (
                            <button className="btn btn-primary small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'approve')}>Approve</button>
                          )}
                          <button className="btn btn-ghost small" disabled={busyId === d._id} onClick={() => setWarnTarget(d)}>
                            Warn
                          </button>
                          <button className="btn btn-danger small" disabled={busyId === d._id} onClick={() => setSuspTarget(d)}>
                            Suspend
                          </button>
                          <button className="btn btn-ghost small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'hide')}>
                            Hide
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="muted center">No drivers in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- Warn modal --- */}
      <Modal open={!!warnTarget} onClose={() => setWarnTarget(null)}>
        <h3>Warn {warnTarget?.name}</h3>
        <p className="small muted mb">The user will see this as an in-app warning banner.</p>
        <textarea
          className="input"
          rows={3}
          placeholder="Describe the breach…"
          value={warnMsg}
          onChange={(e) => setWarnMsg(e.target.value)}
        />
        <div className="modal-actions">
          <button className="btn btn-primary" disabled={busyId === warnTarget?._id || !warnMsg.trim()} onClick={issueWarn}>
            {busyId === warnTarget?._id ? 'Sending…' : 'Issue Warning'}
          </button>
          <button className="btn btn-ghost" onClick={() => setWarnTarget(null)}>Cancel</button>
        </div>
      </Modal>

      {/* --- Suspend modal --- */}
      <Modal open={!!suspTarget} onClose={() => setSuspTarget(null)}>
        <h3>Suspend {suspTarget?.name}</h3>
        <div className="field">
          <label>Reason</label>
          <textarea
            className="input"
            rows={2}
            placeholder="Reason for suspension…"
            value={suspReason}
            onChange={(e) => setSuspReason(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Duration</label>
          <div className="seg-row" style={{ flexWrap: 'wrap' }}>
            {SUSPEND_DURATIONS.map((d) => (
              <button
                key={d.label}
                className={`seg${suspDuration === d.ms ? ' active' : ''}`}
                onClick={() => setSuspDuration(d.ms)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <p className="small muted">
          {suspDuration === null
            ? 'Permanent: the account stays blocked until an admin manually reinstates it.'
            : `Auto-expires after ${SUSPEND_DURATIONS.find(d => d.ms === suspDuration)?.label || '…'}.`}
        </p>

        {/* --- Financial settlement summary --- */}
        {suspFinance && !suspFinance.error && (
          <div className="card" style={{ background: 'var(--bg)', padding: 12, marginTop: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Financial Summary</div>
            <div className="spread mb"><span className="muted">Completed rides</span><b>{suspFinance.completedRides || 0}</b></div>
            <div className="spread mb"><span className="muted">Total earned</span><b>₹{(suspFinance.totalEarned || 0).toLocaleString('en-IN')}</b></div>
            <div className="spread mb"><span className="muted">Platform commission</span><b>₹{(suspFinance.totalCommission || 0).toLocaleString('en-IN')}</b></div>
            <div className="spread mb"><span className="muted">Wallet balance (pending payout)</span><b style={{ color: suspFinance.pendingPayout > 0 ? 'var(--amber)' : undefined }}>₹{(suspFinance.pendingPayout || 0).toLocaleString('en-IN')}</b></div>
            {suspFinance.pendingPayout > 0 && (
              <div className="alert alert-warn" style={{ marginTop: 6 }}>
                This driver has a pending payout of <b>₹{suspFinance.pendingPayout.toLocaleString('en-IN')}</b>.
                Ensure the payout is processed before permanent suspension.
              </div>
            )}
          </div>
        )}
        {suspFinance?.error && <p className="small muted mt">Could not load financial summary.</p>}

        {suspFinance && !suspFinance.error && suspFinance.pendingPayout > 0 && (
          <label className="row mt" style={{ gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={settlementConfirmed} onChange={(e) => setSettlementConfirmed(e.target.checked)} style={{ marginTop: 3 }} />
            <span className="small">I confirm all financial matters (pending payout of ₹{suspFinance.pendingPayout.toLocaleString('en-IN')}) have been settled or will be handled separately.</span>
          </label>
        )}

        <div className="modal-actions">
          <button
            className="btn btn-danger"
            disabled={busyId === suspTarget?._id || (suspFinance && !suspFinance.error && suspFinance.pendingPayout > 0 && !settlementConfirmed)}
            onClick={issueSuspend}
          >
            {busyId === suspTarget?._id ? 'Suspending…' : 'Confirm Suspension'}
          </button>
          <button className="btn btn-ghost" onClick={() => setSuspTarget(null)}>Cancel</button>
        </div>
      </Modal>

      {/* --- View warnings modal --- */}
      <Modal open={!!viewWarnTarget} onClose={() => setViewWarnTarget(null)}>
        <h3>Warnings — {viewWarnTarget?.name}</h3>
        {viewWarnTarget?.warnings?.length === 0 && <p className="muted">No warnings.</p>}
        {viewWarnTarget?.warnings?.map((w) => (
          <div key={w._id} className="warning-banner" style={{ marginBottom: 8 }}>
            <div className="warning-msg">{w.message}</div>
            <div className="small muted mt">{new Date(w.issuedAt).toLocaleDateString('en-IN')}</div>
          </div>
        ))}
        {viewWarnTarget?.warnings?.length > 0 && (
          <button
            className="btn btn-danger small mt"
            disabled={busyId === viewWarnTarget?._id}
            onClick={() => { clearWarnings(viewWarnTarget._id); setViewWarnTarget(null); }}
          >
            Clear all warnings
          </button>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setViewWarnTarget(null)}>Close</button>
        </div>
      </Modal>
    </div>
  );
}
