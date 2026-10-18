import type { Locale } from "@/config/site";
import type { LanguageVersionLink } from "@/domain/article-language";
import type { Messages } from "@/messages";

export type ArticleLanguageLabels = Messages["reader"]["languages"];

export type FallbackNoticeLabels = Messages["reader"]["fallback"];

/**
 * The work-level language switcher: every Site Locale, with the Locale Coverage
 * of this work, pointing at the same Article under each prefix. A Locale with no
 * version is still offered — it lands on the Content Fallback page — but it says
 * so, so the Reader is never told a version exists when it does not.
 */
export function ArticleLanguageVersions({
  current,
  versions,
  names,
  labels,
}: {
  /** The Locale of the URL being read, which may be a Content Fallback page. */
  current: Locale;
  versions: readonly LanguageVersionLink[];
  names: Record<Locale, string>;
  labels: ArticleLanguageLabels;
}) {
  return (
    <nav className="article-locales" aria-label={labels.label}>
      <ul>
        {versions.map((version) => (
          <li key={version.locale} className="article-locales-item">
            <a
              href={version.href}
              hrefLang={version.locale}
              lang={version.locale}
              aria-current={version.locale === current ? "page" : undefined}
              aria-describedby={
                version.hasVersion ? undefined : `article-locale-note-${version.locale}`
              }
              data-version={version.hasVersion ? "own" : "fallback"}
            >
              {names[version.locale]}
            </a>
            {version.hasVersion ? null : (
              <span className="article-locale-note" id={`article-locale-note-${version.locale}`}>
                {labels.missing}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The one notice a Content Fallback page shows, above the default version's
 * body. The page keeps the requested prefix and stays noindex — this is what
 * tells the Reader why they are reading another language.
 */
export function FallbackNotice({
  labels,
  requested,
  shown,
}: {
  labels: FallbackNoticeLabels;
  /** Display name of the Locale in the URL. */
  requested: string;
  /** Display name of the Locale the body is actually in. */
  shown: string;
}) {
  return (
    <p className="reader-notice" role="note">
      {labels.notice.replaceAll("{requested}", requested).replaceAll("{shown}", shown)}
    </p>
  );
}
