const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// Isolate all synthetic files from real development uploads.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'privacyprint-cleanup-'))
process.env.UPLOAD_DIR = path.join(root, 'uploads')
process.env.DATA_DIR = path.join(root, 'data')
fs.mkdirSync(process.env.UPLOAD_DIR)
const { UPLOAD_DIR } = require('../src/config')
const { removeDocument } = require('../src/services/documentStorage')
const jobs = require('../src/services/jobService')
const { processExpiredJobs } = require('../src/services/expiryService')
const { UPLOAD_DIR: multerDir } = require('../src/utils/fileValidation')
let sequence = 0
const now = Date.now()
const errors = []
const tick = async (time = now) => processExpiredJobs(time, () => {}, (message) => errors.push(message))

function create() {
  const filename = `synthetic-${++sequence}.txt`
  const filePath = path.join(UPLOAD_DIR, filename)
  fs.writeFileSync(filePath, 'Synthetic cleanup test only')
  const job = jobs.create({
    tenantId: 'TENANT-001',
    printSettings: { copies: 1, retentionMinutes: 10 },
    document: { filename, originalName: filename, path: filePath },
  })
  return jobs.getRaw(job.jobId)
}

function print(job) {
  jobs.startPrinting(job.jobId, job.tenantId)
  jobs.markPrinted(job.jobId, job.tenantId)
}

(async () => {
try {
  assert.equal(multerDir, UPLOAD_DIR)
  const printed = create()
  print(printed)
  printed.expiresAt = new Date(now + 1000).toISOString()
  await tick()
  assert.ok(fs.existsSync(printed.document.path), 'Retained until deadline')
  assert.equal(printed.status, 'PRINTED')
  await tick(now + 1000)
  assert.equal(printed.status, 'EXPIRED')
  assert.ok(!fs.existsSync(printed.document.path))
  const expiredAt = printed.expiredAt
  await jobs.expireJob(printed.jobId)
  assert.equal(printed.expiredAt, expiredAt)
  assert.equal(jobs.getById(printed.jobId).document.path, undefined)
  console.log('✓ Shared upload configuration, deadline deletion and idempotency')

  const cancelled = create()
  assert.equal(await jobs.cancelJob(cancelled.jobId, 'TENANT-002'), null)
  assert.ok(fs.existsSync(cancelled.document.path))
  await jobs.cancelJob(cancelled.jobId, cancelled.tenantId, 'Customer revoked')
  assert.equal(cancelled.status, 'CANCELLED')
  assert.ok(!fs.existsSync(cancelled.document.path))
  await jobs.cancelJob(cancelled.jobId, cancelled.tenantId, 'Second reason')
  assert.equal(cancelled.cancellationReason, 'Customer revoked')
  const printing = create()
  jobs.startPrinting(printing.jobId, printing.tenantId)
  await jobs.cancelJob(printing.jobId, printing.tenantId)
  await jobs.expireJob(printing.jobId)
  assert.equal(printing.status, 'PRINTING')
  assert.ok(fs.existsSync(printing.document.path))
  console.log('✓ Cancellation removes files only for eligible matching-tenant jobs')

  const abandoned = create()
  abandoned.createdAt = new Date(now - 600001).toISOString()
  await tick()
  assert.equal(abandoned.status, 'CANCELLED')
  assert.ok(!fs.existsSync(abandoned.document.path))
  const missing = create()
  fs.unlinkSync(missing.document.path)
  await jobs.cancelJob(missing.jobId, missing.tenantId)
  assert.equal(missing.status, 'CANCELLED')
  console.log('✓ Abandonment cleanup and already-missing file handling')

  const failed = create()
  print(failed)
  failed.expiresAt = new Date(now - 1).toISOString()
  fs.unlinkSync(failed.document.path)
  // A directory deterministically causes unlink failure even when tests run as root.
  fs.mkdirSync(failed.document.path)
  const healthy = create()
  print(healthy)
  healthy.expiresAt = failed.expiresAt
  await tick()
  assert.equal(failed.status, 'PRINTED')
  assert.equal(failed.expiredAt, null)
  assert.equal(healthy.status, 'EXPIRED', 'One failure must not block other jobs')
  assert.equal(errors.length, 1)
  assert.ok(!errors[0].includes(failed.document.path))
  fs.rmdirSync(failed.document.path)
  fs.writeFileSync(failed.document.path, 'Retry synthetic file')
  await tick()
  assert.equal(failed.status, 'EXPIRED')
  assert.ok(!fs.existsSync(failed.document.path))
  console.log('✓ Cleanup failure preserves state, isolates failure and retries')

  const outside = path.join(root, 'outside.txt')
  fs.writeFileSync(outside, 'Must remain untouched')
  await assert.rejects(() => removeDocument({ path: outside }), /outside/)
  await assert.rejects(() => removeDocument({}), /missing/)
  const keep = path.join(UPLOAD_DIR, '.gitkeep')
  fs.writeFileSync(keep, '')
  await assert.rejects(() => removeDocument({ path: keep }), /outside/)
  const link = path.join(UPLOAD_DIR, 'link.txt')
  fs.symlinkSync(outside, link)
  await removeDocument({ path: link })
  assert.ok(fs.existsSync(outside), 'Unlink must not follow file symlinks')
  assert.ok(fs.existsSync(keep))
  console.log('✓ Storage boundary and symlink-target protection')

  const tagged = create()
  for (const storage of ['s3', 'unknown', null]) {
    tagged.document.storage = storage
    await assert.rejects(() => jobs.cancelJob(tagged.jobId, tagged.tenantId), /(cannot remove|incomplete)/)
    assert.equal(tagged.status, 'READY')
    assert.ok(fs.existsSync(tagged.document.path))
  }
  tagged.document.storage = 'local'
  await jobs.cancelJob(tagged.jobId, tagged.tenantId)
  assert.equal(tagged.status, 'CANCELLED')
  assert.ok(!fs.existsSync(tagged.document.path))
  console.log('✓ Local deletion rejects non-local metadata without deleting files or changing state')
  console.log('All cleanup checks passed')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
