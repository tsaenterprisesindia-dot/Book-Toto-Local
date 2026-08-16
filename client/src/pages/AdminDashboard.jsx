import { useEffect, useState } from 'react';
import client from '../api/client.js';
import Nav from '../components/Nav.jsx';
import { formatINR, timeAgo } from '../utils/geo.js';

function DriverRow({ driver, onAction, busyId }) {
  const status = driver.driverStatus;
  return (
    <tr>
      <td>
        <b>{driver.name}</b>
        <div className="small muted">{driver.email}</div>
      </td>
      <td>{driver.vehicleType}</td>
      <td>{driver.vehicleNumber || '—'}</td>
      <td>{driver.rideCount || 0}</td>
      <td>⭐ {driver.rating?.toFixed?.(1)}</td>
      <td>
        <span className={`badge ${status === 'approved' ? 'badge-green' : status === 'pending' ? 'badge-amber' : 'badge-red'}`}>
          {status}
        </span>
      </td>
      <td>
        <div className="row">
          {status === 'pending' && (
            <button className="btn btn-primary small" disabled={busyId === driver._id} onClick={() => onAction(driver._id, 'approve')}>
              Approve
            </button>
          )}
          {status === 'approved' && (
            <button className="btn btn-danger small" disabled={busyId === driver._id} onClick={() => onAction(driver._id, 'block')}>
              Block
            </button>
          )}
          {status === 'blocked' && (
            <button className="btn btn-ghost small" disabled={busyId === driver._id} onClick={() => onAction(driver._id, 'unblock')}>
              Unblock
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('drivers');
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [rides, setRides] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    client.get('/admin/stats').then(({ data }) => setStats(data.stats)).catch(() => {});
  }, []);

  useEffect(() => {
    const load = {
      drivers: () => client.get('/admin/drivers').then(({ data }) => setDrivers(data.drivers)),
      riders: () => client.get('/admin/riders').then(({ data }) => setRiders(data.riders)),
      rides: () => client.get('/admin/rides').then(({ data }) => setRides(data.rides)),
    }[tab];
    load?.().catch(() => {});
  }, [tab]);

  const actOnDriver = async (id, action) => {
    setBusyId(id);
    setMsg('');
    try {
      await client.patch(`/admin/drivers/${id}`, { action });
      const { data } = await client.get('/admin/drivers');
      setDrivers(data.drivers);
      client.get('/admin/stats').then(({ data }) => setStats(data.stats));
      setMsg('Driver updated');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Nav />
      <div className="page">
        <h2>📊 Admin dashboard</h2>

        {msg && <div className="alert alert-green mb">{msg}</div>}

        {stats && (
          <>
            <div className="stats-grid mb">
              <div className="card stat">
                <div className="num" style={{ color: 'var(--brand-dark)' }}>{stats.riders}</div>
                <div className="lbl">Riders</div>
              </div>
              <div className="card stat">
                <div className="num" style={{ color: '#1d4ed8' }}>{stats.drivers}</div>
                <div className="lbl">Drivers registered</div>
              </div>
              <div className="card stat">
                <div className="num">{stats.online}</div>
                <div className="lbl">Drivers online</div>
              </div>
              <div className="card stat">
                <div className="num">{stats.rides}</div>
                <div className="lbl">Total rides</div>
              </div>
              <div className="card stat">
                <div className="num">{stats.ridesToday}</div>
                <div className="lbl">Rides today</div>
              </div>
              <div className="card stat">
                <div className="num" style={{ color: 'var(--amber)' }}>{formatINR(stats.revenue)}</div>
                <div className="lbl">Rider payments (all)</div>
              </div>
              <div className="card stat">
                <div className="num" style={{ color: 'var(--amber)' }}>{formatINR(stats.paid)}</div>
                <div className="lbl">Collected</div>
              </div>
              <div className="card stat">
                <div className="num" style={{ color: 'var(--brand-dark)' }}>{formatINR(stats.outstanding)}</div>
                <div className="lbl">Outstanding ({stats.pendingCount})</div>
              </div>
            </div>

            <h3 style={{ margin: '0 0 12px' }}>💸 Platform earnings</h3>
            <div className="stats-grid mb">
              <div className="card stat">
                <div className="num" style={{ color: 'var(--brand-dark)' }}>{formatINR(stats.platformRevenue)}</div>
                <div className="lbl">Platform total (commission + GST + fees)</div>
              </div>
              <div className="card stat">
                <div className="num" style={{ color: '#1d4ed8' }}>{formatINR(stats.commission)}</div>
                <div className="lbl">Commission (15%)</div>
              </div>
              <div className="card stat">
                <div className="num" style={{ color: '#1d4ed8' }}>{formatINR(stats.gst)}</div>
                <div className="lbl">GST collected (5%)</div>
              </div>
              <div className="card stat">
                <div className="num" style={{ color: 'var(--amber)' }}>{formatINR(stats.cancellationFees)}</div>
                <div className="lbl">Cancellation fees ({formatINR(stats.cancellationFeesPaid)} paid)</div>
              </div>
              <div className="card stat">
                <div className="num" style={{ color: 'var(--brand-dark)' }}>{formatINR(stats.driverEarnings)}</div>
                <div className="lbl">Paid out to drivers</div>
              </div>
              <div className="card stat">
                <div className="num">
                  📱 {stats.methods.UPI.rides} · 💵 {stats.methods.Cash.rides} · 💳 {stats.methods.Card.rides}
                </div>
                <div className="lbl">
                  Paid rides by method (UPI {formatINR(stats.methods.UPI.amount)} · Cash {formatINR(stats.methods.Cash.amount)} · Card {formatINR(stats.methods.Card.amount)})
                </div>
              </div>
            </div>
          </>
        )}

        <div className="tab-row" style={{ maxWidth: 420 }}>
          <button className={`tab${tab === 'drivers' ? ' active' : ''}`} onClick={() => setTab('drivers')}>
            🛺 Drivers
          </button>
          <button className={`tab${tab === 'rides' ? ' active' : ''}`} onClick={() => setTab('rides')}>
            🚕 Rides
          </button>
          <button className={`tab${tab === 'riders' ? ' active' : ''}`} onClick={() => setTab('riders')}>
            👤 Riders
          </button>
        </div>

        <div className="card table-wrap fade-in">
          {tab === 'drivers' && (
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
                {drivers.map((d) => (
                  <DriverRow key={d._id} driver={d} onAction={actOnDriver} busyId={busyId} />
                ))}
              </tbody>
            </table>
          )}

          {tab === 'rides' && (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Rider</th>
                  <th>Driver</th>
                  <th>Route</th>
                  <th>Fare</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r._id}>
                    <td className="small">{timeAgo(r.createdAt)}</td>
                    <td>{r.rider?.name || '—'}</td>
                    <td>{r.driver?.name ? `${r.driver.name} (${r.driver.vehicleNumber})` : '—'}</td>
                    <td className="small">
                      {r.pickup.name} → {r.drop.name}
                    </td>
                    <td>
                      {formatINR(r.status === 'cancelled_by_rider' && r.cancellationFee > 0 ? r.cancellationFee : r.fare)}
                      {r.status === 'cancelled_by_rider' && r.cancellationFee > 0 && (
                        <div className="small muted">cancellation fee</div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${r.status === 'completed' ? 'badge-green' : ['cancelled_by_rider', 'cancelled_by_driver', 'no_driver'].includes(r.status) ? 'badge-red' : 'badge-blue'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${r.payment?.status === 'paid' ? 'badge-green' : r.payment?.status === 'cash_pending' ? 'badge-amber' : 'badge-gray'}`}>
                        {r.payment?.status || '—'}
                      </span>
                    </td>
                    <td>{r.payment?.method || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'riders' && (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Rating</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {riders.map((r) => (
                  <tr key={r._id}>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td>{r.phone || '—'}</td>
                    <td>⭐ {r.rating?.toFixed?.(1)}</td>
                    <td className="small">{timeAgo(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
