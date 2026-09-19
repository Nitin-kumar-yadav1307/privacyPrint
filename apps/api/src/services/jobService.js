/**
 * Job lifecycle service.
 *
 * Storage is pluggable: the local single-process file store (development) or
 * DynamoDB (AWS deployment, selected by JOBS_TABLE). Every operation is
 * awaited, so the deployed expiry-worker Lambda can act on the same records
 * the API writes. Transitions are applied to a working copy and persisted as
 * a whole record; a failed persist leaves the previous state untouched.
 */

const { JOB_STATUS } = require('../constants')
const { DATA_DIR, JOBS_TABLE } = require('../config')
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
const { openJobStore } = require('./jobStore')
const { createDynamoJobRepository } = require('./dynamoJobRepository')

/** Local single-process repository over the atomic JSON snapshot store. */
function createLocalJobRepository(directory) {
  const { jobs, save } = openJobStore(directory)
  return {
    isRemote: false,
    async create(job) {
      const stored = structuredClone(job)
      jobs.set(stored.jobId, stored)
      try {
        save()
      } catch (error) {
        jobs.delete(stored.jobId)
        throw error
      }
      return stored
    },
    async put(job) {
      const previous = jobs.get(job.jobId)
      const previousClone = previous ? structuredClone(previous) : undefined
      const stored = structuredClone(job)
      jobs.set(stored.jobId, stored)
      try {
        save()
      } catch (error) {
        if (previousClone) jobs.set(job.jobId, previousClone)
        else jobs.delete(job.jobId)
        throw error
      }
      return stored
    },
    /** Local handle: intentionally the live object (same-process mutation idiom). */
    async get(jobId) {
      return jobs.get(jobId) || null
    },
    /** Persist after an in-place mutation; restores identity on failure. */
    async checkpoint(job, previousClone) {
      try {
        save()
      } catch (error) {
        for (const key of Object.keys(job)) delete job[key]
        Object.assign(job, previousClone)
        throw error
      }
    },
    async listByTenant(tenantId) {
      return Array.from(jobs.values())
        .filter((job) => job.tenantId === tenantId)
        .map((job) => structuredClone(job))
    },
    async listAll() {
      return Array.from(jobs.values()).map((job) => structuredClone(job))
    },
  }
}

const repository = JOBS_TABLE
  ? createDynamoJobRepository()
  : createLocalJobRepository(DATA_DIR)

/** Load, verify tenancy (when given) and apply a transition to a fresh copy. */
async function transition(jobId, tenantId, mutate) {
  const current = await repository.get(jobId)
  if (!current) return null
  if (tenantId !== null && current.tenantId !== tenantId) return null
  // Remote (DynamoDB): never mutate the fetched copy in place — persist a
  // whole record so a failed write leaves the stored state untouched.
  if (repository.isRemote) {
    const next = structuredClone(current)
    mutate(next)
    await repository.put(next)
    return toPublic(next)
  }
  // Local single-process idiom (pre-existing): mutate the live stored object
  // so same-process handles observe transitions; save() afterwards. A failed
  // persist restores the object in place, preserving identity.
  const previous = structuredClone(current)
  try {
    mutate(current)
    await repository.checkpoint(current, previous)
  } catch (error) {
    throw error
  }
  return toPublic(current)
}

function failJob(jobId, reason) {
  return transition(jobId, null, (job) => markFailed(job, reason))
}

/**
 * Create and store a new job.
 * @param {Object} data - Job creation data (tenantId, printSettings, document)
 * @returns {Promise<Object>} The created job (public-safe)
 */
async function create(data) {
  const job = _createJob(data)
  // Mark as READY once stored
  markReady(job)
  await repository.create(job)
  return toPublic(job)
}

/**
 * Retrieve a job by its ID.
 * @param {string} jobId
 * @returns {Promise<Object|null>} Public-safe job or null
 */
async function getById(jobId) {
  const job = await repository.get(jobId)
  return job ? toPublic(job) : null
}

