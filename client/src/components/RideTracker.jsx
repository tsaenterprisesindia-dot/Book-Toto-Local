import { useState, useEffect } from 'react';
import client from '../api/client.js';
import MapView from './MapView.jsx';
import { STATUS_LABELS, formatINR, formatTime } from '../utils/geo.js';

const STEPS = [
  { key: 'assigned', label: 'Toto confirmed' },
  { key: 'driver_arrived', label: 'Driver arrived' },
  { key: 'in_progress', label: 'Trip started' },
  { key: 'completed', label: 'Completed' },
];

function StarPicker({ value, onChange, disabled }) {
  return (
    <div className="row">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          disabled={disabled}
          onClick={() => onChange(n)}
          style={{
            fontSize: 26,
            background: 'none',
            border: 'none',
            filter: n <= value ? 'none' : 'grayscale(1)',
          }}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

export default function RideTracker({ ride, role, driverPos, setRide, socket }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rating, setRating] = useState(0);

  const isRider = role === 'rider';
  const statusIdx = STEPS.findIndex((s) => s.key === ride.status);
  const completed = ride.status === 'completed';

  useEffect(() => {
    socket?.emit('ride:join', ride._id);
  }, [ride._id, socket]);

  const act = async (fn, then) => {
    setBusy(true);
    setErr('');
    try {
      const { data } = await fn();
      setRide(data.ride || data);
      then?.(data);
    } catch (e) {
      setErr(e.response?.data?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const pay = () => act(() => client.post(`/rides/${ride._id}/pay`, { method: 'UPI' }));
  const rate = () =>
    act(() => client.post(`/rides/${ride._id}/rate`, { rating, ratedRole: isRider ? 'driver' : 'rider' }));

  const canCancel = ['requested', 'assigned'].includes(ride.status);
  const driver = ride.driver;
  const paid = ride.payment?.status === 'paid';

  return (
    <div className="grid-2 fade-in">
      <div className="map-col">
        <MapView
          pickup={ride.pickup}
          drop={ride.drop}
          driverPos={driverPos || (ride.driver?.location?.lat != null ? ride.driver.location : null)}
        />
      </div>

      <div className="stack">
        <div className="card">
          <div className="spread">
            <h3 style={{ margin: 0 }}>
              {isRider ? 'Your ride' : 'Ride in progress'} ·{' '}
              <span className="badge badge-blue">{STATUS_LABELS[ride.status]}</span>
            </h3>
          </div>

          {err && <div className="err-box mt">{err}</div>}

          {driver ? (
            <div className="card mt" style={{ boxShadow: 'none', background: 'var(--bg)' }}>
              <div className="row">
                <span className="avatar" style={{ background: '#1d4ed8' }}>
                  {driver.name?.[0]?.toUpperCase()}
                </span>
                <div>
                  <b>{driver.name}</b>
                  <div className="small muted">
                    {driver.vehicleType} · {driver.vehicleNumber || '—'} · ⭐ {driver.rating?.toFixed?.(1) || '—'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="alert alert-warn mt pulse">
              Searching for a nearby toto… hold on, a driver will be notified.
            </div>
          )}

          <ul className="timeline mt">
            {STEPS.map((s, i) => (
              <li
                key={s.key}
                className={
                  ride.status === s.key || (ride.status === 'completed' && i <= statusIdx)
                    ? 'done'
                    : ride.status === s.key
                      ? 'active'
                      : ''
                }
              >
                <span className="dot" />
                <div>
                  <div className="t-label">{s.label}</div>
                  <div className="t-sub">
                    {s.key === 'assigned' && formatTime(ride.acceptedAt)}
                    {s.key === 'driver_arrived' && formatTime(ride.arrivedAt)}
                    {s.key === 'in_progress' && formatTime(ride.startedAt)}
                    {s.key === 'completed' && formatTime(ride.completedAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="spread">
            <div>
              <div className="small muted">Pickup</div>
              <b>{ride.pickup.name}</b>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="small muted">Drop</div>
              <b>{ride.drop.name}</b>
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', margin: '14px 0' }} />
          <div className="spread">
            <span className="muted">Distance</span>
            <b>{ride.distanceKm} km</b>
          </div>
          <div className="spread">
            <span className="muted">Est. time</span>
            <b>{ride.durationMin} min</b>
          </div>
          <div className="spread" style={{ fontSize: 18, fontWeight: 800 }}>
            <span>Fare</span>
            <span style={{ color: 'var(--brand-dark)' }}>{formatINR(ride.fare)}</span>
          </div>
        </div>

        {/* Rider controls */}
        {isRider && canCancel && (
          <button
            className="btn btn-danger btn-block"
            disabled={busy}
            onClick={() => act(() => client.post(`/rides/${ride._id}/cancel`))}
          >
            Cancel ride
          </button>
        )}

        {isRider && completed && !paid && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Payment</h3>
            <div className="spread mb">
              <span className="muted">Fare (UPI)</span>
              <b>{formatINR(ride.fare)}</b>
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={pay}>
              💳 Pay {formatINR(ride.fare)} · mock UPI
            </button>
          </div>
        )}

        {isRider && completed && paid && !ride.riderRating && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Rate your toto driver</h3>
            <StarPicker value={rating} onChange={setRating} />
            <button className="btn btn-primary btn-block mt" disabled={busy || !rating} onClick={rate}>
              Submit rating
            </button>
          </div>
        )}

        {isRider && completed && ride.riderRating && (
          <div className="alert alert-green">Thanks! You rated ⭐ {ride.riderRating}.</div>
        )}

        {/* Driver controls */}
        {!isRider && ride.status === 'assigned' && (
          <button
            className="btn btn-amber btn-block btn-lg"
            disabled={busy}
            onClick={() => act(() => client.post(`/driver/arrived/${ride._id}`))}
          >
            📍 I have arrived at pickup
          </button>
        )}
        {!isRider && ride.status === 'driver_arrived' && (
          <button
            className="btn btn-primary btn-block btn-lg"
            disabled={busy}
            onClick={() => act(() => client.post(`/driver/start/${ride._id}`))}
          >
            ▶️ Start trip
          </button>
        )}
        {!isRider && ride.status === 'in_progress' && (
          <button
            className="btn btn-primary btn-block btn-lg"
            disabled={busy}
            onClick={() => act(() => client.post(`/driver/complete/${ride._id}`))}
          >
            ✅ Complete trip · collect {formatINR(ride.fare)}
          </button>
        )}
        {!isRider && completed && !ride.driverRating && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Rate your rider</h3>
            <StarPicker value={rating} onChange={setRating} />
            <button className="btn btn-primary btn-block mt" disabled={busy || !rating} onClick={rate}>
              Submit rating
            </button>
          </div>
        )}
        {!isRider && completed && ride.driverRating && (
          <div className="alert alert-green">You rated the rider ⭐ {ride.driverRating}.</div>
        )}
      </div>
    </div>
  );
}
