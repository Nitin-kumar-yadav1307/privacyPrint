const { JOB_STATUS, calculateExpiry } = require('../constants')
const { v4: uuidv4 } = require('uuid')

/**
 * PrintJob model.
 * Represents a single print job created by a customer for a specific tenant/shop.
 *
 * @param {Object} data - Job creation data
 * @param {string} data.tenantId - The tenant/shop identifier (server-side trusted)
 * @param {Object} data.printSettings - Customer-defined print settings
 * @param {Object} data.document - Document info from upload
 * @returns {Object} A new job record
 */
function createJob(data) {
  const retentionMinutes = data.printSettings.retentionMinutes || 30
  const now = Date.now()

  return {
    jobId: uuidv4(),
    tenantId: data.tenantId,
    document: {
      filename: data.document.filename,
      originalName: data.document.originalName,
      // Document stored path is internal only, never exposed to clients
      path: data.document.path,
    },
    printSettings: {
      copies: data.printSettings.copies || 1,
      pages: data.printSettings.pages || 'all',
      color: data.printSettings.color || 'bw',
      paperSize: data.printSettings.paperSize || 'A4',
      duplex: data.printSettings.duplex || false,
      orientation: data.printSettings.orientation || 'portrait',
      retentionMinutes,
    },
    status: JOB_STATUS.CREATED,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    readyAt: null,
    printedAt: null,
    expiresAt: null,
    expiredAt: null,
  }
}

/**
 * Transition a job to READY status.
 * This happens once the document upload is confirmed stored.
 */
function markReady(job) {
  job.status = JOB_STATUS.READY
  job.readyAt = new Date().toISOString()
  job.updatedAt = new Date().toISOString()
  return job
}

/**
 * Transition a job to PRINTING status.
 * Called when the shopkeeper clicks PRINT.
 */
function markPrinting(job) {
  job.status = JOB_STATUS.PRINTING
  job.updatedAt = new Date().toISOString()
  return job
}

/**
 * Transition a job to PRINTED status and start retention countdown.
 * @param {number} retentionMinutes - Customer-configured retention period
 */
function markPrinted(job, retentionMinutes) {
  job.status = JOB_STATUS.PRINTED
  job.printedAt = new Date().toISOString()
  job.expiresAt = new Date(calculateExpiry(retentionMinutes)).toISOString()
  job.updatedAt = new Date().toISOString()
  return job
}

/**
 * Transition a job to EXPIRED status.
 * Called after the retention period elapses.
 */
function markExpired(job) {
  if (job.status !== JOB_STATUS.PRINTED) {
    throw new Error('Only PRINTED jobs can transition to EXPIRED')
  }
  job.status = JOB_STATUS.EXPIRED
  job.expiredAt = new Date().toISOString()
  job.updatedAt = new Date().toISOString()
  return job
}

/**
 * Transition a job to FAILED status.
 */
function markFailed(job, reason) {
  job.status = JOB_STATUS.FAILED
  job.failureReason = reason || 'Unknown error'
  job.updatedAt = new Date().toISOString()
  return job
}

/**
 * Transition a job to CANCELLED status.
 * Abandoned jobs should use CANCELLED with a safety timeout.
 */
function markCancelled(job, reason) {
  job.status = JOB_STATUS.CANCELLED
  job.cancellationReason = reason || 'Job cancelled'
  job.updatedAt = new Date().toISOString()
  return job
}

/**
 * Public-safe view of a job (excludes internal fields like file path).
 */
function toPublic(job) {
  return {
    jobId: job.jobId,
    tenantId: job.tenantId,
    document: {
      filename: job.document.filename,
      originalName: job.document.originalName,
    },
    printSettings: job.printSettings,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    readyAt: job.readyAt,
    printedAt: job.printedAt,
    expiresAt: job.expiresAt,
    expiredAt: job.expiredAt,
    failureReason: job.failureReason,
    cancellationReason: job.cancellationReason,
  }
}

module.exports = {
  createJob,
  markReady,
  markPrinting,
  markPrinted,
  markExpired,
  markFailed,
  markCancelled,
  toPublic,
}
