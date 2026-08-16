import { useState, useEffect } from 'react';
import client from '../api/client.js';
import MapView from './MapView.jsx';
import { STATUS_LABELS, formatINR, formatTime, PAYMENT_METHODS } from '../utils/geo.js';

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
  const [method, setMethod] = useState('UPI');

  const isRider = role === 'rider';
  const statusIdx = STEPS.findIndex((s) => s.key === ride.status);
  const completed = ride.status === 'completed';
  const fb = ride.fareBreakup || {};
  const paid = ride.payment?.status === 'paid';
  const cashPending = ride.payment?.status === 'cash_pending';

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

  const pay = () => act(() => client.post(`/rides/${ride._id}/pay`, { method }));
  const settleCash = () => act(() => client.post(`/driver/settle/${ride._id}`));
  const rate = () =>
    act(() => client.post(`/rides/${ride._id}/rate`, { rating, ratedRole: isRider ? 'driver' : 'rider' }));

  const canCancel = ['requested', 'assigned'].includes(ride.status);
  const driver = ride.driver;
  const methodMeta = PAYMENT_METHODS.find((m) => m.id === method) || PAYMENT_METHODS[0];

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
          {fb.subtotal > 0 && (
            <>
              <div className="spread">
                <span className="muted">Base + distance + time</span>
                <b>₹{fb.base} + ₹{fb.distance} + ₹{fb.time}</b>
              </div>
              <div className="spread">
                <span className="muted">Surge</span>
                <b>{fb.surge > 1 ? <span className="badge badge-red">×{fb.surge}</span> : <span className="badge badge-green">×1.0</span>}</b>
              </div>
              <div className="spread">
                <span className="muted">GST (5%)</span>
                <b>{formatINR(fb.gst)}</b>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', margin: '10px 0' }} />
            </>
          )}
          <div className="spread" style={{ fontSize: 18, fontWeight: 800 }}>
            <span>{isRider ? 'Total (incl. GST)' : 'Rider pays'}</span>
            <span style={{ color: 'var(--brand-dark)' }}>{formatINR(ride.fare)}</span>
          </div>
          {!isRider && fb.driverEarnings > 0 && (
            <div className="spread mt" style={{ fontWeight: 700 }}>
              <span className="muted">You earn (after {Math.round((fb.gross - fb.driverEarnings) / fb.gross * 100)}% commission)</span>
              <span style={{ color: 'var(--brand-dark)' }}>{formatINR(fb.driverEarnings)}</span>
            </div>
          )}
          {paid && (
            <div className="alert alert-green mt" style={{ marginBottom: 0 }}>
              ✅ Paid {formatINR(ride.payment.amount || ride.fare)} via {ride.payment.method || 'UPI'}
              {ride.payment.paidAt ? ` · ${formatTime(ride.payment.paidAt)}` : ''}
            </div>
          )}
        </div>

        {/* Rider controls */}
        {isRider && canCancel && (
          <button
            className="btn btn-danger btn-block"
            disabled={busy}
            onClick={() => act(() => client.post(`/rides/${ride._id}/cancel`))}
          >
            Cancel ride {ride.status === 'assigned' ? '· ₹20 fee may apply' : ''}
          </button>
        )}

        {isRider && completed && !paid && !cashPending && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Payment</h3>
            <div className="chip-row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  className={`chip${method === m.id ? ' chip-active' : ''}`}
                  onClick={() => setMethod(m.id)}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={pay}>
              {method === 'Cash'
                ? `💵 Pay ${formatINR(ride.fare)} by cash to the driver`
                : `${methodMeta.icon} Pay ${formatINR(ride.fare)} by ${method} · mock gateway`}
            </button>
            <p className="small muted" style={{ marginBottom: 0 }}>
              {method === 'Cash'
                ? 'Hand over the cash to your driver, who will confirm the collection.'
                : method === 'Card'
                  ? 'Simulated card payment — no real money is charged in this demo.'
                  : 'Simulated UPI payment — no real money is charged in this demo.'}
            </p>
          </div>
        )}

        {isRider && completed && cashPending && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Payment by cash</h3>
            <div className="alert alert-warn mb">
              You chose to pay {formatINR(ride.payment.amount || ride.fare)} in cash. Hand it to the
              driver — payment is confirmed once they mark it collected.
            </div>
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
            ✅ Complete trip · earn {formatINR(fb.driverEarnings)}
          </button>
        )}
        {!isRider && completed && cashPending && (
          <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={settleCash}>
            💵 Confirm cash collection · {formatINR(ride.payment.amount || ride.fare)}
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
