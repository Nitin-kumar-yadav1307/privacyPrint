const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { once } = require('node:events')
const test = require('node:test')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'privacyprint-tenants-'))
const uploadDir = path.join(root, 'uploads')
process.env.UPLOAD_DIR = uploadDir
process.env.DATA_DIR = path.join(root, 'data')
fs.mkdirSync(uploadDir, { recursive: true })
const { app } = require('../src/server')
const jobService = require('../src/services/jobService')
const tenantService = require('../src/services/tenantService')
const { TENANT_STATUS, toPublicTenant } = require('../src/models/Tenant')

const settings = { copies: 1, retentionMinutes: 10, duplex: false }
test.after(() => fs.rmSync(root, { recursive: true, force: true }))

test('demo registry has unique ids, valid statuses and code-shaped shop codes', () => {
  const tenants = tenantService.allTenants()
  assert.ok(tenants.length >= 3)
  assert.equal(new Set(tenants.map((t) => t.id)).size, tenants.length, 'Tenant ids must be unique')
  assert.equal(new Set(tenants.map((t) => t.code)).size, tenants.length, 'Shop codes must be unique')
  for (const tenant of tenants) {
    assert.match(tenant.id, /^TENANT-\d{3}$/)
    assert.match(tenant.code, /^SHOP-[A-Z]{3}-\d{3}$/)
    assert.ok([TENANT_STATUS.ACTIVE, TENANT_STATUS.INACTIVE].includes(tenant.status))
    assert.ok(tenant.name.trim().length > 0)
  }
  // At least one active and one inactive shop must exist to exercise both paths.
  assert.ok(tenants.some((t) => t.status === TENANT_STATUS.ACTIVE))
  assert.ok(tenants.some((t) => t.status === TENANT_STATUS.INACTIVE))
  console.log('✓ Registry ids/codes are unique and statuses are valid')
})

test('tenant lookup rejects unknown, blank and non-string input', () => {
  assert.equal(tenantService.findTenant('TENANT-001').code, 'SHOP-MUM-001')
  assert.equal(tenantService.findTenant('  TENANT-001  ').id, 'TENANT-001', 'Whitespace is ignored')
  assert.equal(tenantService.isActiveTenant('TENANT-001'), true)
  for (const bad of [undefined, null, 42, '', '   ', 'TENANT-999', 'tenant-001']) {
    assert.equal(tenantService.findTenant(bad), null, `Expected ${String(bad)} to be unknown`)
    assert.equal(tenantService.isActiveTenant(bad), false)
  }
  assert.equal(tenantService.isActiveTenant('TENANT-004'), false, 'Inactive shop is never active')
  console.log('✓ Lookup is exact, trimmed and rejects inactive shops')
})

test('public tenant shape exposes only id, name, code and status', () => {
  assert.deepEqual(Object.keys(toPublicTenant(tenantService.allTenants()[0])), ['id', 'name', 'code', 'status'])
})

test('GET /api/tenants lists active shops only, GET /api/tenants/:id hides inactive ones', async () => {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  try {
    const listRes = await fetch(`${base}/tenants`)
    assert.equal(listRes.status, 200)
    const list = await listRes.json()
    assert.equal(list.success, true)
    assert.equal(list.count, list.tenants.length)
    const active = tenantService.allTenants().filter((t) => t.status === TENANT_STATUS.ACTIVE)
    assert.deepEqual(list.tenants.map((t) => t.id), active.map((t) => t.id))
    for (const tenant of list.tenants) {
      assert.deepEqual(Object.keys(tenant), ['id', 'name', 'code', 'status'])
    }
    console.log('✓ Directory returns active shops with public fields')

    const one = await fetch(`${base}/tenants/TENANT-001`)
    assert.equal(one.status, 200)
    assert.equal((await one.json()).tenant.name, 'QuickPrint Mumbai')

    for (const unknown of ['TENANT-999', 'TENANT-004', '%20']) {
      const res = await fetch(`${base}/tenants/${unknown}`)
      assert.equal(res.status, 404, `${unknown} must not be revealed`)
      assert.equal((await res.json()).error, 'Not found')
    }
    console.log('✓ Single lookup returns a shop or 404 without revealing inactive shops')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('job creation rejects unknown and inactive shops without leaking an upload', async () => {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const url = `http://127.0.0.1:${server.address().port}/api/jobs`
  try {
    async function submit(tenantId) {
      const form = new FormData()
      form.set('tenantId', tenantId)
      form.set('printSettings', JSON.stringify(settings))
      form.set('document', new Blob(['Synthetic tenant test'], { type: 'text/plain' }), 'synthetic.txt')
      return fetch(url, { method: 'POST', body: form })
    }

    const baseline = (await jobService.allJobs()).length
    const unknown = await submit('TENANT-999')
    assert.equal(unknown.status, 404)
    assert.equal((await unknown.json()).message, 'Unknown print shop')

    const inactive = await submit('TENANT-004')
    assert.equal(inactive.status, 403)
    assert.equal((await inactive.json()).message, 'Print shop is not active')

    assert.equal((await jobService.allJobs()).length, baseline, 'Rejected shops must not create jobs')
    assert.deepEqual(fs.readdirSync(uploadDir), [], 'Rejected shops must leave no uploaded file')
    console.log('✓ Unknown shop → 404 and inactive shop → 403, both with no file and no job')

    // A valid shop still works, and the stored job uses the trimmed tenant id.
    const accepted = await submit('  TENANT-001  ')
    assert.equal(accepted.status, 201)
    const job = (await accepted.json()).job
    assert.equal(job.tenantId, 'TENANT-001')
    assert.equal((await jobService.getRaw(job.jobId)).tenantId, 'TENANT-001')
    assert.equal(fs.readdirSync(uploadDir).length, 1)
    console.log('✓ Valid shop creates a job bound to the normalized tenant id')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})