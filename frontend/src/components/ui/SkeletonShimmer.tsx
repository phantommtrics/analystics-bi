interface SkeletonProps {
  className?: string
}

export function SkeletonShimmer({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer animate-shimmer rounded ${className}`}
    ></div>
  )
}
