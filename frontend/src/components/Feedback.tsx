export function CardSkeleton() {
  return (
    <div className="card card-skeleton" aria-hidden="true">
      <span className="skeleton card-skeleton__img" />
      <div className="card-skeleton__lines">
        <span className="skeleton" style={{ height: '1.2rem', width: '70%' }} />
        <span className="skeleton" style={{ height: '.8rem', width: '92%' }} />
        <span className="skeleton" style={{ height: '.8rem', width: '60%' }} />
      </div>
    </div>
  );
}

export function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <p>Something went wrong loading this.</p>
      <button type="button" className="btn btn--ghost" onClick={onRetry}>Retry</button>
    </div>
  );
}

export function FeedEmpty({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}
