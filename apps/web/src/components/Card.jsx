export function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl shadow-2xs transition-all duration-200 ${
        hover ? 'hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/80 ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`px-6 py-5 ${className}`}>
      {children}
    </div>
  )
}

