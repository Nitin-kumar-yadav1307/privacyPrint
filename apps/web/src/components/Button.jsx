import { Loader2 } from 'lucide-react'

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  type = 'button',
  className = '',
  icon: Icon,
  ...props
}) {
  const base =
    'relative inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]'

  const variants = {
    primary:
      'bg-zinc-950 text-white hover:bg-zinc-800 active:bg-black dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white dark:active:bg-zinc-200 border border-zinc-900 dark:border-zinc-200 shadow-xs focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-100',
    secondary:
      'bg-white dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 shadow-2xs focus-visible:ring-zinc-400',
    danger:
      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-xs focus-visible:ring-red-500',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-xs focus-visible:ring-emerald-500',
    ghost:
      'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 focus-visible:ring-zinc-400',
    outline:
      'border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-zinc-500',
  }

  const sizes = {
    xs: 'px-2.5 py-1 text-xs rounded-lg',
    sm: 'px-3.5 py-1.5 text-xs sm:text-sm font-medium',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base font-semibold',
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
    </button>
  )
}

