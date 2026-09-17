/**
 * Tests for the PrivacyPrint API job lifecycle.
 * Run with: node tests/jobs.test.js
 */
const assert = require('assert')
const http = require('http')
const path = require('path')
const fs = require('fs')
const { app } = require('../src/server')

const PORT = 3991 // test port to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`

let server

/**
 * Simple HTTP helper that returns { status, body }.
 */
function apiRequest(method, urlPath, body, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary12345'
    let headers = {}
    let bodyData

    if (filePath) {
      const fileContent = fs.readFileSync(filePath)
      bodyData = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tenantId"',
        '',
        'TENANT-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="printSettings"',
        '',
        JSON.stringify({
          copies: 1, pages: '1', color: 'bw', paperSize: 'A4',
          duplex: false, orientation: 'portrait', retentionMinutes: 1,
        }),
        `--${boundary}`,
        'Content-Disposition: form-data; name="document"; filename="test.pdf"',
        'Content-Type: application/pdf',
        '',
      ]
      const parts = []
      bodyData.forEach((line) => parts.push(Buffer.from(line + '\r\n')))
      bodyData = Buffer.concat([...parts, fileContent, Buffer.from(`\r\n--${boundary}--\r\n`)])
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      bodyData = Buffer.from(JSON.stringify(body))
    } else {
      headers['Content-Type'] = 'application/json'
      bodyData = Buffer.from('{}')
    }

    const options = {
      hostname: 'localhost', port: PORT, path: urlPath, method,
      headers: { 'Content-Length': bodyData.length, ...headers },
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.write(bodyData)
    req.end()
  })
}

