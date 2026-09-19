const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

// Configure DynamoDB mode before anything reads the config.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'privacyprint-ddb-'))
process.env.JOBS_TABLE = 'privacyprint-jobs-test'
process.env.UPLOAD_DIR = path.join(root, 'uploads')
process.env.DATA_DIR = path.join(root, 'data')
fs.mkdirSync(process.env.UPLOAD_DIR)
fs.mkdirSync(process.env.DATA_DIR)

// Fake DocumentClient command layer backed by in-memory items.
const items = new Map() // jobId -> item
const calls = []

const { _setDocumentClientFactory } = require('../src/services/dynamoJobRepository')
_setDocumentClientFactory(() => ({
  async send(command) {
    calls.push(command)
    const input = command.input
    const kind = command.constructor.name
    if (kind === 'PutCommand') {
      if (input.ConditionExpression === 'attribute_not_exists(jobId)' && items.has(input.Item.jobId)) {
        throw Object.assign(new Error('ConditionalCheckFailed'), { name: 'ConditionalCheckFailedException' })
      }
      items.set(input.Item.jobId, { ...input.Item })
      return {}
    }
    if (kind === 'GetCommand') {
      if (input.ConsistentRead !== true) throw new Error('get must be ConsistentRead')
      const item = items.get(input.Key.jobId)
      return item ? { Item: { ...item } } : {}
    }
    if (kind === 'QueryCommand') {
      const tenant = input.ExpressionAttributeValues[':tenant']
      return { Items: Array.from(items.values()).filter((item) => item.tenantId === tenant).map((item) => ({ ...item })) }
    }
    if (kind === 'ScanCommand') {
      return { Items: Array.from(items.values()).map((item) => ({ ...item })) }
    }
    throw new Error(`Unexpected command: ${kind}`)
  },
}))

const jobService = require('../src/services/jobService')

test.after(() => {
  fs.rmSync(root, { recursive: true, force: true })
  delete process.env.JOBS_TABLE
})

test('job creation persists a retention record for the expiry worker', async () => {
  const job = await jobService.create({
    tenantId: 'TENANT-001',
    printSettings: { copies: 1, retentionMinutes: 10 },
    document: {
      filename: 'k1', originalName: 'Doc.pdf',
      storage: 's3', bucket: 'b', key: 'documents/TENANT-001/k1',
    },
  })
  assert.equal(job.status, 'READY')
  const stored = items.get(job.jobId)
  assert.ok(stored, 'record written to DynamoDB')
  assert.equal(stored.tenantId, 'TENANT-001')
  assert.equal(stored.document.key, 'documents/TENANT-001/k1')
  // CREATED jobs get no TTL yet; expiry only exists after printing.
  assert.equal(stored.expiresAtEpoch, undefined)
})

test('printing writes expiresAt + the TTL attribute the worker and table rely on', async () => {
  const job = await jobService.create({
    tenantId: 'TENANT-002',
    printSettings: { copies: 1, retentionMinutes: 10 },
    document: { filename: 'k2', originalName: 'Doc.pdf', storage: 's3', bucket: 'b', key: 'k2' },
  })
  await jobService.startPrinting(job.jobId, job.tenantId)
  await jobService.markPrinted(job.jobId, job.tenantId)
  const stored = items.get(job.jobId)
  assert.equal(stored.status, 'PRINTED')
  assert.ok(stored.expiresAt, 'ISO expiry recorded')
  assert.equal(stored.expiresAtEpoch, Math.floor(Date.parse(stored.expiresAt) / 1000))
})

test('tenant isolation: cross-tenant reads, queues and transitions fail closed', async () => {
  const job = await jobService.create({
    tenantId: 'TENANT-ISO',
    printSettings: { copies: 1, retentionMinutes: 10 },
    document: { filename: 'k3', originalName: 'Doc.pdf', storage: 's3', bucket: 'b', key: 'k3' },
  })
  assert.equal(await jobService.getByIdAndTenant(job.jobId, 'TENANT-003'), null)
  assert.deepEqual(await jobService.getByTenant('TENANT-003'), [])
  assert.equal(await jobService.startPrinting(job.jobId, 'TENANT-003'), null)
  const queue = await jobService.getQueue('TENANT-ISO')
  assert.ok(queue.some((entry) => entry.jobId === job.jobId), 'own job visible in its queue')
  assert.ok(queue.every((entry) => entry.tenantId === 'TENANT-ISO'), 'no cross-tenant leak')
})

test('full lifecycle round-trips through the table, including cancel', async () => {
  // Local document metadata: exercises deletion-before-cancel through the table path.
  const staged = path.join(process.env.UPLOAD_DIR, `cancel-${Date.now()}.pdf`)
  fs.writeFileSync(staged, '%PDF-1.4 cancel')
  const job = await jobService.create({
    tenantId: 'TENANT-LIFE',
    printSettings: { copies: 1, retentionMinutes: 10 },
    document: { filename: path.basename(staged), originalName: 'Doc.pdf', storage: 'local', path: staged },
  })
  const cancelled = await jobService.cancelJob(job.jobId, job.tenantId, 'Test')
  assert.equal(cancelled.status, 'CANCELLED')
  assert.equal(items.get(job.jobId).status, 'CANCELLED')
})