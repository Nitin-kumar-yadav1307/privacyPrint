import { Link, NavLink } from 'react-router-dom'
import { Shield, PlusCircle, ListOrdered, Store, Lock } from 'lucide-react'

export function Header({ showNav = true }) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-black/80 backdrop-blur-md transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center border border-zinc-800 dark:border-zinc-200 shadow-xs group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 fill-current opacity-90" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-zinc-950 dark:text-white">
                PrivacyPrint
              </span>
              <span className="text-[10px] -mt-1 font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Zero-Knowledge Print
              </span>
            </div>
          </Link>

          {showNav && (
            <nav className="hidden sm:flex items-center gap-1.5 text-sm font-medium">
              <NavLink
                to="/customer/new"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-white font-semibold border border-zinc-200/80 dark:border-zinc-800'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60'
                  }`
                }
              >
                <PlusCircle className="w-4 h-4" />
                New Job
              </NavLink>
              <NavLink
                to="/jobs"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-white font-semibold border border-zinc-200/80 dark:border-zinc-800'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60'
                  }`
                }
              >
                <ListOrdered className="w-4 h-4" />
                My Jobs
              </NavLink>
            </nav>
          )}
        </div>

        {showNav && (
          <div className="flex items-center gap-3">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 transition-all shadow-2xs"
            >
              <Store className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              Shop Portal
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}

export function Layout({ title, showNav = true, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa] dark:bg-[#000000] text-zinc-900 dark:text-zinc-100 antialiased selection:bg-zinc-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-950">
      {/* Subtle monochrome ambient light */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-zinc-400/5 dark:bg-zinc-700/5 rounded-full blur-3xl" />
      </div>

      <Header title={title} showNav={showNav} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-black/60 backdrop-blur-xs py-8 mt-16 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
            <span className="font-semibold text-zinc-900 dark:text-zinc-200">PrivacyPrint</span>
            <span>—</span>
            <span>Zero-Knowledge ephemeral document dispatch for print shops.</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-500">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Auto-Expiring</span>
            <span>·</span>
            <span>Tenant Isolated</span>
            <span>·</span>
            <span>Simulated Spooler</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

