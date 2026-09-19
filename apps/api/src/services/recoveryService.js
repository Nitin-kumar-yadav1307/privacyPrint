const fs = require('node:fs')
const path = require('node:path')
const jobs = require('./jobService')
const { UPLOAD_DIR, DATA_DIR } = require('../config')
const { JOB_STATUS } = require('../constants')
const { removeDocument } = require('./documentStorage')
const { processExpiredJobs } = require('./expiryService')

const ORPHAN_GRACE_MS = 10 * 60 * 1000

// Run before accepting requests, with exclusive ownership of these directories.
async function recoverJobs(now = Date.now(), log = console.log, onError = console.error) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o700 })
  if (DATA_DIR === UPLOAD_DIR) throw new Error('Metadata and uploads must use separate directories')
  const referenced = new Set()
  // Validate every path before any destructive recovery action. Remote (S3)
  // documents have no local file and are managed by the expiry worker, not
  // by filesystem recovery.
  for (const job of jobs.allJobs()) {
    if (job.document.storage === 's3') continue
    const filePath = path.resolve(job.document.path)
    if (path.dirname(filePath) !== UPLOAD_DIR || path.basename(filePath) === '.gitkeep') {
      throw new Error('Stored document path is invalid; recovery stopped')
    }
    referenced.add(filePath)
  }
  await processExpiredJobs(now, log, onError)
  for (const job of jobs.allJobs()) {
    if (![JOB_STATUS.CREATED, JOB_STATUS.READY, JOB_STATUS.PRINTING, JOB_STATUS.PRINTED].includes(job.status)) continue
    if (job.document.storage === 's3') continue
    try {
      fs.lstatSync(job.document.path)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      jobs.failJob(job.jobId, 'Temporary document unavailable after restart')
      log('[RECOVERY] Missing document job marked FAILED')
    }
  }
  for (const entry of fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })) {
    if (entry.name === '.gitkeep' || (!entry.isFile() && !entry.isSymbolicLink())) continue
    const filePath = path.join(UPLOAD_DIR, entry.name)
    if (referenced.has(filePath)) continue
    try {
      if (now - fs.lstatSync(filePath).mtimeMs >= ORPHAN_GRACE_MS) {
        removeDocument({ path: filePath })
        log('[RECOVERY] Unreferenced temporary document removed')
      }
    } catch {
      onError('[RECOVERY] Unreferenced document removal failed; retry at next startup')
    }
  }
}

module.exports = { recoverJobs, ORPHAN_GRACE_MS }
