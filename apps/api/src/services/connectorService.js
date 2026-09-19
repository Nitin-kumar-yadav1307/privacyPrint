/**
 * Connector-facing job operations.
 *
 * The print connector runs on the shop's own computer and authenticates as
 * exactly one shop tenant (same signed session as the dashboard). Every
 * function here is tenant-scoped; a connector for shop A can never observe,
 * download or complete shop B's jobs.
 */

const { JOB_STATUS } = require('../constants')
const jobService = require('./jobService')

/** A connector is considered offline after this long without a heartbeat. */
const HEARTBEAT_TIMEOUT_MS = 20000

const heartbeats = new Map() // tenantId -> { lastSeenAt, meta }

function recordHeartbeat(tenantId, meta = {}) {
  heartbeats.set(tenantId, { lastSeenAt: new Date().toISOString(), meta })
}

function connectorStatus(tenantId, now = Date.now()) {
  const entry = heartbeats.get(tenantId) || null
  const lastSeenAt = entry ? entry.lastSeenAt : null
  const online = lastSeenAt !== null && now - new Date(lastSeenAt).getTime() < HEARTBEAT_TIMEOUT_MS
  return { online, lastSeenAt, ...(entry ? entry.meta : {}) }
}

/**
 * Jobs the connector should act on — PRINTING only.
 * READY jobs await the shopkeeper's PRINT click; the connector must not
 * start printing by itself.
 * @param {string} tenantId
 * @returns {Promise<Array<Object>>} Public-safe PRINTING jobs for this tenant
 */
async function listPrintingJobs(tenantId) {
  return (await jobService.getQueue(tenantId))
    .filter((job) => job.status === JOB_STATUS.PRINTING)
}

/**
 * Report the print result from the connector.
 * Only PRINTING jobs may transition; repeat reports are idempotent.
 * @param {string} jobId
 * @param {string} tenantId
 * @param {{result: 'completed'|'failed', reason?: string}} report
 * @returns {Promise<Object|null>} Updated public job, or null if unauthorized/not found
 */
async function reportPrintResult(jobId, tenantId, { result, reason } = {}) {
  if (result === 'failed') {
    const raw = await jobService.getRaw(jobId)
    if (!raw || raw.tenantId !== tenantId) return null
    if (raw.status !== JOB_STATUS.PRINTING) return jobService.getById(jobId)
    return jobService.failJob(jobId, reason)
  }
  // result === 'completed' — markPrinted is tenant-checked and a no-op
  // (returns the unchanged job) when the job is no longer PRINTING.
  return jobService.markPrinted(jobId, tenantId)
}

module.exports = {
  HEARTBEAT_TIMEOUT_MS,
  recordHeartbeat,
  connectorStatus,
  listPrintingJobs,
  reportPrintResult,
}