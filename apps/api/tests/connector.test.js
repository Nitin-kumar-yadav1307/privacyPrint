/**
 * End-to-end connector tests against the real API:
 * shop-authenticated queue, tenant-checked document download, completion,
 * failure reporting, heartbeats and cross-tenant isolation.
 */
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')

process.env.PORT = '3993'
const { app } = require('../src/server')
const tenantService = require('../src/services/tenantService')
const { SHOP_DEMO_PASSCODE } = require('../src/config')

const PORT = 3993
let base
let server

async function login(tenantId) {
  const res = await fetch(`${base}/api/auth/shop/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, passcode: SHOP_DEMO_PASSCODE }),
  })
  assert.equal(res.status, 200, `login as ${tenantId} should succeed`)
  const data = await res.json()
  return data.token
}

async function createJob(tenantId, content) {
  const form = new FormData()
  form.append('document', new Blob([content], { type: 'application/pdf' }), 'connector-test.pdf')
  form.append('tenantId', tenantId)
  form.append(
    'printSettings',
    JSON.stringify({
      copies: 2,
      pages: '1-2',
      color: 'bw',
      paperSize: 'A4',
      duplex: true,
      orientation: 'portrait',
      retentionMinutes: 30,
    }),
  )
  const res = await fetch(`${base}/api/jobs`, { method: 'POST', body: form })
  assert.equal(res.status, 201)
  const data = await res.json()
  return data.job.jobId
}

async function startPrint(jobId, tenantId) {
  const res = await fetch(`${base}/api/jobs/${jobId}/print?tenantId=${tenantId}`, { method: 'POST' })
  assert.equal(res.status, 200)
  return res.json()
}

function authed(token) {
  return { Authorization: `Bearer ${token}` }
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve)
  })
  base = `http://localhost:${PORT}`
})

after(() => {
  server.close()
})

test('connector sees only PRINTING jobs of its own shop and can download, complete and fail them', async () => {
  const token = await login('TENANT-002')

  // Empty queue when nothing is printing.
  let res = await fetch(`${base}/api/connector/jobs`, { headers: authed(token) })
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).jobs, [])

  const jobId = await createJob('TENANT-002', '%PDF-1.4 connector-test-bytes')
  await startPrint(jobId, 'TENANT-002')

  // Job appears in the connector queue once PRINTING.
  res = await fetch(`${base}/api/connector/jobs`, { headers: authed(token) })
  assert.equal(res.status, 200)
  const queued = (await res.json()).jobs
  assert.ok(queued.some((j) => j.jobId === jobId))

  // Document bytes are served to the owning tenant while PRINTING.
  res = await fetch(`${base}/api/connector/jobs/${jobId}/document`, { headers: authed(token) })
  assert.equal(res.status, 200)
  assert.equal(await res.text(), '%PDF-1.4 connector-test-bytes')

  // Heartbeat makes the connector visible to the dashboard.
  res = await fetch(`${base}/api/connector/heartbeat`, { method: 'POST', headers: authed(token) })
  assert.equal(res.status, 200)
  res = await fetch(`${base}/api/connector/status?tenantId=TENANT-002`)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).connector.online, true)

  // Completion starts retention.
  res = await fetch(`${base}/api/connector/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: { ...authed(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: 'completed', mode: 'PDF_FALLBACK' }),
  })
  assert.equal(res.status, 200)
  const completed = (await res.json()).job
  assert.equal(completed.status, 'PRINTED')
  assert.ok(completed.expiresAt)

  // Duplicate completion is idempotent — status stays PRINTED.
  res = await fetch(`${base}/api/connector/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: { ...authed(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: 'completed', mode: 'PDF_FALLBACK' }),
  })
  assert.equal(res.status, 200)
  assert.equal((await res.json()).job.status, 'PRINTED')
})

test('connector failures map PRINTING → FAILED with a reason', async () => {
  const token = await login('TENANT-002')
  const jobId = await createJob('TENANT-002', '%PDF-1.4 failing-job')
  await startPrint(jobId, 'TENANT-002')

  const res = await fetch(`${base}/api/connector/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: { ...authed(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: 'failed', reason: 'CUPS printer offline' }),
  })
  assert.equal(res.status, 200)
  const job = (await res.json()).job
  assert.equal(job.status, 'FAILED')
  assert.equal(job.failureReason, 'CUPS printer offline')
})

test('a connector for one shop cannot download or complete another shop\'s job', async () => {
  const tokenA = await login('TENANT-001')
  const tokenB = await login('TENANT-002')

  const jobId = await createJob('TENANT-002', '%PDF-1.4 tenant-isolated')
  await startPrint(jobId, 'TENANT-002')

  // Wrong-shop connector: queue must not contain the job, download and
  // completion must 404 without leaking its existence.
  let res = await fetch(`${base}/api/connector/jobs`, { headers: authed(tokenA) })
  assert.equal(res.status, 200)
  assert.ok(!(await res.json()).jobs.some((j) => j.jobId === jobId))

  res = await fetch(`${base}/api/connector/jobs/${jobId}/document`, { headers: authed(tokenA) })
  assert.equal(res.status, 404)

  res = await fetch(`${base}/api/connector/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: { ...authed(tokenA), 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: 'completed' }),
  })
  assert.equal(res.status, 404)

  // Tampered token is rejected outright.
  res = await fetch(`${base}/api/connector/jobs`, { headers: authed(`${tokenB.slice(0, -2)}xx`) })
  assert.equal(res.status, 401)
})