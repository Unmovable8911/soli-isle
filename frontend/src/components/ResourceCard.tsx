import { useScrollReveal } from '../hooks/useScrollReveal.js';

interface ResourceCardProps {
  resource: {
    id: string;
    url: string;
    cover_image: string | null;
    translation: { title: string; description: string };
    category: { id: string; slug: string; translation: { name: string | null } } | null;
  };
}

export function ResourceCard({ resource }: ResourceCardProps) {
  const reveal = useScrollReveal<HTMLAnchorElement>();
  return (
    <a ref={reveal} href={resource.url} className="resource-card card card--interactive reveal"
      target="_blank" rel="noopener noreferrer">
      {resource.cover_image && <img src={resource.cover_image} alt="" />}
      <div className="resource-card__body">
        {resource.category && (
          <span className="eyebrow">{resource.category.translation.name ?? resource.category.slug}</span>
        )}
        <h3>{resource.translation.title} <span className="resource-card__ext" aria-hidden="true">↗</span></h3>
        <p>{resource.translation.description}</p>
      </div>
    </a>
  );
}