/**
 * Retrieve all jobs for a specific tenant.
 * Server-side tenant isolation: only jobs matching the tenant are returned.
 * @param {string} tenantId
 * @returns {Promise<Array<Object>>} Public-safe jobs for this tenant
 */
async function getByTenant(tenantId) {
  return (await repository.listByTenant(tenantId)).map(toPublic)
}

/**
 * Find a job by ID and verify it belongs to the given tenant.
 * @param {string} jobId
 * @param {string} tenantId
 * @returns {Promise<Object|null>} Public-safe job if authorized, else null
 */
async function getByIdAndTenant(jobId, tenantId) {
  const job = await repository.get(jobId)
  if (!job || job.tenantId !== tenantId) {
    return null
  }
  return toPublic(job)
}

/**
 * Mark a job as PRINTING (shopkeeper clicked PRINT).
 * @param {string} jobId
 * @param {string} tenantId
 * @returns {Promise<Object|null>} Updated public job or null if unauthorized/not found
 */
function startPrinting(jobId, tenantId) {
  return transition(jobId, tenantId, (job) => {
    if (job.status !== JOB_STATUS.READY) return
    markPrinting(job)
  })
}

/**
 * Mark a job as PRINTED and start retention countdown.
 * @param {string} jobId
 * @param {string} tenantId
 * @returns {Promise<Object|null>} Updated public job or null if unauthorized/not found
 */
function markPrinted(jobId, tenantId) {
  return transition(jobId, tenantId, (job) => {
    if (job.status !== JOB_STATUS.PRINTING) return
    _markPrinted(job, job.printSettings.retentionMinutes)
  })
}

/**
 * Expire a job (remove its temporary document reference and mark EXPIRED).
 * The document is deleted BEFORE the status transition, so a failure leaves
 * the job PRINTED and the next tick retries — an EXPIRED job whose document
 * still exists is impossible by construction.
 * @param {string} jobId
 * @returns {Promise<Object|null>} Updated public job or null if not found
 */
async function expireJob(jobId) {
  const job = await repository.get(jobId)
  if (!job) {
    return null
  }
  if (job.status !== JOB_STATUS.PRINTED) {
    return toPublic(job)
  }
  await removeDocument(job.document)
  return transition(jobId, null, markExpired)
}

/**
 * Cancel a job that hasn't been printed yet.
 * @param {string} jobId
 * @param {string} tenantId
 * @param {string} reason
 * @returns {Promise<Object|null>} Updated public job or null if unauthorized/not found
 */
async function cancelJob(jobId, tenantId, reason) {
  const job = await repository.get(jobId)
  if (!job || job.tenantId !== tenantId) {
    return null
  }
  // Only jobs that haven't entered printing can be cancelled
  if (job.status !== JOB_STATUS.CREATED && job.status !== JOB_STATUS.READY) {
    return toPublic(job)
  }
  await removeDocument(job.document)
  return transition(jobId, null, (record) => markCancelled(record, reason))
}

/**
 * Get all jobs (for admin/debug — not exposed to tenants).
 * @returns {Promise<Array<Object>>} All jobs (private, with internal fields)
 */
async function allJobs() {
  return repository.listAll()
}

/**
 * Get a job without public filtering (internal use only).
 * @param {string} jobId
 * @returns {Promise<Object|undefined>} The raw job object
 */
async function getRaw(jobId) {
  return repository.get(jobId)
}

/**
 * Get the public-safe status of a job (lightweight — for polling).
 * @param {string} jobId
 * @param {string} tenantId
 * @returns {Promise<Object|null>} Status info { jobId, status, tenantId } or null if unauthorized
 */
async function getStatus(jobId, tenantId) {
  const job = await repository.get(jobId)
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
 * @returns {Promise<Array<Object>>} Public-safe jobs that are ready or printing
 */
async function getQueue(tenantId) {
  return (await repository.listByTenant(tenantId))
    .filter((job) => job.status === JOB_STATUS.READY || job.status === JOB_STATUS.PRINTING)
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
  return markPrinted(jobId, tenantId)
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
  failJob,
  allJobs,
  getRaw,
}
