import { RichContent } from './RichContent.js';

interface MomentCardProps {
  moment: {
    id: string;
    published_at: string;
    translation: { body: string };
    tags: { id: string; slug: string; translation: { name: string | null } }[];
  };
}

export function MomentCard({ moment }: MomentCardProps) {
  return (
    <div className="moment-card">
      <RichContent content={moment.translation.body} />
      {moment.tags.length > 0 && (
        <div className="moment-card__tags">
          {moment.tags.map(tag => (
            <span key={tag.id} className="tag-pill">{tag.translation.name ?? tag.slug}</span>
          ))}
        </div>
      )}
      <time dateTime={moment.published_at}>
        {new Date(moment.published_at).toLocaleDateString()}
      </time>
    </div>
  );
}
