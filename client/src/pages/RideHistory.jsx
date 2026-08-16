import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import Nav from '../components/Nav.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatINR, timeAgo, PAYMENT_METHODS } from '../utils/geo.js';

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

function payStatus(ride) {
  if (ride.status === 'cancelled_by_rider' && ride.cancellationFee > 0) {
    return ride.payment?.status === 'paid'
      ? { text: `Fee paid ✓`, paid: true }
      : { text: `Fee pending · ${formatINR(ride.cancellationFee)}`, paid: false };
  }
  if (ride.payment?.status === 'paid') {
    return { text: `Paid ✓ ${ride.payment.method || ''}`.trim(), paid: true };
  }
  if (ride.payment?.status === 'cash_pending') {
    return { text: 'Cash pending', paid: false };
  }
  return { text: 'Payment pending', paid: false };
}

export default function RideHistory() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    client
      .get('/rides/mine')
      .then(({ data }) => setRides(data.rides))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const payFee = async (id) => {
    setBusyId(id);
    try {
      await client.post(`/rides/${id}/pay`, { method: 'UPI' });
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not pay the cancellation fee');
    } finally {
      setBusyId(null);
    }
  };

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
            {rides.map((r) => {
              const ps = payStatus(r);
              return (
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
                      <div style={{ fontWeight: 800, fontSize: 16 }}>
                        {r.status === 'cancelled_by_rider' && r.cancellationFee > 0
                          ? formatINR(r.cancellationFee)
                          : formatINR(r.fare)}
                      </div>
                      <div className="small muted">
                        {r.status === 'cancelled_by_rider' && r.cancellationFee > 0
                          ? 'Cancellation fee'
                          : 'Fare (incl. GST)'}
                      </div>
                      <div className={`small ${ps.paid ? 'muted' : ''}`}>
                        {ps.text}
                      </div>
                    </div>
                  </div>
                  {r.status === 'cancelled_by_rider' && r.cancellationFee > 0 && !ps.paid && user?.role === 'rider' && (
                    <button
                      className="btn btn-primary btn-block mt"
                      disabled={busyId === r._id}
                      onClick={() => payFee(r._id)}
                    >
                      Pay cancellation fee · {formatINR(r.cancellationFee)} (UPI)
                    </button>
                  )}
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
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
