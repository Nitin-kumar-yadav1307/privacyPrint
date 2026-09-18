/**
 * HTTP client for the PrivacyPrint API, authenticated as one shop tenant
 * with the connector's signed session token.
 */
const { API_BASE_URL, SHOP_TOKEN } = require('./config')

async function apiFetch(pathname, options = {}) {
  const res = await fetch(`${API_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${SHOP_TOKEN}`,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `API error HTTP ${res.status}`)
  }
  return res
}

/** PRINTING jobs belonging to this connector's shop. */
async function listPrintingJobs() {
  const res = await apiFetch('/api/connector/jobs')
  const data = await res.json()
  return data.jobs || []
}

/**
 * Download the job's temporary document into destPath.
 * The API only serves it to the owning tenant while the job is PRINTING.
 */
async function downloadDocument(job, destPath) {
  const res = await apiFetch(`/api/connector/jobs/${encodeURIComponent(job.jobId)}/document`)
  const bytes = Buffer.from(await res.arrayBuffer())
  require('fs').writeFileSync(destPath, bytes)
  return destPath
}

/** Report the print outcome: { result: 'completed'|'failed', mode?, reason? } */
async function reportPrintResult(jobId, payload) {
  const res = await apiFetch(`/api/connector/jobs/${encodeURIComponent(jobId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

/** Keep-alive so the shop dashboard shows the connector as online. */
async function heartbeat(meta = {}) {
  await apiFetch('/api/connector/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  })
}

module.exports = { apiFetch, listPrintingJobs, downloadDocument, reportPrintResult, heartbeat }