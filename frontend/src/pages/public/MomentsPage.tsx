import { useSearchParams } from 'react-router';
import { useMoments } from '../../api/moments.js';
import { MomentCard } from '../../components/MomentCard.js';
import { FilterBar } from '../../components/FilterBar.js';
import { InfiniteScroll } from '../../components/InfiniteScroll.js';
import { CardSkeleton, FeedError, FeedEmpty } from '../../components/Feedback.js';

export function MomentsPage() {
  const [searchParams] = useSearchParams();
  const tag = searchParams.get('tag') ?? undefined;

  const query = useMoments({ tag });
  const moments = query.data?.pages.flatMap(p => p.data) ?? [];

  return (
    <div className="list-page">
      <header className="list-page__header"><h1>Moments</h1></header>
      <FilterBar show="tags" />
      {query.isLoading
        ? <div className="timeline">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        : query.error
          ? <FeedError onRetry={() => query.refetch()} />
          : moments.length === 0
            ? <FeedEmpty message="No moments here yet." />
            : <InfiniteScroll className="timeline" hasNextPage={!!query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage}>
                {moments.map(moment => <MomentCard key={moment.id} moment={moment} />)}
              </InfiniteScroll>}
    </div>
  );
}
