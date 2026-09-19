const { JOB_STATUS } = require('../constants')
const jobService = require('../services/jobService')
const { removeDocument } = require('../services/documentStorage')
const { assertUploadContent } = require('../utils/fileValidation')
const { createDocumentUploader } = require('../services/documentUploader')
const tenantService = require('../services/tenantService')
const { TENANT_STATUS } = require('../models/Tenant')

// Keep local storage until remote deletion and recovery are integrated.
const uploadDocument = createDocumentUploader()

/**
 * Tenant this request may act on.
 *
 * A verified shop session (shopAuth middleware) is authoritative: its tenantId
 * is bound server-side and a conflicting query parameter was already rejected
 * with 403. The query parameter remains the local-demo fallback when no
 * session was presented (AUTH_REQUIRED=false).
 */
function requestTenantId(req) {
  return req.authorizedTenantId || (req.query && req.query.tenantId)
}

/**
 * GET /health
 * Simple health check endpoint.
 */
function health(req, res) {
  res.json({
    status: 'ok',
    service: 'PrivacyPrint API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
}

/**
 * POST /jobs
 * Create a new print job.
 *
 * The tenantId is taken from the request body in this simple flow,
 * but in the full implementation it will come from an authenticated
 * session or signed token (server-side trusted).
 *
 * The tenantId is validated against the shop registry so a job can never
 * reference an unknown or inactive shop. This is still request input, not
 * proof of identity: real tenant authorization comes in a later phase.
 *
 * @body {string} tenantId - The shop/tenant identifier
 * @body {Object} printSettings - Customer print settings
 * @body {Object} document - Uploaded document info (from multer)
 */
async function createJob(req, res, next) {
  let jobStored = false
  const httpError = (name, message, statusCode) => Object.assign(new Error(message), { name, statusCode })
  const validationError = (message) => httpError('Validation error', message, 400)
  try {
    // A shop session, when presented, is authoritative for the tenant; the
    // form body value is only trusted in the local demo (no session).
    const tenantId = req.authorizedTenantId || req.body.tenantId
    const printSettings = req.body.printSettings

    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      throw validationError('tenantId is required')
    }

    // Every job must belong to a known, active print shop.
    const tenant = tenantService.findTenant(tenantId)
    if (!tenant) {
      throw httpError('Not found', 'Unknown print shop', 404)
    }
    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      throw httpError('Forbidden', 'Print shop is not active', 403)
    }

    if (!req.file) {
      throw validationError('A document file is required')
    }

    let settings
    try {
      settings = JSON.parse(printSettings || '{}')
    } catch {
      throw validationError('printSettings must be valid JSON')
    }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw validationError('printSettings must be a JSON object')
    }
    const errors = validatePrintSettings(settings)
    if (errors.length > 0) {
      throw validationError(errors.join('; '))
    }

    // The bytes decide the type, not the client's Content-Type header: a file
    // renamed .pdf is rejected here instead of being stored and later failing
    // inside the printer's filter chain. The catch block removes it.
    try {
      assertUploadContent(req.file.path, req.file.mimetype)
    } catch (contentError) {
      throw validationError(contentError.message)
    }

    const documentInfo = {
      ...await uploadDocument(req.file, tenant.id),
      mimetype: req.file.mimetype,
      size: req.file.size,
    }

    const job = jobService.create({
      tenantId: tenant.id,
      printSettings: settings,
      document: documentInfo,
    })
    jobStored = true

    res.status(201).json({
      success: true,
      job,
    })
  } catch (err) {
    // Multer owns cleanup of upload errors; this handles post-upload rejection.
    // Once a job owns the file, only its lifecycle may remove it.
    if (req.file && !jobStored) {
      try {
        removeDocument(req.file)
      } catch (cleanupError) {
        return next(cleanupError)
      }
    }
    next(err)
  }
}

/**
 * Validate print settings fields.
 * @param {Object} settings
 * @returns {string[]} Array of error messages
 */
function validatePrintSettings(settings) {
  const errors = []

  if (!settings.copies || settings.copies < 1 || settings.copies > 99) {
    errors.push('copies must be between 1 and 99')
  }

  if (!settings.retentionMinutes || settings.retentionMinutes < 1) {
    errors.push('retentionMinutes must be at least 1')
  }

  if (settings.color && !['bw', 'color'].includes(settings.color)) {
    errors.push('color must be "bw" or "color"')
  }

  if (settings.paperSize && !['A4', 'A3'].includes(settings.paperSize)) {
    errors.push('paperSize must be "A4" or "A3"')
  }

  if (settings.orientation && !['portrait', 'landscape'].includes(settings.orientation)) {
    errors.push('orientation must be "portrait" or "landscape"')
  }

  if (typeof settings.duplex !== 'boolean') {
    errors.push('duplex must be true or false')
  }

  return errors
}

