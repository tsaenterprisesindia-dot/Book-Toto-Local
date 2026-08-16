import { useEffect, useState, useCallback } from 'react';
import client from '../../api/client.js';

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState('all'); // all | active | hidden
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    client.get('/admin/drivers').then(({ data }) => setDrivers(data.drivers)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actOnDriver = async (id, action) => {
    setBusyId(id);
    setMsg('');
    try {
      await client.patch(`/admin/drivers/${id}`, { action });
      load();
      const labels = { approve: 'approved', block: 'blocked', unblock: 'unblocked', hide: 'hidden', unhide: 'restored' };
      setMsg(`Driver ${labels[action] || action}`);
    } catch (e) {
      setMsg(e.response?.data?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = drivers.filter((d) =>
    filter === 'hidden' ? d.isHidden : filter === 'active' ? !d.isHidden : true
  );
  const hiddenCount = drivers.filter((d) => d.isHidden).length;

  return (
    <div className="fade-in">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ marginTop: 0 }}>🛺 Drivers</h2>
        <span className="small muted">{hiddenCount} hidden</span>
      </div>
      {msg && <div className="alert alert-green mb">{msg}</div>}

      <div className="tab-row" style={{ maxWidth: 360 }}>
        {[['all', `All (${drivers.length})`], ['active', `Active (${drivers.length - hiddenCount})`], ['hidden', `Hidden (${hiddenCount})`]].map(([k, label]) => (
          <button key={k} className={`tab${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Number</th>
              <th>Rides</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const status = d.driverStatus;
              return (
                <tr key={d._id}>
                  <td>
                    <b>{d.name}</b>
                    <div className="small muted">{d.email}</div>
                  </td>
                  <td>{d.vehicleType}</td>
                  <td>{d.vehicleNumber || '—'}</td>
                  <td>{d.rideCount || 0}</td>
                  <td>⭐ {d.rating?.toFixed?.(1)}</td>
                  <td>
                    <span className={`badge ${status === 'approved' ? 'badge-green' : status === 'pending' ? 'badge-amber' : 'badge-red'}`}>
                      {status}
                    </span>
                    {d.isHidden && <span className="badge badge-gray">hidden</span>}
                  </td>
                  <td>
                    <div className="row wrap">
                      {d.isHidden ? (
                        <button className="btn btn-ghost small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'unhide')}>
                          Restore
                        </button>
                      ) : (
                        <button className="btn btn-ghost small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'hide')}>
                          Hide
                        </button>
                      )}
                      {status === 'pending' && (
                        <button className="btn btn-primary small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'approve')}>
                          Approve
                        </button>
                      )}
                      {status === 'approved' && !d.isHidden && (
                        <button className="btn btn-danger small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'block')}>
                          Block
                        </button>
                      )}
                      {status === 'blocked' && (
                        <button className="btn btn-ghost small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'unblock')}>
                          Unblock
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="muted center">No drivers in this view.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
