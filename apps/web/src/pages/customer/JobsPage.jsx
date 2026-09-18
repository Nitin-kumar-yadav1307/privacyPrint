import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../../components/Layout.jsx'
import { Card, CardBody } from '../../components/Card.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { Button } from '../../components/Button.jsx'
import { Select } from '../../components/Input.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { usePolling } from '../../hooks/usePolling.js'
import { useApiBaseUrl, fetchJSON } from '../../services/api.js'
import { useTenants } from '../../hooks/useTenants.js'
import { formatCountdown } from '../../utils/time.js'
import { PrivacyReceipt } from '../../components/PrivacyReceipt.jsx'
import {
  FileText,
  Clock,
  Receipt,
  PlusCircle,
  Store,
} from 'lucide-react'

export default function JobsPage() {
  const apiBaseUrl = useApiBaseUrl()
  const { tenants, error: shopsError } = useTenants()
  const [selectedShop, setSelectedShop] = useLocalStorage('selectedShop', '')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)
  const [receiptJobId, setReceiptJobId] = useState(null)

  const cancelJob = async (job) => {
    if (cancellingId) return
    setCancellingId(job.jobId)
    try {
      const data = await fetchJSON(
        apiBaseUrl,
        `/api/jobs/${job.jobId}/cancel?tenantId=${encodeURIComponent(selectedShop)}`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'Cancelled by customer before printing' }),
        }
      )
      setJobs((prev) => prev.map((j) => (j.jobId === job.jobId ? data.job : j)))
      setError('')
    } catch (e) {
      setError(`Cancel failed: ${e.message}`)
    } finally {
      setCancellingId(null)
    }
  }

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchJobs = useCallback(
    async (signal) => {
      if (!selectedShop) return
      setLoading(true)
      try {
        const data = await fetchJSON(
          apiBaseUrl,
          `/api/jobs?tenantId=${encodeURIComponent(selectedShop)}`,
          { signal }
        )
        if (!signal.aborted) {
          setJobs(data.jobs || [])
          setError('')
        }
      } catch (e) {
        if (!signal.aborted) setError(e.message)
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [selectedShop, apiBaseUrl]
  )

  // Auto-refresh every 5 seconds when a shop is selected
  usePolling(fetchJobs, selectedShop ? 5000 : null)

  return (
    <Layout title="My Print Jobs">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Title & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Active Print Jobs
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live tracking and zero-knowledge privacy lifecycle receipts.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Link to="/customer/new">
              <Button size="sm" icon={PlusCircle}>
                New Print Job
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-semibold">Filter by Print Shop:</span>
          </div>

          <div className="w-full sm:w-72">
            <Select
              name="shopFilter"
              value={selectedShop}
              placeholder="All Shops (Select one)"
              options={tenants.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.code})`,
              }))}
              onChange={(e) => {
                setSelectedShop(e.target.value)
                setJobs([])
                setError('')
                setLoading(Boolean(e.target.value))
              }}
            />
          </div>
        </div>

        {shopsError && (
          <p role="alert" className="text-xs text-rose-500">
            Could not load print shops: {shopsError}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-rose-500">
            Unable to refresh jobs: {error}
          </p>
        )}

        {/* Jobs List */}
        {jobs.length === 0 && !loading ? (
          <Card>
            <CardBody className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                {selectedShop ? 'No print jobs found' : 'Select a print shop to view jobs'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                {selectedShop
                  ? 'There are currently no active or pending jobs for this print shop.'
                  : 'Choose a print shop from the dropdown above or submit a new print job to begin.'}
              </p>
              <Link to="/customer/new">
                <Button icon={PlusCircle}>Start a Print Job</Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const isReceiptOpen = receiptJobId === job.jobId
              const isCancelling = cancellingId === job.jobId
              const isPending = job.status === 'READY' || job.status === 'CREATED'

              return (
                <div
                  key={job.jobId}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Job Meta & Document */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                            {job.jobId}
                          </span>
                          <StatusBadge status={job.status} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                          {job.document?.originalName || 'Untitled Document'}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span>{job.printSettings?.copies || 1} copies</span>
                          <span>·</span>
                          <span>{job.printSettings?.paperSize || 'A4'}</span>
                          <span>·</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {job.printSettings?.color === 'color' ? 'Color' : 'B&W'}
                          </span>
                          <span>·</span>
                          <span>{job.printSettings?.duplex ? 'Duplex' : '1-Sided'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Time & Actions */}
                    <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      {job.expiresAt && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Wipe in {formatCountdown(job.expiresAt, now)}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {selectedShop && isPending && (
                          <Button
                            variant="secondary"
                            size="xs"
                            disabled={Boolean(cancellingId)}
                            loading={isCancelling}
                            onClick={() => cancelJob(job)}
                            className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          variant={isReceiptOpen ? 'primary' : 'secondary'}
                          size="xs"
                          icon={Receipt}
                          onClick={() => setReceiptJobId(isReceiptOpen ? null : job.jobId)}
                        >
                          {isReceiptOpen ? 'Close Audit' : 'Privacy Receipt'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Privacy Receipt */}
                  {isReceiptOpen && (
                    <div className="pt-2">
                      <PrivacyReceipt job={job} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {jobs.length === 0 && loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
            <p className="mt-2 text-xs font-semibold text-slate-500">Checking for print jobs...</p>
          </div>
        )}
      </div>
    </Layout>
  )
}

