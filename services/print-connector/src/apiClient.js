/**
 * HTTP client for the PrivacyPrint API, authenticated as one shop tenant
 * with the connector's signed session token.
 */
const { API_BASE_URL, SHOP_TOKEN } = require('./config')

let shopToken = SHOP_TOKEN

function setShopToken(token) {
  shopToken = token || ''
}

function getShopToken() {
  return shopToken
}

async function apiFetch(pathname, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (shopToken) {
    headers.Authorization = `Bearer ${shopToken}`
  }
  const res = await fetch(`${API_BASE_URL}${pathname}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `API error HTTP ${res.status}`)
  }
  return res
}

async function pingHealth() {
  const res = await fetch(`${API_BASE_URL}/api/health`)
  if (!res.ok) {
    throw new Error(`API health check failed with HTTP ${res.status}`)
  }
  return res.json()
}

async function loginShop({ tenantId, passcode }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/shop/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, passcode }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `API error HTTP ${res.status}`)
  }
  const data = await res.json()
  if (data.token) setShopToken(data.token)
  return data
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

module.exports = {
  apiFetch,
  pingHealth,
  loginShop,
  listPrintingJobs,
  downloadDocument,
  reportPrintResult,
  heartbeat,
  getShopToken,
  setShopToken,
}