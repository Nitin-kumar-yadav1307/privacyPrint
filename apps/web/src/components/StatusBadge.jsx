const STATUS_CONFIG = {
  CREATED: {
    color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    pulse: false,
    label: 'Created',
  },
  READY: {
    color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    dot: 'bg-sky-500',
    pulse: true,
    label: 'Ready for Print',
  },
  PRINTING: {
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
    pulse: true,
    label: 'Printing...',
  },
  PRINTED: {
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    pulse: false,
    label: 'Printed',
  },
  EXPIRED: {
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    dot: 'bg-rose-400',
    pulse: false,
    label: 'Auto-Deleted',
  },
  FAILED: {
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    dot: 'bg-rose-500',
    pulse: false,
    label: 'Failed',
  },
  CANCELLED: {
    color: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
    dot: 'bg-zinc-400',
    pulse: false,
    label: 'Cancelled',
  },
}

export function StatusBadge({ status, className = '' }) {
  const config = STATUS_CONFIG[status] || {
    color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
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

