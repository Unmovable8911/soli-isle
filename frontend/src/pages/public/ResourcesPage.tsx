import { useSearchParams } from 'react-router';
import { useResources } from '../../api/resources.js';
import { ResourceCard } from '../../components/ResourceCard.js';
import { FilterBar } from '../../components/FilterBar.js';
import { InfiniteScroll } from '../../components/InfiniteScroll.js';
import { CardSkeleton, FeedError, FeedEmpty } from '../../components/Feedback.js';

export function ResourcesPage() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') ?? undefined;

  const query = useResources({ category });
  const resources = query.data?.pages.flatMap(p => p.data) ?? [];

  return (
    <div className="list-page">
      <header className="list-page__header"><h1>Resources</h1></header>
      <FilterBar show="categories" />
      {query.isLoading
        ? <div className="resource-grid">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        : query.error
          ? <FeedError onRetry={() => query.refetch()} />
          : resources.length === 0
            ? <FeedEmpty message="No resources here yet." />
            : <InfiniteScroll className="resource-grid" hasNextPage={!!query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage}>
                {resources.map(resource => <ResourceCard key={resource.id} resource={resource} />)}
              </InfiniteScroll>}
    </div>
  );
}
