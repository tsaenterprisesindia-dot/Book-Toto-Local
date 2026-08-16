import { useEffect, useState, useCallback } from 'react';
import client from '../../api/client.js';

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
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
      setMsg(`Driver ${action === 'approve' ? 'approved' : action === 'block' ? 'blocked' : 'unblocked'}`);
    } catch (e) {
      setMsg(e.response?.data?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fade-in">
      <h2 style={{ marginTop: 0 }}>🛺 Drivers</h2>
      {msg && <div className="alert alert-green mb">{msg}</div>}

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
            {drivers.map((d) => {
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
                  </td>
                  <td>
                    <div className="row">
                      {status === 'pending' && (
                        <button className="btn btn-primary small" disabled={busyId === d._id} onClick={() => actOnDriver(d._id, 'approve')}>
                          Approve
                        </button>
                      )}
                      {status === 'approved' && (
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
