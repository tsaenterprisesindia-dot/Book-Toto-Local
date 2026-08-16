import { useEffect, useState, useCallback } from 'react';
import client from '../../api/client.js';
import { timeAgo } from '../../utils/geo.js';

export default function AdminRiders() {
  const [riders, setRiders] = useState([]);
  const [filter, setFilter] = useState('all'); // all | active | hidden
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    client.get('/admin/riders').then(({ data }) => setRiders(data.riders)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actOnRider = async (id, action) => {
    setBusyId(id);
    setMsg('');
    try {
      await client.patch(`/admin/riders/${id}`, { action });
      load();
      setMsg(`Rider ${action === 'hide' ? 'hidden' : 'restored'} — they can no longer log in.`);
    } catch (e) {
      setMsg(e.response?.data?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = riders.filter((r) =>
    filter === 'hidden' ? r.isHidden : filter === 'active' ? !r.isHidden : true
  );
  const hiddenCount = riders.filter((r) => r.isHidden).length;

  return (
    <div className="fade-in">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ marginTop: 0 }}>👤 Riders</h2>
        <span className="small muted">{hiddenCount} hidden</span>
      </div>
      {msg && <div className="alert alert-green mb">{msg}</div>}

      <div className="tab-row" style={{ maxWidth: 360 }}>
        {[['all', `All (${riders.length})`], ['active', `Active (${riders.length - hiddenCount})`], ['hidden', `Hidden (${hiddenCount})`]].map(([k, label]) => (
          <button key={k} className={`tab${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Rating</th>
              <th>Joined</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r._id}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.phone || '—'}</td>
                <td>⭐ {r.rating?.toFixed?.(1)}</td>
                <td className="small">{timeAgo(r.createdAt)}</td>
                <td>
                  {r.isHidden ? <span className="badge badge-red">hidden</span> : <span className="badge badge-green">active</span>}
                </td>
                <td>
                  <button
                    className={`btn ${r.isHidden ? 'btn-ghost' : 'btn-danger'} small`}
                    disabled={busyId === r._id}
                    onClick={() => actOnRider(r._id, r.isHidden ? 'unhide' : 'hide')}
                  >
                    {r.isHidden ? 'Restore' : 'Hide'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="muted center">No riders in this view.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
