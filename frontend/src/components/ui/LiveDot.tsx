export function LiveDot({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-semantic-green opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-semantic-green"></span>
      </div>
      <span className="text-xs font-medium text-semantic-green">Live</span>
    </div>
  )
}
