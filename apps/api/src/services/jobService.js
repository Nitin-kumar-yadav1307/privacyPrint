/**
 * In-memory job store.
 * For local development this provides persistence within a single server session.
 * In production (Phase 9+) this will be replaced by DynamoDB.
 */

const { JOB_STATUS } = require('../constants')
const { removeDocument } = require('./documentStorage')
const {
  createJob: _createJob,
  markReady,
  markPrinting,
  markPrinted: _markPrinted,
  markExpired,
  markFailed,
  markCancelled,
  toPublic,
} = require('../models/Job')

const jobs = new Map()

/**
 * Create and store a new job.
 * @param {Object} data - Job creation data (tenantId, printSettings, document)
 * @returns {Object} The created job (public-safe)
 */
function create(data) {
  const job = _createJob(data)
  // Mark as READY once stored
  markReady(job)
  jobs.set(job.jobId, job)
  return toPublic(job)
}

/**
 * Retrieve a job by its ID.
 * @param {string} jobId
 * @returns {Object|null} Public-safe job or null
 */
function getById(jobId) {
  const job = jobs.get(jobId)
  return job ? toPublic(job) : null
}

/**
 * Retrieve all jobs for a specific tenant.
 * This enforces server-side tenant isolation — callers can only see
 * jobs that belong to the tenant they are authorized for.
 * @param {string} tenantId
 * @returns {Array<Object>} Public-safe jobs for this tenant
 */
function getByTenant(tenantId) {
  return Array.from(jobs.values())
    .filter((job) => job.tenantId === tenantId)
    .map(toPublic)
}

/**
 * Find a job by ID and verify it belongs to the given tenant.
 * This is the authorization check — even if a client provides a valid
 * jobId, if the tenantId doesn't match, the job is not returned.
 * @param {string} jobId
 * @param {string} tenantId
 * @returns {Object|null} Public-safe job if authorized, else null
 */
function getByIdAndTenant(jobId, tenantId) {
  const job = jobs.get(jobId)
  if (!job || job.tenantId !== tenantId) {
    return null
  }
  return toPublic(job)
}

/**
 * Mark a job as PRINTING (shopkeeper clicked PRINT).
 * @param {string} jobId
 * @param {string} tenantId
 * @returns {Object|null} Updated public job or null if unauthorized/not found
 */
function startPrinting(jobId, tenantId) {
  const job = jobs.get(jobId)
  if (!job || job.tenantId !== tenantId) {
    return null
  }
  if (job.status !== JOB_STATUS.READY) {
    return toPublic(job)
  }
  markPrinting(job)
  return toPublic(job)
}

/**
 * Mark a job as PRINTED and start retention countdown.
 * @param {string} jobId
 * @param {string} tenantId
 * @returns {Object|null} Updated public job or null if unauthorized/not found
 */
function markPrinted(jobId, tenantId) {
  const job = jobs.get(jobId)
  if (!job || job.tenantId !== tenantId) {
    return null
  }
  if (job.status !== JOB_STATUS.PRINTING) {
    return toPublic(job)
  }
  const retentionMinutes = job.printSettings.retentionMinutes
  _markPrinted(job, retentionMinutes)
  return toPublic(job)
}

/**
 * Expire a job (remove its temporary document reference and mark EXPIRED).
 * @param {string} jobId
 * @returns {Object|null} Updated public job or null if not found
 */
function expireJob(jobId) {
  const job = jobs.get(jobId)
  if (!job) {
    return null
  }
  if (job.status !== JOB_STATUS.PRINTED) {
    return toPublic(job)
  }
  removeDocument(job.document)
  markExpired(job)
  return toPublic(job)
}

/**
 * Cancel a job that hasn't been printed yet.
 * @param {string} jobId
 * @param {string} tenantId
 * @param {string} reason
 * @returns {Object|null} Updated public job or null if unauthorized/not found
 */
function cancelJob(jobId, tenantId, reason) {
  const job = jobs.get(jobId)
  if (!job || job.tenantId !== tenantId) {
    return null
  }
  // Only jobs that haven't entered printing can be cancelled
  if (job.status !== JOB_STATUS.CREATED && job.status !== JOB_STATUS.READY) {
    return toPublic(job)
  }
  removeDocument(job.document)
  markCancelled(job, reason)
  return toPublic(job)
}

/**
 * Get all jobs (for admin/debug — not exposed to tenants).
 * @returns {Array<Object>} All jobs (private, with internal fields)
 */
function allJobs() {
  return Array.from(jobs.values())
}

/**
 * Get a job without public filtering (internal use only).
 * @param {string} jobId
 * @returns {Object|undefined} The raw job object
 */
function getRaw(jobId) {
  return jobs.get(jobId)
}

/**
 * Get the public-safe status of a job (lightweight — for polling).
 * @param {string} jobId
 * @param {string} tenantId
 * @returns {Object|null} Status info { jobId, status, tenantId } or null if unauthorized
 */
function getStatus(jobId, tenantId) {
  const job = jobs.get(jobId)
  if (!job || job.tenantId !== tenantId) {
    return null
  }
  return {
    jobId: job.jobId,
    status: job.status,
    tenantId: job.tenantId,
  }
}

/**
 * Get the printer queue for a tenant — READY and PRINTING jobs.
 * @param {string} tenantId
 * @returns {Array<Object>} Public-safe jobs that are ready or printing
 */
function getQueue(tenantId) {
  return Array.from(jobs.values())
    .filter((job) => job.tenantId === tenantId &&
      (job.status === JOB_STATUS.READY || job.status === JOB_STATUS.PRINTING))
    .map(toPublic)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

/**
 * Auto-complete a job that is in PRINTING state.
 * Used by the printer simulator to mark jobs as printed after a delay.
 * @param {string} jobId
 * @param {string} tenantId
 * @returns {Object|null} Updated public job or null if unauthorized/not found
 */
function autoCompletePrint(jobId, tenantId) {
  const job = jobs.get(jobId)
  if (!job || job.tenantId !== tenantId) {
    return null
  }
  if (job.status !== JOB_STATUS.PRINTING) {
    return toPublic(job)
  }
  _markPrinted(job, job.printSettings.retentionMinutes)
  return toPublic(job)
}

module.exports = {
  create,
  getById,
  getByTenant,
  getByIdAndTenant,
  getStatus,
  getQueue,
  startPrinting,
  markPrinted,
  autoCompletePrint,
  expireJob,
  cancelJob,
  allJobs,
  getRaw,
}
