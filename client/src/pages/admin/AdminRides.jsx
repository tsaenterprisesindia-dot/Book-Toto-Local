import { useEffect, useState } from 'react';
import client from '../../api/client.js';
import { formatINR, timeAgo } from '../../utils/geo.js';

export default function AdminRides() {
  const [rides, setRides] = useState([]);

  useEffect(() => {
    client.get('/admin/rides').then(({ data }) => setRides(data.rides)).catch(() => {});
  }, []);

  return (
    <div className="fade-in">
      <h2 style={{ marginTop: 0 }}>🚕 Rides</h2>
      <div className="card table-wrap">
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
      </div>
    </div>
  );
}
