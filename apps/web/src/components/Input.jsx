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
          className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-slate-400 pointer-events-none">
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
          } py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 ${
            error
              ? 'border-rose-400 dark:border-rose-500/60 focus:ring-rose-500/10 focus:border-rose-500'
              : 'hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-500 font-medium">{error}</p>}
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
          className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          required={required}
          onChange={onChange}
          className={`w-full appearance-none px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 pr-10 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 cursor-pointer ${
            error
              ? 'border-rose-400 dark:border-rose-500/60 focus:ring-rose-500/10 focus:border-rose-500'
              : 'hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          {placeholder && !options.some(o => o.value === '') && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-500 font-medium">{error}</p>}
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
          className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
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
        className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 resize-none ${
          error
            ? 'border-rose-400 dark:border-rose-500/60 focus:ring-rose-500/10 focus:border-rose-500'
            : 'hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  )
}

