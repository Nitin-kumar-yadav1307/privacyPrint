export function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs transition-all duration-200 backdrop-blur-xs ${
        hover ? 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700/90' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 ${className}`}>
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

