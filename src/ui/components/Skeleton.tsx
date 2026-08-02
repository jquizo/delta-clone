import type { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

/** A pulsing placeholder block. Always carries aria-hidden — the loading state itself should be announced by the container (e.g. role="status"), not by every individual block. */
export function Skeleton({ className = '', style }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-gray-200 ${className}`} style={style} />;
}

export function SummaryHeaderSkeleton() {
  return (
    <div role="status" aria-label="Loading portfolio summary" className="mb-6 grid grid-cols-2 gap-4 rounded border p-4 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-2 h-3 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
}

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 3 }: TableSkeletonProps) {
  return (
    <div role="status" aria-label="Loading holdings">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b py-2">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface ChartSkeletonProps {
  height?: number;
  label: string;
}

export function ChartSkeleton({ height = 200, label }: ChartSkeletonProps) {
  return (
    <div role="status" aria-label={label} className="mb-6 rounded border p-4">
      <Skeleton className="mb-2 h-4 w-32" />
      <Skeleton style={{ height }} className="w-full" />
    </div>
  );
}
