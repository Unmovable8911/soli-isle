import { Outlet, Link } from 'react-router';
import { LanguageSwitcher } from './LanguageSwitcher.js';

export function Layout() {
  return (
    <div className="layout">
      <header>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/articles">Articles</Link>
          <Link to="/moments">Moments</Link>
          <Link to="/resources">Resources</Link>
        </nav>
        <LanguageSwitcher />
      </header>
      <main><Outlet /></main>
      <footer><p>Soli Isle</p></footer>
    </div>
  );
}
