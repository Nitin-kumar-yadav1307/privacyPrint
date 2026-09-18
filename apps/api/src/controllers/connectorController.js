const path = require('path')
const fs = require('fs')
const { UPLOAD_DIR } = require('../config')
const jobService = require('../services/jobService')
const connectorService = require('../services/connectorService')

/**
 * GET /connector/jobs
 * PRINTING jobs for the authenticated shop — the connector's work queue.
 */
function listJobs(req, res, next) {
  try {
    const jobs = connectorService.listPrintingJobs(req.authorizedTenantId)
    res.json({ success: true, jobs })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /connector/jobs/:jobId/document
 * Stream the stored document to the shop's print connector.
 * Only the job's own tenant, and only while PRINTING, may fetch the bytes.
 */
function getDocument(req, res, next) {
  try {
    const { jobId } = req.params
    const tenantId = req.authorizedTenantId

    const job = jobService.getByIdAndTenant(jobId, tenantId)
    if (!job) {
      // 404, not 403 — never reveal other tenants' job ids.
      return res.status(404).json({
        error: 'Not found',
        message: 'Job not found or you do not have access to this job',
      })
    }
    if (job.status !== 'PRINTING') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Document is only available while the job is PRINTING',
      })
    }

    const raw = jobService.getRaw(jobId)
    const docPath = raw?.document?.path
    if (typeof docPath !== 'string' || !docPath) {
      return res.status(404).json({ error: 'Not found', message: 'Document is no longer available' })
    }

    // Same containment rule as removeDocument: only direct children of the
    // private upload directory may be served.
    const resolved = path.resolve(docPath)
    if (path.dirname(resolved) !== UPLOAD_DIR || path.basename(resolved) === '.gitkeep') {
      return res.status(404).json({ error: 'Not found', message: 'Document is no longer available' })
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Not found', message: 'Document is no longer available' })
    }

    res.download(resolved, raw.document.originalName || 'document', (err) => {
      if (err && !res.headersSent) next(err)
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /connector/jobs/:jobId/complete
 * Connector reports the print outcome.
 * @body {string} result - "completed" | "failed"
 * @body {string} [mode] - "CUPS" | "PDF_FALLBACK" (informational)
 * @body {string} [reason] - required for failures
 */
function completePrint(req, res, next) {
  try {
    const { jobId } = req.params
    const { result, mode, reason } = req.body || {}

    if (result !== 'completed' && result !== 'failed') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'result must be "completed" or "failed"',
      })
    }
    if (result === 'failed' && (typeof reason !== 'string' || !reason.trim())) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'reason is required when result is "failed"',
      })
    }

    const job = connectorService.reportPrintResult(jobId, req.authorizedTenantId, {
      result,
      reason,
    })
    if (!job) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Job not found or you do not have access to this job',
      })
    }

    res.json({
      success: true,
      job,
      message:
        result === 'completed'
          ? 'Print completed — retention countdown started'
          : 'Print failure recorded',
    })
  } catch (err) {
    next(err)
  }
}

/** POST /connector/heartbeat — proves this shop's connector is alive. */
function heartbeat(req, res, next) {
  try {
    connectorService.recordHeartbeat(req.authorizedTenantId)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

/** GET /connector/status — shop dashboard badge for connector liveness. */
function status(req, res, next) {
  try {
    res.json({ success: true, connector: connectorService.connectorStatus(req.authorizedTenantId) })
  } catch (err) {
    next(err)
  }
}

module.exports = { listJobs, getDocument, completePrint, heartbeat, status }