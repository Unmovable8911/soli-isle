import { useState } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext.js';
import { ThemeToggle } from '../../components/ThemeToggle.js';

const NAV: { group: string; links: [string, string][] }[] = [
  { group: 'Content', links: [['/admin', 'Dashboard'], ['/admin/articles', 'Articles'], ['/admin/moments', 'Moments'], ['/admin/resources', 'Resources'], ['/admin/pages', 'Pages']] },
  { group: 'Taxonomy', links: [['/admin/categories', 'Categories'], ['/admin/tags', 'Tags']] },
  { group: 'System', links: [['/admin/languages', 'Languages'], ['/admin/ui-strings', 'UI Strings'], ['/admin/media', 'Media'], ['/admin/social-links', 'Social Links']] },
];

export function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    try { await logout(); } catch { /* proceed regardless */ }
    navigate('/admin/login');
  }

  return (
    <div className={`admin-layout${open ? ' is-open' : ''}`}>
      <button type="button" className="admin-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>≡</button>
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-brand" onClick={() => setOpen(false)}>Soli Isle</Link>
        <nav onClick={() => setOpen(false)}>
          {NAV.map(({ group, links }) => (
            <div key={group} className="admin-nav-group">
              <p className="admin-nav-group__label">{group}</p>
              {links.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/admin'}>{label}</NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <ThemeToggle />
          <button type="button" className="btn btn--ghost" onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className="admin-content"><Outlet /></main>
    </div>
  );
}
