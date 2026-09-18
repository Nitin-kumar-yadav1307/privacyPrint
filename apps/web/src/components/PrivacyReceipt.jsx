import { ShieldCheck, CheckCircle2, Clock, Trash2, Info } from 'lucide-react'

export function PrivacyReceipt({ job }) {
  const rows = [
    ['Job ID', job.jobId],
    ['Document', job.document?.originalName || '—'],
    ['Copies', job.printSettings?.copies],
    ['Pages', job.printSettings?.pages || 'all'],
    ['Color Mode', job.printSettings?.color === 'color' ? 'Full Color' : 'Grayscale (B&W)'],
    ['Paper Format', `${job.printSettings?.paperSize ?? '—'} · ${job.printSettings?.orientation ?? ''}`.trim()],
    ['Duplex', job.printSettings?.duplex ? 'Double-Sided' : 'Single-Sided'],
    ['Retention Policy', job.printSettings?.retentionMinutes ? `${job.printSettings.retentionMinutes} minutes` : '—'],
    ['Submitted', job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'],
    ['Printed At', job.printedAt ? new Date(job.printedAt).toLocaleString() : 'Pending print'],
    ['Scheduled Wipe', job.expiresAt ? new Date(job.expiresAt).toLocaleString() : '—'],
    ['Shredded At', job.expiredAt ? new Date(job.expiredAt).toLocaleString() : '—'],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')

  const removed = job.status === 'EXPIRED' && job.expiredAt

  return (
    <div className="mt-4 relative rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/40 via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 sm:p-6 shadow-xs text-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
              Privacy Lifecycle Receipt
            </h4>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              AUDIT-{job.jobId?.slice(0, 12) || 'RECEIPT'}
            </p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
          removed
            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
        }`}>
          {removed ? <Trash2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {removed ? 'Shredded' : 'Active Retention'}
        </span>
      </div>

      {/* Details Grid */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between items-baseline border-b border-slate-100 dark:border-slate-800/60 pb-1.5 sm:border-0 sm:pb-0">
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {label}
            </dt>
            <dd className="font-mono text-xs text-slate-900 dark:text-slate-200 font-medium text-right truncate max-w-[200px]">
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>

      {/* Audit Banner */}
      <div className={`mt-5 p-3 rounded-xl flex items-start gap-2.5 text-xs ${
        removed
          ? 'bg-rose-50/80 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
          : 'bg-indigo-50/80 border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-300'
      }`}>
        {removed ? (
          <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        )}
        <div>
          <p className="font-semibold">
            {removed
              ? `Document permanently shredded at ${new Date(job.expiredAt).toLocaleTimeString()}`
              : 'Zero-persistence guarantee in effect'}
          </p>
          <p className="mt-0.5 text-[11px] opacity-90">
            {removed
              ? 'Temporary file and decrypted print buffers were unlinked from print-shop storage.'
              : 'The shop cache is scheduled for automatic unlinking once the retention timer expires.'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
        <Info className="w-3 h-3 shrink-0" />
        <span>Honest system audit event record for customer verification.</span>
      </div>
    </div>
  )
}