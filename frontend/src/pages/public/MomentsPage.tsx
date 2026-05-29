import { useSearchParams } from 'react-router';
import { useMoments } from '../../api/moments.js';
import { MomentCard } from '../../components/MomentCard.js';
import { FilterBar } from '../../components/FilterBar.js';
import { InfiniteScroll } from '../../components/InfiniteScroll.js';

export function MomentsPage() {
  const [searchParams] = useSearchParams();
  const tag = searchParams.get('tag') ?? undefined;

  const query = useMoments({ tag });
  const moments = query.data?.pages.flatMap(p => p.data) ?? [];

  return (
    <div>
      <h1>Moments</h1>
      <FilterBar show="tags" />
      <InfiniteScroll hasNextPage={!!query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage}>
        {moments.map(moment => <MomentCard key={moment.id} moment={moment} />)}
      </InfiniteScroll>
    </div>
  );
}
