import { RichContent } from './RichContent.js';
import { useScrollReveal } from '../hooks/useScrollReveal.js';
import { useLanguage } from '../contexts/LanguageContext.js';
import { FallbackBadge } from './FallbackBadge.js';

interface MomentCardProps {
  moment: {
    id: string;
    published_at: string;
    lang: string;
    translation: { body: string };
    tags: { id: string; slug: string; translation: { name: string | null } }[];
  };
}

export function MomentCard({ moment }: MomentCardProps) {
  const reveal = useScrollReveal<HTMLDivElement>();
  const { t } = useLanguage();
  return (
    <div ref={reveal} className="moment-card reveal">
      <FallbackBadge lang={moment.lang} />
      <div className="moment-card__body"><RichContent content={moment.translation.body} /></div>
      {moment.tags.length > 0 && (
        <div className="moment-card__tags">
          {moment.tags.map(tag => (
            <span key={tag.id} className="tag-pill">{tag.translation.name ?? tag.slug}</span>
          ))}
        </div>
      )}
      <time dateTime={moment.published_at}>{t('published_on', 'Published on')} {new Date(moment.published_at).toLocaleDateString()}</time>
    </div>
  );
}
