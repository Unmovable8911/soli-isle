import { useSearchParams } from 'react-router';
import { useResources } from '../../api/resources.js';
import { ResourceCard } from '../../components/ResourceCard.js';
import { FilterBar } from '../../components/FilterBar.js';
import { InfiniteScroll } from '../../components/InfiniteScroll.js';

export function ResourcesPage() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') ?? undefined;

  const query = useResources({ category });
  const resources = query.data?.pages.flatMap(p => p.data) ?? [];

  return (
    <div>
      <h1>Resources</h1>
      <FilterBar show="categories" />
      <InfiniteScroll hasNextPage={!!query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage}>
        {resources.map(resource => <ResourceCard key={resource.id} resource={resource} />)}
      </InfiniteScroll>
    </div>
  );
}
