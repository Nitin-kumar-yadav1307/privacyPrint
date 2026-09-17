const { setTimeout: sleep } = require('node:timers/promises')

/** Simulate one explicitly selected READY job; never read document contents. */
async function simulateJob({
  apiBaseUrl = 'http://localhost:3001',
  tenantId,
  jobId,
  copyDelayMs = 700,
  log = console.log,
  wait = sleep,
}) {
  if (typeof tenantId !== 'string' || !tenantId.trim() ||
      typeof jobId !== 'string' || !jobId.trim()) {
    throw new Error('tenantId and jobId are required')
  }
  if (!Number.isInteger(copyDelayMs) || copyDelayMs < 0 || copyDelayMs > 60000) {
    throw new Error('copyDelayMs must be an integer between 0 and 60000')
  }
  const base = new URL(apiBaseUrl)
  if (!['http:', 'https:'].includes(base.protocol)) {
    throw new Error('API URL must use HTTP or HTTPS')
  }
  const jobPath = `/api/jobs/${encodeURIComponent(jobId)}`

  async function request(suffix = '', method = 'GET') {
    const url = new URL(`${jobPath}${suffix}`, base)
    url.searchParams.set('tenantId', tenantId)
    const response = await fetch(url, { method, signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`API request failed (${response.status})`)
    const data = await response.json()
    if (!data.success || !data.job || data.job.jobId !== jobId || data.job.tenantId !== tenantId) {
      throw new Error('API returned an unexpected job')
    }
    return data.job
  }

  const job = await request()
  if (job.status !== 'READY') throw new Error(`Job must be READY, received ${job.status}`)
  const settings = job.printSettings
  if (!Number.isInteger(settings?.copies) || settings.copies < 1 || settings.copies > 99) {
    throw new Error('Job has invalid copy count')
  }
  log('DEMO SIMULATOR — no physical printer or document rendering')
  log(`Settings: ${JSON.stringify(settings)}`)
  const started = await request('/print', 'POST')
  if (started.status !== 'PRINTING') throw new Error(`Print did not start: ${started.status}`)
  log('PRINTING')
  for (let copy = 1; copy <= settings.copies; copy++) {
    await wait(copyDelayMs)
    log(`Copy ${copy}/${settings.copies}`)
  }
  const completed = await request('/complete', 'POST')
  if (completed.status !== 'PRINTED' || !completed.expiresAt) {
    throw new Error('Backend did not confirm print completion')
  }
  log('PRINT COMPLETED')
  log(`Retention expires at ${completed.expiresAt} (API demo TTL may be accelerated)`)
  return completed
}

module.exports = { simulateJob }
