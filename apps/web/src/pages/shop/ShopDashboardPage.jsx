import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../../components/Layout.jsx'
import { Card, CardHeader, CardBody } from '../../components/Card.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { Button } from '../../components/Button.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { usePolling } from '../../hooks/usePolling.js'
import { useTenants } from '../../hooks/useTenants.js'
import { useApiBaseUrl, fetchJSON, shopAuthHeaders, shopLogout } from '../../services/api.js'
import { formatCountdown } from '../../utils/time.js'
import {
  Printer,
  Terminal,
  FileText,
  Clock,
  LogOut,
  Wifi,
  WifiOff,
  CheckCircle2,
  Play,
  ListOrdered,
  Radio,
} from 'lucide-react'

export default function ShopDashboardPage() {
  const navigate = useNavigate()
  const apiBaseUrl = useApiBaseUrl()
  const [shopTenant] = useLocalStorage('shopTenant', '')
  const { getTenant } = useTenants()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [printingJobId, setPrintingJobId] = useState(null)
  const [printerLogs, setPrinterLogs] = useState([])

  const [queue, setQueue] = useState([])
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Connector liveness (online/offline, print mode, printer state).
  const [connector, setConnector] = useState(null)
  useEffect(() => {
    if (!shopTenant) return
    let cancelled = false
    const check = async () => {
      try {
        const data = await fetchJSON(
          apiBaseUrl,
          `/api/connector/status?tenantId=${encodeURIComponent(shopTenant)}`,
          { headers: shopAuthHeaders() }
        )
        if (!cancelled) setConnector(data.connector || null)
      } catch {
        if (!cancelled) setConnector(null)
      }
    }
    check()
    const timer = setInterval(check, 10000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [shopTenant, apiBaseUrl])

  const fetchJobs = useCallback(
    async (signal) => {
      if (!shopTenant) return
      try {
        const tenant = encodeURIComponent(shopTenant)
        const [data, queueData] = await Promise.all([
          fetchJSON(apiBaseUrl, `/api/jobs?tenantId=${tenant}`, {
            signal,
            headers: shopAuthHeaders(),
          }),
          fetchJSON(apiBaseUrl, `/api/jobs/queue?tenantId=${tenant}`, {
            signal,
            headers: shopAuthHeaders(),
          }),
        ])
        if (!signal.aborted) {
          setJobs(data.jobs || [])
          setQueue(queueData.jobs || [])
          setError('')
        }
      } catch (e) {
        if (!signal.aborted) {
          if (/session/i.test(e.message)) {
            shopLogout()
            navigate('/shop')
            return
          }
          setError(e.message)
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [shopTenant, apiBaseUrl, navigate]
  )

  useEffect(() => {
    if (!shopTenant) navigate('/shop')
  }, [shopTenant, navigate])

  // Auto-refresh job list every 5 seconds
  usePolling(fetchJobs, shopTenant ? 5000 : null)

  const addLog = (msg) => setPrinterLogs((p) => [...p.slice(-49), msg])

  const handlePrint = async (job) => {
    if (printingJobId) return
    setPrintingJobId(job.jobId)
    addLog(`[${new Date().toLocaleTimeString()}] SPOOLING payload for Job ${job.jobId}...`)

    try {
      const data = await fetchJSON(
        apiBaseUrl,
        `/api/jobs/${job.jobId}/print?tenantId=${shopTenant}`,
        { method: 'POST', headers: shopAuthHeaders() }
      )
      setJobs((prev) => prev.map((j) => (j.jobId === job.jobId ? data.job : j)))
      setQueue((prev) => prev.map((j) => (j.jobId === job.jobId ? data.job : j)))
      addLog(data.message || 'Status: HARDWARE PRINTING IN PROGRESS')
    } catch (e) {
      console.error('Failed to start print:', e)
      addLog(`[${new Date().toLocaleTimeString()}] ERROR: ${e.message}`)
      setPrintingJobId(null)
      return
    }

    const copies = job.printSettings?.copies ?? 1
    for (let i = 1; i <= copies; i++) {
      await new Promise((r) => setTimeout(r, 700))
      addLog(
        `[${new Date().toLocaleTimeString()}] Printing copy ${i}/${copies} · ${
          job.printSettings?.paperSize
        } ${job.printSettings?.orientation}`
      )
    }
    await new Promise((r) => setTimeout(r, 500))

    try {
      const data = await fetchJSON(
        apiBaseUrl,
        `/api/jobs/${job.jobId}/autocomplete?tenantId=${shopTenant}`,
        { method: 'POST', headers: shopAuthHeaders() }
      )
      setQueue((prev) => prev.filter((j) => j.jobId !== job.jobId))
      setJobs((prev) =>
        prev.map((j) =>
          j.jobId === job.jobId
            ? {
                ...j,
                status: data.job.status,
                printedAt: data.job.printedAt,
                expiresAt: data.job.expiresAt,
              }
            : j
        )
      )
      addLog(
        `[${new Date().toLocaleTimeString()}] PRINT FINISHED · File unlinked. Retained in RAM cache for ${
          job.printSettings?.retentionMinutes ?? 30
        }m`
      )
    } catch (e) {
      console.error('Failed to complete print:', e)
      addLog(`[${new Date().toLocaleTimeString()}] ERROR: ${e.message}`)
    }
    setPrintingJobId(null)
  }

  if (!shopTenant) {
    return (
      <Layout title="Shop Dashboard">
        <div className="text-center py-16">
          <p className="text-slate-500 mb-4">No shop selected. Redirecting...</p>
          <Button onClick={() => navigate('/shop')}>Go to Login</Button>
        </div>
      </Layout>
    )
  }

  const shop = getTenant(shopTenant)
  const pendingJobs = jobs.filter((j) => j.status === 'READY' || j.status === 'CREATED')

  return (
    <Layout title={`Shop Dashboard — ${shop?.name}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Shop Operator Top Bar */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-extrabold text-zinc-950 dark:text-white">
                {shop?.name || 'Print Shop'}
              </h2>
              <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-200 dark:border-zinc-700">
                {shop?.code}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tenant ID: <code className="font-mono text-[11px]">{shopTenant}</code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              connector?.online
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
            }`}>
              {connector?.online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>Connector {connector?.online ? 'Online' : 'Offline'}</span>
              {connector?.online && connector.printerState && (
                <span className="opacity-80">· {connector.printerState}</span>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={LogOut}
              onClick={() => {
                shopLogout()
                navigate('/shop')
              }}
            >
              Switch Shop
            </Button>
          </div>
        </div>

        {/* Quick KPI Stat Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center font-bold border border-zinc-200/60 dark:border-zinc-700/60">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Pending Jobs</span>
              <p className="text-xl font-extrabold text-zinc-950 dark:text-white">{pendingJobs.length}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center font-bold border border-zinc-200/60 dark:border-zinc-700/60">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Active Queue</span>
              <p className="text-xl font-extrabold text-zinc-950 dark:text-white">{queue.length}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center font-bold border border-zinc-200/60 dark:border-zinc-700/60">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Total Processed</span>
              <p className="text-xl font-extrabold text-zinc-950 dark:text-white">
                {jobs.filter((j) => j.status === 'PRINTED' || j.status === 'EXPIRED').length}
              </p>
            </div>
          </div>
        </div>

        {/* Printer Simulator Console */}
        <div className="rounded-2xl border border-zinc-800 bg-black text-zinc-100 overflow-hidden shadow-md">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-600 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-500 inline-block" />
              </div>
              <Terminal className="w-4 h-4 text-zinc-300" />
              <span className="font-mono text-xs font-bold text-zinc-200">
                Hardware Spooler Daemon · Virtual Driver
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <Radio className="w-3.5 h-3.5 text-zinc-200 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>

          <div className="p-4 font-mono text-xs text-zinc-300 h-36 overflow-y-auto space-y-1 bg-black/60">
            {printerLogs.length === 0 ? (
              <p className="text-zinc-600 italic">Waiting for print requests...</p>
            ) : (
              printerLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  {log}
                </div>
              ))
            )}
          </div>

          {printingJobId && (
            <div className="px-4 py-2.5 bg-zinc-900 border-t border-zinc-800 text-zinc-200 text-xs font-mono flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
              <span>Actively printing Job {printingJobId}... Please do not disconnect.</span>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-500">
            Error loading queue: {error}
          </p>
        )}

        {/* Printer Queue */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                  Hardware Dispatch Queue ({queue.length})
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  FIFO sequencing · Automatic daemon dispatch
                </p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {loading ? (
              <p className="text-xs text-zinc-400 animate-pulse">Loading queue...</p>
            ) : queue.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 py-2">
                No jobs currently waiting in the hardware spooler.
              </p>
            ) : (
              <div className="space-y-2">
                {queue.map((qJob, index) => (
                  <div
                    key={qJob.jobId}
                    className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-xs sm:max-w-md">
                          {qJob.document?.originalName || qJob.jobId}
                        </p>
                        <span className="font-mono text-[11px] text-zinc-400">{qJob.jobId}</span>
                      </div>
                    </div>
                    <StatusBadge status={qJob.status} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* All Shop Jobs List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Printer className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
              Incoming Job Management ({jobs.length})
            </h3>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-zinc-950 dark:border-zinc-100 border-t-transparent" />
              <p className="mt-2 text-xs font-semibold text-zinc-500">Loading incoming jobs...</p>
            </div>
          ) : jobs.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <FileText className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200">No print jobs received</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  When customers submit print jobs to {shop?.name}, they will appear here.
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const isReady = job.status === 'READY' || job.status === 'CREATED'
                return (
                  <div
                    key={job.jobId}
                    className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] p-5 shadow-xs hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left Details */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-md">
                            {job.jobId}
                          </span>
                          <StatusBadge status={job.status} />
                        </div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-xs sm:max-w-md">
                          {job.document?.originalName || 'Untitled Document'}
                        </h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Received {job.createdAt ? new Date(job.createdAt).toLocaleTimeString() : '—'}
                        </p>
                      </div>

                      {/* Right Print Button or Timestamps */}
                      <div className="shrink-0 flex items-center gap-3">
                        {isReady ? (
                          <Button
                            size="sm"
                            icon={Play}
                            onClick={() => handlePrint(job)}
                            disabled={Boolean(printingJobId)}
                            loading={printingJobId === job.jobId}
                          >
                            {printingJobId === job.jobId ? 'Printing...' : 'PRINT JOB'}
                          </Button>
                        ) : (
                          <div className="text-right text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
                            {job.printedAt && (
                              <p className="flex items-center gap-1 font-mono">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />
                                Printed at {new Date(job.printedAt).toLocaleTimeString()}
                              </p>
                            )}
                            {job.expiresAt && (
                              <p className="flex items-center gap-1 font-mono text-zinc-600 dark:text-zinc-400 font-medium">
                                <Clock className="w-3.5 h-3.5 inline" />
                                Wipe in {formatCountdown(job.expiresAt, now)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Print Specs Grid */}
                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                        <span className="text-[10px] text-zinc-400 uppercase">Copies / Format</span>
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {job.printSettings?.copies}× {job.printSettings?.paperSize} ({job.printSettings?.orientation})
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                        <span className="text-[10px] text-zinc-400 uppercase">Pages</span>
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {job.printSettings?.pages || 'all'}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                        <span className="text-[10px] text-zinc-400 uppercase">Color & Duplex</span>
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {job.printSettings?.color === 'color' ? 'Full Color' : 'B&W'} · {job.printSettings?.duplex ? 'Duplex' : '1-Sided'}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40">
                        <span className="text-[10px] text-zinc-400 uppercase">Retention Window</span>
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {job.printSettings?.retentionMinutes || 30} min
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

