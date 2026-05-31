import { Link } from 'react-router';
import { usePublicSocialLinks } from '../api/social-links.js';
import { SOCIAL_META } from '../lib/social-catalog.js';

export function Footer() {
  const { data: socials } = usePublicSocialLinks();
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <strong>Soli Isle</strong>
        <p>An archipelago of essays, moments &amp; finds</p>
      </div>
      <nav className="site-footer__nav" aria-label="Footer">
        <Link to="/articles">Articles</Link>
        <Link to="/moments">Moments</Link>
        <Link to="/resources">Resources</Link>
      </nav>
      {socials && socials.length > 0 && (
        <div className="site-footer__social">
          {socials.map(s => {
            const meta = SOCIAL_META[s.platform];
            if (!meta) return null;
            const external = s.platform !== 'email';
            return (
              <a key={s.id} href={s.url} aria-label={meta.label} className="social-icon"
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {meta.icon}
              </a>
            );
          })}
        </div>
      )}
    </footer>
  );
}
