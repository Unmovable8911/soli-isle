import { Outlet, Link, NavLink } from 'react-router';
import { LanguageSwitcher } from './LanguageSwitcher.js';

export function Layout() {
  return (
    <div className="layout">
      <div className="bg-decor" aria-hidden="true">
        <span className="bg-blob bg-blob--a" />
        <span className="bg-blob bg-blob--b" />
        <span className="bg-grain" />
      </div>
      <header className="masthead">
        <Link to="/" className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__name">Soli&nbsp;Isle</span>
        </Link>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/articles">Articles</NavLink>
          <NavLink to="/moments">Moments</NavLink>
          <NavLink to="/resources">Resources</NavLink>
        </nav>
        <LanguageSwitcher />
      </header>
      <main><Outlet /></main>
      <footer>
        <strong>Soli Isle</strong>
        <p>An archipelago of essays, moments &amp; finds</p>
      </footer>
    </div>
  );
}
