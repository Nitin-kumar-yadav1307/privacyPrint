import { Layout } from '../components/Layout.jsx'
import { Link } from 'react-router-dom'
import {
  Shield,
  Printer,
  ArrowRight,
  Store,
  Clock,
  Trash2,
  Lock,
  Layers,
  Zap,
} from 'lucide-react'

export default function HomePage() {
  return (
    <Layout title="PrivacyPrint — Zero Knowledge Printing" showNav={false}>
      <div className="max-w-5xl mx-auto py-6 sm:py-12">
        {/* Top Hero Pill */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 shadow-xs">
            <span className="flex h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100 animate-pulse" />
            Zero-Knowledge Ephemeral Document Pipeline
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-zinc-950 dark:text-white tracking-tight leading-[1.15] mb-6">
            Print confidential files{' '}
            <span className="bg-gradient-to-b from-zinc-900 via-zinc-700 to-zinc-500 dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-500 bg-clip-text text-transparent">
              without leaving a trace.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 mb-10 leading-relaxed font-normal">
            Upload your document, route it directly to your print shop, and let our zero-persistence
            worker permanently erase it after printing. No logins. No permanent cloud storage.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/customer/new"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-semibold rounded-xl shadow-xs transition-all duration-200 active:scale-[0.98]"
            >
              <Printer className="w-5 h-5" />
              <span>Start a Print Job</span>
              <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
            </Link>
            <Link
              to="/shop"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-all duration-200 shadow-xs active:scale-[0.98]"
            >
              <Store className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <span>Shop Dashboard</span>
            </Link>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Already submitted a file?</span>
            <Link to="/jobs" className="text-zinc-900 dark:text-zinc-100 hover:underline font-semibold">
              Track your jobs →
            </Link>
          </div>
        </div>

        {/* 3-Step Visual Lifecycle Section */}
        <div className="mt-16 pt-12 border-t border-zinc-200/80 dark:border-zinc-800/80">
          <div className="text-center mb-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              How It Works
            </h2>
            <p className="text-2xl font-bold text-zinc-950 dark:text-white">
              End-to-end privacy in three simple stages
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Step 1 */}
            <div className="relative bg-white dark:bg-[#0c0c0e] rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 flex items-center justify-center font-bold text-lg mb-4 border border-zinc-200/60 dark:border-zinc-700/60">
                01
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                Configure & Dispatch
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Choose your print shop, upload your PDF or doc, and pick custom print specs along with an auto-deletion countdown.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative bg-white dark:bg-[#0c0c0e] rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 flex items-center justify-center font-bold text-lg mb-4 border border-zinc-200/60 dark:border-zinc-700/60">
                02
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                <Printer className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                Isolated Print Queue
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Only the designated shop can access the document via a single-use token. Other print shops never see your data.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative bg-white dark:bg-[#0c0c0e] rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 flex items-center justify-center font-bold text-lg mb-4 border border-zinc-200/60 dark:border-zinc-700/60">
                03
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                Auto-Purge & Audit
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Once printed or upon timeout, the document buffer is wiped forever and a verifiable Privacy Receipt is issued.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center mb-4 border border-zinc-200/60 dark:border-zinc-700/60">
              <Shield className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-base mb-1.5">No Account Required</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Never register or share your email. Jobs are tracked locally on your device with clean cryptographic identifiers.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center mb-4 border border-zinc-200/60 dark:border-zinc-700/60">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-base mb-1.5">Strict Tenant Isolation</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Multi-tenant architecture guarantees print shops can only process orders submitted specifically to their shop ID.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center mb-4 border border-zinc-200/60 dark:border-zinc-700/60">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-base mb-1.5">Configurable Retention</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              You choose the retention window — 5 minutes to 24 hours. The automated reaper deletes expired files immediately.
            </p>
          </div>
        </div>

        {/* Demo Mode Notice */}
        <div className="mt-12 p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 text-xs text-zinc-700 dark:text-zinc-300">
          <Zap className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
          <p>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">Interactive Demo:</span> Print simulation runs in real-time. In production, the Print Connector daemon delivers jobs directly to the local hardware spooler.
          </p>
        </div>
      </div>
    </Layout>
  )
}

