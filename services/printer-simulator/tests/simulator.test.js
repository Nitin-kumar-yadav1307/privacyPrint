const assert = require('node:assert/strict')
const { once } = require('node:events')
const { spawnSync, execFile } = require('node:child_process')
const { promisify } = require('node:util')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'privacyprint-simulator-'))
process.env.UPLOAD_DIR = uploadDir
const { app } = require('../../../apps/api/src/server')
const jobService = require('../../../apps/api/src/services/jobService')
const { simulateJob } = require('../src/simulator')

async function runTests() {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const apiBaseUrl = `http://127.0.0.1:${server.address().port}`
  const settings = {
    copies: 2, pages: '1-2', color: 'bw', paperSize: 'A4',
    duplex: true, orientation: 'portrait', retentionMinutes: 10,
  }
  const create = () => jobService.create({
    tenantId: 'TENANT-001', printSettings: settings,
    document: { filename: 'synthetic.txt', originalName: 'synthetic.txt', path: path.join(uploadDir, 'synthetic.txt') },
  })
  const logs = []
  const options = {
    apiBaseUrl, tenantId: 'TENANT-001', log: (message) => logs.push(message),
    copyDelayMs: 0,
  }
  try {
    const job = create()
    let copies = 0
    const completed = await simulateJob({
      ...options, jobId: job.jobId,
      wait: async () => {
        copies++
        const current = jobService.getById(job.jobId)
        assert.equal(current.status, 'PRINTING')
        assert.equal(current.expiresAt, null, 'Retention must not start during printing')
      },
    })
    assert.equal(copies, 2)
    assert.equal(completed.status, 'PRINTED')
    assert.deepEqual(completed.printSettings, settings)
    assert.ok(Date.parse(completed.expiresAt) > Date.parse(completed.printedAt))
    assert.ok(logs.includes('Copy 1/2'))
    assert.ok(logs.includes('Copy 2/2'))
    assert.ok(logs.includes(`Settings: ${JSON.stringify(settings)}`))
    assert.ok(logs.includes('PRINT COMPLETED'))
    console.log('✓ Copy progress, settings and post-print retention')

    await assert.rejects(simulateJob({ ...options, jobId: job.jobId }), /must be READY/)
    const cancelled = create()
    jobService.cancelJob(cancelled.jobId, cancelled.tenantId, 'Test cancellation')
    await assert.rejects(simulateJob({ ...options, jobId: cancelled.jobId }), /must be READY/)
    console.log('✓ Completed and cancelled jobs cannot be reprinted')

    const other = create()
    await assert.rejects(simulateJob({ ...options, tenantId: 'TENANT-002', jobId: other.jobId }), /404/)
    assert.equal(jobService.getById(other.jobId).status, 'READY')
    console.log('✓ Mismatched tenant refused without changing job')

    logs.length = 0
    await assert.rejects(simulateJob({
      ...options, jobId: other.jobId,
      wait: async () => { throw new Error('Simulated interruption') },
    }), /Simulated interruption/)
    assert.equal(jobService.getById(other.jobId).status, 'PRINTING')
    assert.equal(jobService.getById(other.jobId).expiresAt, null)
    assert.ok(!logs.includes('PRINT COMPLETED'))
    console.log('✓ Interrupted simulation does not report completion')

    await assert.rejects(simulateJob({ ...options }), /required/)
    await assert.rejects(simulateJob({ ...options, jobId: 'missing' }), /404/)
    await assert.rejects(simulateJob({ ...options, jobId: job.jobId, copyDelayMs: -1 }), /copyDelayMs/)
    const cli = spawnSync(process.execPath, [path.join(__dirname, '../src/index.js')], { encoding: 'utf8' })
    assert.equal(cli.status, 1)
    assert.match(cli.stderr, /Usage:/)
    console.log('✓ Invalid input and CLI failure exit')
    const form = new FormData()
    form.set('tenantId', 'TENANT-001')
    form.set('printSettings', JSON.stringify(settings))
    form.set('document', new Blob(['Synthetic simulator test only'], { type: 'text/plain' }), 'synthetic.txt')
    const upload = await fetch(`${apiBaseUrl}/api/jobs`, { method: 'POST', body: form })
    assert.equal(upload.status, 201)
    const uploaded = (await upload.json()).job
    try {
      const result = await promisify(execFile)(process.execPath, [
        path.join(__dirname, '../src/index.js'), 'TENANT-001', uploaded.jobId,
      ], { env: { ...process.env, API_BASE_URL: apiBaseUrl }, timeout: 15000 })
      assert.match(result.stdout, /Copy 2\/2/)
      assert.match(result.stdout, /PRINT COMPLETED/)
      const response = await fetch(`${apiBaseUrl}/api/jobs/${uploaded.jobId}?tenantId=TENANT-001`)
      const finalJob = (await response.json()).job
      assert.equal(finalJob.status, 'PRINTED')
      assert.ok(finalJob.printedAt)
      assert.ok(finalJob.expiresAt)
      console.log('✓ HTTP upload → real CLI → HTTP retrieval confirms PRINTED')
    } finally {
      fs.rmSync(jobService.getRaw(uploaded.jobId).document.path, { force: true })
    }
    console.log('All simulator checks passed')
  } finally {
    fs.rmSync(uploadDir, { recursive: true, force: true })
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

runTests().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
