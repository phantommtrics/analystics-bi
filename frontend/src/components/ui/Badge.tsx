import React from 'react'

export type BadgeVariant =
  | 'blue'
  | 'gold'
  | 'green'
  | 'amber'
  | 'purple'
  | 'red'
  | 'gray'
  | 'super-admin'
  | 'finance'
  | 'compliance'
  | 'agent'
  | 'viewer'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({
  children,
  variant = 'gray',
  className = '',
}: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    blue: 'bg-brand-blue/10 text-brand-blue',
    gold: 'bg-brand-gold/10 text-brand-gold',
    green: 'bg-semantic-green/10 text-semantic-green',
    amber: 'bg-semantic-amber/10 text-semantic-amber',
    purple: 'bg-semantic-purple/10 text-semantic-purple',
    red: 'bg-semantic-red/10 text-semantic-red',
    gray: 'bg-semantic-gray/10 text-semantic-gray',
    'super-admin':
      'bg-[#E6F1FB] text-[#0C447C] dark:bg-[#0C447C]/20 dark:text-[#E6F1FB]',
    finance:
      'bg-[#EAF3DE] text-[#27500A] dark:bg-[#27500A]/20 dark:text-[#EAF3DE]',
    compliance:
      'bg-[#FAEEDA] text-[#633806] dark:bg-[#633806]/20 dark:text-[#FAEEDA]',
    agent:
      'bg-[#EEEDFE] text-[#3C3489] dark:bg-[#3C3489]/20 dark:text-[#EEEDFE]',
    viewer:
      'bg-[#F1EFE8] text-[#444441] dark:bg-[#444441]/20 dark:text-[#F1EFE8]',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium uppercase ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
