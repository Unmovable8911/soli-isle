import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <strong>Soli Isle</strong>
        <p>An archipelago of essays, moments &amp; finds</p>
      </div>
      <nav className="site-footer__nav">
        <Link to="/articles">Articles</Link>
        <Link to="/moments">Moments</Link>
        <Link to="/resources">Resources</Link>
      </nav>
    </footer>
  );
}
