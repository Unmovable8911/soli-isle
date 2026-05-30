import { useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { ThemeToggle } from './ThemeToggle.js';
import { Footer } from './Footer.js';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="layout">
      <header className="masthead">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>Soli&nbsp;Isle</Link>
        <button type="button" className="masthead__burger" aria-label="Menu"
          aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>≡</button>
        <nav className={`masthead__nav${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end className="link-underline">Home</NavLink>
          <NavLink to="/articles" className="link-underline">Articles</NavLink>
          <NavLink to="/moments" className="link-underline">Moments</NavLink>
          <NavLink to="/resources" className="link-underline">Resources</NavLink>
        </nav>
        <div className="masthead__actions">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main><Outlet /></main>
      <Footer />
    </div>
  );
}
