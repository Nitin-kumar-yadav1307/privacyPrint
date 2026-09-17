import { useState, useCallback } from 'react'
import { Layout } from '../../components/Layout.jsx'
import { Card, CardBody } from '../../components/Card.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { Button } from '../../components/Button.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { usePolling } from '../../hooks/usePolling.js'
import { useApiBaseUrl, fetchJSON } from '../../services/api.js'

const SHOPS = [
  { id: 'TENANT-001', name: 'QuickPrint Mumbai', code: 'SHOP-MUM-001' },
  { id: 'TENANT-002', name: 'Express Prints Bangalore', code: 'SHOP-BLR-001' },
  { id: 'TENANT-003', name: 'PrintHub Delhi', code: 'SHOP-DEL-001' },
]

export default function JobsPage() {
  const apiBaseUrl = useApiBaseUrl()
  const [selectedShop, setSelectedShop] = useLocalStorage('selectedShop', '')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)

  const cancelJob = async (job) => {
    if (cancellingId) return
    setCancellingId(job.jobId)
    try {
      const data = await fetchJSON(apiBaseUrl, `/api/jobs/${job.jobId}/cancel?tenantId=${encodeURIComponent(selectedShop)}`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by customer before printing' }),
      })
      setJobs((prev) => prev.map((j) => (j.jobId === job.jobId ? data.job : j)))
      setError('')
    } catch (e) {
      setError(`Cancel failed: ${e.message}`)
    } finally {
      setCancellingId(null)
    }
  }

  const fetchJobs = useCallback(async (signal) => {
    if (!selectedShop) return
    setLoading(true)
    try {
      const data = await fetchJSON(apiBaseUrl, `/api/jobs?tenantId=${encodeURIComponent(selectedShop)}`, { signal })
      if (!signal.aborted) {
        setJobs(data.jobs || [])
        setError('')
      }
    } catch (e) {
      if (!signal.aborted) setError(e.message)
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [selectedShop, apiBaseUrl])

  // Auto-refresh every 5 seconds when a shop is selected
  usePolling(fetchJobs, selectedShop ? 5000 : null)

  return (
    <Layout title="My Print Jobs">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by Print Shop</label>
          <select value={selectedShop} onChange={(e) => {
            setSelectedShop(e.target.value)
            setJobs([])
            setError('')
            setLoading(Boolean(e.target.value))
          }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800">
            <option value="">All shops (local only)</option>
            {SHOPS.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
          {selectedShop && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Showing jobs for <span className="font-medium">{SHOPS.find((s) => s.id === selectedShop)?.name}</span>
            </p>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">Unable to refresh jobs: {error}</p>}

        {jobs.length === 0 && !loading ? (
          <Card>
            <CardBody className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No jobs yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Create your first print job to see it here.</p>
              <Button onClick={() => window.location.href = '/customer/new'} className="mt-4">New print job</Button>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card key={job.jobId} className="hover:shadow-md transition-shadow">
                <CardBody className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400 font-medium">{job.jobId}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 truncate">{job.document?.originalName || '—'}</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{job.printSettings?.copies}x {job.printSettings?.paperSize} · {job.printSettings?.color === 'color' ? 'Color' : 'B&W'} · {job.printSettings?.duplex ? 'Duplex' : 'Single-sided'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {job.expiresAt && <p className="text-xs text-gray-400 dark:text-gray-500">Expires <span className="font-mono">{new Date(job.expiresAt).toLocaleString()}</span></p>}
                    {job.printedAt && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Printed <span className="font-mono">{new Date(job.printedAt).toLocaleString()}</span></p>}
                    {selectedShop && (job.status === 'READY' || job.status === 'CREATED') && (
                      <div className="mt-2">
                        <Button variant="secondary" size="sm" disabled={!!cancellingId} onClick={() => cancelJob(job)}>
                          {cancellingId === job.jobId ? 'Cancelling…' : 'Cancel'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {jobs.length === 0 && loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="mt-2 text-sm text-gray-500">Loading jobs...</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
