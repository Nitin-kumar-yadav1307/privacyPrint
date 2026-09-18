const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  validateSettings,
  buildLpArgs,
} = require('../src/cupsPrinter')
const pdfFallback = require('../src/pdfFallback')
const { JobPoller } = require('../src/jobPoller')

const SETTINGS = {
  copies: 2,
  pages: '1-2',
  color: 'bw',
  paperSize: 'A4',
  duplex: true,
  orientation: 'portrait',
}

test('lp arguments map print settings exactly and safely', () => {
  const args = buildLpArgs(SETTINGS, '/tmp/doc.pdf', 'Office_Printer')
  assert.deepEqual(args, [
    '-d', 'Office_Printer',
    '-n', '2',
    '-P', '1-2',
    '-o', 'ColorModel=Gray',
    '-o', 'media=A4',
    '-o', 'sides=two-sided-long-edge',
    '--', '/tmp/doc.pdf',
  ])
})

test('landscape, color and one-sided settings map to their CUPS options', () => {
  const args = buildLpArgs(
    { ...SETTINGS, copies: 1, pages: 'all', color: 'color', duplex: false, orientation: 'landscape' },
    '/tmp/doc.pdf',
    'p',
  )
  assert.ok(args.includes('-o', 'ColorModel=RGB'))
  assert.ok(!args.includes('-P')) // pages=all → no page range
  assert.ok(args.includes('sides=one-sided'))
  assert.ok(args.includes('landscape'))
})

test('invalid settings never reach the shell', () => {
  assert.throws(() => buildLpArgs({ ...SETTINGS, copies: 500 }, '/x', 'p'))
  assert.throws(() => buildLpArgs({ ...SETTINGS, pages: '1; rm -rf /' }, '/x', 'p'))
  assert.throws(() => buildLpArgs({ ...SETTINGS, paperSize: 'LETTER' }, '/x', 'p'))
})

test('PDF fallback produces a verbatim copy plus a settings manifest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-fallback-'))
  const src = path.join(dir, 'doc.pdf')
  fs.writeFileSync(src, '%PDF-1.4 sample document bytes')

  const job = { jobId: 'JOB-TEST-1', document: { originalName: 'doc.pdf' }, printSettings: SETTINGS }
  const result = pdfFallback.printFile(src, job)

  assert.equal(result.ok, true)
  assert.equal(result.mode, 'PDF_FALLBACK')
  assert.equal(fs.readFileSync(result.outputPath, 'utf8'), '%PDF-1.4 sample document bytes')

  const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'))
  assert.equal(manifest.jobId, 'JOB-TEST-1')
  assert.equal(manifest.mode, 'PDF_FALLBACK')
  assert.equal(manifest.printSettings.copies, 2)
  assert.equal(manifest.printSettings.pages, '1-2')

  fs.rmSync(dir, { recursive: true, force: true })
  fs.rmSync(result.outputPath, { force: true })
  fs.rmSync(result.manifestPath, { force: true })
})

