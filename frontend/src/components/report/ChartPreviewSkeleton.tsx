import { SkeletonShimmer } from '../ui/SkeletonShimmer'

interface ChartPreviewSkeletonProps {
  height?: number | string
  className?: string
}

export function ChartPreviewSkeleton({
  height = 220,
  className = '',
}: ChartPreviewSkeletonProps) {
  return (
    <div
      className={`rounded-md border border-border bg-bg-primary p-3 ${className}`}
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="mb-3 flex h-32 items-end justify-between gap-2 px-1">
        {[40, 72, 56, 88, 48, 64, 80, 52].map((h, i) => (
          <SkeletonShimmer key={i} className="w-full max-w-[2rem] rounded-t" style={{ height: h }} />
        ))}
      </div>
      <SkeletonShimmer className="w-full rounded" style={{ height }} />
    </div>
  )
}