async function runTests() {
  console.log('Starting API tests...\n')

  // Test 1: Health check
  const health = await apiRequest('GET', '/api/health')
  assert.strictEqual(health.status, 200, 'Health check should return 200')
  assert.strictEqual(health.body.status, 'ok')
  assert.strictEqual(health.body.service, 'PrivacyPrint API')
  console.log('✓ Test 1: Health check passes')

  // Create a test file for upload
  const testFilePath = path.join(__dirname, 'test-upload.txt')
  fs.writeFileSync(testFilePath, 'This is a test document for PrivacyPrint API testing.')

  // Test 2: Create a job
  const created = await apiRequest('POST', '/api/jobs', null, testFilePath)
  assert.ok([200, 201].includes(created.status), 'Create job should return 200/201')
  assert.ok(created.body.success, 'Create job should have success=true')
  assert.ok(created.body.job, 'Create job should have a job')
  assert.ok(created.body.job.jobId, 'Job should have a jobId')
  assert.strictEqual(created.body.job.tenantId, 'TENANT-001')
  assert.strictEqual(created.body.job.status, 'READY', 'New job should be READY')
  console.log('✓ Test 2: Job creation passes')

  const jobId = created.body.job.jobId

  // Test 3: Retrieve job by ID with correct tenant
  const retrieved = await apiRequest('GET', `/api/jobs/${jobId}?tenantId=TENANT-001`)
  assert.strictEqual(retrieved.status, 200)
  assert.ok(retrieved.body.success)
  assert.strictEqual(retrieved.body.job.jobId, jobId)
  console.log('✓ Test 3: Job retrieval by ID passes')

  // Test 4: Cross-tenant access denial
  const crossTenant = await apiRequest('GET', `/api/jobs/${jobId}?tenantId=TENANT-002`)
  assert.strictEqual(crossTenant.status, 404, 'Cross-tenant access should return 404')
  console.log('✓ Test 4: Cross-tenant isolation works (404 for unauthorized tenant)')

  // Test 5: List jobs for tenant
  const listed = await apiRequest('GET', '/api/jobs?tenantId=TENANT-001')
  assert.strictEqual(listed.status, 200)
  assert.ok(Array.isArray(listed.body.jobs))
  assert.ok(listed.body.jobs.length >= 1, 'Should have at least 1 job')
  console.log('✓ Test 5: Job listing by tenant passes')

  // Test 6: Start printing
  const started = await apiRequest('POST', `/api/jobs/${jobId}/print?tenantId=TENANT-001`)
  assert.strictEqual(started.status, 200)
  assert.strictEqual(started.body.job.status, 'PRINTING')
  console.log('✓ Test 6: Print start passes')

  // Test 7: Complete printing
  const completed = await apiRequest('POST', `/api/jobs/${jobId}/complete?tenantId=TENANT-001`)
  assert.strictEqual(completed.status, 200)
  assert.strictEqual(completed.body.job.status, 'PRINTED')
  assert.ok(completed.body.job.expiresAt, 'PRINTED job should have expiresAt')
  console.log('✓ Test 7: Print completion passes')

  // Test 8: Validation error — missing tenantId
  const noTenant = await apiRequest('GET', '/api/jobs')
  assert.strictEqual(noTenant.status, 400, 'Missing tenantId should return 400')
  console.log('✓ Test 8: Validation error passes')

  // Test 9: Cross-tenant print denial
  const crossPrint = await apiRequest('POST', `/api/jobs/${jobId}/complete?tenantId=TENANT-002`)
  assert.strictEqual(crossPrint.status, 404, 'Cross-tenant print should return 404')
     console.log('✓ Test 9: Cross-tenant print denial works')

  // Test 10: Status check endpoint
  const statusRes = await apiRequest('GET', `/api/jobs/${jobId}/status?tenantId=TENANT-001`)
  assert.strictEqual(statusRes.status, 200)
  assert.strictEqual(statusRes.body.status, 'PRINTED')
  assert.strictEqual(statusRes.body.jobId, jobId)
  console.log('✓ Test 10: Status check endpoint passes')

  // Test 11: Status check — cross-tenant 404
  const crossStatus = await apiRequest('GET', `/api/jobs/${jobId}/status?tenantId=TENANT-002`)
  assert.strictEqual(crossStatus.status, 404, 'Cross-tenant status should return 404')
  console.log('✓ Test 11: Cross-tenant status denial works')

  // Test 12: Printer queue
  const queueRes = await apiRequest('GET', '/api/jobs/queue?tenantId=TENANT-001')
  assert.strictEqual(queueRes.status, 200)
  assert.ok(Array.isArray(queueRes.body.jobs))
  // The job from test 2-7 is PRINTED, so it should not be in the queue
  // Create a new job for queue testing
  const queued = await apiRequest('POST', '/api/jobs', null, testFilePath)
  assert.ok([200, 201].includes(queued.status), 'Create job for queue test should return 200/201')
  const queuedJobId = queued.body.job.jobId
  const queueRes2 = await apiRequest('GET', '/api/jobs/queue?tenantId=TENANT-001')
  assert.strictEqual(queueRes2.status, 200)
  assert.ok(queueRes2.body.jobs.some((j) => j.jobId === queuedJobId), 'Queue should contain the new READY job')
  assert.ok(queueRes2.body.jobs.every((j) => ['READY', 'PRINTING'].includes(j.status)), 'Queue should only have READY/PRINTING jobs')
  console.log('✓ Test 12: Printer queue endpoint passes')

  // Test 13: Auto-complete a PRINTING job
  await apiRequest('POST', `/api/jobs/${queuedJobId}/print?tenantId=TENANT-001`)
  const autoCompleted = await apiRequest('POST', `/api/jobs/${queuedJobId}/autocomplete?tenantId=TENANT-001`)
  assert.strictEqual(autoCompleted.status, 200)
  assert.strictEqual(autoCompleted.body.job.status, 'PRINTED')
  assert.ok(autoCompleted.body.job.expiresAt, 'Auto-completed job should have expiresAt')
  console.log('✓ Test 13: Auto-complete print passes')

  // Test 14: Auto-complete non-PRINTING job returns job as-is
  const autoOnReady = await apiRequest('POST', `/api/jobs/${jobId}/autocomplete?tenantId=TENANT-001`)
  assert.strictEqual(autoOnReady.status, 200)
  assert.strictEqual(autoOnReady.body.job.status, 'PRINTED', 'Job already PRINTED should stay PRINTED')
  console.log('✓ Test 14: Auto-complete on non-PRINTING job handled gracefully')

  // Cleanup
  fs.unlinkSync(testFilePath)

  console.log('\n✅ All tests passed!')
}

// Start server and run tests
server = app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`)
  runTests()
    .then(() => {
      server.close()
      process.exit(0)
    })
    .catch((err) => {
      console.error('Test failure:', err)
      server.close()
      process.exit(1)
    })
})

// Force timeout (covers unexpected hangs)
setTimeout(() => {
  console.error('Tests timed out')
  server.close()
  process.exit(1)
}, 15000)
