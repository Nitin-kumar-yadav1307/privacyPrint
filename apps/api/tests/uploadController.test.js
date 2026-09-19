const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'privacyprint-controller-'))
process.env.UPLOAD_DIR = path.join(root, 'uploads')
process.env.DATA_DIR = path.join(root, 'data')
fs.mkdirSync(process.env.UPLOAD_DIR)
const uploader = require('../src/services/documentUploader')
const originalFactory = uploader.createDocumentUploader
let resolveUpload
let rejectUpload
let uploadArgs
// Replace only the uploader boundary before loading this isolated controller.
uploader.createDocumentUploader = () => (file, tenantId) => {
  uploadArgs = { file, tenantId }
  return new Promise((resolve, reject) => {
    resolveUpload = resolve
    rejectUpload = reject
  })
}
const { createJob } = require('../src/controllers/jobsController')
uploader.createDocumentUploader = originalFactory
const jobs = require('../src/services/jobService')
test.after(() => fs.rmSync(root, { recursive: true, force: true }))

function request(name) {
  const filePath = path.join(process.env.UPLOAD_DIR, name)
  fs.writeFileSync(filePath, 'Synthetic controller test')
  return {
    body: {
      tenantId: 'TENANT-001',
      printSettings: JSON.stringify({ copies: 1, retentionMinutes: 10, duplex: false }),
    },
    file: { path: filePath, filename: name, originalname: name, mimetype: 'text/plain', size: 25 },
  }
}

test('controller awaits upload confirmation and persists returned local metadata', async () => {
  const req = request('accepted.txt')
  let response
  let forwarded
  const pending = createJob(req, {
    status(code) {
      assert.equal(code, 201)
      return { json(value) { response = value } }
    },
  }, (error) => { forwarded = error })
  assert.deepEqual(uploadArgs, { file: req.file, tenantId: 'TENANT-001' })
  assert.equal((await jobs.allJobs()).length, 0)
  assert.equal(response, undefined)
  resolveUpload({ storage: 'local', path: req.file.path, filename: 'confirmed.txt', originalName: 'Confirmed synthetic.txt' })
  await pending
  assert.equal(forwarded, undefined)
  const stored = await jobs.getRaw(response.job.jobId)
  assert.equal(stored.document.filename, 'confirmed.txt')
  assert.equal(stored.document.originalName, 'Confirmed synthetic.txt')
  assert.equal(stored.document.path, req.file.path)
  assert.equal(stored.status, 'READY')
  assert.ok(fs.existsSync(req.file.path))
})

test('upload failure creates no job and removes the unowned staging file', async () => {
  const req = request('rejected.txt')
  const count = (await jobs.allJobs()).length
  const failure = new Error('Synthetic uploader failure')
  let forwarded
  const pending = createJob(req, {
    status() { assert.fail('Failed upload must not send a success response') },
  }, (error) => { forwarded = error })
  assert.equal((await jobs.allJobs()).length, count)
  rejectUpload(failure)
  await pending
  assert.equal(forwarded, failure)
  assert.equal((await jobs.allJobs()).length, count)
  assert.ok(!fs.existsSync(req.file.path))
})
