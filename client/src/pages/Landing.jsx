import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/super-toto-logo.png';

export default function Landing() {
  const { user } = useAuth();
  const start = user ? (user.role === 'driver' ? '/driver' : user.role === 'admin' ? '/admin' : '/ride') : '/register';

  return (
    <div className="landing">
      <div className="hero">
        <img src={logo} alt="Super Toto Local logo" className="hero-logo" />
        <span className="chip chip-active" style={{ fontSize: 15, padding: '8px 16px' }}>
          Your local toto, on demand
        </span>
        <h1>
          Book a <span className="accent">toto</span>,<br />
          any time. Anywhere.
        </h1>
        <p>
          Super Toto Local connects you with nearby totos &amp; e-rickshaws in minutes — with live
          tracking, transparent fares, mock payments <b>and Face Recognition login</b>.
        </p>
        <p className="muted" style={{ marginTop: '-6px', marginBottom: '22px' }}>
          A Unit of TSA Enterprises
        </p>
        <div className="hero-btns">
          <Link to={start} className="btn btn-primary btn-lg">
            {user ? 'Open app' : 'Get started'}
          </Link>
          {!user && (
            <>
              <Link to="/login" className="btn btn-ghost btn-lg">
                Log in
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="card demo-card">
        <h3>🔑 Try it with the demo accounts</h3>
        <div className="demo-accounts">
          <div className="demo-account">
            <b>👤 Rider</b>
            <div className="small muted">rider@supertoto.local</div>
            <div className="small muted">demo123</div>
          </div>
          <div className="demo-account">
            <b>🛺 Driver</b>
            <div className="small muted">driver@supertoto.local</div>
            <div className="small muted">demo123</div>
          </div>
          <div className="demo-account">
            <b>🛠️ Admin</b>
            <div className="small muted">admin@supertoto.local</div>
            <div className="small muted">demo123</div>
          </div>
        </div>
        <p className="small muted mt">
          Tip: open two browser windows — log in as rider in one and driver in the other, then book
          a ride to watch live dispatch &amp; tracking.
        </p>
      </div>

      <div className="features">
        <div className="feature">
          <div className="icon">📱</div>
          <h4>Book in seconds</h4>
          <p>Set pickup &amp; drop on the map, see the fare instantly, tap to request.</p>
        </div>
        <div className="feature">
          <div className="icon">🛰️</div>
          <h4>Live tracking</h4>
          <p>Watch your toto approach in real time over WebSockets.</p>
        </div>
        <div className="feature">
          <div className="icon">🛺</div>
          <h4>Driver app</h4>
          <p>Go online, accept nearby ride requests, complete trips and earn.</p>
        </div>
        <div className="feature">
          <div className="icon">📊</div>
          <h4>Admin dashboard</h4>
          <p>Approve drivers, monitor rides and track revenue.</p>
        </div>
        <div className="feature">
          <div className="icon">💳</div>
          <h4>Mock payments</h4>
          <p>Cashless UPI-style payment flow after every completed ride.</p>
        </div>
        <div className="feature">
          <div className="icon">⭐</div>
          <h4>Ratings</h4>
          <p>Rate your driver and rider to keep the community trusted.</p>
        </div>
      </div>
    </div>
  );
}
