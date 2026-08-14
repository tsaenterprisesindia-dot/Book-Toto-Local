import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import Nav from '../components/Nav.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR, timeAgo } from '../utils/geo.js';

const BADGE = {
  completed: 'badge-green',
  requested: 'badge-blue',
  assigned: 'badge-blue',
  driver_arrived: 'badge-blue',
  in_progress: 'badge-amber',
  cancelled_by_rider: 'badge-red',
  cancelled_by_driver: 'badge-red',
  no_driver: 'badge-red',
};

export default function RideHistory() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get('/rides/mine')
      .then(({ data }) => setRides(data.rides))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Nav />
      <div className="page">
        <div className="spread">
          <h2>🧾 My rides</h2>
          {user?.role === 'rider' && (
            <Link to="/ride" className="btn btn-primary">
              Book a toto
            </Link>
          )}
        </div>

        {loading ? (
          <div className="page-loader">Loading…</div>
        ) : rides.length === 0 ? (
          <div className="card">
            <p className="muted">No rides yet. Book your first toto!</p>
          </div>
        ) : (
          <div className="stack">
            {rides.map((r) => (
              <div className="card" key={r._id}>
                <div className="spread">
                  <div>
                    <b>
                      {r.pickup.name} → {r.drop.name}
                    </b>
                    <div className="small muted">
                      {timeAgo(r.createdAt)} · {r.distanceKm} km · ~{r.durationMin} min
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={`badge mb ${BADGE[r.status] || 'badge-gray'}`}>{r.status}</div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{formatINR(r.fare)}</div>
                    <div className="small muted">
                      {r.payment?.status === 'paid' ? 'Paid ✓' : 'Payment pending'}
                    </div>
                  </div>
                </div>
                {r.driver && user?.role === 'rider' && (
                  <div className="small muted mt">
                    🛺 {r.driver.name} · {r.driver.vehicleNumber}
                    {r.riderRating ? ` · you rated ⭐ ${r.riderRating}` : ''}
                  </div>
                )}
                {r.rider && user?.role === 'driver' && (
                  <div className="small muted mt">
                    👤 {r.rider.name}
                    {r.driverRating ? ` · you rated ⭐ ${r.driverRating}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
