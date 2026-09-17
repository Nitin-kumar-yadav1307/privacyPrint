import { Link, NavLink } from 'react-router-dom'

export function Header({ showNav = true }) {
  return (
    <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold text-xl tracking-tight transition-colors"
          >
            PrivacyPrint
          </Link>
          {showNav && (
            <nav className="ml-8 hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-300">
              <NavLink
                to="/customer/new"
                className={({ isActive }) =>
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'hover:text-gray-900 dark:hover:text-gray-100 transition-colors'
                }
              >
                New Job
              </NavLink>
              <NavLink
                to="/jobs"
                className={({ isActive }) =>
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'hover:text-gray-900 dark:hover:text-gray-100 transition-colors'
                }
              >
                My Jobs
              </NavLink>
            </nav>
          )}
        </div>
        {showNav && (
          <div className="flex items-center gap-2">
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Shop Dashboard
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}

export function Layout({ title, showNav = true, children }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title={title} showNav={showNav} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center text-sm text-gray-500 dark:text-gray-400">
          PrivacyPrint — Privacy-first printing for everyone.
        </div>
      </footer>
    </div>
  )
}
