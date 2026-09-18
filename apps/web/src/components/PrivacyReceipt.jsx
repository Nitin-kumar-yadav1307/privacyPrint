import { ShieldCheck, CheckCircle2, Trash2, Info } from 'lucide-react'

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
    <div className="mt-4 relative rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 p-5 sm:p-6 shadow-2xs text-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-200/80 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-sm">
              Privacy Lifecycle Receipt
            </h4>
            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              AUDIT-{job.jobId?.slice(0, 12) || 'RECEIPT'}
            </p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
          removed
            ? 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800'
            : 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-white shadow-2xs'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${removed ? 'bg-zinc-400' : 'bg-emerald-400 dark:bg-emerald-600'}`} />
          {removed ? 'Shredded' : 'Active Retention'}
        </span>
      </div>

      {/* Details Grid */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between items-baseline border-b border-zinc-200/60 dark:border-zinc-900 pb-1.5 sm:border-0 sm:pb-0">
            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {label}
            </dt>
            <dd className="font-mono text-xs text-zinc-900 dark:text-zinc-200 font-medium text-right truncate max-w-[200px]">
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>

      {/* Audit Banner */}
      <div className={`mt-5 p-3 rounded-xl flex items-start gap-2.5 text-xs border ${
        removed
          ? 'bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
          : 'bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 shadow-2xs'
      }`}>
        {removed ? (
          <Trash2 className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        )}
        <div>
          <p className="font-semibold">
            {removed
              ? `Document permanently shredded at ${new Date(job.expiredAt).toLocaleTimeString()}`
              : 'Zero-persistence guarantee active'}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {removed
              ? 'Temporary file and decrypted print buffers were unlinked from print-shop storage.'
              : 'The shop cache is scheduled for automatic unlinking once the retention timer expires.'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
        <Info className="w-3 h-3 shrink-0" />
        <span>Cryptographic lifecycle audit record for customer verification.</span>
      </div>
    </div>
  )
}