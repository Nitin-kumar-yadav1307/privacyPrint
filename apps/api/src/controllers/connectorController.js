const path = require('path')
const fs = require('fs')
const { UPLOAD_DIR } = require('../config')
const jobService = require('../services/jobService')
const connectorService = require('../services/connectorService')
const { getS3Getter } = require('../services/s3Client')

/**
 * GET /connector/jobs
 * PRINTING jobs for the authenticated shop — the connector's work queue.
 */
function listJobs(req, res, next) {
  connectorService.listPrintingJobs(req.authorizedTenantId)
    .then((jobs) => res.json({ success: true, jobs }))
    .catch(next)
}

/**
 * GET /connector/jobs/:jobId/document
 * Stream the stored document to the shop's print connector.
 * Only the job's own tenant, and only while PRINTING, may fetch the bytes.
 */
function getDocument(req, res, next) {
  getDocumentAsync(req, res).catch(next)
}

async function getDocumentAsync(req, res) {
  const { jobId } = req.params
  const tenantId = req.authorizedTenantId

  const job = await jobService.getByIdAndTenant(jobId, tenantId)
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

  const raw = await jobService.getRaw(jobId)

  // Remote storage: stream the private S3 object straight to the connector.
  // The exact recorded bucket/key is used — the tenant-authorized jobId has
  // already been resolved above, and keys are opaque UUIDs (no tenant data).
  if (raw?.document?.storage === 's3') {
    const { bucket, key } = raw.document
    if (typeof bucket !== 'string' || !bucket || typeof key !== 'string' || !key) {
      return res.status(404).json({ error: 'Not found', message: 'Document is no longer available' })
    }
    const getObject = getS3Getter()
    if (!getObject) {
      return res.status(500).json({ error: 'Server error', message: 'Remote document storage is not configured' })
    }
    let object
    try {
      object = await getObject({ Bucket: bucket, Key: key })
    } catch {
      return res.status(404).json({ error: 'Not found', message: 'Document is no longer available' })
    }
    res.setHeader('Content-Type', object.ContentType || 'application/octet-stream')
    if (object.ContentLength) res.setHeader('Content-Length', String(object.ContentLength))
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${(raw.document.originalName || 'document').replace(/["\\\r\n]/g, '_')}"`,
    )
    object.Body.pipe(res)
    return
  }

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
}

/**
 * POST /connector/jobs/:jobId/complete
 * Connector reports the print outcome.
 * @body {string} result - "completed" | "failed"
 * @body {string} [mode] - "CUPS" | "PDF_FALLBACK" (informational)
 * @body {string} [reason] - required for failures
 */
async function completePrint(req, res, next) {
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

    const job = await connectorService.reportPrintResult(jobId, req.authorizedTenantId, {
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

/**
 * Heartbeat metadata the connector may publish; anything else is ignored.
 * The connector is authenticated, but this payload still comes from the network
 * and is echoed to the shop dashboard, so it is whitelisted and bounded.
 */
const HEARTBEAT_META_FIELDS = ['mode', 'printerState', 'printerName', 'printerConnection', 'printerSource']
const HEARTBEAT_META_MAX_LENGTH = 120

function sanitizeHeartbeatMeta(body) {
  const meta = {}
  for (const field of HEARTBEAT_META_FIELDS) {
    const value = body ? body[field] : undefined
    if (typeof value === 'string' && value.trim()) {
      meta[field] = value.trim().slice(0, HEARTBEAT_META_MAX_LENGTH)
    }
  }
  return meta
}

/**
 * POST /connector/heartbeat — proves this shop's connector is alive and
 * publishes the printer it auto-detected, so the dashboard can show it.
 */
function heartbeat(req, res, next) {
  try {
    connectorService.recordHeartbeat(req.authorizedTenantId, sanitizeHeartbeatMeta(req.body))
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