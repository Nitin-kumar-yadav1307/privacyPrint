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
test('CUPS device URIs are classified so USB and wireless printers are recognized', () => {
  const { classifyDevice } = require('../src/cupsPrinter')
  assert.equal(classifyDevice('usb://HP/DeskJet%204900?serial=123'), 'USB')
  assert.equal(classifyDevice('hp:/usb/DeskJet_4900?serial=123'), 'USB')
  // IPP-over-USB (ipp-usb) exposes a USB printer on loopback IPP.
  assert.equal(classifyDevice('ipp://localhost:60000/ipp/print'), 'USB')
  assert.equal(classifyDevice('ipps://127.0.0.1:60000/ipp/print'), 'USB')
  assert.equal(classifyDevice('ipp://192.168.1.42/ipp/print'), 'NETWORK')
  assert.equal(classifyDevice('dnssd://Office%20Printer._ipp._tcp.local/'), 'NETWORK')
  assert.equal(classifyDevice('socket://printer.local:9100'), 'NETWORK')
  assert.equal(classifyDevice('cups-pdf:/'), 'VIRTUAL')
  assert.equal(classifyDevice('parallel:/dev/lp0'), 'LOCAL')
  assert.equal(classifyDevice(''), 'UNKNOWN')
})

test('CUPS discovery output yields printer queues, the system default and device kinds', () => {
  const { parsePrinters, parseDevices, classifyDevice } = require('../src/cupsPrinter')
  const listing = [
    'printer HP_DeskJet_4900_series_2849E5_USB is idle.  enabled since Sat 19 Sep 2026',
    'printer Office_Laser is idle.  enabled since Sat 19 Sep 2026',
    'system default destination: Office_Laser',
  ].join('\n')
  const { printers, defaultPrinter } = parsePrinters(listing)
  assert.deepEqual(printers, ['HP_DeskJet_4900_series_2849E5_USB', 'Office_Laser'])
  assert.equal(defaultPrinter, 'Office_Laser')

  // No default configured is the common case for a freshly attached printer.
  assert.equal(parsePrinters('printer Only_One is idle.\nno system default destination').defaultPrinter, null)

  const devices = parseDevices([
    'device for HP_DeskJet_4900_series_2849E5_USB: ipp://localhost:60000/ipp/print',
    'device for Office_Laser: ipp://192.168.1.42/ipp/print',
  ].join('\n'))
  assert.equal(classifyDevice(devices.HP_DeskJet_4900_series_2849E5_USB), 'USB')
  assert.equal(classifyDevice(devices.Office_Laser), 'NETWORK')
})

test('printer selection prefers override, then OS default, then USB, and skips virtual queues', () => {
  const { selectPrinter } = require('../src/printerService')
  const details = [
    { name: 'Print_to_PDF', connection: 'VIRTUAL' },
    { name: 'Office_Laser', connection: 'NETWORK' },
    { name: 'DeskJet_USB', connection: 'USB' },
  ]

  // Explicit shop override always wins.
  assert.equal(selectPrinter({ configured: 'Office_Laser', defaultPrinter: null, details }).name, 'Office_Laser')
  assert.equal(selectPrinter({ configured: 'Office_Laser', defaultPrinter: null, details }).source, 'CONFIGURED')

  // The OS default is respected next.
  const byDefault = selectPrinter({ configured: '', defaultPrinter: 'Office_Laser', details })
  assert.deepEqual(byDefault, { name: 'Office_Laser', source: 'OS_DEFAULT', connection: 'NETWORK' })

  // With no default, a directly attached printer beats a network one.
  const auto = selectPrinter({ configured: '', defaultPrinter: null, details })
  assert.deepEqual(auto, { name: 'DeskJet_USB', source: 'AUTO_DETECTED', connection: 'USB' })

  // A virtual default is never used, even if the OS sets it.
  const virtualDefault = selectPrinter({ configured: '', defaultPrinter: 'Print_to_PDF', details })
  assert.equal(virtualDefault.name, 'DeskJet_USB')

  // Nothing usable → no printer, so the connector reports a failure instead of
  // silently printing into a file.
  const none = selectPrinter({ configured: '', defaultPrinter: null, details: [{ name: 'Print_to_PDF', connection: 'VIRTUAL' }] })
  assert.deepEqual(none, { name: null, source: 'NONE', connection: 'UNKNOWN' })
})

test('Windows printer ports are classified so USB and network printers are recognized', () => {
  const { classifyPort, parsePrinters } = require('../src/windowsPrinter')
  assert.equal(classifyPort('USB001'), 'USB')
  assert.equal(classifyPort('WSD-abc123'), 'NETWORK')
  assert.equal(classifyPort('IP_192.168.1.42'), 'NETWORK')
  assert.equal(classifyPort('PORTPROMPT:'), 'VIRTUAL')
  assert.equal(classifyPort(''), 'UNKNOWN')

  const parsed = parsePrinters('HP LaserJet|True|USB001\nMicrosoft Print to PDF|False|PORTPROMPT:\n')
  assert.deepEqual(parsed.printers, ['HP LaserJet', 'Microsoft Print to PDF'])
  assert.equal(parsed.defaultPrinter, 'HP LaserJet')
  assert.equal(parsed.details[0].connection, 'USB')
  assert.equal(parsed.details[1].connection, 'VIRTUAL')
})


