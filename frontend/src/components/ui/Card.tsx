import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  noPadding?: boolean
}

export function Card({
  children,
  className = '',
  noPadding = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-md border border-border bg-bg-primary ${noPadding ? '' : 'p-4 sm:p-5'} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className = '',
  action,
}: {
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <div className={`mb-4 flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2">{children}</div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function CardTitle({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h3 className={`text-lg font-medium text-text-primary ${className}`}>
      {children}
    </h3>
  )
}
