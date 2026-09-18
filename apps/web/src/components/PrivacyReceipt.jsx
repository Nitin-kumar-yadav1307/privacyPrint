/**
 * Privacy Receipt — the customer-facing record of a document's lifecycle.
 *
 * Shows exactly what happened to the temporary document and when. Per the
 * product spec, this is an honest activity record, NOT cryptographic proof
 * of deletion.
 */
export function PrivacyReceipt({ job }) {
  const rows = [
    ['Job ID', job.jobId],
    ['Document', job.document?.originalName || '—'],
    ['Copies', job.printSettings?.copies],
    ['Pages', job.printSettings?.pages || 'all'],
    ['Color', job.printSettings?.color === 'color' ? 'Color' : 'B&W'],
    ['Paper', `${job.printSettings?.paperSize ?? '—'} ${job.printSettings?.orientation ?? ''}`.trim()],
    ['Duplex', job.printSettings?.duplex ? 'Yes' : 'No'],
    ['Retention chosen', job.printSettings?.retentionMinutes ? `${job.printSettings.retentionMinutes} min` : '—'],
    ['Sent at', job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'],
    ['Printed at', job.printedAt ? new Date(job.printedAt).toLocaleString() : 'Not yet printed'],
    ['Expires at', job.expiresAt ? new Date(job.expiresAt).toLocaleString() : '—'],
    ['Removed at', job.expiredAt ? new Date(job.expiredAt).toLocaleString() : '—'],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')

  const removed = job.status === 'EXPIRED' && job.expiredAt

  return (
    <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 text-sm">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">Privacy Receipt</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2 sm:block">
            <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="font-medium text-gray-900 dark:text-white break-all">{String(value)}</dd>
          </div>
        ))}
      </dl>
      <p className={`mt-3 text-xs ${removed ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {removed
          ? `✓ Temporary document removed from the print shop at ${new Date(job.expiredAt).toLocaleTimeString()}.`
          : 'The temporary document is deleted automatically when the retention period ends.'}
      </p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        This receipt records lifecycle events reported by the system. It is not cryptographic proof of deletion.
      </p>
    </div>
  )
}