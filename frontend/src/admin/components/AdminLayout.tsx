import { Outlet, Link, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext.js';

export function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // proceed to login regardless — session may already be invalid
    }
    navigate('/admin/login');
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <nav>
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/articles">Articles</Link>
          <Link to="/admin/moments">Moments</Link>
          <Link to="/admin/resources">Resources</Link>
          <Link to="/admin/pages">Pages</Link>
          <Link to="/admin/categories">Categories</Link>
          <Link to="/admin/tags">Tags</Link>
          <Link to="/admin/languages">Languages</Link>
          <Link to="/admin/ui-strings">UI Strings</Link>
          <Link to="/admin/media">Media</Link>
        </nav>
        <button type="button" onClick={handleLogout}>Logout</button>
      </aside>
      <main className="admin-content"><Outlet /></main>
    </div>
  );
}
