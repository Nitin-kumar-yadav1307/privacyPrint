/**
 * Printer health — the difference between "CUPS has a queue" and "this printer
 * can actually accept a document".
 *
 * `lpstat -p -d` reports a queue as "idle. enabled" even when the device is
 * unplugged, switched off or out of paper. Only `lpstat -l -p <printer>` exposes
 * the real state message and alerts. Without this, a shopkeeper who forgot to
 * plug the printer in sees "Connector Online" and a job that silently never
 * prints — the exact confusion this module removes.
 *
 * Real Fedora/CUPS output for a queue whose device is gone:
 *
 *   printer HP_DeskJet_4900_series_2849E5_USB is idle.  enabled since ...
 *       gstoraster filter failed.
 *       Alerts: media-empty-report
 *
 * and for a queue whose device is unreachable:
 *
 *   The printer may not exist or is unavailable at this time.
 *
 * Parsing is pure and the runner is injectable, so all of this is testable
 * without a printer.
 */
const { spawnSync } = require('child_process')

const PRINTER_HEALTH = Object.freeze({
  OK: 'OK',
  MEDIA_EMPTY: 'MEDIA_EMPTY',
  UNREACHABLE: 'UNREACHABLE',
  ERROR: 'ERROR',
  UNKNOWN: 'UNKNOWN',
})

/** States in which sending a job would only jam the queue. */
const BLOCKING_STATES = [PRINTER_HEALTH.UNREACHABLE, PRINTER_HEALTH.MEDIA_EMPTY, PRINTER_HEALTH.ERROR]

const UNREACHABLE_PATTERNS = [
  /host is down/i,
  /may not exist or is unavailable/i,
  /connection error/i,
  /no route to host/i,
  /not connected/i,
  /offline/i,
]

const MEDIA_PATTERNS = [
  /media-empty/i,
  /media-needed/i,
  /media-jam/i,
  /out of paper/i,
  /paper-?out/i,
]

const ERROR_PATTERNS = [
  /filter failed/i,
  /crashed/i,
  /printer-error/i,
  /stopped/i,
  /toner-empty/i,
  /ink-?empty/i,
]

/**
 * Parse `lpstat -l -p [printer]` output into the fields that matter.
 * @param {string} output
 * @returns {{name: string|null, state: string|null, message: string, alerts: string, raw: string}}
 */
function parsePrinterReport(output) {
  const lines = String(output || '').split('\n')
  const report = { name: null, state: null, message: '', alerts: '', raw: String(output || '') }

  for (const line of lines) {
    const header = line.match(/^printer (\S+) is (\S+?)[.\s]/)
    if (header) {
      report.name = header[1]
      report.state = header[2]
      continue
    }
    const alerts = line.match(/^\s*(?:Alerts|printer-state-reasons):\s*(.+)$/i)
    if (alerts) {
      report.alerts = `${report.alerts} ${alerts[1]}`.trim()
      continue
    }
    const stateMessage = line.match(/^\s*printer-state-message:\s*(.+)$/i)
    if (stateMessage) {
      report.message = stateMessage[1].trim()
      continue
    }
    // Older CUPS prints the state message as the first unlabeled indented line.
    if (!report.message && /^\s+\S/.test(line) && !/^\s+\S[^:]*:/.test(line.trim()) === false) {
      // handled below
    }
    if (!report.message && /^\t\s*\S/.test(line) && !/^\t[A-Z][\w ]*:/.test(line)) {
      report.message = line.trim()
    }
  }

  return report
}

/**
 * Classify a parsed report. Unreachable wins over paper, paper over errors,
 * because that is the order in which a shopkeeper should fix things.
 * @returns {{state: string, message: string, blocking: boolean}}
 */
function classifyPrinterHealth(report) {
  const haystack = `${report?.message || ''} ${report?.alerts || ''}`
  const state = report?.state || null

  if (UNREACHABLE_PATTERNS.some((pattern) => pattern.test(haystack)) || state === 'stopped') {
    return { state: PRINTER_HEALTH.UNREACHABLE, message: report?.message || report?.alerts || 'Printer is unreachable', blocking: true }
  }
  if (MEDIA_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { state: PRINTER_HEALTH.MEDIA_EMPTY, message: report?.message || report?.alerts || 'Printer needs paper', blocking: true }
  }
  if (ERROR_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return { state: PRINTER_HEALTH.ERROR, message: report?.message || report?.alerts || 'Printer reported an error', blocking: true }
  }
  if (!report?.name) {
    return { state: PRINTER_HEALTH.UNKNOWN, message: '', blocking: false }
  }
  return { state: PRINTER_HEALTH.OK, message: report.message || '', blocking: false }
}

/**
 * Ask CUPS how a single queue is doing.
 * @param {string} printerName
 * @param {{runner?: Function}} [deps]
 * @returns {{state: string, message: string, blocking: boolean}}
 */
function checkPrinterHealth(printerName, deps = {}) {
  const runner = deps.runner || spawnSync
  if (!printerName) {
    return { state: PRINTER_HEALTH.UNKNOWN, message: '', blocking: false }
  }

  const result = runner('lpstat', ['-l', '-p', printerName], { encoding: 'utf8', timeout: 5000 })
  if (result?.error || result?.status !== 0) {
    // No lpstat (e.g. Windows) or CUPS unreachable: report unknown, never block.
    return { state: PRINTER_HEALTH.UNKNOWN, message: '', blocking: false }
  }

  return classifyPrinterHealth(parsePrinterReport(result.stdout))
}

/** Human-readable explanation for a blocking health state. */
function healthFailureReason(health, printerName) {
  const target = printerName ? ` "${printerName}"` : ''
  if (health.state === PRINTER_HEALTH.UNREACHABLE) {
    return `Printer${target} is not reachable (${health.message || 'device unavailable'}) — check that it is switched on and connected, then retry`
  }
  if (health.state === PRINTER_HEALTH.MEDIA_EMPTY) {
    return `Printer${target} needs paper (${health.message || 'media-empty'}) — load paper and retry`
  }
  return `Printer${target} reported an error (${health.message || 'unknown'}) — fix the printer and retry`
}

module.exports = {
  PRINTER_HEALTH,
  BLOCKING_STATES,
  parsePrinterReport,
  classifyPrinterHealth,
  checkPrinterHealth,
  healthFailureReason,
}
