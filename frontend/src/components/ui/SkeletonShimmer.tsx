import type { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export function SkeletonShimmer({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer animate-shimmer rounded ${className}`}
      style={style}
    ></div>
  )
}
