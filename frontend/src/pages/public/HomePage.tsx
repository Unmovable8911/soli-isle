import { useArticles } from '../../api/articles.js';
import { useMoments } from '../../api/moments.js';
import { ArticleCard } from '../../components/ArticleCard.js';
import { MomentCard } from '../../components/MomentCard.js';
import { CardSkeleton, FeedError, FeedEmpty } from '../../components/Feedback.js';

export function HomePage() {
  const articles = useArticles();
  const moments = useMoments();

  const loading = articles.isLoading || moments.isLoading;
  const error = articles.error || moments.error;

  const recentArticles = articles.data?.pages.flatMap(p => p.data) ?? [];
  const recentMoments = moments.data?.pages.flatMap(p => p.data) ?? [];
  const items = [
    ...recentArticles.map(a => ({ type: 'article' as const, data: a, date: a.published_at })),
    ...recentMoments.map(m => ({ type: 'moment' as const, data: m, date: m.published_at })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  return (
    <>
      <section className="home-hero">
        <h1 className="home-hero__title">Notes from a small,<br /><em>bright</em> isle.</h1>
        <p className="home-hero__sub">
          Essays, fleeting moments, and things worth keeping — in whatever language finds you.
        </p>
      </section>
      <div className="home-feed">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
          : error
            ? <FeedError onRetry={() => { articles.refetch(); moments.refetch(); }} />
            : items.length === 0
              ? <FeedEmpty message="Nothing here yet — check back soon." />
              : items.map(item =>
                  item.type === 'article'
                    ? <ArticleCard key={item.data.id} article={item.data} />
                    : <MomentCard key={item.data.id} moment={item.data} />
                )}
      </div>
    </>
  );
}
