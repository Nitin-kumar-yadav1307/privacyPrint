import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout.jsx'
import { Card, CardHeader, CardBody } from '../../components/Card.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { Button } from '../../components/Button.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'

const SHOPS = [
  { id: 'TENANT-001', name: 'QuickPrint Mumbai', code: 'SHOP-MUM-001' },
  { id: 'TENANT-002', name: 'Express Prints Bangalore', code: 'SHOP-BLR-001' },
  { id: 'TENANT-003', name: 'PrintHub Delhi', code: 'SHOP-DEL-001' },
]

export default function ShopDashboardPage() {
  const navigate = useNavigate()
  const [shopTenant] = useLocalStorage('shopTenant', '')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [printingJobId, setPrintingJobId] = useState(null)
  const [printerLogs, setPrinterLogs] = useState([])

  useEffect(() => {
    if (!shopTenant) { navigate('/shop'); return }
    const fetchJobs = async () => {
      try {
        const res = await fetch(`http://localhost:3001/jobs?tenantId=${shopTenant}`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setJobs(data)
      } catch { setJobs([]) }
      finally { setLoading(false) }
    }
    fetchJobs()
  }, [shopTenant, navigate])

  const addLog = (msg) => setPrinterLogs((p) => [...p.slice(-49), msg])

  const handlePrint = async (job) => {
    if (printingJobId) return
    setPrintingJobId(job.jobId)
    setJobs((prev) => prev.map((j) => j.jobId === job.jobId ? { ...j, status: 'PRINTING' } : j))
    addLog(`[${new Date().toLocaleTimeString()}] PRINT initiated for Job ${job.jobId}`)

    const copies = job.printSettings?.copies ?? 1
    for (let i = 1; i <= copies; i++) {
      await new Promise((r) => setTimeout(r, 700))
      addLog(`[${new Date().toLocaleTimeString()}] Copy ${i}/${copies} — ${job.printSettings?.paperSize} ${job.printSettings?.orientation}`)
    }
    await new Promise((r) => setTimeout(r, 500))

    try {
      await fetch(`http://localhost:3001/jobs/${job.jobId}/printed`, { method: 'POST' })
    } catch (e) { console.error('Failed to notify backend:', e) }

    const now = new Date()
    const retentionMs = (job.printSettings?.retentionMinutes ?? 30) * 60 * 1000
    const demoMultiplier = 1 / 60
    const expiresAt = new Date(now.getTime() + retentionMs * demoMultiplier)

    setJobs((prev) => prev.map((j) =>
      j.jobId === job.jobId
        ? { ...j, status: 'PRINTED', printedAt: now.toISOString(), expiresAt: expiresAt.toISOString() }
        : j
    ))
    addLog(`[${new Date().toLocaleTimeString()}] PRINT COMPLETED — Job ${job.jobId} retained for ${job.printSettings?.retentionMinutes ?? 30} min (demo: ~${(retentionMs * demoMultiplier / 1000).toFixed(1)}s)`)
    setPrintingJobId(null)
  }

  if (!shopTenant) {
    return (
      <Layout title="Shop Dashboard">
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No shop selected. Redirecting...</p>
          <Button onClick={() => navigate('/shop')}>Go to login</Button>
        </div>
      </Layout>
    )
  }

  const shop = SHOPS.find((s) => s.id === shopTenant)
  const pendingCount = jobs.filter((j) => j.status === 'READY' || j.status === 'CREATED').length

  return (
    <Layout title={`Shop Dashboard — ${shop?.name}`}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{shop?.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{shop?.code} · Tenant: {shopTenant}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 dark:text-gray-500">{pendingCount} pending</span>
              <Button variant="secondary" onClick={() => navigate('/shop')}>Switch shop</Button>
            </div>
          </div>
        </div>

        <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10">
          <CardHeader>
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Printer Simulator
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Simulated print progress. In production, a Print Connector would drive the actual local printer.</p>
          </CardHeader>
          <CardBody>
            <div className="bg-gray-900 dark:bg-black rounded-lg p-4 font-mono text-xs text-green-400 h-32 overflow-y-auto">
              {printerLogs.length === 0 && <div className="text-gray-500 italic">Waiting for print jobs...</div>}
              {printerLogs.map((line, i) => <div key={i}>{line}</div>)}
            </div>
            {printingJobId && (
              <div className="mt-3 flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-yellow-500 border-t-transparent" />
                Printing Job {printingJobId}...
              </div>
            )}
          </CardBody>
        </Card>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <p className="mt-2 text-sm text-gray-500">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No jobs for this shop</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">When customers send jobs to {shop?.name}, they will appear here.</p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Print Jobs ({jobs.length})</h3>
            {jobs.map((job) => (
              <Card key={job.jobId} className="hover:shadow-md transition-shadow">
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400 font-medium">{job.jobId}</span>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white truncate">{job.documentName}</p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Received {job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'}</p>
                    </div>
                    {job.status === 'READY' || job.status === 'CREATED' ? (
                      <Button size="sm" onClick={() => handlePrint(job)} disabled={!!printingJobId}>{printingJobId === job.jobId ? 'Printing...' : 'PRINT'}</Button>
                    ) : (
                      <div className="text-right shrink-0">
                        {job.printedAt && <p className="text-xs text-gray-400 dark:text-gray-500">Printed {new Date(job.printedAt).toLocaleString()}</p>}
                        {job.expiresAt && <p className="text-xs text-gray-400 dark:text-gray-500">Expires {new Date(job.expiresAt).toLocaleString()}</p>}
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm border border-gray-100 dark:border-gray-800">
                    <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Copies</p><p className="font-medium text-gray-900 dark:text-white">{job.printSettings?.copies ?? '—'}</p></div>
                    <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pages</p><p className="font-medium text-gray-900 dark:text-white">{job.printSettings?.pages ?? '—'}</p></div>
                    <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Color</p><p className="font-medium text-gray-900 dark:text-white">{job.printSettings?.color === 'color' ? 'Color' : 'B&W'}</p></div>
                    <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Paper</p><p className="font-medium text-gray-900 dark:text-white">{job.printSettings?.paperSize ?? '—'} {job.printSettings?.orientation ?? ''}</p></div>
                    <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Duplex</p><p className="font-medium text-gray-900 dark:text-white">{job.printSettings?.duplex ? 'Yes' : 'No'}</p></div>
                    <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Orientation</p><p className="font-medium text-gray-900 dark:text-white">{job.printSettings?.orientation ?? '—'}</p></div>
                    <div className="col-span-2"><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Retention</p><p className="font-medium text-gray-900 dark:text-white">{job.printSettings?.retentionMinutes ?? '—'} min</p></div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
