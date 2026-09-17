const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { once } = require('node:events')

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'privacyprint-rejected-'))
process.env.UPLOAD_DIR = uploadDir
const { app } = require('../src/server')
const jobs = require('../src/services/jobService')
const { createJob } = require('../src/controllers/jobsController')
const settings = { copies: 1, retentionMinutes: 10, duplex: false }

async function runTests() {
  const server = app.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const url = `http://127.0.0.1:${server.address().port}/api/jobs`
    async function submit(tenantId, printSettings, withFile = true) {
      const form = new FormData()
      if (tenantId !== undefined) form.set('tenantId', tenantId)
      if (printSettings !== undefined) form.set('printSettings', printSettings)
      if (withFile) {
        form.set('document', new Blob(['Synthetic rejection test'], { type: 'text/plain' }), 'synthetic.txt')
      }
      return fetch(url, { method: 'POST', body: form })
    }

    // Keep a valid file present while rejecting other submissions.
    const accepted = await submit('TENANT-001', JSON.stringify(settings))
    assert.equal(accepted.status, 201)
    const validJob = (await accepted.json()).job
    const validPath = jobs.getRaw(validJob.jobId).document.path
    const expectedFiles = fs.readdirSync(uploadDir)
    assert.equal(expectedFiles.length, 1)

    const invalidCases = [
      [undefined, JSON.stringify(settings)],
      ['   ', JSON.stringify(settings)],
      ['TENANT-001', '{broken'],
      ['TENANT-001', 'null'],
      ['TENANT-001', '[]'],
      ['TENANT-001', '"text"'],
      ['TENANT-001', '42'],
      ['TENANT-001', undefined],
      ['TENANT-001', JSON.stringify({ ...settings, copies: 0 })],
      ['TENANT-001', JSON.stringify({ ...settings, duplex: 'yes' })],
    ]
    for (const [tenant, printSettings] of invalidCases) {
      const response = await submit(tenant, printSettings)
      assert.equal(response.status, 400)
      assert.equal((await response.json()).error, 'Validation error')
      assert.deepEqual(fs.readdirSync(uploadDir), expectedFiles, 'Rejected upload must be removed')
      assert.equal(jobs.allJobs().length, 1, 'Rejected requests must not create jobs')
    }
    const noFile = await submit('TENANT-001', JSON.stringify(settings), false)
    assert.equal(noFile.status, 400)
    assert.ok(fs.existsSync(validPath))
    console.log('✓ Invalid tenant/settings JSON/settings values leave no uploaded file or job')
    console.log('✓ Accepted document survives other rejected requests; missing file returns 400')

    // Deterministic failure cases at the controller boundary.
    const temporaryPath = path.join(uploadDir, 'failure.txt')
    const req = {
      body: { tenantId: 'TENANT-001', printSettings: JSON.stringify(settings) },
      file: { path: temporaryPath, filename: 'failure.txt', originalname: 'synthetic.txt' },
    }
    const originalCreate = jobs.create
    const failure = new Error('Synthetic store failure')
    let forwarded
    try {
      jobs.create = () => { throw failure }
      fs.writeFileSync(temporaryPath, 'Synthetic failure test')
      createJob(req, {}, (error) => { forwarded = error })
      assert.equal(forwarded, failure)
      assert.ok(!fs.existsSync(temporaryPath))
    } finally {
      jobs.create = originalCreate
    }
    console.log('✓ Store failure removes the unowned upload')

    fs.mkdirSync(temporaryPath)
    createJob({ ...req, body: {} }, {}, (error) => { forwarded = error })
    assert.equal(forwarded.message, 'Temporary document removal failed')
    assert.equal(forwarded.statusCode, undefined, 'Cleanup failure must not masquerade as validation success')
    fs.rmdirSync(temporaryPath)
    console.log('✓ Removal failure is forwarded as a server error')

    fs.writeFileSync(temporaryPath, 'Synthetic response failure test')
    const responseFailure = new Error('Response failed after storing job')
    createJob(req, {
      status: () => ({ json: () => { throw responseFailure } }),
    }, (error) => { forwarded = error })
    assert.equal(forwarded, responseFailure)
    assert.ok(fs.existsSync(temporaryPath), 'A stored job owns its document even if response fails')
    assert.equal(jobs.allJobs().length, 2)
    console.log('✓ Response failure does not remove an accepted job document')
    console.log('All rejected-upload checks passed')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    fs.rmSync(uploadDir, { recursive: true, force: true })
  }
}

runTests().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
