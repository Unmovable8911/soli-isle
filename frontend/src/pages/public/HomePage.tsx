import { useArticles } from '../../api/articles.js';
import { useMoments } from '../../api/moments.js';
import { ArticleCard } from '../../components/ArticleCard.js';
import { MomentCard } from '../../components/MomentCard.js';

export function HomePage() {
  const articles = useArticles();
  const moments = useMoments();

  const recentArticles = articles.data?.pages.flatMap(p => p.data) ?? [];
  const recentMoments = moments.data?.pages.flatMap(p => p.data) ?? [];

  const items = [
    ...recentArticles.map(a => ({ type: 'article' as const, data: a, date: a.published_at })),
    ...recentMoments.map(m => ({ type: 'moment' as const, data: m, date: m.published_at })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  return (
    <div className="home-feed">
      {items.map(item =>
        item.type === 'article'
          ? <ArticleCard key={item.data.id} article={item.data} />
          : <MomentCard key={item.data.id} moment={item.data} />
      )}
    </div>
  );
}