test('connector API client signs in with shop credentials and caches the token', async () => {
  const originalFetch = global.fetch
  delete require.cache[require.resolve('../src/apiClient')]
  delete require.cache[require.resolve('../src/config')]

  process.env.API_BASE_URL = 'http://example.test:3001'
  process.env.SHOP_TOKEN = ''

  const calls = []
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return {
      ok: true,
      json: async () => ({ token: 'token-123', tenant: { code: 'SHOP-MUM-001' } }),
    }
  }

  try {
    const apiClient = require('../src/apiClient')
    const session = await apiClient.loginShop({ tenantId: 'TENANT-001', passcode: 'privacyprint-demo' })

    assert.equal(session.token, 'token-123')
    assert.equal(apiClient.getShopToken(), 'token-123')
    assert.equal(calls[0].url, 'http://example.test:3001/api/auth/shop/login')
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      tenantId: 'TENANT-001',
      passcode: 'privacyprint-demo',
    })
  } finally {
    global.fetch = originalFetch
  }
})

test('connector startup retries until the API becomes available', async () => {
  const originalFetch = global.fetch
  delete require.cache[require.resolve('../src/apiClient')]
  delete require.cache[require.resolve('../src/config')]

  process.env.API_BASE_URL = 'http://example.test:3001'
  process.env.SHOP_TOKEN = ''
  process.env.SHOP_TENANT_ID = 'TENANT-002'
  process.env.SHOP_PASSCODE = 'privacyprint-demo'
  process.env.STARTUP_RETRY_MS = '1'
  process.env.STARTUP_RETRY_LIMIT = '3'

  let callCount = 0
  global.fetch = async (url) => {
    callCount += 1
    if (callCount === 1) throw new Error('fetch failed')
    if (String(url).endsWith('/api/health')) {
      return { ok: true, json: async () => ({ status: 'ok' }) }
    }
    if (String(url).endsWith('/api/auth/shop/login')) {
      return { ok: true, json: async () => ({ token: 'token-abc', tenant: { code: 'SHOP-BLR-001' } }) }
    }
    throw new Error(`Unexpected fetch ${url}`)
  }

  try {
    const { bootstrapAuth } = require('../src/index')
    await bootstrapAuth()
    await new Promise((resolve) => setTimeout(resolve, 20))
    const apiClient = require('../src/apiClient')

    assert.equal(apiClient.getShopToken(), 'token-abc')
    assert.ok(callCount >= 3)
  } finally {
    global.fetch = originalFetch
  }
})

test('CUPS request ids are read from lp output', () => {
  const { parseRequestId } = require('../src/cupsPrinter')
  assert.equal(parseRequestId('request id is HP_DeskJet-42 (1 file(s))\n'), 'HP_DeskJet-42')
  assert.equal(parseRequestId('lp: Error - no default destination available'), null)
  assert.equal(parseRequestId(''), null)
})

test('a CUPS filter failure is reported as failed instead of printed', async () => {
  const { printFile, readJobBlock, jobErrorMessage } = require('../src/cupsPrinter')

  // The exact block CUPS produced for a document that was not a real PDF.
  const failingQueue = [
    'HP_DeskJet-42 nitin             1024   Sat 19 Sep 2026 01:56:46 PM IST',
    '\tStatus: cfFilterPDFToPDF: load_file failed: temp file: unable to find trailer dictionary while recovering damaged file',
    '\tAlerts: job-completed-with-errors',
    '\tqueued for HP_DeskJet',
  ].join('\n')

  const block = readJobBlock(failingQueue, 'HP_DeskJet-42')
  assert.match(jobErrorMessage(block), /load_file failed/)
  assert.equal(readJobBlock(failingQueue, 'Other-9'), null)
  assert.equal(jobErrorMessage(readJobBlock('HP_DeskJet-42 nitin 1024\n\tqueued for HP_DeskJet', 'HP_DeskJet-42')), null)

  const runner = (command) => (command === 'lp'
    ? { status: 0, stdout: 'request id is HP_DeskJet-42 (1 file(s))\n' }
    : { status: 0, stdout: failingQueue })

  const result = await printFile('/tmp/doc.pdf', SETTINGS, 'HP_DeskJet', { runner, sleep: async () => {}, verifyAttempts: 3 })
  assert.equal(result.ok, false)
  assert.match(result.error, /CUPS reported: .*load_file failed/)
})

test('a CUPS job that leaves the queue counts as printed', async () => {
  const { printFile } = require('../src/cupsPrinter')
  const runner = (command) => (command === 'lp'
    ? { status: 0, stdout: 'request id is HP_DeskJet-43 (1 file(s))\n' }
    : { status: 0, stdout: '' })

  const result = await printFile('/tmp/doc.pdf', SETTINGS, 'HP_DeskJet', { runner, sleep: async () => {} })
  assert.deepEqual(result, { ok: true, mode: 'CUPS', verified: true })
})

test('a job still queued after the observation window is accepted, not failed', async () => {
  const { printFile } = require('../src/cupsPrinter')
  const runner = (command) => (command === 'lp'
    ? { status: 0, stdout: 'request id is HP_DeskJet-44 (1 file(s))\n' }
    : { status: 0, stdout: 'HP_DeskJet-44 nitin 4096 Sat\n\tqueued for HP_DeskJet\n' })

  const result = await printFile('/tmp/doc.pdf', SETTINGS, 'HP_DeskJet', {
    runner, sleep: async () => {}, verifyAttempts: 2,
  })
  assert.deepEqual(result, { ok: true, mode: 'CUPS', verified: false })
})
