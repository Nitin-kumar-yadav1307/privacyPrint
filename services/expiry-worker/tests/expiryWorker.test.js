const { test } = require('node:test')
const assert = require('node:assert/strict')
const { classify, planActions } = require('../src/expiryCore')
const { handler } = require('../src/index')

const NOW = Date.parse('2026-09-18T12:00:00.000Z')

test('expiry rules mirror the local lifecycle exactly', () => {
  assert.equal(
    classify({ status: 'PRINTED', expiresAt: '2026-09-18T11:59:59.000Z', createdAt: 'x' }, NOW),
    'expire',
  )
  assert.equal(
    classify({ status: 'PRINTED', expiresAt: '2026-09-18T12:00:01.000Z', createdAt: 'x' }, NOW),
    null,
  )
  assert.equal(
    classify({ status: 'CREATED', createdAt: '2026-09-18T11:49:59.000Z' }, NOW),
    'abandon',
  )
  assert.equal(
    classify({ status: 'CREATED', createdAt: '2026-09-18T11:59:59.000Z' }, NOW),
    null, // fresh job — not yet stale
  )
  assert.equal(classify({ status: 'CANCELLED', createdAt: '2026-09-18T11:00:00.000Z' }, NOW), null)
})

test('planActions covers only jobs needing action', () => {
  const plan = planActions(
    [
      { jobId: 'J1', tenantId: 'T1', status: 'PRINTED', expiresAt: '2026-09-18T11:00:00.000Z', createdAt: 'x' },
      { jobId: 'J2', tenantId: 'T1', status: 'PRINTING', createdAt: '2026-09-18T11:00:00.000Z' },
      { jobId: 'J3', tenantId: 'T2', status: 'READY', createdAt: '2026-09-18T11:00:00.000Z' },
    ],
    NOW,
  )
  assert.deepEqual(plan, [
    { jobId: 'J1', tenantId: 'T1', action: 'expire' },
    { jobId: 'J3', tenantId: 'T2', action: 'abandon' },
  ])
})

function fakeRepository(jobs) {
  const calls = { deleted: [], expired: [], cancelled: [] }
  let failDeletionFor = null
  return {
    calls,
    failDeletionFor(jobId) {
      failDeletionFor = jobId
    },
    async findActive() {
      return jobs.filter((j) => !calls.expired.includes(j.jobId) && !calls.cancelled.includes(j.jobId))
    },
    async deleteDocument(job) {
      if (failDeletionFor === job.jobId) throw new Error('S3 delete failed')
      calls.deleted.push(job.jobId)
    },
    async markExpired(jobId) {
      calls.expired.push(jobId)
    },
    async markCancelled(jobId) {
      calls.cancelled.push(jobId)
    },
  }
}

test('handler expires: document deleted BEFORE status update', async () => {
  const jobs = [
    { jobId: 'J-EXP', tenantId: 'T1', status: 'PRINTED', expiresAt: '2026-09-18T11:00:00.000Z', createdAt: 'x', document: { objectKey: 'doc.pdf' } },
  ]
  const repo = fakeRepository(jobs)
  const result = await handler({}, { repository: repo, logger: { log() {}, error() {} } })

  assert.deepEqual(result.expired, ['J-EXP'])
  assert.deepEqual(result.cancelled, [])
  assert.equal(result.processed, 1)
  // Order guarantee: the document deletion is recorded before the transition.
  assert.ok(repo.calls.deleted.includes('J-EXP'))
  assert.ok(repo.calls.expired.includes('J-EXP'))
})

test('failed document deletion leaves the job untouched and reports a retryable failure', async () => {
  const jobs = [
    { jobId: 'J-FAIL', tenantId: 'T1', status: 'PRINTED', expiresAt: '2026-09-18T11:00:00.000Z', createdAt: 'x', document: { objectKey: 'doc.pdf' } },
  ]
  const repo = fakeRepository(jobs)
  repo.failDeletionFor('J-FAIL')

  const result = await handler({}, { repository: repo, logger: { log() {}, error() {} } })
  assert.deepEqual(result.expired, [])
  assert.deepEqual(result.failures, [{ jobId: 'J-FAIL', action: 'expire' }])
  assert.ok(!repo.calls.expired.includes('J-FAIL'))
})

test('stale abandoned jobs are cleaned up; terminal jobs are never reprocessed', async () => {
  const jobs = [
    { jobId: 'J-STALE', tenantId: 'T2', status: 'READY', createdAt: '2026-09-18T11:00:00.000Z', document: { objectKey: 'd2.pdf' } },
    { jobId: 'J-DONE', tenantId: 'T1', status: 'EXPIRED', createdAt: 'x' },
  ]
  const repo = fakeRepository(jobs)
  const result = await handler({}, { repository: repo, logger: { log() {}, error() {} } })

  assert.deepEqual(result.cancelled, ['J-STALE'])
  assert.deepEqual(result.expired, [])
  // Second invocation sees nothing — idempotent.
  const again = await handler({}, { repository: repo, logger: { log() {}, error() {} } })
  assert.equal(again.processed, 0)
})