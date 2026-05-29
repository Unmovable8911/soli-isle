import { useSearchParams } from 'react-router';
import { useArticles } from '../../api/articles.js';
import { ArticleCard } from '../../components/ArticleCard.js';
import { FilterBar } from '../../components/FilterBar.js';
import { InfiniteScroll } from '../../components/InfiniteScroll.js';

export function ArticlesPage() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') ?? undefined;
  const tag = searchParams.get('tag') ?? undefined;

  const query = useArticles({ category, tag });
  const articles = query.data?.pages.flatMap(p => p.data) ?? [];

  return (
    <div>
      <h1>Articles</h1>
      <FilterBar show="both" />
      <InfiniteScroll hasNextPage={!!query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage}>
        {articles.map(article => <ArticleCard key={article.id} article={article} />)}
      </InfiniteScroll>
    </div>
  );
}
