/**
 * In-memory job store.
 * For local development this provides persistence within a single server session.
 * In production (Phase 9+) this will be replaced by DynamoDB.
 */

const { JOB_STATUS } = require('../constants')
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
  markExpired(job)
  // In production, the document file is also deleted from S3 here
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
  if (job.status === JOB_STATUS.PRINTING || job.status === JOB_STATUS.PRINTED) {
    return toPublic(job)
  }
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

module.exports = {
  create,
  getById,
  getByTenant,
  getByIdAndTenant,
  startPrinting,
  markPrinted,
  expireJob,
  cancelJob,
  allJobs,
  getRaw,
}
