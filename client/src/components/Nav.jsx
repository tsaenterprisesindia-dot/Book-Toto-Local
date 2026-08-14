import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const home = user?.role === 'driver' ? '/driver' : user?.role === 'admin' ? '/admin' : '/ride';

  const doLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="nav">
      <Link to={user ? home : '/'} className="brand">
        <span className="toto">🛺</span> Book Toto Local
      </Link>
      <div className="nav-links">
        {user?.role === 'rider' && (
          <>
            <NavLink to="/ride" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Book a toto
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              My rides
            </NavLink>
          </>
        )}
        {user?.role === 'driver' && (
          <NavLink to="/history" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            My rides
          </NavLink>
        )}
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Dashboard
          </NavLink>
        )}
        <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          Profile
        </NavLink>
        <div className="user-chip">
          <span className="avatar">{user?.name?.[0]?.toUpperCase()}</span>
          <span className="small muted">{user?.name}</span>
        </div>
        <button className="logout-btn" onClick={doLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}