/**
 * GET /jobs?tenantId=<id>
 * List all jobs for a specific tenant.
 * Server-side tenant isolation: only jobs matching the tenantId are returned.
 */
function listJobs(req, res, next) {
  try {
    const tenantId = requestTenantId(req)

    if (!tenantId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'tenantId query parameter is required',
      })
    }

    const jobs = jobService.getByTenant(tenantId)

    res.json({
      success: true,
      jobs,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /jobs/:jobId?tenantId=<id>
 * Retrieve a specific job.
 * Server-side authorization: the tenantId must match the job's tenant.
 */
function getJob(req, res, next) {
  try {
    const { jobId } = req.params
    const tenantId = requestTenantId(req)

    if (!tenantId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'tenantId query parameter is required',
      })
    }

    const job = jobService.getByIdAndTenant(jobId, tenantId)

    if (!job) {
      // Return 404 to avoid leaking job existence across tenants
      return res.status(404).json({
        error: 'Not found',
        message: 'Job not found or you do not have access to this job',
      })
    }

    res.json({
      success: true,
      job,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /jobs/:jobId/print?tenantId=<id>
 * Shopkeeper clicked PRINT — transition to PRINTING.
 */
function startPrint(req, res, next) {
  try {
    const { jobId } = req.params
    const tenantId = requestTenantId(req)

    if (!tenantId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'tenantId query parameter is required',
      })
    }

    const job = jobService.startPrinting(jobId, tenantId)

    if (!job) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Job not found or you do not have access to this job',
      })
    }

    res.json({
      success: true,
      job,
      message: 'Print started',
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /jobs/:jobId/complete?tenantId=<id>
 * Printer simulator reports print completion.
 * Transitions job to PRINTED and starts retention countdown.
 */
function completePrint(req, res, next) {
  try {
    const { jobId } = req.params
    const tenantId = requestTenantId(req)

    if (!tenantId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'tenantId query parameter is required',
      })
    }

    const job = jobService.markPrinted(jobId, tenantId)

    if (!job) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Job not found or you do not have access to this job',
      })
    }

    res.json({
      success: true,
      job,
      message: 'Print completed successfully',
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /jobs/:jobId/status?tenantId=<id>
 * Lightweight status check — returns just the jobId and status for polling.
 */
function getStatus(req, res, next) {
  try {
    const { jobId } = req.params
    const tenantId = requestTenantId(req)

    if (!tenantId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'tenantId query parameter is required',
      })
    }

    const status = jobService.getStatus(jobId, tenantId)

    if (!status) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Job not found or you do not have access to this job',
      })
    }

    res.json({
      success: true,
      jobId: status.jobId,
      status: status.status,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /jobs/queue?tenantId=<id>
 * Get the printer queue for a shop — READY and PRINTING jobs.
 */
function getQueue(req, res, next) {
  try {
    const tenantId = requestTenantId(req)

    if (!tenantId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'tenantId query parameter is required',
      })
    }

    const queueJobs = jobService.getQueue(tenantId)

    res.json({
      success: true,
      jobs: queueJobs,
      count: queueJobs.length,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /jobs/:jobId/autocomplete?tenantId=<id>
 * Printer simulator auto-completes a PRINTING job.
 */
function autoComplete(req, res, next) {
  try {
    const { jobId } = req.params
    const tenantId = requestTenantId(req)

    if (!tenantId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'tenantId query parameter is required',
      })
    }

    const job = jobService.autoCompletePrint(jobId, tenantId)

    if (!job) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Job not found or you do not have access to this job',
      })
    }

    res.json({
      success: true,
      job,
      message: 'Job auto-completed by printer simulator',
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /jobs/:jobId/cancel?tenantId=<id>
 * Customer or shop cancels a job that hasn't started printing.
 * Optional JSON body: { "reason": "why" }
 */
function cancelJob(req, res, next) {
  try {
    const { jobId } = req.params
    const tenantId = requestTenantId(req)

    if (!tenantId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'tenantId query parameter is required',
      })
    }

    const reason = req.body && typeof req.body.reason === 'string' ? req.body.reason : undefined
    const job = jobService.cancelJob(jobId, tenantId, reason)

    if (!job) {
      // Return 404 to avoid leaking job existence across tenants
      return res.status(404).json({
        error: 'Not found',
        message: 'Job not found or you do not have access to this job',
      })
    }

    res.json({
      success: true,
      job,
      message: 'Job cancelled successfully',
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  health,
  createJob,
  listJobs,
  getJob,
  startPrint,
  completePrint,
  getStatus,
  getQueue,
  autoComplete,
  cancelJob,
  validatePrintSettings,
}
