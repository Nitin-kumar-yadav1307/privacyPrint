import { ChevronDown } from 'lucide-react'

export function Input({
  label,
  type = 'text',
  name,
  value = '',
  placeholder = '',
  required = false,
  error = '',
  onChange,
  className = '',
  icon: Icon,
  ...props
}) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-zinc-400 pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          placeholder={placeholder}
          required={required}
          onChange={onChange}
          className={`w-full ${
            Icon ? 'pl-10' : 'px-3.5'
          } py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 dark:focus:ring-zinc-100/10 focus:border-zinc-900 dark:focus:border-zinc-100 ${
            error
              ? 'border-red-500 dark:border-red-500/60 focus:ring-red-500/10 focus:border-red-500'
              : 'hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}

export function Select({
  label,
  name,
  value = '',
  options = [],
  required = false,
  error = '',
  onChange,
  className = '',
  placeholder = 'Select an option...',
}) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          required={required}
          onChange={onChange}
          className={`w-full appearance-none px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 pr-10 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 dark:focus:ring-zinc-100/10 focus:border-zinc-900 dark:focus:border-zinc-100 cursor-pointer ${
            error
              ? 'border-red-500 dark:border-red-500/60 focus:ring-red-500/10 focus:border-red-500'
              : 'hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          {placeholder && !options.some(o => o.value === '') && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 py-1">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}

export function Textarea({
  label,
  name,
  value = '',
  placeholder = '',
  required = false,
  error = '',
  onChange,
  className = '',
  rows = 3,
}) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={onChange}
        rows={rows}
        className={`w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 dark:focus:ring-zinc-100/10 focus:border-zinc-900 dark:focus:border-zinc-100 resize-none ${
          error
            ? 'border-red-500 dark:border-red-500/60 focus:ring-red-500/10 focus:border-red-500'
            : 'hover:border-zinc-300 dark:hover:border-zinc-700'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}


