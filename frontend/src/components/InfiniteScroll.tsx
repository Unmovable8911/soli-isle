import { useEffect, useRef, type ReactNode } from 'react';

interface InfiniteScrollProps {
  children: ReactNode;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  className?: string;
}

export function InfiniteScroll({ children, hasNextPage, isFetchingNextPage, fetchNextPage, className }: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]!.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className={className}>
      {children}
      <div ref={sentinelRef} className="infinite-scroll__sentinel" aria-hidden="true" />
      {isFetchingNextPage && <div className="infinite-scroll__status" role="status" aria-live="polite">Loading more…</div>}
    </div>
  );
}
