const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const express = require('express')

// Configure S3 mode + isolated store before anything reads the config.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'privacyprint-s3-'))
process.env.DOCUMENT_BUCKET = 'privacyprint-test-bucket'
process.env.UPLOAD_DIR = path.join(root, 'uploads')
process.env.DATA_DIR = path.join(root, 'data')
fs.mkdirSync(process.env.UPLOAD_DIR)
fs.mkdirSync(process.env.DATA_DIR)

const s3Client = require('../src/services/s3Client')
const jobService = require('../src/services/jobService')
const { removeDocument } = require('../src/services/documentStorage')
const connectorController = require('../src/controllers/connectorController')

const putCalls = []
const deleteCalls = []
const getResults = new Map()
s3Client._overrideClients({
  put: async (request) => { putCalls.push(request) },
  delete: async (request) => {
    deleteCalls.push(request)
    getResults.delete(request.Key)
  },
  get: async (request) => {
    if (!getResults.has(request.Key)) {
      throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' })
    }
    return getResults.get(request.Key)
  },
})

test.after(() => {
  fs.rmSync(root, { recursive: true, force: true })
  delete process.env.DOCUMENT_BUCKET
})

async function createJob() {
  const job = await jobService.create({
    tenantId: 'TENANT-001',
    printSettings: { copies: 1, retentionMinutes: 10 },
    document: {
      filename: 'object-key-1', originalName: 'Report.pdf',
      storage: 's3', bucket: 'privacyprint-test-bucket', key: 'documents/TENANT-001/object-key-1',
    },
  })
  getResults.set('documents/TENANT-001/object-key-1', {
    ContentType: 'application/pdf',
    ContentLength: 4,
    Body: (function () {
      const { Readable } = require('node:stream')
      return Readable.from([Buffer.from('%PDF')])
    })(),
  })
  return job
}

test('document removal deletes the recorded S3 object, not a local path', async () => {
  await removeDocument({ storage: 's3', bucket: 'privacyprint-test-bucket', key: 'k/1' })
  assert.deepEqual(deleteCalls.pop(), { Bucket: 'privacyprint-test-bucket', Key: 'k/1' })
  await assert.rejects(() => removeDocument({ storage: 's3', bucket: 'privacyprint-test-bucket' }), /incomplete/)
})

test('cancelling an S3-backed job deletes the object before the status change', async () => {
  const job = await createJob()
  assert.equal((await jobService.getRaw(job.jobId)).document.storage, 's3')
  const updated = await jobService.cancelJob(job.jobId, job.tenantId, 'Test cancel')
  assert.equal(updated.status, 'CANCELLED')
  const last = deleteCalls.pop()
  assert.equal(last.Bucket, 'privacyprint-test-bucket')
  assert.equal(last.Key, 'documents/TENANT-001/object-key-1')
  assert.equal((await jobService.getById(job.jobId)).document.path, undefined)
})

function buildApp() {
  const app = express()
  app.use('/connector/jobs/:jobId/document', (req, res, next) => {
    // Simulates the shop-auth middleware: a fixed authorized tenant.
    req.authorizedTenantId = 'TENANT-001'
    next()
  }, connectorController.getDocument)
  return app
}

async function request(app, url) {
  const server = app.listen(0)
  try {
    const port = server.address().port
    const response = await fetch(`http://127.0.0.1:${port}${url}`)
    return { status: response.status, contentType: response.headers.get('content-type'), body: Buffer.from(await response.arrayBuffer()) }
  } finally {
    server.close()
  }
}

test('connector streams an S3 document only for its own PRINTING job', async () => {
  const job = await createJob()
  await jobService.startPrinting(job.jobId, job.tenantId)

  const ok = await request(buildApp(), `/connector/jobs/${job.jobId}/document`)
  assert.equal(ok.status, 200)
  assert.equal(ok.contentType, 'application/pdf')
  assert.equal(ok.body.toString(), '%PDF')

  // A second tenant is not allowed to fetch the same job.
  const other = express()
  other.use('/connector/jobs/:jobId/document', (req, res, next) => {
    req.authorizedTenantId = 'TENANT-002'
    next()
  }, connectorController.getDocument)
  const denied = await request(other, `/connector/jobs/${job.jobId}/document`)
  assert.equal(denied.status, 404)
})

test('a missing S3 object surfaces as 404, not a crash', async () => {
  const job = await createJob()
  await jobService.startPrinting(job.jobId, job.tenantId)
  getResults.delete('documents/TENANT-001/object-key-1')
  const missing = await request(buildApp(), `/connector/jobs/${job.jobId}/document`)
  assert.equal(missing.status, 404)
})