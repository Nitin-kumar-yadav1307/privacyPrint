/**
 * Real Linux/CUPS printing via `lp`.
 *
 * Security: arguments are always passed as an array to spawnSync — never a
 * shell string — and every value is whitelisted before it reaches CUPS.
 */
const { spawnSync } = require('child_process')

const PAPER_SIZES = ['A4', 'A3']
const COLOR_MODES = ['bw', 'color']
const ORIENTATIONS = ['portrait', 'landscape']

/** Assert every setting is an allowed value before it can reach `lp`. */
function validateSettings(settings) {
  const errors = []
  if (!Number.isInteger(settings.copies) || settings.copies < 1 || settings.copies > 99) {
    errors.push('copies must be an integer between 1 and 99')
  }
  if (settings.pages !== 'all' && !/^\d+(-\d+)?$/.test(String(settings.pages))) {
    errors.push('pages must be "all" or a range like "1-2"')
  }
  if (!COLOR_MODES.includes(settings.color)) errors.push('color must be "bw" or "color"')
  if (!PAPER_SIZES.includes(settings.paperSize)) errors.push('paperSize must be "A4" or "A3"')
  if (typeof settings.duplex !== 'boolean') errors.push('duplex must be true or false')
  if (!ORIENTATIONS.includes(settings.orientation)) errors.push('orientation must be portrait or landscape')
  if (errors.length > 0) throw new Error(`Invalid print settings: ${errors.join('; ')}`)
}

/**
 * Map PrivacyPrint settings to CUPS `lp` arguments.
 * The printer name always comes from trusted configuration/discovery.
 */
function buildLpArgs(settings, filePath, printerName) {
  validateSettings(settings)
  const args = ['-d', printerName, '-n', String(settings.copies)]

  if (settings.pages !== 'all') args.push('-P', String(settings.pages))
  args.push('-o', settings.color === 'bw' ? 'ColorModel=Gray' : 'ColorModel=RGB')
  args.push('-o', `media=${settings.paperSize}`)
  args.push('-o', settings.duplex ? 'sides=two-sided-long-edge' : 'sides=one-sided')
  if (settings.orientation === 'landscape') args.push('-o', 'landscape')

  // "--" ends option parsing so the file path can never be read as a flag.
  args.push('--', filePath)
  return args
}

/**
 * Parse `lpstat -p -d` output: printer queues plus the system default.
 * @returns {{printers: string[], defaultPrinter: string|null}}
 */
function parsePrinters(output) {
  const printers = []
  let defaultPrinter = null
  for (const line of String(output || '').split('\n')) {
    const printer = line.match(/^printer (\S+)/)
    if (printer) {
      printers.push(printer[1])
      continue
    }
    const fallback = line.match(/^system default destination:\s*(\S+)/)
    if (fallback) defaultPrinter = fallback[1]
  }
  return { printers, defaultPrinter }
}

/**
 * Connection kind of a CUPS device URI — this is how the connector knows a
 * shop's printer is attached over USB or reached over the network.
 *
 * Note: many modern USB printers are exposed through IPP-over-USB (the `ipp-usb`
 * daemon advertises `ipp://localhost:60000/ipp/print`), so loopback IPP counts
 * as USB. Virtual queues (cups-pdf, "Print to File") are never auto-selected.
 */
