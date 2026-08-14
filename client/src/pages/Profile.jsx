import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = () => {
    logout();
    navigate('/');
  };

  const fields = [
    { label: 'Name', value: user?.name },
    { label: 'Email', value: user?.email },
    { label: 'Phone', value: user?.phone || '—' },
    { label: 'Role', value: user?.role },
    ...(user?.role === 'driver'
      ? [
          { label: 'Vehicle', value: user?.vehicleType },
          { label: 'Vehicle number', value: user?.vehicleNumber || '—' },
          { label: 'Driver status', value: user?.driverStatus },
          { label: 'Rating', value: `⭐ ${user?.rating?.toFixed?.(1)}` },
          { label: 'Earnings', value: `₹${(user?.earnings || 0).toLocaleString('en-IN')}` },
          { label: 'Total rides', value: String(user?.totalRides || 0) },
        ]
      : []),
  ];

  return (
    <>
      <Nav />
      <div className="page">
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="row" style={{ marginBottom: 16 }}>
            <span className="avatar" style={{ width: 52, height: 52, fontSize: 24 }}>
              {user?.name?.[0]?.toUpperCase()}
            </span>
            <div>
              <h2 style={{ margin: 0 }}>{user?.name}</h2>
              <span className={`badge ${user?.role === 'driver' ? 'badge-amber' : user?.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>
                {user?.role}
              </span>
            </div>
          </div>

          <div className="stack">
            {fields.map((f) => (
              <div className="spread" key={f.label}>
                <span className="muted">{f.label}</span>
                <b>{f.value}</b>
              </div>
            ))}
          </div>

          <button className="btn btn-ghost btn-block mt" onClick={doLogout}>
            Log out
          </button>
        </div>
      </div>
    </>
  );
}
