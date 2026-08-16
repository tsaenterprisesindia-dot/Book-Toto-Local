import { useEffect, useState, useCallback } from 'react';
import client from '../api/client.js';
import Nav from '../components/Nav.jsx';
import MapView from '../components/MapView.jsx';
import RideTracker from '../components/RideTracker.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { DESTINATIONS, formatINR } from '../utils/geo.js';

const ACTIVE_STATUSES = ['requested', 'assigned', 'driver_arrived', 'in_progress'];

export default function RiderHome() {
  const { socket } = useSocket();
  const [ride, setRide] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pickup, setPickup] = useState({ ...DESTINATIONS[0] });
  const [drop, setDrop] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [settingField, setSettingField] = useState('pickup');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const currentUserId = JSON.parse(localStorage.getItem('btl_user') || '{}')?.id;

  const refreshActive = useCallback(async () => {
    try {
      const { data } = await client.get('/rides/mine');
      const active = data.rides.find((r) => ACTIVE_STATUSES.includes(r.status));
      if (active) setRide(active);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshActive();
  }, [refreshActive]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (r) => {
      if (r.rider?._id !== currentUserId) return;
      if (['cancelled_by_rider', 'cancelled_by_driver', 'no_driver'].includes(r.status)) {
        setRide(null);
        setDriverPos(null);
        if (r.status === 'no_driver') setNotice('No totos were available nearby. Please try again.');
        return;
      }
      setRide(r);
      if (!ACTIVE_STATUSES.includes(r.status)) setDriverPos(null);
    };
    const onLoc = (pos) => setDriverPos(pos);

    socket.on('ride:updated', onUpdate);
    socket.on('ride:driver_location', onLoc);
    return () => {
      socket.off('ride:updated', onUpdate);
      socket.off('ride:driver_location', onLoc);
    };
  }, [socket, currentUserId]);

  useEffect(() => {
    if (!pickup || !drop) {
      setEstimate(null);
      return;
    }
    let alive = true;
    client
      .post('/rides/estimate', { pickup, drop })
      .then(({ data }) => alive && setEstimate(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pickup, drop]);

  const pickDestination = (e, which) => {
    const found = DESTINATIONS.find((d) => d.name === e.target.value);
    if (which === 'pickup') setPickup(found);
    else setDrop(found);
  };

  const onMapClick = (latlng) => {
    if (settingField === 'pickup') setPickup({ name: 'Custom pickup', ...latlng });
    else setDrop({ name: 'Custom drop', ...latlng });
  };

  const requestRide = async () => {
    if (!pickup || !drop) return;
    setBusy(true);
    setErr('');
    try {
      const { data } = await client.post('/rides', { pickup, drop });
      setRide(data.ride);
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not request a ride');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="page-loader">Loading…</div>;

  return (
    <>
      <Nav />
      <div className="page">
        {ride ? (
          <RideTracker
            ride={ride}
            role="rider"
            driverPos={driverPos}
            setRide={setRide}
            socket={socket}
          />
        ) : (
          <>
            <h2>Book a toto 🛺</h2>
            <p className="muted mb">
              Pick a pickup point and drop on the map (click to set). Tap <b>Request toto</b> to
              notify the nearest available driver.
            </p>

            {err && <div className="alert alert-warn mb">{err}</div>}
            {notice && (
              <div className="alert alert-info mb" onClick={() => setNotice('')}>
                {notice}
              </div>
            )}

            <div className="grid-2">
              <div className="map-col">
                <MapView
                  center={pickup}
                  pickup={pickup}
                  drop={drop}
                  onMapClick={onMapClick}
                />
              </div>

              <div className="stack">
                <div className="card">
                  <h3>Trip details</h3>

                  <div className="chip-row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button
                      className={`chip${settingField === 'pickup' ? ' chip-active' : ''}`}
                      onClick={() => setSettingField('pickup')}
                    >
                      Set pickup on map
                    </button>
                    <button
                      className={`chip${settingField === 'drop' ? ' chip-active' : ''}`}
                      onClick={() => setSettingField('drop')}
                    >
                      Set drop on map
                    </button>
                  </div>

                  <div className="field">
                    <label>Pickup</label>
                    <select className="input" value={pickup.name} onChange={(e) => pickDestination(e, 'pickup')}>
                      {DESTINATIONS.map((d) => (
                        <option key={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Drop</label>
                    <select className="input" value={drop?.name || ''} onChange={(e) => pickDestination(e, 'drop')}>
                      <option value="">Select a destination…</option>
                      {DESTINATIONS.filter((d) => d.name !== pickup.name).map((d) => (
                        <option key={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {estimate ? (
                    <div className="card mt" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
                      <div className="spread">
                        <span className="muted">Distance</span>
                        <b>{estimate.distanceKm} km · ~{estimate.durationMin} min</b>
                      </div>
                      <div className="spread">
                        <span className="muted">Base + distance + time</span>
                        <b>
                          ₹{estimate.fare.base} + ₹{estimate.fare.distance} + ₹{estimate.fare.time}
                        </b>
                      </div>
                      {estimate.fare.surge > 1 ? (
                        <div className="spread">
                          <span className="muted">
                            Surge <span className="badge badge-red" style={{ marginLeft: 6 }}>×{estimate.fare.surge}</span>
                          </span>
                          <b>{formatINR(estimate.fare.gross - estimate.fare.subtotal)} extra</b>
                        </div>
                      ) : (
                        <div className="spread">
                          <span className="muted">Surge</span>
                          <b className="badge badge-green">×1.0 — no surge</b>
                        </div>
                      )}
                      <div className="spread">
                        <span className="muted">GST (5%)</span>
                        <b>{formatINR(estimate.fare.gst)}</b>
                      </div>
                      <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', margin: '10px 0' }} />
                      <div className="spread" style={{ fontSize: 20, fontWeight: 800 }}>
                        <span>Estimated total</span>
                        <span style={{ color: 'var(--brand-dark)' }}>{formatINR(estimate.fare.total)}</span>
                      </div>
                      {estimate.activeRequests > 0 && (
                        <div className="small muted mt">
                          {estimate.activeRequests} active request(s) · {estimate.onlineDrivers} driver(s)
                          online — surge adjusts automatically.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="alert alert-info">Select a drop to see the fare estimate.</div>
                  )}

                  <button
                    className="btn btn-primary btn-block btn-lg mt"
                    disabled={!drop || busy}
                    onClick={requestRide}
                  >
                    {busy ? 'Requesting…' : '🛺 Request toto'}
                  </button>
                </div>

                <div className="card">
                  <h3 style={{ margin: 0 }}>How it works</h3>
                  <ul className="small muted" style={{ paddingLeft: 18, marginBottom: 0 }}>
                    <li>Your request is sent to the nearest online driver.</li>
                    <li>The driver has 25 seconds to accept.</li>
                    <li>Once accepted you can track them live on the map.</li>
                    <li>Pay by UPI, Cash or Card at the end of the trip.</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
