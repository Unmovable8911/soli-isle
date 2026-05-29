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
  return (
    <a href={resource.url} className="resource-card" target="_blank" rel="noopener noreferrer">
      {resource.cover_image && <img src={resource.cover_image} alt="" />}
      <h3>{resource.translation.title}</h3>
      <p>{resource.translation.description}</p>
      {resource.category && (
        <span className="category-label">{resource.category.translation.name ?? resource.category.slug}</span>
      )}
    </a>
  );
}