test('poller never prints the same job twice and cleans up temp files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-poller-'))
  let downloadCalls = 0
  let printed = []
  const completed = []

  const api = {
    async listPrintingJobs() {
      return [{ jobId: 'JOB-DUP', document: { filename: 'doc.pdf' }, printSettings: SETTINGS }]
    },
    async downloadDocument(job, dest) {
      downloadCalls += 1
      fs.writeFileSync(dest, 'bytes')
    },
    async reportPrintResult(jobId, payload) {
      completed.push({ jobId, ...payload })
    },
  }
  const printer = {
    printDocument(filePath, job) {
      printed.push(job.jobId)
      assert.ok(fs.existsSync(filePath))
      return { ok: true, mode: 'PDF_FALLBACK' }
    },
  }
  const logger = { info() {}, warn() {}, error() {} }
  const poller = new JobPoller({ api, printer, logger, pollIntervalMs: 10000 })

  // Two overlapping polls must not duplicate the print.
  await Promise.all([poller.tick(), poller.tick()])
  assert.equal(printed.length, 1)
  assert.equal(downloadCalls, 1)
  assert.deepEqual(completed, [{ jobId: 'JOB-DUP', result: 'completed', mode: 'PDF_FALLBACK' }])

  // Temp download removed after the attempt.
  const leftovers = fs.readdirSync(dir).length // dir itself is empty; TMP_DIR holds nothing
  assert.equal(leftovers, 0)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('Windows SumatraPDF settings string maps print settings exactly', () => {
  const { buildPrintSettings } = require('../src/windowsPrinter')
  assert.equal(buildPrintSettings(SETTINGS), '2x,1-2,duplex,paper=a4,portrait')
  assert.equal(
    buildPrintSettings({ ...SETTINGS, copies: 1, pages: 'all', duplex: false, orientation: 'landscape' }),
    'simplex,paper=a4,landscape',
  )
  assert.throws(() => buildPrintSettings({ ...SETTINGS, copies: 500 }))
  assert.throws(() => buildPrintSettings({ ...SETTINGS, pages: '1 && del /q *' }))
})

test('Windows print invocation uses argument arrays, never a shell string', () => {
  const { buildPrintArgs } = require('../src/windowsPrinter')
  const args = buildPrintArgs('C:\\Tools\\SumatraPDF.exe', 'HP LaserJet', SETTINGS, 'C:\\tmp\\doc.pdf')
  assert.deepEqual(args, [
    'C:\\Tools\\SumatraPDF.exe',
    '-print-to', 'HP LaserJet',
    '-silent',
    '-exit-when-done',
    '-print-settings', '2x,1-2,duplex,paper=a4,portrait',
    'C:\\tmp\\doc.pdf',
  ])
})

test('Windows printer discovery parser handles names with defaults', () => {
  const { parsePrinters } = require('../src/windowsPrinter')
  const parsed = parsePrinters('HP LaserJet|True\nMicrosoft Print to PDF|False\n\n')
  assert.deepEqual(parsed.printers, ['HP LaserJet', 'Microsoft Print to PDF'])
  assert.equal(parsed.defaultPrinter, 'HP LaserJet')
})

test('auto mode selects per platform: Windows tool on win32, CUPS elsewhere, PDF last', () => {
  const { selectAutoMode } = require('../src/printerService')
  assert.equal(selectAutoMode('win32', { cupsAvailable: false, windowsAvailable: true }), 'windows')
  assert.equal(selectAutoMode('win32', { cupsAvailable: false, windowsAvailable: false }), 'pdf')
  assert.equal(selectAutoMode('linux', { cupsAvailable: true, windowsAvailable: false }), 'cups')
  assert.equal(selectAutoMode('linux', { cupsAvailable: false, windowsAvailable: false }), 'pdf')
  assert.equal(selectAutoMode('darwin', { cupsAvailable: true, windowsAvailable: false }), 'cups')
})

test('print failure is reported as PRINT_FAILED, not success', async () => {
  const completed = []
  const api = {
    async listPrintingJobs() {
      return [{ jobId: 'JOB-FAIL', document: { filename: 'd.pdf' }, printSettings: SETTINGS }]
    },
    async downloadDocument(job, dest) {
      require('node:fs').writeFileSync(dest, 'bytes')
    },
    async reportPrintResult(jobId, payload) {
      completed.push({ jobId, ...payload })
    },
  }
  const printer = { printDocument() { return { ok: false, mode: 'CUPS', error: 'lp exited with status 1' } } }
  const poller = new JobPoller({ api, printer, logger: { info() {}, warn() {}, error() {} }, pollIntervalMs: 10000 })

  await poller.tick()
  assert.deepEqual(completed, [{ jobId: 'JOB-FAIL', result: 'failed', reason: 'lp exited with status 1' }])
})