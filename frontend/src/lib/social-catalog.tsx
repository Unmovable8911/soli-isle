import type { ReactNode } from 'react';

export interface SocialMeta { platform: string; label: string; urlHint: string; icon: ReactNode; }

export const SOCIAL_CATALOG: SocialMeta[] = [
  {
    platform: 'github',
    label: 'GitHub',
    urlHint: 'https://github.com/…',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--color-accent-soft)" />
        {/* GitHub mark: cat silhouette simplified */}
        <path
          fill="var(--color-accent)"
          d="M12 6.5a5.5 5.5 0 0 0-1.739 10.716c.275.05.376-.119.376-.265 0-.13-.005-.475-.007-.933-1.531.333-1.855-.738-1.855-.738-.25-.635-.612-.804-.612-.804-.5-.342.038-.335.038-.335.553.039.845.568.845.568.491.842 1.288.599 1.603.458.05-.356.192-.598.35-.736-1.222-.139-2.507-.611-2.507-2.719 0-.6.215-1.091.566-1.476-.056-.14-.245-.699.054-1.456 0 0 .461-.148 1.51.563A5.26 5.26 0 0 1 12 9.928a5.26 5.26 0 0 1 1.378.185c1.048-.711 1.508-.563 1.508-.563.3.757.112 1.316.055 1.456.352.385.565.876.565 1.476 0 2.113-1.287 2.578-2.513 2.714.198.17.374.507.374 1.022 0 .738-.007 1.333-.007 1.514 0 .147.099.319.379.265A5.5 5.5 0 0 0 12 6.5z"
        />
      </svg>
    ),
  },
  {
    platform: 'twitter',
    label: 'X / Twitter',
    urlHint: 'https://x.com/…',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--color-accent-soft)" />
        {/* X letterform */}
        <path
          fill="var(--color-accent)"
          d="M7 7h3.5l1.98 2.9L14.8 7H17l-3.6 4.3L17.5 17H14l-2.14-3.1L9.2 17H7l3.8-4.6L7 7zm1.8 1 3.88 5.6 .15.22h1.17L9.97 8H8.8z"
        />
      </svg>
    ),
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    urlHint: 'https://tiktok.com/@…',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--color-accent-soft)" />
        {/* TikTok music note */}
        <path
          fill="var(--color-accent)"
          d="M15.5 7.5c.8.9 2 1.5 3.3 1.5v2.3a5.57 5.57 0 0 1-3.3-1.1v4.8a4.5 4.5 0 1 1-4.5-4.5h.5v2.3h-.5a2.2 2.2 0 1 0 2.2 2.2V7h2.3v.5z"
        />
      </svg>
    ),
  },
  {
    platform: 'telegram',
    label: 'Telegram',
    urlHint: 'https://t.me/…',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--color-accent-soft)" />
        {/* Telegram paper plane */}
        <path
          fill="var(--color-accent)"
          d="M17.6 7.1 6.2 11.5c-.8.3-.8.8-.1 1l2.8.9 1.1 3.3c.2.5.4.7.8.5l1.2-1.2 2.7 2c.5.3.9.1 1-.4l1.8-8.6c.2-.8-.3-1.1-.9-.9zm-1.5 2.1-5.6 3.4-.2 2-1-3 6.8-2.4z"
        />
      </svg>
    ),
  },
  {
    platform: 'instagram',
    label: 'Instagram',
    urlHint: 'https://instagram.com/…',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--color-accent-soft)" />
        {/* Instagram rounded square + circle + dot */}
        <rect x="7" y="7" width="10" height="10" rx="3" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2.5" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
        <circle cx="16" cy="8" r="0.8" fill="var(--color-accent)" />
      </svg>
    ),
  },
  {
    platform: 'facebook',
    label: 'Facebook',
    urlHint: 'https://facebook.com/…',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--color-accent-soft)" />
        {/* Facebook "f" */}
        <path
          fill="var(--color-accent)"
          d="M13.5 8.5H15V6.5h-1.5C12.1 6.5 11 7.6 11 9v1.5H9.5V12.5H11V17.5h2V12.5h1.5l.5-2H13V9c0-.28.22-.5.5-.5z"
        />
      </svg>
    ),
  },
  {
    platform: 'reddit',
    label: 'Reddit',
    urlHint: 'https://reddit.com/u/…',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--color-accent-soft)" />
        {/* Reddit alien head: circle head + two ears + eyes + smile */}
        <circle cx="12" cy="13" r="4" fill="none" stroke="var(--color-accent)" strokeWidth="1.4" />
        <circle cx="10.2" cy="12.5" r="0.7" fill="var(--color-accent)" />
        <circle cx="13.8" cy="12.5" r="0.7" fill="var(--color-accent)" />
        <path d="M10.5 14.5 q1.5 1 3 0" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" />
        {/* antenna */}
        <circle cx="15" cy="7.5" r="1.2" fill="var(--color-accent)" />
        <line x1="14.1" y1="8.4" x2="12.8" y2="9.8" stroke="var(--color-accent)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    platform: 'email',
    label: 'Email',
    urlHint: 'mailto:you@example.com',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--color-accent-soft)" />
        {/* Envelope */}
        <rect x="6" y="8" width="12" height="8" rx="1.5" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
        <path d="M6 9l6 4.5L18 9" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    platform: 'rss',
    label: 'RSS',
    urlHint: '/rss.xml',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--color-accent-soft)" />
        {/* RSS: dot + two arcs */}
        <circle cx="8" cy="16" r="1.5" fill="var(--color-accent)" />
        <path d="M8 13a5 5 0 0 1 5 5" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 9.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export const SOCIAL_META: Record<string, SocialMeta> = Object.fromEntries(SOCIAL_CATALOG.map(s => [s.platform, s]));
