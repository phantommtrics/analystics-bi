interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

const variantClasses: Record<NonNullable<LoadingButtonProps['variant']>, string> = {
  primary: 'bg-brand-navy text-white hover:bg-brand-blue',
  secondary: 'border border-border bg-bg-primary text-text-primary hover:bg-bg-secondary',
  danger: 'bg-semantic-red text-white hover:bg-semantic-red/90',
  ghost: 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
}

export function LoadingButton({
  loading = false,
  variant = 'primary',
  disabled,
  children,
  className = '',
  ...props
}: LoadingButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && <i className="ti ti-loader animate-spin"></i>}
      {children}
    </button>
  )
}
