const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'privacyprint-restart-'))
const uploads = path.join(root, 'uploads')
const data = path.join(root, 'data')
fs.mkdirSync(uploads)
const env = { ...process.env, UPLOAD_DIR: uploads, DATA_DIR: data }
function child(code, success = true) {
  // Top-level await is not allowed alongside require() in `node -e`, so every
  // child script is wrapped in an async IIFE.
  const result = spawnSync(process.execPath, ['-e', `(async () => { ${code} })().catch((error) => { console.error(error); process.exit(1) })`], {
    cwd: path.join(__dirname, '..'), env, encoding: 'utf8', timeout: 10000,
  })
  assert.ifError(result.error)
  if (success) assert.equal(result.status, 0, result.stderr)
  else assert.notEqual(result.status, 0)
  return result
}
const load = "const jobs = require('./src/services/jobService');"
const recover = "await require('./src/services/recoveryService').recoverJobs(Date.now(), () => {}, () => {});"
const snapshot = path.join(data, 'jobs.json')
try {
  child(`
    const fs = require('node:fs'); const path = require('node:path'); ${load}
    for (const name of ['ready', 'printed', 'printing', 'missing', 'abandoned', 'cancelled']) {
      const filePath = path.join(process.env.UPLOAD_DIR, name + '.txt');
      fs.writeFileSync(filePath, 'Synthetic restart document');
      const job = await jobs.create({ tenantId: 'SHOP-A', printSettings: { copies: 2, retentionMinutes: 10 },
        document: { filename: name + '.txt', originalName: name, path: filePath } });
      if (['printed', 'printing'].includes(name)) await jobs.startPrinting(job.jobId, 'SHOP-A');
      if (name === 'printed') await jobs.markPrinted(job.jobId, 'SHOP-A');
      if (name === 'cancelled') await jobs.cancelJob(job.jobId, 'SHOP-A', 'Synthetic cancel');
    }
  `)
  const saved = JSON.parse(fs.readFileSync(snapshot))
  const printed = saved.jobs.find((job) => job.document.originalName === 'printed')
  // Move test fixture deadlines into the past without sleeps.
  printed.expiresAt = new Date(Date.now() - 1000).toISOString()
  saved.jobs.find((job) => job.document.originalName === 'abandoned').createdAt = new Date(Date.now() - 700000).toISOString()
  fs.writeFileSync(snapshot, JSON.stringify(saved))
  fs.unlinkSync(path.join(uploads, 'missing.txt'))
  for (const filename of ['old-orphan.txt', 'recent-orphan.txt', '.gitkeep']) {
    fs.writeFileSync(path.join(uploads, filename), 'Synthetic orphan fixture')
  }
  fs.utimesSync(path.join(uploads, 'old-orphan.txt'), 1, 1)
  fs.utimesSync(path.join(uploads, '.gitkeep'), 1, 1)
  fs.mkdirSync(path.join(uploads, 'untouched-directory'))
  child(`${load}
    const assert = require('node:assert/strict');
    assert.equal((await jobs.allJobs()).length, 6);
    assert.equal((await jobs.getByTenant('SHOP-B')).length, 0);
    ${recover}
    const byName = Object.fromEntries((await jobs.allJobs()).map(j => [j.document.originalName, j]));
    assert.equal(byName.ready.status, 'READY');
    assert.equal(byName.printed.status, 'EXPIRED');
    assert.equal(byName.printed.printedAt, ${JSON.stringify(printed.printedAt)});
    assert.equal(byName.printed.expiresAt, ${JSON.stringify(printed.expiresAt)});
    assert.equal(byName.printing.status, 'PRINTING');
    assert.equal(byName.printing.expiresAt, null);
    assert.equal(byName.missing.status, 'FAILED');
    assert.equal(byName.abandoned.status, 'CANCELLED');
    assert.equal(byName.cancelled.status, 'CANCELLED');
    assert.equal((await jobs.getById(byName.ready.jobId)).document.path, undefined);
  `)
  assert.ok(!fs.existsSync(path.join(uploads, 'old-orphan.txt')))
  assert.ok(!fs.existsSync(path.join(uploads, 'printed.txt')))
  assert.ok(!fs.existsSync(path.join(uploads, 'abandoned.txt')))
  for (const file of ['ready.txt', 'printing.txt', 'recent-orphan.txt', '.gitkeep', 'untouched-directory']) {
    assert.ok(fs.existsSync(path.join(uploads, file)))
  }
  const recovered = fs.readFileSync(snapshot, 'utf8')
  child(`${load} ${recover}`)
  assert.equal(fs.readFileSync(snapshot, 'utf8'), recovered)
  console.log('✓ Separate-process restoration, tenant filtering, deadlines and idempotent recovery')
  console.log('✓ Missing documents fail safely; interrupted prints remain PRINTING; orphan grace respected')

  child(`${load}
    const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
    const target = path.join(process.env.DATA_DIR, 'jobs.json');
    const original = fs.readFileSync(target); fs.unlinkSync(target); fs.mkdirSync(target);
    const ready = (await jobs.allJobs()).find(j => j.status === 'READY');
    try {
      await assert.rejects(() => jobs.startPrinting(ready.jobId, 'SHOP-A'), /could not be saved/);
      assert.equal(ready.status, 'READY');
      const count = (await jobs.allJobs()).length;
      await assert.rejects(() => jobs.create({ tenantId: 'SHOP-A', printSettings: { copies: 1 }, document: ready.document }), /could not be saved/);
      assert.equal((await jobs.allJobs()).length, count);
    } finally { fs.rmdirSync(target); fs.writeFileSync(target, original); }
  `)
  console.log('✓ Failed metadata writes roll back creation and state transitions')

  fs.writeFileSync(path.join(uploads, 'protected-orphan.txt'), 'Synthetic corruption fixture')
  fs.utimesSync(path.join(uploads, 'protected-orphan.txt'), 1, 1)
  fs.writeFileSync(snapshot, '{broken')
  child(`${load} ${recover}`, false)
  assert.ok(fs.existsSync(path.join(uploads, 'protected-orphan.txt')))
  fs.writeFileSync(snapshot, recovered)
  const badPath = JSON.parse(recovered)
  badPath.jobs[0].document.path = path.join(root, 'outside.txt')
  fs.writeFileSync(snapshot, JSON.stringify(badPath))
  child(`${load} ${recover}`, false)
  assert.ok(fs.existsSync(path.join(uploads, 'protected-orphan.txt')))
  console.log('✓ Corrupt metadata and out-of-area paths stop recovery before sweeping')
  console.log('All restart checks passed')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
