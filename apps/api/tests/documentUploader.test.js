const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'privacyprint-uploader-'))
process.env.UPLOAD_DIR = path.join(root, 'uploads')
fs.mkdirSync(process.env.UPLOAD_DIR)
const { createDocumentUploader } = require('../src/services/documentUploader')
const { MAX_FILE_SIZE } = require('../src/constants')
const file = {
  path: path.join(process.env.UPLOAD_DIR, 'synthetic.txt'),
  filename: 'synthetic.txt', originalname: 'Synthetic document.txt', mimetype: 'text/plain',
}
fs.writeFileSync(file.path, 'Synthetic document only')
test.after(() => fs.rmSync(root, { recursive: true, force: true }))

test('local default preserves the staging document and requires no S3 client', async () => {
  const result = await createDocumentUploader()(file, 'TENANT-001')
  assert.deepEqual(result, {
    filename: file.filename, originalName: file.originalname, storage: 'local', path: file.path,
  })
  assert.equal(fs.readFileSync(file.path, 'utf8'), 'Synthetic document only')
})

test('S3 upload awaits confirmation, encrypts content and returns private object metadata', async () => {
  const calls = []
  let release
  const gate = new Promise((resolve) => { release = resolve })
  let received
  const requestReceived = new Promise((resolve) => { received = resolve })
  const upload = createDocumentUploader({ provider: 's3', bucket: 'synthetic-bucket', client: {
    putObject: async (request) => { calls.push(request); received(); await gate },
  } })
  let finished = false
  const pending = upload(file, 'TENANT/001').then((value) => { finished = true; return value })
  // Wait for the injected client without timing-based sleeps.
  await Promise.race([requestReceived, pending])
  assert.equal(finished, false)
  release()
  const result = await pending
  assert.equal(calls[0].Body.toString(), 'Synthetic document only')
  assert.equal(calls[0].ServerSideEncryption, 'AES256')
  assert.equal(calls[0].ContentType, 'text/plain')
  assert.equal(calls[0].Bucket, 'synthetic-bucket')
  assert.match(calls[0].Key, /^documents\/TENANT%2F001\/[a-f0-9-]{36}$/)
  assert.deepEqual(result, {
    filename: file.filename, originalName: file.originalname,
    storage: 's3', bucket: 'synthetic-bucket', key: calls[0].Key,
  })
  assert.ok(fs.existsSync(file.path), 'Caller owns cleanup until metadata is persisted')
  const second = await upload(file, 'TENANT/001')
  assert.notEqual(second.key, result.key)
})

test('S3 failure propagates without returning local success or deleting staging data', async () => {
  const failure = new Error('Synthetic transport failure')
  const upload = createDocumentUploader({ provider: 's3', bucket: 'synthetic-bucket', client: {
    putObject: async () => { throw failure },
  } })
  await assert.rejects(upload(file, 'TENANT-001'), (error) => error === failure)
  assert.ok(fs.existsSync(file.path))
})

test('invalid provider/client configuration fails closed', () => {
  assert.throws(() => createDocumentUploader({ provider: 'unknown' }), /Unknown/)
  assert.throws(() => createDocumentUploader({ provider: 's3' }), /requires/)
  assert.throws(() => createDocumentUploader({ provider: 's3', bucket: ' ', client: { putObject() {} } }), /requires/)
})

test('invalid paths, symlinks, tenants and oversized files never reach S3', async () => {
  let calls = 0
  const upload = createDocumentUploader({ provider: 's3', bucket: 'synthetic-bucket', client: {
    putObject: async () => { calls++ },
  } })
  const outside = path.join(root, 'outside.txt')
  fs.writeFileSync(outside, 'Synthetic outside file')
  const link = path.join(process.env.UPLOAD_DIR, 'link.txt')
  fs.symlinkSync(outside, link)
  const large = path.join(process.env.UPLOAD_DIR, 'large.txt')
  fs.writeFileSync(large, '')
  fs.truncateSync(large, MAX_FILE_SIZE + 1)
  for (const badPath of [undefined, outside, link, large, path.join(process.env.UPLOAD_DIR, '.gitkeep')]) {
    await assert.rejects(upload({ ...file, path: badPath }, 'TENANT-001'))
  }
  for (const tenant of [undefined, '', ' ', 'a'.repeat(129)]) {
    await assert.rejects(upload(file, tenant), /tenant/)
  }
  assert.equal(calls, 0)
  assert.equal(fs.readFileSync(outside, 'utf8'), 'Synthetic outside file')
})
