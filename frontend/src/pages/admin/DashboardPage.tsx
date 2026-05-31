import { Link } from 'react-router';

export function DashboardPage() {
  return (
    <div className="admin-dashboard">
      <h1>Dashboard</h1>
      <div className="admin-quick-actions">
        <Link to="/admin/articles/new">New Article</Link>
        <Link to="/admin/moments/new">New Moment</Link>
        <Link to="/admin/resources/new">New Resource</Link>
        <Link to="/admin/pages/new">New Page</Link>
      </div>
    </div>
  );
}
