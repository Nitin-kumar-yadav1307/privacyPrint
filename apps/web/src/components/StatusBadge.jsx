const STATUS_CONFIG = {
  CREATED: {
    color: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800',
    dot: 'bg-zinc-400',
    pulse: false,
    label: 'Created',
  },
  READY: {
    color: 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 dark:border-white shadow-2xs',
    dot: 'bg-emerald-400 dark:bg-emerald-600',
    pulse: true,
    label: 'Ready for Print',
  },
  PRINTING: {
    color: 'bg-zinc-950 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-200 shadow-2xs',
    dot: 'bg-amber-400 dark:bg-amber-600',
    pulse: true,
    label: 'Printing...',
  },
  PRINTED: {
    color: 'bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700',
    dot: 'bg-emerald-500',
    pulse: false,
    label: 'Printed',
  },
  EXPIRED: {
    color: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-500 dark:border-zinc-800',
    dot: 'bg-zinc-400',
    pulse: false,
    label: 'Auto-Deleted',
  },
  FAILED: {
    color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
    dot: 'bg-red-500',
    pulse: false,
    label: 'Failed',
  },
  CANCELLED: {
    color: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800',
    dot: 'bg-zinc-400',
    pulse: false,
    label: 'Cancelled',
  },
}

export function StatusBadge({ status, className = '' }) {
  const config = STATUS_CONFIG[status] || {
    color: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800',
    dot: 'bg-zinc-400',
    pulse: false,
    label: status,
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.color} ${className}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {config.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
      </span>
      {config.label}
    </span>
  )
}