function classifyDevice(uri) {
  const value = String(uri || '').toLowerCase()
  if (!value) return 'UNKNOWN'
  if (/^cups-pdf:/.test(value) || /print-to-file|pdf-writer/.test(value)) return 'VIRTUAL'
  if (value.startsWith('usb://') || value.includes('/usb/')) return 'USB'
  if (/^ipp(s)?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(value)) return 'USB'
  if (/^(ipp|ipps|dnssd|socket|lpd|http|https|smb):\/\//.test(value)) return 'NETWORK'
  if (/^(parallel|serial):/.test(value)) return 'LOCAL'
  return 'UNKNOWN'
}

/** Parse `lpstat -v` output: { printerName: deviceUri }. */
function parseDevices(output) {
  const devices = {}
  for (const line of String(output || '').split('\n')) {
    const match = line.match(/^device for (\S+):\s*(\S+)/)
    if (match) devices[match[1]] = match[2]
  }
  return devices
}

/**
 * Enumerate every printer CUPS already knows about — USB or network. CUPS
 * itself discovers both (usb backend, Avahi/DNSSD for wireless printers), so
 * the connector inherits that discovery without any shop-side configuration.
 *
 * @returns {{available: boolean, printers: string[], defaultPrinter: string|null,
 *            details: Array<{name: string, deviceUri: string|null, connection: string}>,
 *            reason: string|null}}
 */
function discoverPrinters() {
  const listing = spawnSync('lpstat', ['-p', '-d'], { encoding: 'utf8', timeout: 5000 })
  if (listing.error || listing.status !== 0) {
    return { available: false, printers: [], defaultPrinter: null, details: [], reason: 'CUPS_UNAVAILABLE' }
  }
  const { printers, defaultPrinter } = parsePrinters(listing.stdout)

  // Device URIs are best-effort: absence only means an UNKNOWN connection type.
  const deviceResult = spawnSync('lpstat', ['-v'], { encoding: 'utf8', timeout: 5000 })
  const devices = !deviceResult.error && deviceResult.status === 0 ? parseDevices(deviceResult.stdout) : {}

  const details = printers.map((name) => ({
    name,
    deviceUri: devices[name] || null,
    connection: classifyDevice(devices[name]),
  }))

  return {
    available: printers.length > 0,
    printers,
    defaultPrinter,
    details,
    reason: printers.length > 0 ? null : 'NO_PRINTER',
  }
}

/** `lp` prints "request id is PRINTER-42 (1 file(s))" — the queue handle. */
function parseRequestId(lpStdout) {
  const match = String(lpStdout || '').match(/request id is (\S+)/i)
  return match ? match[1] : null
}

/**
 * Read the indented Status:/Alerts: block CUPS prints under a job in
 * `lpstat -l -o`, so a failed filter can be reported honestly.
 * @returns {{status: string, alerts: string, text: string}|null}
 */
function readJobBlock(lpstatOutput, requestId) {
  if (!requestId) return null
  const lines = String(lpstatOutput || '').split('\n')
  const start = lines.findIndex((line) => {
    const value = line.trim()
    return value === requestId || value.startsWith(`${requestId} `)
  })
  if (start === -1) return null

  const collected = []
  for (let i = start + 1; i < lines.length; i += 1) {
    if (!/^\s/.test(lines[i])) break // the next job starts at column 0
    collected.push(lines[i].trim())
  }

  const block = { status: '', alerts: '', text: collected.join(' ') }
  for (const line of collected) {
    if (/^Status:/i.test(line)) block.status = line.replace(/^Status:\s*/i, '')
    else if (/^Alerts:/i.test(line)) block.alerts = line.replace(/^Alerts:\s*/i, '')
  }
  return block
}

/** CUPS alerts/status text that mean the document did NOT come out. */
const CUPS_FAILURE_PATTERN = /job-completed-with-errors|job-failed|job-canceled|document-unprintable|unable to find|load_file failed/i

/**
 * Failure reason for a queue block, or null when nothing is wrong.
 * Only CUPS' own status text is used — never document contents.
 */
function jobErrorMessage(block) {
  if (!block) return null
  const text = `${block.alerts} ${block.status}`.trim()
  if (!text) return null
  return CUPS_FAILURE_PATTERN.test(text) ? block.status || block.alerts : null
}

const VERIFY_ATTEMPTS = 20
const VERIFY_DELAY_MS = 1000

/**
 * Send a document to CUPS and watch the queue briefly.
 *
 * `lp` exiting 0 only means CUPS *accepted* the job — a broken document or an
 * offline printer fails later in the filter chain. Reporting PRINTED at that
 * point would be a lie, so the job is followed until it leaves the queue (or
 * shows a CUPS failure alert). If it is still queued after the observation
 * window the job counts as accepted (`verified: false`), because slow printing
 * is not a failure.
 *
 * @returns {Promise<{ok: boolean, mode: 'CUPS', verified?: boolean, error?: string}>}
 */
async function printFile(filePath, settings, printerName, deps = {}) {
  const runner = deps.runner || spawnSync
  const sleep = deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const attempts = deps.verifyAttempts ?? VERIFY_ATTEMPTS
  const delayMs = deps.verifyDelayMs ?? VERIFY_DELAY_MS

  const args = buildLpArgs(settings, filePath, printerName)
  const result = runner('lp', args, { encoding: 'utf8', timeout: 30000 })
  if (result.error) return { ok: false, mode: 'CUPS', error: `lp failed: ${result.error.message}` }
  if (result.status !== 0) {
    // Capture the operational error without ever logging document contents.
    return { ok: false, mode: 'CUPS', error: `lp exited with status ${result.status}` }
  }

  const requestId = parseRequestId(result.stdout)
  if (!requestId) return { ok: true, mode: 'CUPS' }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const listing = runner('lpstat', ['-l', '-o'], { encoding: 'utf8', timeout: 5000 })
    if (!listing.error && listing.status === 0) {
      const block = readJobBlock(listing.stdout, requestId)
      if (!block) return { ok: true, mode: 'CUPS', verified: true } // left the queue
      const failure = jobErrorMessage(block)
      if (failure) return { ok: false, mode: 'CUPS', error: `CUPS reported: ${failure}` }
    }
    if (attempt < attempts - 1) await sleep(delayMs)
  }
  return { ok: true, mode: 'CUPS', verified: false }
}

module.exports = {
  validateSettings,
  buildLpArgs,
  parsePrinters,
  parseDevices,
  classifyDevice,
  discoverPrinters,
  parseRequestId,
  readJobBlock,
  jobErrorMessage,
  printFile,
}